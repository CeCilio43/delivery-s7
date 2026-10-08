using Delivery.Common.Http;
using Microsoft.EntityFrameworkCore;
using PaymentService.Data;

namespace PaymentService.Routes;

/// <summary>
/// Read-only: payments are created by the order.created event handler, never
/// directly by a client.
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
    }
}
