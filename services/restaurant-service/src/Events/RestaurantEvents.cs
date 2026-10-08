using Delivery.Common;
using Delivery.Common.Events;
using Microsoft.EntityFrameworkCore;
using RestaurantService.Data;

namespace RestaurantService.Events;

/// <summary>
/// Publishes restaurant.created / restaurant.updated. Other services keep
/// their own copy of who owns which restaurant from these (order-service
/// uses it to authorize owners), so every change that touches these fields
/// must be published.
/// </summary>
public class RestaurantEvents(IEventBus bus, ILogger<RestaurantEvents> logger)
{
    public Task PublishCreatedAsync(Restaurant restaurant) =>
        bus.PublishAsync(RoutingKeys.RestaurantCreated, ToEvent(restaurant));

    public Task PublishUpdatedAsync(Restaurant restaurant) =>
        bus.PublishAsync(RoutingKeys.RestaurantUpdated, ToEvent(restaurant));

    /// <summary>
    /// Publishes the current state of every restaurant. Run at startup so that
    /// consumers also learn about restaurants created before they subscribed
    /// (e.g. seeded data); consumers upsert, so repeating this is harmless.
    /// </summary>
    public async Task PublishSnapshotAsync(RestaurantDb db)
    {
        foreach (var restaurant in await db.Restaurants.AsNoTracking().ToListAsync())
        {
            await PublishUpdatedAsync(restaurant);
        }
    }

    /// <summary>
    /// Restaurant changes are committed before they're published; a failed
    /// publish is logged rather than failing the request, and the startup
    /// snapshot brings consumers back in sync.
    /// </summary>
    public async Task PublishSafelyAsync(Func<Task> publish)
    {
        try
        {
            await publish();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to publish restaurant event");
        }
    }

    private static RestaurantChangedEvent ToEvent(Restaurant restaurant) =>
        new(restaurant.Id, restaurant.OwnerId, restaurant.Name, restaurant.IsOpen, Clock.IsoNow());
}
