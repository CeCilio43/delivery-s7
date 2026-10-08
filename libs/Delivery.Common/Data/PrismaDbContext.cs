using Microsoft.EntityFrameworkCore;

namespace Delivery.Common.Data;

/// <summary>
/// A DbContext over a schema Prisma created. Besides the naming in
/// <see cref="PrismaSchema"/>, it fills in what Prisma's @default(now()) and
/// @updatedAt did on the client side: CreatedAt on insert and UpdatedAt on
/// every save. Bulk ExecuteUpdate calls bypass this and set UpdatedAt
/// themselves.
/// </summary>
public abstract class PrismaDbContext(DbContextOptions options) : DbContext(options)
{
    protected abstract void ConfigureModel(ModelBuilder modelBuilder);

    protected sealed override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ConfigureModel(modelBuilder);
        modelBuilder.UsePrismaNaming();
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        StampTimestamps();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        StampTimestamps();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void StampTimestamps()
    {
        var now = Clock.Now();
        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.State == EntityState.Added && entry.Metadata.FindProperty("CreatedAt") is not null)
            {
                var createdAt = entry.Property("CreatedAt");
                if (createdAt.CurrentValue is DateTime value && value == default) createdAt.CurrentValue = now;
            }

            if (entry.State is EntityState.Added or EntityState.Modified && entry.Metadata.FindProperty("UpdatedAt") is not null)
            {
                entry.Property("UpdatedAt").CurrentValue = now;
            }
        }
    }
}
