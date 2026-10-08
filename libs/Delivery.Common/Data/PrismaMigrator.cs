using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Delivery.Common.Data;

/// <summary>
/// Applies the plain-SQL migrations under Migrations/&lt;timestamp&gt;_&lt;name&gt;/migration.sql
/// at startup. These are the migrations Prisma created, and the record of
/// which ones ran is kept in Prisma's own _prisma_migrations table, so
/// databases set up by the Node services carry on without being recreated.
/// </summary>
public static class PrismaMigrator
{
    // Arbitrary key for pg_advisory_lock, so replicas starting together
    // don't apply the same migration twice.
    private const long LockKey = 7_224_301_455;

    public static async Task MigrateAsync<TContext>(this IServiceProvider services, CancellationToken cancellationToken = default)
        where TContext : DbContext
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TContext>();

        // Tests run on SQLite, where the schema is simply created from the model.
        if (!db.Database.IsNpgsql())
        {
            await db.Database.EnsureCreatedAsync(cancellationToken);
            return;
        }

        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(PrismaMigrator));
        var directory = Path.Combine(AppContext.BaseDirectory, "Migrations");
        await ApplyAsync(db.Database.GetConnectionString()!, directory, logger, cancellationToken);
    }

    public static async Task ApplyAsync(string connectionString, string directory, ILogger logger, CancellationToken cancellationToken = default)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);

        await ExecuteAsync(connection, $"SELECT pg_advisory_lock({LockKey})", cancellationToken);
        try
        {
            await ExecuteAsync(connection, """
                CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
                    "id"                  VARCHAR(36) PRIMARY KEY NOT NULL,
                    "checksum"            VARCHAR(64) NOT NULL,
                    "finished_at"         TIMESTAMPTZ,
                    "migration_name"      VARCHAR(255) NOT NULL,
                    "logs"                TEXT,
                    "rolled_back_at"      TIMESTAMPTZ,
                    "started_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
                    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
                )
                """, cancellationToken);

            var applied = new HashSet<string>();
            await using (var query = new NpgsqlCommand(
                """SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL""",
                connection))
            await using (var reader = await query.ExecuteReaderAsync(cancellationToken))
            {
                while (await reader.ReadAsync(cancellationToken)) applied.Add(reader.GetString(0));
            }

            var pending = Directory.GetDirectories(directory)
                .Select(Path.GetFileName)
                .OfType<string>()
                .Where(name => !applied.Contains(name))
                .Order(StringComparer.Ordinal);

            foreach (var name in pending)
            {
                var file = Path.Combine(directory, name, "migration.sql");
                var bytes = await File.ReadAllBytesAsync(file, cancellationToken);

                await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
                await ExecuteAsync(connection, System.Text.Encoding.UTF8.GetString(bytes), cancellationToken);
                await using (var record = new NpgsqlCommand(
                    """
                    INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "applied_steps_count")
                    VALUES (@id, @checksum, now(), @name, 1)
                    """,
                    connection))
                {
                    record.Parameters.AddWithValue("id", Guid.NewGuid().ToString());
                    record.Parameters.AddWithValue("checksum", Convert.ToHexStringLower(SHA256.HashData(bytes)));
                    record.Parameters.AddWithValue("name", name);
                    await record.ExecuteNonQueryAsync(cancellationToken);
                }
                await transaction.CommitAsync(cancellationToken);
                logger.LogInformation("Applied migration {Migration}", name);
            }
        }
        finally
        {
            await ExecuteAsync(connection, $"SELECT pg_advisory_unlock({LockKey})", CancellationToken.None);
        }
    }

    private static async Task ExecuteAsync(NpgsqlConnection connection, string sql, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
