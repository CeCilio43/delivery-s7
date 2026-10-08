import amqplib, { type ChannelModel, type Channel, type ConsumeMessage } from 'amqplib';

// Same topic exchange every publisher on the bus writes to (see
// restaurant-service/src/events/eventBus.ts and libs/events/*.json).
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
 * Subscribes to events matching a routing key (e.g. "hello.world") using a
 * private, exclusive queue bound to the shared exchange, and invokes the
 * handler for each message.
 */
export async function subscribeToEvent(
  routingKey: string,
  handler: (payload: unknown) => void,
): Promise<void> {
  const { channel } = await connect();
  const { queue } = await channel.assertQueue('', { exclusive: true });
  await channel.bindQueue(queue, EXCHANGE, routingKey);

  await channel.consume(queue, (msg: ConsumeMessage | null) => {
    if (!msg) return;
    try {
      handler(JSON.parse(msg.content.toString()));
    } catch (err) {
      console.error(`Failed to handle "${routingKey}" event`, err);
    } finally {
      channel.ack(msg);
    }
  });
}
