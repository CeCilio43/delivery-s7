using Delivery.Common.Http;
using Delivery.Common.Json;
using Microsoft.EntityFrameworkCore;
using PaymentService.Data;

namespace PaymentService.Routes;

/// <summary>
/// Payments are created (pending) by the order.created event handler, never
/// directly by a client; the customer then pays one with "Pay now".
/// </summary>
public static class PaymentRoutes
{
    public static void MapPaymentRoutes(this IEndpointRouteBuilder app)
    {
        var payments = app.MapGroup("/payments").RequireUser();

        payments.MapGet("", async (string? orderId, HttpContext context, PaymentDb db) =>
        {
            var query = db.Transactions.Where(t => t.CustomerId == context.UserId());
            if (!string.IsNullOrEmpty(orderId)) query = query.Where(t => t.OrderId == orderId);
            return await query.OrderByDescending(t => t.CreatedAt).ToListAsync();
        });

        payments.MapGet("/{id}", async (string id, HttpContext context, PaymentDb db) =>
        {
            var payment = await db.Transactions.FirstOrDefaultAsync(t => t.Id == id && t.CustomerId == context.UserId());
            return payment is null ? Results.NotFound(new { error = "Payment not found" }) : Results.Ok(payment);
        });

        // "Pay now": charges the pending payment with the mock provider.
        payments.MapPost("/{id}/pay", async (string id, HttpContext context, PaymentDb db, MockPaymentProvider provider) =>
        {
            var payment = await db.Transactions.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id && t.CustomerId == context.UserId());
            if (payment is null) return Results.NotFound(new { error = "Payment not found" });

            switch (await provider.ChargeAsync(payment))
            {
                case ChargeResult.NotPending:
                    var current = await db.Transactions.AsNoTracking().SingleAsync(t => t.Id == id);
                    return Results.Conflict(new { error = $"This payment can't be paid while {current.Status.ToApiName()}" });
                case ChargeResult.EventBusUnavailable:
                    return Results.Json(new { error = "Could not process the payment right now; please try again" },
                        statusCode: StatusCodes.Status503ServiceUnavailable);
                default:
                    return Results.Ok(await db.Transactions.AsNoTracking().SingleAsync(t => t.Id == id));
            }
        });
    }
}
