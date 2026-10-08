using System.Text.Json.Serialization;
using Delivery.Common.Data;
using Microsoft.EntityFrameworkCore;

namespace UserService.Data;

public enum Role
{
    Customer,
    RestaurantOwner,
    Courier,
    Admin,
}

public class User
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public required string Email { get; set; }
    public string? PasswordHash { get; set; }
    public string? GoogleId { get; set; }
    public Role Role { get; set; } = Role.Customer;
    public string? Name { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    [JsonIgnore]
    public List<RefreshToken> RefreshTokens { get; set; } = [];
}

public class RefreshToken
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public required string UserId { get; set; }
    [JsonIgnore]
    public User? User { get; set; }
    public required string TokenHash { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class UserDb(DbContextOptions<UserDb> options) : PrismaDbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void ConfigureModel(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(user =>
        {
            user.HasIndex(u => u.Email).IsUnique();
            user.HasIndex(u => u.GoogleId).IsUnique();
        });

        modelBuilder.Entity<RefreshToken>(token =>
        {
            token.HasOne(t => t.User).WithMany(u => u.RefreshTokens).HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
            token.HasIndex(t => t.TokenHash).IsUnique();
            token.HasIndex(t => t.UserId);
        });
    }
}
