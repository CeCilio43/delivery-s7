using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Delivery.Common.Events;
using Microsoft.EntityFrameworkCore;
using OrderService.Data;

namespace OrderService.Tests;

public sealed class OrderRoutesTests : IDisposable
{
    private const string UserId = "customer-1";

    private static readonly object Restaurant = new
    {
        id = "restaurant-1",
        isOpen = true,
        menuItems = new[]
        {
            new { id = "item-1", name = "Margherita Pizza", price = 12.50m, isAvailable = true },
            new { id = "item-2", name = "Garlic Bread", price = 4.50m, isAvailable = false },
        },
    };

    private readonly OrderServiceFactory _factory = new();
    private readonly HttpClient _customer;

    public OrderRoutesTests() => _customer = _factory.ClientAs(UserId);

    public void Dispose() => _factory.Dispose();

    private static StringContent Json(string json) => new(json, Encoding.UTF8, "application/json");

    private Task<HttpResponseMessage> Place(string itemsJson, string restaurantId = "restaurant-1") =>
        _customer.PostAsync("/orders", Json($$"""{"restaurantId":"{{restaurantId}}","items":{{itemsJson}}}"""));

    private static Order StoredOrder(string id, OrderStatus status, DateTime? confirmedAt = null) => new()
    {
        Id = id,
        CustomerId = UserId,
        RestaurantId = "restaurant-1",
        Status = status,
        TotalAmount = 12.5m,
        ConfirmedAt = confirmedAt,
        Lines = [new OrderLine { MenuItemId = "item-1", Name = "Margherita Pizza", UnitPrice = 12.5m, Quantity = 1 }],
    };

    [Fact]
    public async Task Health_ReturnsOk()
    {
        Assert.Equal("""{"status":"ok","service":"order-service"}""", await _factory.CreateClient().GetStringAsync("/health"));
    }

