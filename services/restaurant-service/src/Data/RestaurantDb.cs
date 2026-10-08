using System.Text.Json.Serialization;
using Delivery.Common.Data;
using Microsoft.EntityFrameworkCore;

namespace RestaurantService.Data;

public class Restaurant
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public required string OwnerId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public string? Cuisine { get; set; }
    public required string Address { get; set; }
    public bool IsOpen { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public List<MenuItem> MenuItems { get; set; } = [];
}

public class MenuItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string RestaurantId { get; set; } = null!;
    [JsonIgnore]
    public Restaurant? Restaurant { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public bool IsAvailable { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class RestaurantDb(DbContextOptions<RestaurantDb> options) : PrismaDbContext(options)
{
    public DbSet<Restaurant> Restaurants => Set<Restaurant>();
    public DbSet<MenuItem> MenuItems => Set<MenuItem>();

    protected override void ConfigureModel(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<MenuItem>(item =>
        {
            item.HasOne(i => i.Restaurant).WithMany(r => r.MenuItems).HasForeignKey(i => i.RestaurantId).OnDelete(DeleteBehavior.Cascade);
            item.Property(i => i.Price).HasPrecision(10, 2);
            item.HasIndex(i => i.RestaurantId);
        });
    }
}
