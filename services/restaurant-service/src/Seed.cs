using RestaurantService.Data;

namespace RestaurantService;

/// <summary>Development data; run with `dotnet run -- seed`.</summary>
public static class Seed
{
    public static async Task RunAsync(IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<RestaurantDb>();

        const string owner1 = "22222222-2222-2222-2222-222222222221";
        const string owner2 = "22222222-2222-2222-2222-222222222222";
        const string owner3 = "22222222-2222-2222-2222-222222222223";
        const string restaurant1 = "33333333-3333-3333-3333-333333333331";
        const string restaurant2 = "33333333-3333-3333-3333-333333333332";
        const string restaurant3 = "33333333-3333-3333-3333-333333333333";

        Restaurant[] restaurants =
        [
            new() { Id = restaurant1, OwnerId = owner1, Name = "Mario's Pizzeria", Cuisine = "Italian", Address = "12 Market Street" },
            new() { Id = restaurant2, OwnerId = owner2, Name = "Spice Route", Cuisine = "Indian", Address = "48 Curry Lane" },
            new() { Id = restaurant3, OwnerId = owner3, Name = "Golden Wok", Cuisine = "Chinese", Address = "7 Dragon Avenue" },
        ];

        MenuItem[] menuItems =
        [
            new() { Id = "44444444-4444-4444-4444-444444444441", RestaurantId = restaurant1, Name = "Margherita Pizza", Price = 12.5m },
            new() { Id = "44444444-4444-4444-4444-444444444442", RestaurantId = restaurant1, Name = "Garlic Bread", Price = 4.5m },
            new() { Id = "44444444-4444-4444-4444-444444444443", RestaurantId = restaurant1, Name = "Tiramisu", Price = 6.0m },
            new() { Id = "44444444-4444-4444-4444-444444444444", RestaurantId = restaurant2, Name = "Chicken Tikka Masala", Price = 13.0m },
            new() { Id = "44444444-4444-4444-4444-444444444445", RestaurantId = restaurant2, Name = "Garlic Naan", Price = 3.0m },
            new() { Id = "44444444-4444-4444-4444-444444444446", RestaurantId = restaurant2, Name = "Mango Lassi", Price = 3.5m },
            new() { Id = "44444444-4444-4444-4444-444444444447", RestaurantId = restaurant3, Name = "Kung Pao Chicken", Price = 11.5m },
            new() { Id = "44444444-4444-4444-4444-444444444448", RestaurantId = restaurant3, Name = "Spring Rolls (4pc)", Price = 5.0m },
            new() { Id = "44444444-4444-4444-4444-444444444449", RestaurantId = restaurant3, Name = "Egg Fried Rice", Price = 4.0m },
        ];

        // Existing rows are left as they are.
        foreach (var restaurant in restaurants)
        {
            if (await db.Restaurants.FindAsync(restaurant.Id) is null) db.Restaurants.Add(restaurant);
        }
        foreach (var item in menuItems)
        {
            if (await db.MenuItems.FindAsync(item.Id) is null) db.MenuItems.Add(item);
        }
        await db.SaveChangesAsync();

        Console.WriteLine($"restaurant-service seeded: {restaurants.Length} restaurants, {menuItems.Length} menu items.");
    }
}
