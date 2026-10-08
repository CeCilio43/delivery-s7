using System.Text.Json.Serialization;
using Delivery.Common.Data;
using Microsoft.EntityFrameworkCore;

namespace OrderService.Data;

public enum OrderStatus
{
    Placed,
    Confirmed,
    Preparing,
    Ready,
    PickedUp,
    Delivered,
    Completed,
    Cancelled,
}

public class Order
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public required string CustomerId { get; set; }
    public required string RestaurantId { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Placed;
    public decimal TotalAmount { get; set; }
    // Set when payment succeeds; owners only see orders that have one, so
    // orders whose payment failed never reach the restaurant.
    public DateTime? ConfirmedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<OrderLine> Lines { get; set; } = [];
}

/// <summary>
/// One item of an order, with its own copy of the name and price at the time
/// of ordering, so later menu changes never alter a placed order.
/// </summary>
public class OrderLine
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string OrderId { get; set; } = null!;
    [JsonIgnore]
    public Order? Order { get; set; }
    public required string MenuItemId { get; set; }
    public required string Name { get; set; }
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
}

/// <summary>
/// order-service's own copy of who owns which restaurant, kept in sync from
/// restaurant-service's restaurant.created / restaurant.updated events. Used
/// to authorize owners on their restaurants' orders without calling
/// restaurant-service on every request.
/// </summary>
public class RestaurantProjection
{
    /// <summary>The restaurant's id in restaurant-service.</summary>
    public required string Id { get; set; }
    public required string OwnerId { get; set; }
    public required string Name { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class OrderDb(DbContextOptions<OrderDb> options) : PrismaDbContext(options)
{
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderLine> OrderLines => Set<OrderLine>();
    public DbSet<RestaurantProjection> RestaurantProjections => Set<RestaurantProjection>();

    protected override void ConfigureModel(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Order>(order =>
        {
            order.Property(o => o.TotalAmount).HasPrecision(10, 2);
            order.HasIndex(o => o.CustomerId);
            order.HasIndex(o => o.RestaurantId);
        });

        modelBuilder.Entity<OrderLine>(line =>
        {
            line.HasOne(l => l.Order).WithMany(o => o.Lines).HasForeignKey(l => l.OrderId).OnDelete(DeleteBehavior.Cascade);
            line.Property(l => l.UnitPrice).HasPrecision(10, 2);
            line.HasIndex(l => l.OrderId);
        });

        modelBuilder.Entity<RestaurantProjection>(restaurant =>
        {
            restaurant.Property(r => r.Id).ValueGeneratedNever();
            restaurant.HasIndex(r => r.OwnerId);
        });
    }
}