    [Fact]
    public async Task Place_RejectsRequestsThatDidNotComeThroughTheGateway()
    {
        var response = await _factory.CreateClient().PostAsync("/orders", Json("{}"));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Place_PricesTheOrderFromRestaurantServiceAndPublishesOrderCreated()
    {
        _factory.RestaurantService.Respond(Restaurant);

        // A client-supplied price must be ignored.
        var response = await Place("""[{"menuItemId":"item-1","quantity":2,"price":0.01}]""");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(UserId, body.GetProperty("customerId").GetString());
        Assert.Equal("PLACED", body.GetProperty("status").GetString());
        Assert.Equal("25", body.GetProperty("totalAmount").GetString());
        Assert.Equal(JsonValueKind.Null, body.GetProperty("confirmedAt").ValueKind);
        var line = Assert.Single(body.GetProperty("lines").EnumerateArray());
        Assert.Equal("""{"id":"#","orderId":"#","menuItemId":"item-1","name":"Margherita Pizza","unitPrice":"12.5","quantity":2}""",
            System.Text.RegularExpressions.Regex.Replace(line.GetRawText(), "\"(id|orderId)\":\"[^\"]+\"", "\"$1\":\"#\""));

        var created = Assert.Single(_factory.Events.PublishedTo(RoutingKeys.OrderCreated));
        Assert.Equal(body.GetProperty("id").GetString(), created.GetProperty("orderId").GetString());
        Assert.Equal(UserId, created.GetProperty("customerId").GetString());
        Assert.Equal(25m, created.GetProperty("total").GetDecimal());
        var item = Assert.Single(created.GetProperty("items").EnumerateArray());
        Assert.Equal("item-1", item.GetProperty("menuItemId").GetString());
        Assert.Equal(2, item.GetProperty("quantity").GetInt32());
        Assert.Equal(12.5m, item.GetProperty("price").GetDecimal());
    }

    [Fact]
    public async Task Place_RejectsUnavailableMenuItems()
    {
        _factory.RestaurantService.Respond(Restaurant);

        var response = await Place("""[{"menuItemId":"item-2","quantity":1}]""");

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        Assert.Equal(0, await _factory.WithDb(db => db.Orders.CountAsync()));
    }

    [Fact]
    public async Task Place_RejectsOrdersAtAClosedRestaurant()
    {
        _factory.RestaurantService.Respond(new { id = "restaurant-1", isOpen = false, menuItems = Array.Empty<object>() });

        var response = await Place("""[{"menuItemId":"item-1","quantity":1}]""");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Place_Returns404ForAnUnknownRestaurant()
    {
        var response = await Place("""[{"menuItemId":"item-1","quantity":1}]""", restaurantId: "nope");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Place_Returns502WhenRestaurantServiceIsDown()
    {
        _factory.RestaurantService.Unreachable = true;

        var response = await Place("""[{"menuItemId":"item-1","quantity":1}]""");

        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
    }

    [Theory]
    [InlineData("""[{"menuItemId":"item-1","quantity":0}]""")]
    [InlineData("""[{"menuItemId":"item-1","quantity":1.5}]""")]
    [InlineData("""[{"quantity":1}]""")]
    [InlineData("[]")]
    public async Task Place_ValidatesTheItems(string items)
    {
        var response = await Place(items);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, _factory.RestaurantService.Calls);
    }

    [Fact]
    public async Task Place_CancelsTheOrderWhenTheEventBusIsUnreachable()
    {
        _factory.RestaurantService.Respond(Restaurant);
        _factory.Events.FailNextPublish();

        var response = await Place("""[{"menuItemId":"item-1","quantity":1}]""");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal(OrderStatus.Cancelled, (await _factory.WithDb(db => db.Orders.SingleAsync())).Status);
    }

    [Fact]
    public async Task List_ReturnsOnlyTheCallersOrdersNewestFirst()
    {
        var older = StoredOrder("order-1", OrderStatus.Delivered);
        older.CreatedAt = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc);
        var newer = StoredOrder("order-2", OrderStatus.Placed);
        var someoneElses = StoredOrder("order-3", OrderStatus.Placed);
        someoneElses.CustomerId = "customer-2";
        await _factory.Seed(older, newer, someoneElses);

        var orders = await _customer.GetFromJsonAsync<JsonElement[]>("/orders");

        Assert.Equal(["order-2", "order-1"], orders!.Select(o => o.GetProperty("id").GetString()));
    }

    [Fact]
    public async Task Get_OnlyFindsTheCallersOwnOrders()
    {
        var order = StoredOrder("order-1", OrderStatus.Placed);
        order.CustomerId = "customer-2";
        await _factory.Seed(order);

        var response = await _customer.GetAsync("/orders/order-1");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Cancel_CancelsAPaidOrderAndTellsTheOwner()
    {
        await _factory.Seed(
            StoredOrder("order-1", OrderStatus.Confirmed, confirmedAt: DateTime.UtcNow),
            new RestaurantProjection { Id = "restaurant-1", OwnerId = "owner-1", Name = "Mario's Pizzeria" });

        var response = await _customer.PostAsync("/orders/order-1/cancel", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("CANCELLED", (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("status").GetString());
        var cancelled = Assert.Single(_factory.Events.PublishedTo(RoutingKeys.OrderCancelled));
        Assert.Equal("order-1", cancelled.GetProperty("orderId").GetString());
        Assert.Equal(UserId, cancelled.GetProperty("customerId").GetString());
        Assert.Equal("owner-1", cancelled.GetProperty("restaurantOwnerId").GetString());
        Assert.Equal("Cancelled by customer", cancelled.GetProperty("reason").GetString());
    }

    [Fact]
    public async Task Cancel_RefusesAnOrderThatIsPastCancellation()
    {
        await _factory.Seed(StoredOrder("order-1", OrderStatus.Delivered));

        var response = await _customer.PostAsync("/orders/order-1/cancel", null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("Order cannot be cancelled while DELIVERED",
            (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("error").GetString());
        Assert.Empty(_factory.Events.Published);
    }
}
