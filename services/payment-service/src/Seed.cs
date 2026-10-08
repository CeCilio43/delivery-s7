using PaymentService.Data;

namespace PaymentService;

/// <summary>Development data; run with `dotnet run -- seed`.</summary>
public static class Seed
{
    public static async Task RunAsync(IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<PaymentDb>();

        const string customer1 = "11111111-1111-1111-1111-111111111111";
        const string customer2 = "11111111-1111-1111-1111-111111111112";
        const string customer3 = "11111111-1111-1111-1111-111111111113";

        Transaction[] transactions =
        [
            new() { Id = "77777777-7777-7777-7777-777777777771", OrderId = "66666666-6666-6666-6666-666666666661", CustomerId = customer1, Amount = 17.0m, Status = PaymentStatus.Succeeded, ProviderRef = "demo-ref-001" },
            new() { Id = "77777777-7777-7777-7777-777777777772", OrderId = "66666666-6666-6666-6666-666666666662", CustomerId = customer2, Amount = 16.0m, Status = PaymentStatus.Pending, ProviderRef = "demo-ref-002" },
            new() { Id = "77777777-7777-7777-7777-777777777773", OrderId = "66666666-6666-6666-6666-666666666663", CustomerId = customer3, Amount = 20.5m, Status = PaymentStatus.Succeeded, ProviderRef = "demo-ref-003" },
            new() { Id = "77777777-7777-7777-7777-777777777774", OrderId = "66666666-6666-6666-6666-666666666664", CustomerId = customer1, Amount = 4.0m, Status = PaymentStatus.Failed, ProviderRef = "demo-ref-004" },
        ];

        // Existing transactions are left as they are.
        foreach (var transaction in transactions)
        {
            if (await db.Transactions.FindAsync(transaction.Id) is null) db.Transactions.Add(transaction);
        }
        await db.SaveChangesAsync();

        Console.WriteLine($"payment-service seeded: {transactions.Length} transactions.");
    }
}
