using System.Text.Json;
using Delivery.Common.Events;
using Microsoft.EntityFrameworkCore;
using OrderService.Data;

namespace OrderService.Tests;

public sealed class EventHandlerTests : IDisposable
{
    private readonly OrderServiceFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    private static Order PlacedOrder() => new()
    {
        Id = "order-1",
        CustomerId = "customer-1",
        RestaurantId = "restaurant-1",
        TotalAmount = 25m,
    };

    private static readonly RestaurantProjection Restaurant = new() { Id = "restaurant-1", OwnerId = "owner-1", Name = "Mario's Pizzeria" };

    private Task<Order> StoredOrder() => _factory.WithDb(db => db.Orders.SingleAsync(o => o.Id == "order-1"));

    private Task PaymentSucceeded() => _factory.DeliverAsync(RoutingKeys.PaymentSucceeded,
        new PaymentSucceededEvent("pay-1", "order-1", 25m, "2026-10-08T12:00:00.000Z"));

    [Fact]
    public async Task PaymentSucceeded_ConfirmsAPlacedOrderAndTellsCustomerAndOwner()
    {
        await _factory.Seed(PlacedOrder(), Restaurant);

        await PaymentSucceeded();

        var order = await StoredOrder();
        Assert.Equal(OrderStatus.Confirmed, order.Status);
        Assert.NotNull(order.ConfirmedAt);
        var confirmed = Assert.Single(_factory.Events.PublishedTo(RoutingKeys.OrderConfirmed));
        Assert.Equal("order-1", confirmed.GetProperty("orderId").GetString());
        Assert.Equal("customer-1", confirmed.GetProperty("customerId").GetString());
        Assert.Equal("restaurant-1", confirmed.GetProperty("restaurantId").GetString());
        Assert.Equal("owner-1", confirmed.GetProperty("restaurantOwnerId").GetString());
    }

    [Fact]
    public async Task PaymentSucceeded_PublishesWithoutAnOwnerWhenTheRestaurantIsUnknown()
    {
        await _factory.Seed(PlacedOrder());

        await PaymentSucceeded();

        var confirmed = Assert.Single(_factory.Events.PublishedTo(RoutingKeys.OrderConfirmed));
        Assert.Equal(JsonValueKind.Null, confirmed.GetProperty("restaurantOwnerId").ValueKind);
    }

    [Fact]
    public async Task PaymentSucceeded_IgnoresAnOrderThatIsNoLongerPlaced()
    {
        var order = PlacedOrder();
        order.Status = OrderStatus.Cancelled;
        await _factory.Seed(order);

        await PaymentSucceeded();

        Assert.Equal(OrderStatus.Cancelled, (await StoredOrder()).Status);
        Assert.Empty(_factory.Events.Published);
    }

    [Fact]
    public async Task PaymentFailed_CancelsAPlacedOrderAndTellsOnlyTheCustomerWhy()
    {
        await _factory.Seed(PlacedOrder(), Restaurant);

        await _factory.DeliverAsync(RoutingKeys.PaymentFailed,
            new PaymentFailedEvent("pay-1", "order-1", "Card declined", "2026-10-08T12:00:00.000Z"));

        Assert.Equal(OrderStatus.Cancelled, (await StoredOrder()).Status);
        var cancelled = Assert.Single(_factory.Events.PublishedTo(RoutingKeys.OrderCancelled));
        Assert.Equal("customer-1", cancelled.GetProperty("customerId").GetString());
        // Never paid, so the restaurant never saw it and isn't told.
        Assert.Equal(JsonValueKind.Null, cancelled.GetProperty("restaurantOwnerId").ValueKind);
        Assert.Equal("Payment failed: Card declined", cancelled.GetProperty("reason").GetString());
    }

    [Theory]
    [InlineData(RoutingKeys.RestaurantCreated)]
    [InlineData(RoutingKeys.RestaurantUpdated)]
    public async Task RestaurantChanged_UpsertsTheLocalCopyOfTheOwner(string routingKey)
    {
        await _factory.DeliverAsync(routingKey,
            new RestaurantChangedEvent("restaurant-1", "owner-1", "Mario's Pizzeria", true, "2026-10-08T12:00:00.000Z"));
        await _factory.DeliverAsync(routingKey,
            new RestaurantChangedEvent("restaurant-1", "owner-2", "Mario's", true, "2026-10-08T12:01:00.000Z"));

        var restaurant = await _factory.WithDb(db => db.RestaurantProjections.SingleAsync());
        Assert.Equal("restaurant-1", restaurant.Id);
        Assert.Equal("owner-2", restaurant.OwnerId);
        Assert.Equal("Mario's", restaurant.Name);
    }
}
