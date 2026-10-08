using OrderService.Data;

namespace OrderService;

/// <summary>Development data; run with `dotnet run -- seed`.</summary>
public static class Seed
{
    public static async Task RunAsync(IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<OrderDb>();

        const string customer1 = "11111111-1111-1111-1111-111111111111";
        const string customer2 = "11111111-1111-1111-1111-111111111112";
        const string customer3 = "11111111-1111-1111-1111-111111111113";
        const string restaurant1 = "33333333-3333-3333-3333-333333333331";
        const string restaurant2 = "33333333-3333-3333-3333-333333333332";
        const string restaurant3 = "33333333-3333-3333-3333-333333333333";

        static OrderLine Line(string menuItemId, string name, decimal unitPrice) =>
            new() { MenuItemId = menuItemId, Name = name, UnitPrice = unitPrice, Quantity = 1 };

        Order[] orders =
        [
            new()
            {
                Id = "66666666-6666-6666-6666-666666666661", CustomerId = customer1, RestaurantId = restaurant1,
                Status = OrderStatus.Confirmed, TotalAmount = 17.0m,
                Lines =
                [
                    Line("44444444-4444-4444-4444-444444444441", "Margherita Pizza", 12.5m),
                    Line("44444444-4444-4444-4444-444444444442", "Garlic Bread", 4.5m),
                ],
            },
            new()
            {
                Id = "66666666-6666-6666-6666-666666666662", CustomerId = customer2, RestaurantId = restaurant2,
                Status = OrderStatus.Placed, TotalAmount = 16.0m,
                Lines =
                [
                    Line("44444444-4444-4444-4444-444444444444", "Chicken Tikka Masala", 13.0m),
                    Line("44444444-4444-4444-4444-444444444445", "Garlic Naan", 3.0m),
                ],
            },
            new()
            {
                Id = "66666666-6666-6666-6666-666666666663", CustomerId = customer3, RestaurantId = restaurant3,
                Status = OrderStatus.Delivered, TotalAmount = 20.5m,
                Lines =
                [
                    Line("44444444-4444-4444-4444-444444444447", "Kung Pao Chicken", 11.5m),
                    Line("44444444-4444-4444-4444-444444444448", "Spring Rolls (4pc)", 5.0m),
                    Line("44444444-4444-4444-4444-444444444449", "Egg Fried Rice", 4.0m),
                ],
            },
            new()
            {
                Id = "66666666-6666-6666-6666-666666666664", CustomerId = customer1, RestaurantId = restaurant3,
                Status = OrderStatus.Cancelled, TotalAmount = 4.0m,
                Lines = [Line("44444444-4444-4444-4444-444444444449", "Egg Fried Rice", 4.0m)],
            },
        ];

        // Existing orders are left as they are.
        foreach (var order in orders)
        {
            if (await db.Orders.FindAsync(order.Id) is null) db.Orders.Add(order);
        }
        await db.SaveChangesAsync();

        Console.WriteLine($"order-service seeded: {orders.Length} orders.");
    }
}
