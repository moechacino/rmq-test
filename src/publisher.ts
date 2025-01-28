import amqp from "amqplib";
import { config } from "./config";
import { Order } from "./types";

class OrderPublisher {
  private channel: amqp.Channel | null = null;

  async connect() {
    try {
      const connection = await amqp.connect(config.amqpUrl);
      this.channel = await connection.createChannel();

      // Main exchange
      await this.channel.assertExchange(config.exchange, "direct", {
        durable: true,
      });

      // DLX exchange
      await this.channel.assertExchange(config.dlx.exchange, "direct", {
        durable: true,
      });

      // Main queue
      await this.channel.assertQueue(config.queue, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": config.dlx.exchange,
          "x-dead-letter-routing-key": config.dlx.queue,
        },
      });

      // DLX queue
      await this.channel.assertQueue(config.dlx.queue, {
        durable: true,
        arguments: {
          "x-message-ttl": config.dlx.messageTTL,
        },
      });

      // Bindings
      await this.channel.bindQueue(config.queue, config.exchange, config.queue);
      await this.channel.bindQueue(
        config.dlx.queue,
        config.dlx.exchange,
        config.dlx.queue
      );

      console.log("Publisher connected to RabbitMQ with DLX configuration");
    } catch (error) {
      console.error("Error connecting to RabbitMQ:", error);
      throw error;
    }
  }

  async publishBatchOrders(orders: Order[]) {
    if (!this.channel) {
      throw new Error("Channel not established");
    }

    try {
      const promises = orders.map((order) =>
        this.channel!.publish(
          config.exchange,
          config.queue,
          Buffer.from(JSON.stringify(order)),
          { persistent: true }
        )
      );

      await Promise.all(promises);
      console.log(`Batch of ${orders.length} orders published successfully`);
    } catch (error) {
      console.error("Error publishing batch orders:", error);
      throw error;
    }
  }
}

// Test publisher
async function test() {
  const publisher = new OrderPublisher();
  await publisher.connect();

  const statusFlow: Order["status"][] = [
    "unpaid",
    "new-order",
    "ready-to-ship",
    "shipping",
    "completed",
  ];

  const generateNewOrder = (): Order => ({
    id: Math.random().toString(36).substring(7),
    marketplace: ["shopee", "tokopedia", "lazada"][
      Math.floor(Math.random() * 3)
    ] as any,
    status: "unpaid",
    createdAt: new Date(),
  });

  const generateBatchOrders = (batchSize: number): Order[] => {
    return Array(batchSize)
      .fill(null)
      .map(() => {
        const order = generateNewOrder();
        if (Math.random() < 0.2) {
          order.status = "cancelled";
        } else {
          const nextIndex = Math.floor(Math.random() * statusFlow.length);
          order.status = statusFlow[nextIndex];
        }
        return order;
      });
  };

  const BATCH_SIZE = config.batch_size;
  const INTERVAL = config.interval_request;

  setInterval(async () => {
    const orders = generateBatchOrders(BATCH_SIZE);
    await publisher.publishBatchOrders(orders);
  }, INTERVAL);
}

test();
