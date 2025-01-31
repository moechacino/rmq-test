import amqp from "amqplib";
import fs from "fs";
import { config } from "../config";

export class LazadaConsumer {
  constructor(private consumerId: string) {}
  private queues = config.marketplace.lazada.queues;
  private channel: amqp.Channel | null = null;

  async connect() {
    try {
      const connection = await amqp.connect(config.amqpUrl);
      this.channel = await connection.createChannel();
      await this.channel.prefetch(1);
    } catch (error) {
      console.log("can not connect");
      setTimeout(() => this.connect(), 5000);
    }
  }

  async consume() {
    try {
      const promises = this.queues.map((queue) => {
        return new Promise<void>((resolve, reject) => {
          this.channel?.consume(queue, async (msg) => {
            if (!msg) return;
            try {
              console.log(`Consumer ${this.consumerId} processing: ${msg.content.toString()}`);

              // Acknowledge the message
              this.channel?.ack(msg);

              // Write the message to log file
              this.writeMessageToLog(`l_msg_${this.consumerId}.log`, `${queue}_${msg.content.toString()}`);
              resolve();
            } catch (error) {
              // Reject the message if error occurs, do not requeue
              this.channel?.reject(msg, false);
              console.error(`Consumer ${this.consumerId} failed to process message`, error);
              resolve();
            }
          });
        });
      });

      // Wait for all queues to start consuming messages
      await Promise.all(promises);
    } catch (error) {
      console.error(`Consumer ${this.consumerId} consume error:`, error);
      setTimeout(() => this.connect(), 5000); // Retry connecting in case of failure
    }
  }

  private writeMessageToLog(path: string, message: string): void {
    const logMessage = `order ${message}\n`; // Add newline for each message
    fs.appendFileSync(path, logMessage);
  }
}

export async function runLazadaConsumer(id: string) {
  const consumer = new LazadaConsumer(id);
  await consumer.connect();
  await consumer.consume();
}
