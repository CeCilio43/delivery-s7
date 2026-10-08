namespace Delivery.Common.Events;

// Payloads of every event on the bus, one definition shared by publishers
// and consumers. They mirror the JSON contracts under libs/events; keep the
// two in sync. Timestamps are ISO 8601 strings, amounts plain JSON numbers.

public static class RoutingKeys
{
    public const string OrderCreated = "order.created";
    public const string OrderConfirmed = "order.confirmed";
    public const string OrderPreparing = "order.preparing";
    public const string OrderReady = "order.ready";
    public const string OrderCancelled = "order.cancelled";
    public const string PaymentSucceeded = "payment.succeeded";
    public const string PaymentFailed = "payment.failed";
    public const string RestaurantCreated = "restaurant.created";
    public const string RestaurantUpdated = "restaurant.updated";
    public const string RestaurantOrderReceived = "restaurant.order_received";
}

public record OrderCreatedEvent(
    string OrderId,
    string CustomerId,
    string RestaurantId,
    IReadOnlyList<OrderCreatedItem> Items,
    decimal Total,
    string CreatedAt);

public record OrderCreatedItem(string MenuItemId, int Quantity, decimal Price);

// Every status change after creation names both parties, so
// notification-service can tell the customer and the restaurant owner.
// RestaurantOwnerId is null while the order is unpaid (the restaurant isn't
// involved yet) or if order-service doesn't know the owner.

public record OrderConfirmedEvent(
    string OrderId,
    string CustomerId,
    string RestaurantId,
    string? RestaurantOwnerId,
    string ConfirmedAt);

public record OrderPreparingEvent(
    string OrderId,
    string CustomerId,
    string RestaurantId,
    string? RestaurantOwnerId,
    string PreparingAt);

public record OrderReadyEvent(
    string OrderId,
    string CustomerId,
    string RestaurantId,
    string? RestaurantOwnerId,
    string ReadyAt);

public record OrderCancelledEvent(
    string OrderId,
    string CustomerId,
    string RestaurantId,
    string? RestaurantOwnerId,
    string Reason,
    string CancelledAt);

public record PaymentSucceededEvent(string PaymentId, string OrderId, decimal Amount, string SucceededAt);

public record PaymentFailedEvent(string PaymentId, string OrderId, string Reason, string FailedAt);

/// <summary>Published as restaurant.created and restaurant.updated.</summary>
public record RestaurantChangedEvent(string RestaurantId, string OwnerId, string Name, bool IsOpen, string ChangedAt);

public record RestaurantOrderReceivedEvent(string OrderId, string RestaurantId, string ReceivedAt);
