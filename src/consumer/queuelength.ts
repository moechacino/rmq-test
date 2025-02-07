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
  private totalDuration: number = 0;

  constructor(private consumerId: string) {}

  public async connect() {
    try {
      console.log(`Consumer ${this.consumerId} connecting...`);
      this.connection = await amqp.connect(config.amqpUrl);
      this.channel = await this.connection.createChannel();
      // Mengatur prefetch untuk membatasi jumlah pesan yang diambil sekaligus
      await this.channel.prefetch(1);
      this.consume();
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
      const msgStartTimeTotalDuration = Date.now();
      await this.channel.consume(config.queue, async (msg) => {
        // Mulai hitung waktu konsumsi pesan ini
        const msgStartTimeForPercentile = Date.now();
        if (!msg) return;

        try {
          // Ack pesan bila berhasil
          this.channel?.ack(msg);
        } catch (error) {
          console.error(`Consumer ${this.consumerId} processing error:`, error);
          // Jika terjadi error, kirim pesan ke DLX (tanpa requeue)
          this.channel?.reject(msg, false);
          console.log(`Message sent to DLX queue: ${msg.content.toString()}`);
        }

        // Hitung durasi konsumsi pesan
        const duration = Date.now() - msgStartTimeForPercentile;
        this.durations.push(duration);
        this.messagesConsumed++;

        // Jika sudah mencapai 10.000 pesan, hitung dan tampilkan persentil 95
        if (this.messagesConsumed === 100) {
          this.computeAndPrintPercentile95();
          // Opsional: jika ingin menghentikan consumer setelah 10.000 pesan, close koneksi.

          await this.connection?.close();
        }
      });

      const totalDuration = Date.now() - msgStartTimeTotalDuration;
      this.totalDuration += totalDuration;
      console.log(`Total duration: ${totalDuration} ms`);
    } catch (error) {
      console.error(`Consumer ${this.consumerId} consume error:`, error);
    }
  }

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
    console.dir(this.durations, { depth: Infinity });
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
