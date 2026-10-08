import amqplib, { type ChannelModel, type Channel, type ConsumeMessage } from 'amqplib';

// Topic exchange shared by every service on the bus. Routing keys follow the
// "<entity>.<event>" convention documented as JSON schemas under libs/events
// (e.g. "hello.world", "order.confirmed").
const EXCHANGE = 'delivery_events';

let connectionPromise: Promise<{ connection: ChannelModel; channel: Channel }> | null = null;

function connect() {
  if (!connectionPromise) {
    const url = process.env.RABBITMQ_URL ?? 'amqp://localhost:5672';
    connectionPromise = amqplib
      .connect(url)
      .then(async (connection) => {
        const channel = await connection.createChannel();
        await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
        return { connection, channel };
      })
      .catch((err) => {
        connectionPromise = null;
        throw err;
      });
  }
  return connectionPromise;
}

/**
 * Publishes an event onto the delivery_events exchange under the given
 * routing key. Connects to RabbitMQ lazily on first use.
 */
export async function publishEvent(routingKey: string, payload: unknown): Promise<void> {
  const { channel } = await connect();
  channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), {
    contentType: 'application/json',
    persistent: true,
  });
}

/**
 * Subscribes to events matching a routing key through a durable, named
 * queue. Unlike an exclusive queue, it survives restarts — events published
 * while this service is down wait in RabbitMQ — and replicas of the same
 * service share one queue instead of each handling every event.
 */
export async function subscribeToEvent<T>(
  queueName: string,
  routingKey: string,
  handler: (payload: T) => Promise<void>,
): Promise<void> {
  const { channel } = await connect();
  await channel.assertQueue(queueName, { durable: true });
  await channel.bindQueue(queueName, EXCHANGE, routingKey);

  await channel.consume(queueName, async (msg: ConsumeMessage | null) => {
    if (!msg) return;
    try {
      await handler(JSON.parse(msg.content.toString()) as T);
      channel.ack(msg);
    } catch (err) {
      console.error(`Failed to handle "${routingKey}" event`, err);
      // Not requeued: a handler that failed once will most likely fail the
      // same way again, and requeueing would spin on this message forever.
      channel.nack(msg, false, false);
    }
  });
}
