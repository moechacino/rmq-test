import amqp from "amqplib";
import { config } from "./../config";
import { Order } from "./../types";
import fs from "fs";

class OrderConsumerLog {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  // Menghitung jumlah pesan yang telah dikonsumsi
  private messagesConsumed: number = 0;
  // Array untuk menyimpan durasi proses tiap pesan (ms)
  private durations: number[] = [];

  constructor(private consumerId: string) {}

  public async connect() {
    try {
      console.log(`Consumer ${this.consumerId} connecting...`);
      this.connection = await amqp.connect(config.amqpUrl);
      this.channel = await this.connection.createChannel();
      // Mengatur prefetch untuk membatasi jumlah pesan yang diambil sekaligus
      await this.channel.prefetch(1);
      // this.consume();
    } catch (error) {
      console.error(`Consumer ${this.consumerId} connection error:`, error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  // Method untuk mengecek panjang queue (opsional)
  public async checkQueueLength(): Promise<number> {
    if (!this.channel) {
      throw new Error("Channel not established");
    }
    const startTime = Date.now();
    try {
      const queueInfo = await this.channel.assertQueue(config.queue, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": config.dlx.exchange,
          "x-dead-letter-routing-key": config.dlx.queue,
        },
      });
      const responseTime = (Date.now() - startTime) / 1000;
      console.log(`[Queue Check] Current queue length: ${queueInfo.messageCount}, Response time: ${responseTime.toFixed(3)} seconds`);
      return queueInfo.messageCount;
    } catch (error) {
      console.error(`Failed to check queue length: ${error}`);
      throw error;
    }
  }

  private async consume() {
    if (!this.channel) {
      throw new Error("Channel not established");
    }

    try {
      const msgStartTime = Date.now();
      for (let i = 0; i < 100; i++) {
        const message = await this.channel.get(config.queue);
        this.channel.ack(message as amqp.Message);
      }
      const totalDuration = Date.now() - msgStartTime;
      console.log(`Processed 100 messages in ${totalDuration} ms`);
    } catch (error) {
      console.error(`Consumer ${this.consumerId} consume error:`, error);
    }
  }
  // cloud in 100 : 44,188 ms
  // local in 100 : 48 ms
  private computeAndPrintPercentile95() {
    if (this.durations.length === 0) {
      console.log("No durations to calculate.");
      return;
    }
    // Mengurutkan array durasi secara ascending
    const sortedDurations = [...this.durations].sort((a, b) => a - b);
    // Menghitung indeks untuk persentil 95
    const index95 = Math.floor(0.95 * sortedDurations.length);
    const percentile95 = sortedDurations[index95];
    let total = 0;
    for (let s of this.durations) {
      total += s;
    }
    console.log(this.durations.length);
    console.log(total);
    console.log(`Processed ${this.messagesConsumed} messages.`);
    console.log(`95th percentile processing time: ${percentile95} ms per message.`);
    console.log(`Mean: ${total / this.durations.length}`);
  }

  private writeMessageToLog(message: string): void {
    const logMessage = `order ${message}\n`;
    fs.appendFileSync(`msg_${this.consumerId}.log`, logMessage);
  }
}

async function main() {
  const consumer = new OrderConsumerLog("consumer1");
  await consumer.connect();

  // Opsional: cek panjang queue setiap 5 detik
  setInterval(async () => {
    await consumer.checkQueueLength();
  }, 5000);
}

main().catch((err) => console.error(err));
