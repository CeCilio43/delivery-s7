using System.Text.Json;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace Delivery.Common.Events;

/// <summary>
/// RabbitMQ implementation of <see cref="IEventBus"/>. Every service shares
/// one topic exchange; routing keys follow the "&lt;entity&gt;.&lt;event&gt;"
/// convention documented as JSON schemas under libs/events (e.g.
/// "order.created", "payment.succeeded"). Connects lazily on first use.
/// </summary>
public sealed class RabbitMqEventBus(string url, ILogger<RabbitMqEventBus> logger) : IEventBus, IAsyncDisposable
{
    public const string Exchange = "delivery_events";

    private readonly SemaphoreSlim _connectLock = new(1, 1);
    private readonly SemaphoreSlim _publishLock = new(1, 1);
    private IConnection? _connection;
    private IChannel? _channel;

    private async Task<IChannel> ChannelAsync(CancellationToken cancellationToken)
    {
        if (_channel is { IsOpen: true }) return _channel;

        await _connectLock.WaitAsync(cancellationToken);
        try
        {
            if (_channel is { IsOpen: true }) return _channel;

            if (_connection is not null) await _connection.DisposeAsync();
            var factory = new ConnectionFactory { Uri = new Uri(url) };
            _connection = await factory.CreateConnectionAsync(cancellationToken);
            _channel = await _connection.CreateChannelAsync(cancellationToken: cancellationToken);
            await _channel.ExchangeDeclareAsync(Exchange, ExchangeType.Topic, durable: true, cancellationToken: cancellationToken);
            return _channel;
        }
        finally
        {
            _connectLock.Release();
        }
    }

    public async Task PublishAsync<T>(string routingKey, T payload, CancellationToken cancellationToken = default)
    {
        var channel = await ChannelAsync(cancellationToken);
        var body = JsonSerializer.SerializeToUtf8Bytes(payload, EventJson.Options);
        var properties = new BasicProperties { ContentType = "application/json", Persistent = true };

        await _publishLock.WaitAsync(cancellationToken);
        try
        {
            await channel.BasicPublishAsync(Exchange, routingKey, mandatory: false, properties, body, cancellationToken);
        }
        finally
        {
            _publishLock.Release();
        }
    }

    public async Task SubscribeAsync<T>(string queueName, string routingKey, Func<T, Task> handler, CancellationToken cancellationToken = default)
    {
        var channel = await ChannelAsync(cancellationToken);
        await channel.QueueDeclareAsync(queueName, durable: true, exclusive: false, autoDelete: false, cancellationToken: cancellationToken);
        await channel.QueueBindAsync(queueName, Exchange, routingKey, cancellationToken: cancellationToken);

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += async (_, message) =>
        {
            try
            {
                var payload = JsonSerializer.Deserialize<T>(message.Body.Span, EventJson.Options)!;
                await handler(payload);
                await channel.BasicAckAsync(message.DeliveryTag, multiple: false);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to handle \"{RoutingKey}\" event", routingKey);
                // Not requeued: a handler that failed once will most likely fail the
                // same way again, and requeueing would spin on this message forever.
                await channel.BasicNackAsync(message.DeliveryTag, multiple: false, requeue: false);
            }
        };
        await channel.BasicConsumeAsync(queueName, autoAck: false, consumer, cancellationToken);
    }

    public async Task SubscribeExclusiveAsync(string routingKey, Func<JsonElement, Task> handler, CancellationToken cancellationToken = default)
    {
        var channel = await ChannelAsync(cancellationToken);
        var queue = await channel.QueueDeclareAsync(string.Empty, durable: false, exclusive: true, autoDelete: true, cancellationToken: cancellationToken);
        await channel.QueueBindAsync(queue.QueueName, Exchange, routingKey, cancellationToken: cancellationToken);

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += async (_, message) =>
        {
            try
            {
                using var document = JsonDocument.Parse(message.Body);
                await handler(document.RootElement.Clone());
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to handle \"{RoutingKey}\" event", routingKey);
            }
            finally
            {
                await channel.BasicAckAsync(message.DeliveryTag, multiple: false);
            }
        };
        await channel.BasicConsumeAsync(queue.QueueName, autoAck: false, consumer, cancellationToken);
    }

    public async ValueTask DisposeAsync()
    {
        if (_channel is not null) await _channel.DisposeAsync();
        if (_connection is not null) await _connection.DisposeAsync();
    }
}
