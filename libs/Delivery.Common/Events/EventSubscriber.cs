using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Delivery.Common.Events;

/// <summary>
/// Subscribes a service to the events it handles once it starts. If
/// RabbitMQ isn't reachable yet, it keeps retrying in the background instead
/// of leaving the service deaf to the bus.
/// </summary>
public abstract class EventSubscriber(IEventBus bus, IServiceScopeFactory scopes, ILogger logger) : BackgroundService
{
    private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(5);

    protected IEventBus Bus { get; } = bus;

    protected abstract Task SubscribeAsync(CancellationToken cancellationToken);

    /// <summary>Subscribes a handler that runs in its own DI scope (and so gets its own DbContext).</summary>
    protected Task On<T>(string queueName, string routingKey, Func<IServiceProvider, T, Task> handler, CancellationToken cancellationToken) =>
        Bus.SubscribeAsync<T>(queueName, routingKey, async payload =>
        {
            await using var scope = scopes.CreateAsyncScope();
            await handler(scope.ServiceProvider, payload);
        }, cancellationToken);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SubscribeAsync(stoppingToken);
                return;
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(ex, "Failed to subscribe to the event bus; retrying in {Delay}", RetryDelay);
                await Task.Delay(RetryDelay, stoppingToken);
            }
        }
    }
}
