import fs from "fs";
import amqp from "amqplib";
import { config } from "../config";
export class TokopediaProducer {
  private channel: amqp.ConfirmChannel | null = null;
  private counter_unconfirmed: number = 0;
  private counter_confirmed: number = 0;
  private exchange = config.marketplace.tokopedia.exchange;
  private queues = config.marketplace.tokopedia.queues;
  constructor(private id: string) {}

  async connect() {
    const connection = await amqp.connect(config.amqpUrl);
    this.channel = await connection.createConfirmChannel();

    await this.channel.assertExchange(this.exchange, "direct", { durable: true });

    for (let queue of this.queues) {
      await this.channel.assertQueue(queue, {
        durable: true,
        arguments: {
          "x-queue-type": "quorum",
        },
      });
      await this.channel.bindQueue(queue, this.exchange, queue);
    }
  }

  async publishBatchOrders(orders: string[][]) {
    const promises = orders.map((batch, i) => {
      return new Promise<void>((resolve, reject) => {
        const queue = this.queues[i];
        for (let messageIndex = 0; messageIndex < batch.length; messageIndex++) {
          const message = batch[messageIndex];
          this.channel!.publish(this.exchange, queue, Buffer.from(message), { persistent: true }, (err, ok) => {
            if (err) {
              this.counter_unconfirmed++;
            } else {
              this.counter_confirmed++;
            }
          });
        }
        resolve();
      });
    });

    await Promise.all(promises);
    this.bufferedWriteLog(`t_unconfirmed${this.id}.log`, this.counter_unconfirmed);
    this.bufferedWriteLog(`t_confirmed${this.id}.log`, this.counter_confirmed);
    console.log(`Batch of Tokopedia ${orders.length} orders published successfully`);
  }

  batchOrders(totalOrder: number): string[][] {
    const messages = Array.from({ length: totalOrder }, (_, index) => `Pesan ke-${index + 1}`);
    const batchSize = totalOrder / 12;
    const batches = Array.from({ length: 12 }, (_, index) => messages.slice(index * batchSize, (index + 1) * batchSize));
    return batches;
  }

  private bufferedWriteLog(path: string, data: number): void {
    fs.appendFileSync(path, ` ${data}\n`);
  }
}

export async function runTokopediaPub(id: string) {
  const producer = new TokopediaProducer(id);
  await producer.connect();

  const totalOrder = config.batch_size;
  const INTERVAL = config.interval_request;
  const intervalLoop = async () => {
    while (true) {
      const orders = producer.batchOrders(totalOrder);
      try {
        await producer.publishBatchOrders(orders);
      } catch (err) {
        console.error("Failed to publish batch:", err);
      }
      await new Promise((resolve) => setTimeout(resolve, INTERVAL));
    }
  };

  await intervalLoop();
}
