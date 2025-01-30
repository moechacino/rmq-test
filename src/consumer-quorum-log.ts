import amqp from "amqplib";
import { config } from "./config";
import { Order } from "./types";
import fs from "fs"; // Import fs module for file writing

class OrderConsumerLog {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;

  constructor(private consumerId: string) {}

  public async connect() {
    try {
      console.log(`Consumer ${this.consumerId} connecting...`);
      this.connection = await amqp.connect(config.amqpUrl);
      this.channel = await this.connection.createChannel();
      await this.channel.prefetch(1);

      this.consume();
    } catch (error) {
      console.error(`Consumer ${this.consumerId} connection error:`, error);
      setTimeout(() => this.connect(), 5000); // Retry connection after 5 seconds
    }
  }

  private async consume() {
    if (!this.channel) {
      throw new Error("Channel not established");
    }

    try {
      await this.channel.consume(config.queue, async (msg) => {
        if (!msg) return;
        this.channel?.ack(msg);

        try {
          const order: Order = JSON.parse(msg.content.toString());
          console.log(`Consumer ${this.consumerId} processing order: ${order.marketplace}_${order.id}_${order.status}`);

          // Write the message to message.log file
          this.writeMessageToLog(JSON.parse(msg.content.toString()).counter);

          console.log(`Consumer ${this.consumerId} completed order: ${order.marketplace}_${order.id}_${order.status}`);
        } catch (error) {
          console.error(`Consumer ${this.consumerId} processing error:`, error);
          // Reject and don't requeue - will go to DLX
          this.channel?.reject(msg, false);
          console.log(`Message sent to DLX queue: ${msg.content.toString()}`);
        }
      });
    } catch (error) {
      console.error(`Consumer ${this.consumerId} consume error:`, error);
      setTimeout(() => this.connect(), 500);
    }
  }

  // Helper function to write message to log file
  private writeMessageToLog(message: string): void {
    const logMessage = `order ${message}\n`; // Add newline for each message
    fs.appendFileSync("message.log", logMessage);
  }
}

export { OrderConsumerLog };
