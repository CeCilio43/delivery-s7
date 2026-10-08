using System.Net.Http.Headers;
using Delivery.Common.Events;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;

namespace Delivery.Testing;

/// <summary>
/// Runs a service in-process for tests, with RabbitMQ replaced by a
/// <see cref="FakeEventBus"/>.
/// </summary>
public class ServiceFactory<TProgram> : WebApplicationFactory<TProgram> where TProgram : class
{
    public const string JwtSecret = "test-secret";

    public FakeEventBus Events { get; } = new();

    /// <summary>Configuration values (environment variables in production) the service sees.</summary>
    public Dictionary<string, string?> Settings { get; } = new() { ["JWT_SECRET"] = JwtSecret };

    protected virtual void ConfigureTestServices(IServiceCollection services)
    {
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureLogging(logging => logging.SetMinimumLevel(LogLevel.Warning));
        foreach (var (key, value) in Settings) builder.UseSetting(key, value);

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IEventBus>();
            services.AddSingleton<IEventBus>(Events);
            ConfigureTestServices(services);
        });
    }

    /// <summary>Starts the service if needed and delivers an event to its handler.</summary>
    public Task DeliverAsync(string routingKey, object payload)
    {
        _ = Services;
        return Events.DeliverAsync(routingKey, payload);
    }

    /// <summary>A client calling the service the way the api-gateway does, as the given user.</summary>
    public HttpClient ClientAs(string userId, string? role = null)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add("x-user-id", userId);
        if (role is not null) client.DefaultRequestHeaders.Add("x-user-role", role);
        return client;
    }

    public HttpClient ClientWithToken(string token)
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
}

/// <summary>
/// A <see cref="ServiceFactory{TProgram}"/> whose database is an in-memory
/// SQLite database, created from the EF model and kept for the factory's lifetime.
/// </summary>
public class DbServiceFactory<TProgram, TDb> : ServiceFactory<TProgram>
    where TProgram : class
    where TDb : DbContext
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");

    public DbServiceFactory() => _connection.Open();

    protected override void ConfigureTestServices(IServiceCollection services)
    {
        services.RemoveAll<DbContextOptions<TDb>>();
        services.RemoveAll<IDbContextOptionsConfiguration<TDb>>();
        services.AddDbContext<TDb>(options => options.UseSqlite(_connection));
    }

    /// <summary>Runs <paramref name="action"/> against a fresh DbContext on the test database.</summary>
    public async Task<T> WithDb<T>(Func<TDb, Task<T>> action)
    {
        _ = Services; // make sure the host (and so the schema) exists
        await using var scope = Services.CreateAsyncScope();
        return await action(scope.ServiceProvider.GetRequiredService<TDb>());
    }

    public Task WithDb(Func<TDb, Task> action) => WithDb(async db =>
    {
        await action(db);
        return true;
    });

    /// <summary>Adds entities to the test database.</summary>
    public Task Seed(params object[] entities) => WithDb(async db =>
    {
        db.AddRange(entities);
        await db.SaveChangesAsync();
    });

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing) _connection.Dispose();
    }
}
