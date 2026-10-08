using Delivery.Common.Data;
using Microsoft.EntityFrameworkCore;

namespace PaymentService.Data;

public enum PaymentStatus
{
    Pending,
    Succeeded,
    Failed,
    Refunded,
    /// <summary>Never paid, because its order was cancelled first.</summary>
    Cancelled,
}

public class Transaction
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public required string OrderId { get; set; }
    public required string CustomerId { get; set; }
    public decimal Amount { get; set; }
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    public string? ProviderRef { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class PaymentDb(DbContextOptions<PaymentDb> options) : PrismaDbContext(options)
{
    public DbSet<Transaction> Transactions => Set<Transaction>();

    protected override void ConfigureModel(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Transaction>(transaction =>
        {
            transaction.Property(t => t.Amount).HasPrecision(10, 2);
            transaction.HasIndex(t => t.OrderId);
        });
    }
}
