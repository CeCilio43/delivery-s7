using System.Collections.Concurrent;
using System.Text.Json;
using Delivery.Common.Events;

namespace Delivery.Testing;

/// <summary>An in-memory <see cref="IEventBus"/> that records what was published.</summary>
public sealed class FakeEventBus : IEventBus
{
    private readonly ConcurrentDictionary<string, Func<JsonElement, Task>> _handlers = new();
    private readonly ConcurrentQueue<Exception> _publishFailures = new();

    public ConcurrentQueue<(string RoutingKey, JsonElement Payload)> Published { get; } = new();

    /// <summary>Makes the next publish throw, as if RabbitMQ were unreachable.</summary>
    public void FailNextPublish() => _publishFailures.Enqueue(new InvalidOperationException("connection refused"));

    /// <summary>The payloads published under a routing key, in order.</summary>
    public IReadOnlyList<JsonElement> PublishedTo(string routingKey) =>
        Published.Where(p => p.RoutingKey == routingKey).Select(p => p.Payload).ToList();

    public void Clear() => Published.Clear();

    public Task PublishAsync<T>(string routingKey, T payload, CancellationToken cancellationToken = default)
    {
        if (_publishFailures.TryDequeue(out var failure)) return Task.FromException(failure);
        Published.Enqueue((routingKey, JsonSerializer.SerializeToElement(payload, EventJson.Options)));
        return Task.CompletedTask;
    }

    public Task SubscribeAsync<T>(string queueName, string routingKey, Func<T, Task> handler, CancellationToken cancellationToken = default)
    {
        _handlers[routingKey] = payload => handler(payload.Deserialize<T>(EventJson.Options)!);
        return Task.CompletedTask;
    }

    public Task SubscribeExclusiveAsync(string routingKey, Func<JsonElement, Task> handler, CancellationToken cancellationToken = default)
    {
        _handlers[routingKey] = handler;
        return Task.CompletedTask;
    }

    /// <summary>
    /// Delivers an event to the service's handler for it, waiting briefly
    /// for the service to have subscribed (that happens in the background).
    /// </summary>
    public async Task DeliverAsync(string routingKey, object payload)
    {
        var deadline = DateTime.UtcNow.AddSeconds(5);
        Func<JsonElement, Task>? handler;
        while (!_handlers.TryGetValue(routingKey, out handler))
        {
            if (DateTime.UtcNow > deadline) throw new InvalidOperationException($"Nothing subscribed to \"{routingKey}\"");
            await Task.Delay(20);
        }
        await handler(JsonSerializer.SerializeToElement(payload, EventJson.Options));
    }
}
