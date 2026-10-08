using System.Text.Json.Nodes;
using Delivery.Common;
using Delivery.Common.Http;
using Delivery.Common.Json;
using Microsoft.EntityFrameworkCore;
using OrderService.Data;
using OrderService.Events;

namespace OrderService.Routes;

/// <summary>
/// A restaurant owner working through their restaurants' orders. Reached
/// through the api-gateway at /owner/orders, which only lets RESTAURANT_OWNER
/// tokens through. Ownership comes from RestaurantProjection, this service's
/// copy of restaurant-service's data.
/// </summary>
public static class OwnerRoutes
{
    private const int MaxReasonLength = 200;
    private const int OrderListLimit = 200;

    private static readonly Dictionary<string, OrderStatus> StatusesByName =
        Enum.GetValues<OrderStatus>().ToDictionary(status => status.ToApiName());

    public static void MapOwnerRoutes(this IEndpointRouteBuilder app)
    {
        var owner = app.MapGroup("/owner/orders").RequireOwner();

        owner.MapGet("", async (HttpContext context, OrderDb db) =>
        {
            var query = context.Request.Query;
            var statuses = ParseStatuses(query["status"]);
            if (statuses is { Error: true })
            {
                return Results.BadRequest(new { error = $"status must be a comma-separated list of {string.Join(", ", StatusesByName.Keys)}" });
            }

            var restaurantIds = await OwnedRestaurantIdsAsync(db, context.UserId());
            if (query["restaurantId"] is { Count: 1 } requested)
            {
                if (!restaurantIds.Contains(requested.ToString())) return Results.NotFound(new { error = "Restaurant not found" });
                restaurantIds = [requested.ToString()];
            }

            var orders = db.Orders
                .Include(o => o.Lines)
                // Only paid orders reach the restaurant; unpaid or declined ones don't.
                .Where(o => restaurantIds.Contains(o.RestaurantId) && o.ConfirmedAt != null);
            if (statuses?.Values is { } wanted) orders = orders.Where(o => wanted.Contains(o.Status));

            return Results.Ok(await orders.OrderBy(o => o.ConfirmedAt).Take(OrderListLimit).ToListAsync());
        });

        owner.MapGet("/{id}", async (string id, HttpContext context, OrderDb db) =>
            await FindOwnedAsync(db, id, context.UserId()) is { } order ? Results.Ok(order) : OrderNotFound());

        // Accepting a paid order means the kitchen starts on it.
        owner.MapPost("/{id}/accept", (string id, HttpContext context, OrderDb db, OrderEvents events) =>
            TransitionAsync(db, id, context.UserId(), [OrderStatus.Confirmed], OrderStatus.Preparing, "accepted", events.PublishPreparingAsync, events));

        owner.MapPost("/{id}/ready", (string id, HttpContext context, OrderDb db, OrderEvents events) =>
            TransitionAsync(db, id, context.UserId(), [OrderStatus.Preparing], OrderStatus.Ready, "marked ready", events.PublishReadyAsync, events));

        // Rejecting cancels the order; payment-service refunds it on order.cancelled.
        owner.MapPost("/{id}/reject", async (string id, HttpContext context, OrderDb db, OrderEvents events) =>
        {
            var body = await JsonBody.ReadAsync(context.Request) as JsonObject;
            string detail = "";
            if (body is not null && body.ContainsKey("reason"))
            {
                if (body["reason"].AsString() is not { } raw) return Results.BadRequest(new { error = "reason must be a string" });
                detail = raw.Trim();
            }
            if (detail.Length > MaxReasonLength)
            {
                return Results.BadRequest(new { error = $"reason must be at most {MaxReasonLength} characters" });
            }
            var reason = detail.Length > 0 ? $"Rejected by the restaurant: {detail}" : "Rejected by the restaurant";

            return await TransitionAsync(db, id, context.UserId(), [OrderStatus.Confirmed, OrderStatus.Preparing], OrderStatus.Cancelled,
                "rejected", order => events.PublishCancelledAsync(order, reason), events);
        });
    }

    private static async Task<List<string>> OwnedRestaurantIdsAsync(OrderDb db, string ownerId) =>
        await db.RestaurantProjections.Where(r => r.OwnerId == ownerId).Select(r => r.Id).ToListAsync();

    /// <summary>
    /// The statuses in a ?status=CONFIRMED,PREPARING filter: null when there is no
    /// filter, Error when it names an unknown status.
    /// </summary>
    private static (bool Error, OrderStatus[]? Values)? ParseStatuses(Microsoft.Extensions.Primitives.StringValues value)
    {
        if (value.Count == 0) return null;
        if (value.Count > 1) return (true, null);

        var statuses = new List<OrderStatus>();
        foreach (var name in value.ToString().Split(',').Select(s => s.Trim()))
        {
            if (!StatusesByName.TryGetValue(name, out var status)) return (true, null);
            statuses.Add(status);
        }
        return (false, [.. statuses]);
    }

    // Another restaurant's order is a 404 rather than a 403, so ids can't be probed.
    private static async Task<Order?> FindOwnedAsync(OrderDb db, string id, string ownerId)
    {
        var restaurantIds = await OwnedRestaurantIdsAsync(db, ownerId);
        return await db.Orders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Id == id && restaurantIds.Contains(o.RestaurantId) && o.ConfirmedAt != null);
    }

    /// <summary>
    /// Moves one of the owner's orders from one of <paramref name="from"/> to
    /// <paramref name="to"/>, then publishes. The update is conditional on the
    /// current status, so two concurrent actions (e.g. the customer cancelling
    /// while the owner accepts) can't both succeed.
    /// </summary>
    private static async Task<IResult> TransitionAsync(
        OrderDb db, string id, string ownerId, OrderStatus[] from, OrderStatus to, string verb, Func<Order, Task> publish, OrderEvents events)
    {
        var owned = await FindOwnedAsync(db, id, ownerId);
        if (owned is null) return OrderNotFound();

        var moved = await db.Orders
            .Where(o => o.Id == owned.Id && from.Contains(o.Status))
            .ExecuteUpdateAsync(set => set
                .SetProperty(o => o.Status, to)
                .SetProperty(o => o.UpdatedAt, Clock.Now()));

        // The bulk update bypassed the tracked entity, so read the order afresh.
        db.ChangeTracker.Clear();
        var order = await db.Orders.Include(o => o.Lines).SingleAsync(o => o.Id == owned.Id);
        if (moved == 0)
        {
            return Results.Conflict(new { error = $"Order cannot be {verb} while {order.Status.ToApiName()}" });
        }

        await events.PublishSafelyAsync(() => publish(order));
        return Results.Ok(order);
    }

    private static IResult OrderNotFound() => Results.NotFound(new { error = "Order not found" });
}
