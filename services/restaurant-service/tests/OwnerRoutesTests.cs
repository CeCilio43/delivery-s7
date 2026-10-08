using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Delivery.Common.Events;
using Delivery.Testing;
using Microsoft.EntityFrameworkCore;
using RestaurantService.Data;

namespace RestaurantService.Tests;

public sealed class OwnerRoutesTests : IDisposable
{
    private const string OwnerId = "owner-1";

    private readonly DbServiceFactory<Program, RestaurantDb> _factory = new();
    private readonly HttpClient _owner;

    public OwnerRoutesTests()
    {
        _owner = _factory.ClientAs(OwnerId, "RESTAURANT_OWNER");
        _factory.Seed(new Restaurant
        {
            Id = "restaurant-1",
            OwnerId = OwnerId,
            Name = "Mario's Pizzeria",
            Address = "12 Market Street",
            Cuisine = "Italian",
            MenuItems = [new MenuItem { Id = "item-1", Name = "Margherita Pizza", Price = 12.5m }],
        }).GetAwaiter().GetResult();
        _factory.Events.Clear();
    }

    public void Dispose() => _factory.Dispose();

    private static StringContent Json(string json) => new(json, Encoding.UTF8, "application/json");

    private static async Task<string?> Error(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("error").GetString();

    [Fact]
    public async Task RejectsRequestsThatDidNotComeThroughTheGateway()
    {
        var response = await _factory.CreateClient().GetAsync("/owner/restaurants");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RejectsCustomers()
    {
        var response = await _factory.ClientAs("customer-1", "CUSTOMER").GetAsync("/owner/restaurants");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Returns404ForSomeoneElsesRestaurant()
    {
        await _factory.Seed(new Restaurant { Id = "restaurant-9", OwnerId = "owner-9", Name = "Other", Address = "Elsewhere" });

        var response = await _owner.PatchAsync("/owner/restaurants/restaurant-9", Json("""{"isOpen":false}"""));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.True((await _factory.WithDb(db => db.Restaurants.SingleAsync(r => r.Id == "restaurant-9"))).IsOpen);
    }

    [Fact]
    public async Task List_ReturnsOnlyTheCallersRestaurantsWithTheirMenus()
    {
        await _factory.Seed(new Restaurant { Id = "restaurant-9", OwnerId = "owner-9", Name = "Other", Address = "Elsewhere" });

        var restaurants = await _owner.GetFromJsonAsync<JsonElement[]>("/owner/restaurants");

        var restaurant = Assert.Single(restaurants!);
        Assert.Equal("restaurant-1", restaurant.GetProperty("id").GetString());
        Assert.Equal(1, restaurant.GetProperty("menuItems").GetArrayLength());
    }

    [Fact]
    public async Task Create_MakesAClosedRestaurantForTheCallerAndPublishesRestaurantCreated()
    {
        var response = await _owner.PostAsync("/owner/restaurants", Json("""{"name":" Pasta Corner ","address":"3 Canal Road"}"""));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var id = body.GetProperty("id").GetString();
        var stored = await _factory.WithDb(db => db.Restaurants.SingleAsync(r => r.Id == id));
        Assert.Equal("Pasta Corner", stored.Name);
        Assert.Null(stored.Cuisine);
        Assert.Null(stored.Description);
        Assert.Equal(OwnerId, stored.OwnerId);
        Assert.False(stored.IsOpen);
        Assert.Equal(0, body.GetProperty("menuItems").GetArrayLength());

        var published = Assert.Single(_factory.Events.PublishedTo(RoutingKeys.RestaurantCreated));
        Assert.Equal(id, published.GetProperty("restaurantId").GetString());
        Assert.Equal(OwnerId, published.GetProperty("ownerId").GetString());
        Assert.False(published.GetProperty("isOpen").GetBoolean());
    }

    [Theory]
    [InlineData("""{"name":"Pasta Corner"}""", "address is required")]
    [InlineData("""{"name":"Pasta Corner","address":"3 Canal Road","cuisine":5}""", "cuisine must be a string")]
    [InlineData("[]", "Request body must be a JSON object")]
    public async Task Create_ValidatesTheBody(string json, string error)
    {
        var response = await _owner.PostAsync("/owner/restaurants", Json(json));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(error, await Error(response));
    }

    [Fact]
    public async Task Update_ClosesTheRestaurantAndPublishesRestaurantUpdated()
    {
        var response = await _owner.PatchAsync("/owner/restaurants/restaurant-1", Json("""{"isOpen":false}"""));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False((await _factory.WithDb(db => db.Restaurants.SingleAsync(r => r.Id == "restaurant-1"))).IsOpen);
        var published = Assert.Single(_factory.Events.PublishedTo(RoutingKeys.RestaurantUpdated));
        Assert.Equal("restaurant-1", published.GetProperty("restaurantId").GetString());
        Assert.False(published.GetProperty("isOpen").GetBoolean());
    }

    [Fact]
    public async Task Update_StillSucceedsWhenTheEventBusIsDown()
    {
        _factory.Events.FailNextPublish();

        var response = await _owner.PatchAsync("/owner/restaurants/restaurant-1", Json("""{"name":"Mario's"}"""));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Mario's", (await _factory.WithDb(db => db.Restaurants.SingleAsync(r => r.Id == "restaurant-1"))).Name);
    }

    [Fact]
    public async Task Update_RejectsAnEmptyUpdate()
    {
        var response = await _owner.PatchAsync("/owner/restaurants/restaurant-1", Json("{}"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("Nothing to update", await Error(response));
    }

    [Theory]
    [InlineData("13.5")]
    [InlineData("\"13.50\"")]
    public async Task AddMenuItem_StoresTheExactPrice(string price)
    {
        var response = await _owner.PostAsync("/owner/restaurants/restaurant-1/menu-items", Json($$"""{"name":"Calzone","price":{{price}}}"""));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("13.5", body.GetProperty("price").GetString());
        Assert.True(body.GetProperty("isAvailable").GetBoolean());
        var stored = await _factory.WithDb(db => db.MenuItems.SingleAsync(i => i.Name == "Calzone"));
        Assert.Equal(13.50m, stored.Price);
        Assert.Equal("restaurant-1", stored.RestaurantId);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-1")]
    [InlineData("\"abc\"")]
    [InlineData("12.345")]
    [InlineData("10000.01")]
    public async Task AddMenuItem_RejectsInvalidPrices(string price)
    {
        var response = await _owner.PostAsync("/owner/restaurants/restaurant-1/menu-items", Json($$"""{"name":"Calzone","price":{{price}}}"""));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateMenuItem_MarksItUnavailable()
    {
        var response = await _owner.PatchAsync("/owner/restaurants/restaurant-1/menu-items/item-1", Json("""{"isAvailable":false}"""));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False((await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("isAvailable").GetBoolean());
        Assert.False((await _factory.WithDb(db => db.MenuItems.SingleAsync(i => i.Id == "item-1"))).IsAvailable);
    }

    [Fact]
    public async Task DeleteMenuItem_Returns404ForAnItemOfAnotherRestaurant()
    {
        var response = await _owner.DeleteAsync("/owner/restaurants/restaurant-1/menu-items/item-9");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteMenuItem_DeletesIt()
    {
        var response = await _owner.DeleteAsync("/owner/restaurants/restaurant-1/menu-items/item-1");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(0, await _factory.WithDb(db => db.MenuItems.CountAsync()));
    }

    [Fact]
    public async Task OrderConfirmed_IsAcknowledgedWithRestaurantOrderReceived()
    {
        await _factory.DeliverAsync(RoutingKeys.OrderConfirmed,
            new OrderConfirmedEvent("order-1", "customer-1", "restaurant-1", OwnerId, "2026-10-08T12:00:00.000Z"));

        var received = Assert.Single(_factory.Events.PublishedTo(RoutingKeys.RestaurantOrderReceived));
        Assert.Equal("order-1", received.GetProperty("orderId").GetString());
        Assert.Equal("restaurant-1", received.GetProperty("restaurantId").GetString());
    }
}
