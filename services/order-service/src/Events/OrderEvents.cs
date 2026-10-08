using Delivery.Common;
using Delivery.Common.Events;
using OrderService.Data;

namespace OrderService.Events;

/// <summary>Publishes an order's status changes to the customer's and the restaurant owner's side.</summary>
public class OrderEvents(IEventBus bus, OrderDb db, ILogger<OrderEvents> logger)
{
    public async Task PublishConfirmedAsync(Order order)
    {
        var owner = await OwnerToNotifyAsync(order);
        await bus.PublishAsync(RoutingKeys.OrderConfirmed,
            new OrderConfirmedEvent(order.Id, order.CustomerId, order.RestaurantId, owner, Clock.IsoNow()));
    }

    public async Task PublishPreparingAsync(Order order)
    {
        var owner = await OwnerToNotifyAsync(order);
        await bus.PublishAsync(RoutingKeys.OrderPreparing,
            new OrderPreparingEvent(order.Id, order.CustomerId, order.RestaurantId, owner, Clock.IsoNow()));
    }

    public async Task PublishReadyAsync(Order order)
    {
        var owner = await OwnerToNotifyAsync(order);
        await bus.PublishAsync(RoutingKeys.OrderReady,
            new OrderReadyEvent(order.Id, order.CustomerId, order.RestaurantId, owner, Clock.IsoNow()));
    }

    public async Task PublishCancelledAsync(Order order, string reason)
    {
        var owner = await OwnerToNotifyAsync(order);
        await bus.PublishAsync(RoutingKeys.OrderCancelled,
            new OrderCancelledEvent(order.Id, order.CustomerId, order.RestaurantId, owner, reason, Clock.IsoNow()));
    }

    /// <summary>
    /// For changes that are already committed: a failed publish only delays what
    /// other services do in reaction (notifications, refunds), so it's logged
    /// instead of failing the request.
    /// </summary>
    public async Task PublishSafelyAsync(Func<Task> publish)
    {
        try
        {
            await publish();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to publish order event");
        }
    }

    // The restaurant only gets involved once an order is paid, so events about
    // unpaid orders (e.g. a declined payment) carry no owner and the owner is
    // never told about an order they never saw.
    private async Task<string?> OwnerToNotifyAsync(Order order)
    {
        if (order.ConfirmedAt is null) return null;

        var restaurant = await db.RestaurantProjections.FindAsync(order.RestaurantId);
        if (restaurant is null)
        {
            logger.LogWarning("No known owner for restaurant {RestaurantId}; only the customer is notified", order.RestaurantId);
        }
        return restaurant?.OwnerId;
    }
}
