import amqp from "amqplib";
import { config } from "../config";
import fs from "fs";
class FailingProducer {
  private channel: amqp.ConfirmChannel | null = null;
  private counter_unconfirmed: number = 0;
  private counter_confirmed: number = 0;
  private counter: number = 0;
  private counter_blocked: number = 0;
  private readonly exchange = "fail.exchange";
  private readonly queue = "fail.queue";
  constructor(private readonly id: string) {}

  async connect() {
    const connection = await amqp.connect(config.amqpUrl);
    connection.on("blocked", (reason) => {
      console.log("koneksi terblokir");
      console.dir(reason, { depth: Infinity });

      this.counter_blocked++;
    });
    connection.on("unblocked", () => {
      console.log("Koneksi tidak lagi diblokir");
    });
    this.channel = await connection.createConfirmChannel();

    await this.channel.assertExchange(this.exchange, "direct", {
      durable: true,
    });

    await this.channel.assertQueue(this.queue, {
      durable: true,
      arguments: {
        "x-queue-type": "quorum",
      },
    });
    await this.channel.bindQueue(this.queue, this.exchange, this.queue);
  }

  async publish(batch: string[]) {
    const promises = batch.map(
      (data) =>
        new Promise<void>((resolve, reject) => {
          this.channel!.publish(this.exchange, this.queue, Buffer.from(JSON.stringify(data)), { persistent: true }, (err, ok) => {
            if (err) {
              this.counter_unconfirmed++;
            } else {
              this.counter_confirmed++;
            }
          });
          resolve();
        })
    );

    await Promise.all(promises);
    await this.channel!.waitForConfirms();

    if (this.counter_unconfirmed !== 0) this.bufferedWriteLog(`failing_unconfirmed.log`, this.counter_unconfirmed);

    this.bufferedWriteLog(`failing_confirmed.log`, this.counter_confirmed);
    this.bufferedWriteLog("failing_total.log", this.counter);

    if (this.counter_blocked !== 0) this.bufferedWriteLog("failing_blocked.log", this.counter_blocked);
    console.log(`pesan ke-${this.counter} published`);
  }

  private bufferedWriteLog(path: string, data: number): void {
    fs.appendFileSync(path, ` ${data}\n`);
  }

  generateBatchOrders(batchSize: number): string[] {
    return Array(batchSize)
      .fill(null)
      .map(() => {
        this.counter++;
        return `pesan ke-${this.counter}`;
      });
  }
}

async function delay(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

async function main(id: string) {
  const producer = new FailingProducer(id);
  await producer.connect();

  for (let i = 0; i < 100; i++) {
    const batch = producer.generateBatchOrders(10);
    await producer.publish(batch);
    await delay(1000);
  }
}

main("P1").then(() => console.log("finish"));
