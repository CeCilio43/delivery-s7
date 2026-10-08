using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Delivery.Testing;
using RestaurantService.Data;

namespace RestaurantService.Tests;

public sealed class RestaurantRoutesTests : IDisposable
{
    private readonly DbServiceFactory<Program, RestaurantDb> _factory = new();
    private readonly HttpClient _client;

    public RestaurantRoutesTests() => _client = _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    private static Restaurant Restaurant(string id, string name, string? cuisine) =>
        new() { Id = id, OwnerId = "owner-1", Name = name, Cuisine = cuisine, Address = "12 Market Street" };

    [Fact]
    public async Task Health_ReturnsOk()
    {
        Assert.Equal("""{"status":"ok","service":"restaurant-service"}""", await _client.GetStringAsync("/health"));
    }

    [Fact]
    public async Task List_ReturnsTheSummaryOfEveryRestaurant()
    {
        await _factory.Seed(Restaurant("restaurant-1", "Mario's Pizzeria", "Italian"));

        var response = await _client.GetAsync("/restaurants");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(
            """[{"id":"restaurant-1","name":"Mario's Pizzeria","cuisine":"Italian","address":"12 Market Street","isOpen":true}]""",
            await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task List_FiltersCaseInsensitivelyOnNameAndCuisine()
    {
        await _factory.Seed(
            Restaurant("restaurant-1", "Mario's Pizzeria", "Italian"),
            Restaurant("restaurant-2", "Spice Route", "Indian"),
            Restaurant("restaurant-3", "Golden Wok", null));

        var byName = await _client.GetFromJsonAsync<JsonElement[]>("/restaurants?search=PIZZ");
        var byCuisine = await _client.GetFromJsonAsync<JsonElement[]>("/restaurants?search= indian ");

        Assert.Equal(["restaurant-1"], byName!.Select(r => r.GetProperty("id").GetString()));
        Assert.Equal(["restaurant-2"], byCuisine!.Select(r => r.GetProperty("id").GetString()));
    }

    [Fact]
    public async Task Get_ReturnsTheRestaurantWithItsMenuAndPricesAsStrings()
    {
        var restaurant = Restaurant("restaurant-1", "Mario's Pizzeria", "Italian");
        restaurant.MenuItems.Add(new MenuItem { Id = "item-1", Name = "Margherita Pizza", Price = 12.50m });
        await _factory.Seed(restaurant);

        var body = await _client.GetFromJsonAsync<JsonElement>("/restaurants/restaurant-1");

        Assert.Equal("restaurant-1", body.GetProperty("id").GetString());
        var item = Assert.Single(body.GetProperty("menuItems").EnumerateArray());
        Assert.Equal("item-1", item.GetProperty("id").GetString());
        Assert.Equal("12.5", item.GetProperty("price").GetString());
        Assert.Equal(
            ["id", "restaurantId", "name", "description", "price", "isAvailable", "createdAt", "updatedAt"],
            item.EnumerateObject().Select(p => p.Name));
    }

    [Fact]
    public async Task Get_Returns404ForAnUnknownId()
    {
        var response = await _client.GetAsync("/restaurants/unknown-id");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("Restaurant not found", (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("error").GetString());
    }
}
