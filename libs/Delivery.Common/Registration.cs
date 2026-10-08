using Delivery.Common.Data;
using Delivery.Common.Events;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Npgsql.EntityFrameworkCore.PostgreSQL.Infrastructure;

namespace Delivery.Common;

public static class Registration
{
    /// <summary>Registers the service's DbContext against the Postgres database in DATABASE_URL.</summary>
    public static IServiceCollection AddPrismaDatabase<TContext>(
        this IServiceCollection services,
        Action<NpgsqlDbContextOptionsBuilder>? configure = null)
        where TContext : DbContext =>
        services.AddDbContext<TContext>((provider, options) =>
        {
            var url = provider.GetRequiredService<IConfiguration>()["DATABASE_URL"]
                ?? throw new InvalidOperationException("DATABASE_URL is not set");
            options.UseNpgsql(PostgresUrl.ToConnectionString(url), npgsql => configure?.Invoke(npgsql));
        });

    /// <summary>Registers the RabbitMQ event bus at RABBITMQ_URL.</summary>
    public static IServiceCollection AddRabbitMqEventBus(this IServiceCollection services) =>
        services.AddSingleton<IEventBus>(provider => new RabbitMqEventBus(
            provider.GetRequiredService<IConfiguration>()["RABBITMQ_URL"] ?? "amqp://localhost:5672",
            provider.GetRequiredService<ILogger<RabbitMqEventBus>>()));
}
