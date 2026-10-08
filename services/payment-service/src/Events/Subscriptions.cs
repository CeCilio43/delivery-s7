using System.Globalization;
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

    // There's no real payment provider yet. This stand-in approves every charge
    // up to PAYMENT_DECLINE_ABOVE and declines anything larger, so both the
    // success and failure paths of the order flow can be exercised on demand.
    private static decimal DeclineLimit(IConfiguration configuration) =>
        decimal.TryParse(configuration["PAYMENT_DECLINE_ABOVE"], NumberStyles.Float, CultureInfo.InvariantCulture, out var limit)
            ? limit
            : 100;

    public static async Task HandleOrderCreatedAsync(IServiceProvider services, OrderCreatedEvent e)
    {
        var db = services.GetRequiredService<PaymentDb>();
        var bus = services.GetRequiredService<IEventBus>();

        // RabbitMQ delivers at-least-once; never charge the same order twice.
        if (await db.Transactions.AnyAsync(t => t.OrderId == e.OrderId)) return;

        var transaction = new Transaction { OrderId = e.OrderId, CustomerId = e.CustomerId, Amount = e.Total };
        db.Transactions.Add(transaction);
        await db.SaveChangesAsync();

        var limit = DeclineLimit(services.GetRequiredService<IConfiguration>());
        if (e.Total > limit)
        {
            transaction.Status = PaymentStatus.Failed;
            await db.SaveChangesAsync();
            var reason = string.Create(CultureInfo.InvariantCulture, $"Amount {e.Total:F2} exceeds the card limit of {limit:F2}");
            await bus.PublishAsync(RoutingKeys.PaymentFailed, new PaymentFailedEvent(transaction.Id, e.OrderId, reason, Clock.IsoNow()));
            return;
        }

        transaction.Status = PaymentStatus.Succeeded;
        transaction.ProviderRef = $"sim_{Guid.NewGuid()}";
        await db.SaveChangesAsync();
        await bus.PublishAsync(RoutingKeys.PaymentSucceeded, new PaymentSucceededEvent(transaction.Id, e.OrderId, e.Total, Clock.IsoNow()));
    }

    // A customer can cancel an order after it was paid for; refund it then.
    public static async Task HandleOrderCancelledAsync(IServiceProvider services, OrderCancelledEvent e)
    {
        await services.GetRequiredService<PaymentDb>().Transactions
            .Where(t => t.OrderId == e.OrderId && t.Status == PaymentStatus.Succeeded)
            .ExecuteUpdateAsync(set => set
                .SetProperty(t => t.Status, PaymentStatus.Refunded)
                .SetProperty(t => t.UpdatedAt, Clock.Now()));
    }
}
