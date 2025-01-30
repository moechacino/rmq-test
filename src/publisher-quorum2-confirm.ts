import fs from "fs";
import amqp from "amqplib";
import { config } from "./config";
import { Order } from "./types";
class OrderPublisher {
  private channel: amqp.ConfirmChannel | null = null;
  private counter_unconfirmed: number = 0;
  private counter_confirmed: number = 0;
  async connect() {
    try {
      const connection = await amqp.connect(config.amqpUrl);
      this.channel = await connection.createConfirmChannel(); // Confirm channel

      this.channel.on("ack", () => {
        this.counter_confirmed++;
      });
      this.channel.on("nack", () => {
        this.counter_unconfirmed++;
      });
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
          "x-queue-type": "quorum",
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
      await this.channel.bindQueue(config.dlx.queue, config.dlx.exchange, config.dlx.queue);

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
      const promises = orders.map(
        (order) =>
          new Promise((resolve, reject) => {
            this.channel!.publish(config.exchange, config.queue, Buffer.from(JSON.stringify(order)), { persistent: true }, (err, ok) => {});
            resolve(true);
          })
      );

      await Promise.all(promises);
      await this.channel.waitForConfirms();
      this.writeMessageToLog(this.counter_unconfirmed.toString(), "unconfirmed.log");
      this.writeMessageToLog(this.counter_confirmed.toString(), "confirmed.log");
      console.log(`Batch of ${orders.length} orders published successfully`);
    } catch (error) {
      console.error("Error publishing batch orders:", error);
      throw error;
    }
  }
  private writeMessageToLog(message: string, path: string): void {
    const logMessage = ` ${message}\n`; // Add newline for each message
    fs.appendFile(path, logMessage, (err) => {
      if (err) {
        console.error("Error writing to message.log:", err);
      }
    });
  }
}

// Test publisher
async function test() {
  let counter = 0;
  const publisher = new OrderPublisher();
  await publisher.connect();

  const statusFlow: Order["status"][] = ["unpaid", "new-order", "ready-to-ship", "shipping", "completed"];

  const generateNewOrder = (): any => ({
    id: Math.random().toString(36).substring(7),
    marketplace: ["shopee", "tokopedia", "lazada"][Math.floor(Math.random() * 3)] as any,
    status: "unpaid",
    createdAt: new Date(),
    counter,
  });

  const generateBatchOrders = (batchSize: number): Order[] => {
    return Array(batchSize)
      .fill(null)
      .map(() => {
        counter++;
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
    try {
      await publisher.publishBatchOrders(orders);
    } catch (err) {
      console.error("Failed to publish batch:", err);
    }
  }, INTERVAL);
}

test();
