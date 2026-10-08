using System.Text.Json;
using System.Text.Json.Serialization;
using Delivery.Common.Events;

namespace NotificationService;

/// <summary>What the customer-app receives when one of its orders changes status.</summary>
public record OrderUpdatedNotification(
    string OrderId,
    string Status,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Reason)
{
    [JsonPropertyOrder(-1)]
    public string Type => "order.updated";
}

/// <summary>What the restaurant-app receives when one of its restaurants' orders changes.</summary>
public record RestaurantOrderUpdatedNotification(
    string OrderId,
    string RestaurantId,
    string Status,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Reason)
{
    [JsonPropertyOrder(-1)]
    public string Type => "restaurant.order_updated";
}

/// <summary>
/// Listens to every service's events on private queues (each replica pushes
/// to its own connected clients) and pushes order status changes to the
/// customer and the restaurant owner.
/// </summary>
public class Subscriptions(IEventBus bus, INotificationSender sender, IServiceScopeFactory scopes, ILogger<Subscriptions> logger)
    : EventSubscriber(bus, scopes, logger)
{
    private static readonly Dictionary<string, string> PushedEvents = new()
    {
        [RoutingKeys.OrderConfirmed] = "CONFIRMED",
        [RoutingKeys.OrderPreparing] = "PREPARING",
        [RoutingKeys.OrderReady] = "READY",
        [RoutingKeys.OrderCancelled] = "CANCELLED",
    };

    // Events nobody is pushed for; logged so the whole flow is visible in this
    // service's output.
    private static readonly string[] LoggedOnlyEvents =
    [
        RoutingKeys.OrderCreated,
        RoutingKeys.PaymentSucceeded,
        RoutingKeys.PaymentFailed,
        RoutingKeys.RestaurantOrderReceived,
        RoutingKeys.RestaurantCreated,
        RoutingKeys.RestaurantUpdated,
    ];

    protected override async Task SubscribeAsync(CancellationToken cancellationToken)
    {
        foreach (var (routingKey, status) in PushedEvents)
        {
            await Bus.SubscribeExclusiveAsync(routingKey, payload => NotifyOrderStatusAsync(sender, payload, status), cancellationToken);
        }

        foreach (var routingKey in LoggedOnlyEvents)
        {
            await Bus.SubscribeExclusiveAsync(routingKey, payload =>
            {
                Logger.LogInformation("Received {RoutingKey} event {Payload}", routingKey, payload.GetRawText());
                return Task.CompletedTask;
            }, cancellationToken);
        }
    }

    /// <summary>Tells both parties of an order about its new status, each only their own.</summary>
    public static async Task NotifyOrderStatusAsync(INotificationSender sender, JsonElement payload, string status)
    {
        string? Text(string name) =>
            payload.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

        var orderId = Text("orderId")!;
        var reason = string.IsNullOrEmpty(Text("reason")) ? null : Text("reason");

        await sender.SendToUserAsync(Text("customerId")!, new OrderUpdatedNotification(orderId, status, reason));

        if (Text("restaurantOwnerId") is { Length: > 0 } ownerId)
        {
            await sender.SendToUserAsync(ownerId, new RestaurantOrderUpdatedNotification(orderId, Text("restaurantId")!, status, reason));
        }
    }
}
