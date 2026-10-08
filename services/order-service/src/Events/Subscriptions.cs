using Delivery.Common;
using Delivery.Common.Events;
using Microsoft.EntityFrameworkCore;
using OrderService.Data;

namespace OrderService.Events;

public class Subscriptions(IEventBus bus, IServiceScopeFactory scopes, ILogger<Subscriptions> logger)
    : EventSubscriber(bus, scopes, logger)
{
    protected override async Task SubscribeAsync(CancellationToken cancellationToken)
    {
        await On<PaymentSucceededEvent>("order-service.payment.succeeded", RoutingKeys.PaymentSucceeded, HandlePaymentSucceededAsync, cancellationToken);
        await On<PaymentFailedEvent>("order-service.payment.failed", RoutingKeys.PaymentFailed, HandlePaymentFailedAsync, cancellationToken);
        await On<RestaurantChangedEvent>("order-service.restaurant.created", RoutingKeys.RestaurantCreated, HandleRestaurantChangedAsync, cancellationToken);
        await On<RestaurantChangedEvent>("order-service.restaurant.updated", RoutingKeys.RestaurantUpdated, HandleRestaurantChangedAsync, cancellationToken);
    }

    // Payment outcomes only move an order that is still PLACED, so a redelivered
    // event or one that arrives after the customer cancelled is a no-op.

    public static async Task HandlePaymentSucceededAsync(IServiceProvider services, PaymentSucceededEvent e)
    {
        var db = services.GetRequiredService<OrderDb>();
        var now = Clock.Now();
        var updated = await db.Orders
            .Where(o => o.Id == e.OrderId && o.Status == OrderStatus.Placed)
            .ExecuteUpdateAsync(set => set
                .SetProperty(o => o.Status, OrderStatus.Confirmed)
                .SetProperty(o => o.ConfirmedAt, now)
                .SetProperty(o => o.UpdatedAt, now));
        if (updated == 0) return;

        var order = await db.Orders.SingleAsync(o => o.Id == e.OrderId);
        await services.GetRequiredService<OrderEvents>().PublishConfirmedAsync(order);
    }

    public static async Task HandlePaymentFailedAsync(IServiceProvider services, PaymentFailedEvent e)
    {
        var db = services.GetRequiredService<OrderDb>();
        var updated = await db.Orders
            .Where(o => o.Id == e.OrderId && o.Status == OrderStatus.Placed)
            .ExecuteUpdateAsync(set => set
                .SetProperty(o => o.Status, OrderStatus.Cancelled)
                .SetProperty(o => o.UpdatedAt, Clock.Now()));
        if (updated == 0) return;

        var order = await db.Orders.SingleAsync(o => o.Id == e.OrderId);
        await services.GetRequiredService<OrderEvents>().PublishCancelledAsync(order, $"Payment failed: {e.Reason}");
    }

    // Keeps this service's copy of restaurant ownership current. Upserting makes
    // redelivered events and restaurant-service's startup snapshot harmless.
    public static async Task HandleRestaurantChangedAsync(IServiceProvider services, RestaurantChangedEvent e)
    {
        var db = services.GetRequiredService<OrderDb>();
        var restaurant = await db.RestaurantProjections.FindAsync(e.RestaurantId);
        if (restaurant is null)
        {
            db.RestaurantProjections.Add(new RestaurantProjection { Id = e.RestaurantId, OwnerId = e.OwnerId, Name = e.Name });
        }
        else
        {
            restaurant.OwnerId = e.OwnerId;
            restaurant.Name = e.Name;
        }
        await db.SaveChangesAsync();
    }
}
