using System.Text.Json;

namespace Delivery.Common.Events;

public interface IEventBus
{
    /// <summary>Publishes an event onto the delivery_events exchange under the given routing key.</summary>
    Task PublishAsync<T>(string routingKey, T payload, CancellationToken cancellationToken = default);

    /// <summary>
    /// Subscribes to events matching a routing key through a durable, named
    /// queue. Unlike an exclusive queue, it survives restarts — events
    /// published while this service is down wait in RabbitMQ — and replicas
    /// of the same service share one queue instead of each handling every
    /// event. A handler that throws has its message dropped, not requeued.
    /// </summary>
    Task SubscribeAsync<T>(string queueName, string routingKey, Func<T, Task> handler, CancellationToken cancellationToken = default);

    /// <summary>
    /// Subscribes through a private, exclusive queue that lives only as long
    /// as this connection: every replica gets every event, and nothing is
    /// kept while the service is down. Messages are always acknowledged.
    /// </summary>
    Task SubscribeExclusiveAsync(string routingKey, Func<JsonElement, Task> handler, CancellationToken cancellationToken = default);
}

/// <summary>
/// The JSON format of event payloads, matching the contracts under
/// libs/events: camelCase, and amounts as plain JSON numbers.
/// </summary>
public static class EventJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
}
