import fs from "fs";
import amqp from "amqplib";
import { config } from "./config";
import { Order } from "./types";

export class OrderPublisherQuorum {
  constructor(private id: string) {}
  private channel: amqp.ConfirmChannel | null = null;
  private counter_unconfirmed: number = 0;
  private counter_confirmed: number = 0;
  private totalSend: number = 0;

  async connect() {
    try {
      const connection = await amqp.connect(config.amqpUrl);
      this.channel = await connection.createConfirmChannel();

      await this.channel.assertExchange(config.exchange, "direct", { durable: true });
      await this.channel.assertExchange(config.dlx.exchange, "direct", { durable: true });

      await this.channel.assertQueue(config.queue, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": config.dlx.exchange,
          "x-dead-letter-routing-key": config.dlx.queue,
          "x-queue-type": "quorum",
        },
      });

      await this.channel.assertQueue(config.dlx.queue, {
        durable: true,
        arguments: { "x-message-ttl": config.dlx.messageTTL },
      });

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

    this.totalSend += orders.length; // ✅ Perbaikan perhitungan totalSend

    try {
      for (const order of orders) {
        const isSent = this.channel.publish(config.exchange, config.queue, Buffer.from(JSON.stringify(order)), { persistent: true });

        if (!isSent) {
          this.counter_unconfirmed++;
        }
      }

      await this.channel.waitForConfirms(); // ✅ Menunggu semua konfirmasi sebelum lanjut
      this.counter_confirmed += orders.length - this.counter_unconfirmed;

      // ✅ Buffering log untuk menghindari terlalu banyak operasi disk
      this.bufferedWriteLog(`unconfirmed${this.id}.log`, this.counter_unconfirmed);
      this.bufferedWriteLog(`confirmed${this.id}.log`, this.counter_confirmed);
      this.bufferedWriteLog(`totalSend${this.id}.log`, this.totalSend);

      console.log(`Batch of ${orders.length} orders published successfully`);
    } catch (error) {
      console.error("Error publishing batch orders:", error);
      throw error;
    }
  }

  private bufferedWriteLog(path: string, data: number): void {
    fs.appendFileSync(path, ` ${data}\n`);
  }
}

export async function runPub(id: string) {
  let counter = 0;
  const publisher = new OrderPublisherQuorum(id);
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
          order.status = statusFlow[Math.floor(Math.random() * statusFlow.length)];
        }
        return order;
      });
  };

  const BATCH_SIZE = config.batch_size;
  const INTERVAL = config.interval_request;

  const intervalLoop = async () => {
    while (true) {
      const orders = generateBatchOrders(BATCH_SIZE);
      try {
        await publisher.publishBatchOrders(orders);
      } catch (err) {
        console.error("Failed to publish batch:", err);
      }
      await new Promise((resolve) => setTimeout(resolve, INTERVAL));
    }
  };

  intervalLoop();
}
