using Delivery.Common;
using Delivery.Common.Events;
using Microsoft.EntityFrameworkCore;
using PaymentService.Data;

namespace PaymentService.Events;

public class Subscriptions(IEventBus bus, IServiceScopeFactory scopes, ILogger<Subscriptions> logger)
    : EventSubscriber(bus, scopes, logger)
{
    protected override async Task SubscribeAsync(CancellationToken cancellationToken)
    {
        await On<OrderCreatedEvent>("payment-service.order.created", RoutingKeys.OrderCreated, HandleOrderCreatedAsync, cancellationToken);
        await On<OrderCancelledEvent>("payment-service.order.cancelled", RoutingKeys.OrderCancelled, HandleOrderCancelledAsync, cancellationToken);
    }

    // A new order gets a pending payment for its total; the customer then pays
    // it with "Pay now" (POST /payments/{id}/pay).
    public static async Task HandleOrderCreatedAsync(IServiceProvider services, OrderCreatedEvent e)
    {
        var db = services.GetRequiredService<PaymentDb>();

        // RabbitMQ delivers at-least-once; never create two payments for one order.
        if (await db.Transactions.AnyAsync(t => t.OrderId == e.OrderId)) return;

        db.Transactions.Add(new Transaction { OrderId = e.OrderId, CustomerId = e.CustomerId, Amount = e.Total });
        await db.SaveChangesAsync();
    }

    // A paid order that's cancelled is refunded; an unpaid one can no longer be paid.
    public static async Task HandleOrderCancelledAsync(IServiceProvider services, OrderCancelledEvent e)
    {
        var transactions = services.GetRequiredService<PaymentDb>().Transactions.Where(t => t.OrderId == e.OrderId);
        var now = Clock.Now();

        await transactions
            .Where(t => t.Status == PaymentStatus.Succeeded)
            .ExecuteUpdateAsync(set => set.SetProperty(t => t.Status, PaymentStatus.Refunded).SetProperty(t => t.UpdatedAt, now));
        await transactions
            .Where(t => t.Status == PaymentStatus.Pending)
            .ExecuteUpdateAsync(set => set.SetProperty(t => t.Status, PaymentStatus.Cancelled).SetProperty(t => t.UpdatedAt, now));
    }
}
