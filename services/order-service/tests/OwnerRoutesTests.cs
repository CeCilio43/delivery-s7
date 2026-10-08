using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Delivery.Common.Events;
using Microsoft.EntityFrameworkCore;
using OrderService.Data;

namespace OrderService.Tests;

public sealed class OwnerRoutesTests : IDisposable
{
    private const string OwnerId = "owner-1";

    private readonly OrderServiceFactory _factory = new();
    private readonly HttpClient _owner;

    public OwnerRoutesTests()
    {
        _owner = _factory.ClientAs(OwnerId, "RESTAURANT_OWNER");
        _factory.Seed(
            new RestaurantProjection { Id = "restaurant-1", OwnerId = OwnerId, Name = "Mario's Pizzeria" },
            new RestaurantProjection { Id = "restaurant-9", OwnerId = "owner-9", Name = "Spice Route" }).GetAwaiter().GetResult();
    }

    public void Dispose() => _factory.Dispose();

    private static Order Order(string id, OrderStatus status, string restaurantId = "restaurant-1", bool paid = true) => new()
    {
        Id = id,
        CustomerId = "customer-1",
        RestaurantId = restaurantId,
        Status = status,
        TotalAmount = 12.5m,
        ConfirmedAt = paid ? new DateTime(2026, 10, 8, 12, 0, 0, DateTimeKind.Utc) : null,
    };

    private Task<OrderStatus> StatusOf(string id) =>
        _factory.WithDb(async db => (await db.Orders.SingleAsync(o => o.Id == id)).Status);

    private static async Task<string?> Error(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("error").GetString();

    [Fact]
    public async Task RejectsRequestsThatDidNotComeThroughTheGateway()
    {
        var response = await _factory.CreateClient().GetAsync("/owner/orders");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RejectsCustomers()
    {
        var response = await _factory.ClientAs("customer-1", "CUSTOMER").GetAsync("/owner/orders");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task List_ReturnsOnlyPaidOrdersOfTheOwnersRestaurants()
    {
        await _factory.Seed(
            Order("confirmed", OrderStatus.Confirmed),
            Order("preparing", OrderStatus.Preparing),
            Order("ready", OrderStatus.Ready),
            Order("unpaid", OrderStatus.Placed, paid: false),
            Order("other-restaurant", OrderStatus.Confirmed, restaurantId: "restaurant-9"));

        var all = await _owner.GetFromJsonAsync<JsonElement[]>("/owner/orders");
        var filtered = await _owner.GetFromJsonAsync<JsonElement[]>("/owner/orders?status=CONFIRMED,PREPARING");

        Assert.Equal(["confirmed", "preparing", "ready"], all!.Select(o => o.GetProperty("id").GetString()).Order());
        Assert.Equal(["confirmed", "preparing"], filtered!.Select(o => o.GetProperty("id").GetString()).Order());
    }

    [Fact]
    public async Task List_RejectsUnknownStatuses()
    {
        var response = await _owner.GetAsync("/owner/orders?status=CONFIRMED,NOPE");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("status must be a comma-separated list of PLACED, CONFIRMED, PREPARING, READY, PICKED_UP, DELIVERED, COMPLETED, CANCELLED",
            await Error(response));
    }

    [Fact]
    public async Task List_Returns404WhenFilteringOnSomeoneElsesRestaurant()
    {
        var response = await _owner.GetAsync("/owner/orders?restaurantId=restaurant-9");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Accept_MovesAConfirmedOrderToPreparingAndPublishesOrderPreparing()
    {
        await _factory.Seed(Order("order-1", OrderStatus.Confirmed));

        var response = await _owner.PostAsync("/owner/orders/order-1/accept", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("PREPARING", (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("status").GetString());
        Assert.Equal(OrderStatus.Preparing, await StatusOf("order-1"));
        var preparing = Assert.Single(_factory.Events.PublishedTo(RoutingKeys.OrderPreparing));
        Assert.Equal("order-1", preparing.GetProperty("orderId").GetString());
        Assert.Equal("customer-1", preparing.GetProperty("customerId").GetString());
        Assert.Equal(OwnerId, preparing.GetProperty("restaurantOwnerId").GetString());
    }

    [Fact]
    public async Task Accept_RefusesWhenTheOrderIsNoLongerConfirmed()
    {
        await _factory.Seed(Order("order-1", OrderStatus.Cancelled));

        var response = await _owner.PostAsync("/owner/orders/order-1/accept", null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("Order cannot be accepted while CANCELLED", await Error(response));
        Assert.Empty(_factory.Events.Published);
    }

    [Theory]
    [InlineData("restaurant-9", true)]
    [InlineData("restaurant-1", false)]
    public async Task Accept_Returns404ForOrdersTheOwnerCantSee(string restaurantId, bool paid)
    {
        await _factory.Seed(Order("order-9", OrderStatus.Confirmed, restaurantId, paid));

        var response = await _owner.PostAsync("/owner/orders/order-9/accept", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(OrderStatus.Confirmed, await StatusOf("order-9"));
    }

    [Fact]
    public async Task Ready_MovesAPreparingOrderToReadyAndPublishesOrderReady()
    {
        await _factory.Seed(Order("order-1", OrderStatus.Preparing));

        var response = await _owner.PostAsync("/owner/orders/order-1/ready", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(OrderStatus.Ready, await StatusOf("order-1"));
        Assert.Equal("order-1", Assert.Single(_factory.Events.PublishedTo(RoutingKeys.OrderReady)).GetProperty("orderId").GetString());
    }

    [Fact]
    public async Task Reject_CancelsTheOrderWithTheReasonSoPaymentServiceRefundsIt()
    {
        await _factory.Seed(Order("order-1", OrderStatus.Preparing));

        var response = await _owner.PostAsync("/owner/orders/order-1/reject",
            new StringContent("""{"reason":" Out of mozzarella "}""", Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(OrderStatus.Cancelled, await StatusOf("order-1"));
        var cancelled = Assert.Single(_factory.Events.PublishedTo(RoutingKeys.OrderCancelled));
        Assert.Equal("Rejected by the restaurant: Out of mozzarella", cancelled.GetProperty("reason").GetString());
    }

    [Fact]
    public async Task Reject_WorksWithoutAReason()
    {
        await _factory.Seed(Order("order-1", OrderStatus.Confirmed));

        await _owner.PostAsync("/owner/orders/order-1/reject", null);

        var cancelled = Assert.Single(_factory.Events.PublishedTo(RoutingKeys.OrderCancelled));
        Assert.Equal("Rejected by the restaurant", cancelled.GetProperty("reason").GetString());
    }

    [Fact]
    public async Task Reject_RefusesAReasonThatIsTooLong()
    {
        await _factory.Seed(Order("order-1", OrderStatus.Confirmed));

        var response = await _owner.PostAsJsonAsync("/owner/orders/order-1/reject", new { reason = new string('x', 201) });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(OrderStatus.Confirmed, await StatusOf("order-1"));
    }
}
