using System.Text.Json.Nodes;
using Delivery.Common;
using Delivery.Common.Events;
using Delivery.Common.Http;
using Delivery.Common.Json;
using Microsoft.EntityFrameworkCore;
using OrderService.Data;
using OrderService.Events;

namespace OrderService.Routes;

/// <summary>Customers placing and following their own orders (/orders/...).</summary>
public static class OrderRoutes
{
    // Once the restaurant has started preparing, only the restaurant can cancel.
    private static readonly OrderStatus[] CancellableStatuses = [OrderStatus.Placed, OrderStatus.Confirmed];

    public static void MapOrderRoutes(this IEndpointRouteBuilder app)
    {
        var orders = app.MapGroup("/orders").RequireUser();

        orders.MapPost("", PlaceOrder);

        orders.MapGet("", async (HttpContext context, OrderDb db) =>
            await db.Orders
                .Include(o => o.Lines)
                .Where(o => o.CustomerId == context.UserId())
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync());

        orders.MapGet("/{id}", async (string id, HttpContext context, OrderDb db) =>
        {
            var order = await db.Orders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == id && o.CustomerId == context.UserId());
            return order is null ? OrderNotFound() : Results.Ok(order);
        });

        orders.MapPost("/{id}/cancel", async (string id, HttpContext context, OrderDb db, OrderEvents events) =>
        {
            var customerId = context.UserId();

            // Conditional update so a concurrent payment.succeeded / cancel can't
            // race this into an invalid transition.
            var cancelled = await db.Orders
                .Where(o => o.Id == id && o.CustomerId == customerId && CancellableStatuses.Contains(o.Status))
                .ExecuteUpdateAsync(set => set
                    .SetProperty(o => o.Status, OrderStatus.Cancelled)
                    .SetProperty(o => o.UpdatedAt, Clock.Now()));

            var order = await db.Orders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == id && o.CustomerId == customerId);
            if (order is null) return OrderNotFound();
            if (cancelled == 0)
            {
                return Results.Conflict(new { error = $"Order cannot be cancelled while {order.Status.ToApiName()}" });
            }

            await events.PublishSafelyAsync(() => events.PublishCancelledAsync(order, "Cancelled by customer"));
            return Results.Ok(order);
        });
    }

    private static async Task<IResult> PlaceOrder(
        HttpContext context, OrderDb db, RestaurantClient restaurants, IEventBus bus, ILogger<RestaurantClient> logger)
    {
        var body = await JsonBody.ReadAsync(context.Request) as JsonObject;
        var restaurantId = body?["restaurantId"].AsString();
        if (restaurantId is null || body?["items"] is not JsonArray items || items.Count == 0)
        {
            return Results.BadRequest(new { error = "restaurantId and a non-empty items array are required" });
        }

        var requested = new List<(string MenuItemId, int Quantity)>();
        foreach (var item in items)
        {
            var menuItemId = (item as JsonObject)?["menuItemId"].AsString();
            var quantity = (item as JsonObject)?["quantity"].AsDecimal();
            if (menuItemId is null || quantity is not { } count || count < 1 || count != decimal.Truncate(count) || count > int.MaxValue)
            {
                return Results.BadRequest(new { error = "Each item needs a menuItemId and a positive integer quantity" });
            }
            requested.Add((menuItemId, (int)count));
        }

        RestaurantMenu? restaurant;
        try
        {
            restaurant = await restaurants.GetMenuAsync(restaurantId, context.RequestAborted);
        }
        catch (Exception ex) when (!context.RequestAborted.IsCancellationRequested)
        {
            logger.LogError(ex, "Failed to fetch restaurant menu");
            return Results.Json(new { error = "Could not reach restaurant-service" }, statusCode: StatusCodes.Status502BadGateway);
        }

        if (restaurant is null) return Results.NotFound(new { error = "Restaurant not found" });
        if (!restaurant.IsOpen) return Results.Conflict(new { error = "Restaurant is currently closed" });

        var lines = new List<OrderLine>();
        foreach (var (menuItemId, quantity) in requested)
        {
            var menuItem = restaurant.MenuItems.FirstOrDefault(m => m.Id == menuItemId);
            if (menuItem is null || !menuItem.IsAvailable)
            {
                return Results.UnprocessableEntity(new { error = $"Menu item {menuItemId} is not available at this restaurant" });
            }
            lines.Add(new OrderLine { MenuItemId = menuItem.Id, Name = menuItem.Name, UnitPrice = menuItem.Price, Quantity = quantity });
        }

        var order = new Order
        {
            CustomerId = context.UserId(),
            RestaurantId = restaurantId,
            TotalAmount = lines.Sum(line => line.UnitPrice * line.Quantity),
            Lines = lines,
        };
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        var created = new OrderCreatedEvent(
            order.Id,
            order.CustomerId,
            order.RestaurantId,
            [.. lines.Select(line => new OrderCreatedItem(line.MenuItemId, line.Quantity, line.UnitPrice))],
            order.TotalAmount,
            Clock.ToIso(order.CreatedAt));

        try
        {
            await bus.PublishAsync(RoutingKeys.OrderCreated, created);
        }
        catch (Exception ex)
        {
            // Without order.created no payment is ever attempted, so leaving the
            // order PLACED would strand it. Cancel it and let the client retry.
            logger.LogError(ex, "Failed to publish order.created event");
            order.Status = OrderStatus.Cancelled;
            await db.SaveChangesAsync();
            return Results.Json(new { error = "Could not reach the event bus; the order was not placed" }, statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        return Results.Json(order, statusCode: StatusCodes.Status201Created);
    }

    private static IResult OrderNotFound() => Results.NotFound(new { error = "Order not found" });
}
