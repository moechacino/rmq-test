import amqp from "amqplib";
import fs from "fs";
import { config } from "../config";

export class ShopeeConsumer {
  constructor(private consumerId: string) {}
  private exchange = config.marketplace.shopee.exchange;
  private queues = config.marketplace.shopee.queues;
  private channel: amqp.Channel | null = null;

  async connect() {
    try {
      const connection = await amqp.connect(config.amqpUrl);
      this.channel = await connection.createChannel();
    } catch (error) {
      console.log("can not connect");
    }
  }

  async consume() {
    try {
      await this.channel!.consume(config.queue, async (msg) => {
        if (!msg) return;
        this.channel?.ack(msg);

        try {
          console.log(`Consumer ${this.consumerId} processing : ${msg.content.toString()}`);

          // Write the message to message.log file
          this.writeMessageToLog("s_msg.log", msg.content.toString());
        } catch (error) {
          // Reject and don't requeue - will go to DLX
          this.channel?.reject(msg, false);
        }
      });
    } catch (error) {
      console.error(`Consumer ${this.consumerId} consume error:`, error);
      setTimeout(() => this.connect(), 500);
    }
  }

  private writeMessageToLog(path: string, message: string): void {
    const logMessage = `order ${message}\n`; // Add newline for each message
    fs.appendFileSync(path, logMessage);
  }
}
