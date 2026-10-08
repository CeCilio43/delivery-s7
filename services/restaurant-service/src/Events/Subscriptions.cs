using Delivery.Common;
using Delivery.Common.Events;
using RestaurantService.Data;

namespace RestaurantService.Events;

public class Subscriptions(IEventBus bus, IServiceScopeFactory scopes, ILogger<Subscriptions> logger)
    : EventSubscriber(bus, scopes, logger)
{
    protected override async Task SubscribeAsync(CancellationToken cancellationToken)
    {
        await On<OrderConfirmedEvent>("restaurant-service.order.confirmed", RoutingKeys.OrderConfirmed,
            (_, e) => HandleOrderConfirmedAsync(e), cancellationToken);

        // Lets other services (re)build their copy of restaurant ownership, e.g.
        // for restaurants that were seeded rather than created through the API.
        try
        {
            await using var scope = Scopes.CreateAsyncScope();
            var services = scope.ServiceProvider;
            await services.GetRequiredService<RestaurantEvents>().PublishSnapshotAsync(services.GetRequiredService<RestaurantDb>());
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Failed to publish the restaurant snapshot");
        }
    }

    // Once an order is paid for, it lands in the restaurant's queue; receiving it
    // is acknowledged on the bus.
    private async Task HandleOrderConfirmedAsync(OrderConfirmedEvent e)
    {
        Logger.LogInformation("Restaurant {RestaurantId} received order {OrderId}", e.RestaurantId, e.OrderId);
        await Bus.PublishAsync(RoutingKeys.RestaurantOrderReceived, new RestaurantOrderReceivedEvent(e.OrderId, e.RestaurantId, Clock.IsoNow()));
    }
}
