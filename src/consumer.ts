import amqp from "amqplib";
import { config } from "./config";
import { Order } from "./types";

class OrderConsumer {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;

  constructor(private consumerId: string) {}

  public async connect() {
    try {
      console.log(`Consumer ${this.consumerId} connecting...`);
      this.connection = await amqp.connect(config.amqpUrl);
      this.channel = await this.connection.createChannel();
      await this.channel.prefetch(1);
      // Setup queues and exchanges
      // await this.setupQueues();

      // Start consuming messages
      this.consume();
    } catch (error) {
      console.error(`Consumer ${this.consumerId} connection error:`, error);
      setTimeout(() => this.connect(), 5000); // Retry connection after 5 seconds
    }
  }

  private async setupQueues() {
    if (!this.channel) {
      throw new Error("Channel not established");
    }

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
    await this.channel.bindQueue(config.dlx.queue, config.dlx.exchange, config.dlx.queue);

    console.log("Queues and exchanges are set up with DLX");
  }

  private async consume() {
    if (!this.channel) {
      throw new Error("Channel not established");
    }

    try {
      await this.channel.consume(config.queue, async (msg) => {
        if (!msg) return;
        this.channel?.ack(msg);

        // try {
        //   const order: Order = JSON.parse(msg.content.toString());
        //   console.log(
        //     `Consumer ${this.consumerId} processing order: ${order.marketplace}_${order.id}_${order.status}`
        //   );

        //   await this.processOrder(order).catch((error) => {
        //     throw new Error(`Order processing error: ${error.message}`);
        //   });
        //   this.channel?.ack(msg);
          
        //   console.log(
        //     `Consumer ${this.consumerId} completed order: ${order.marketplace}_${order.id}_${order.status}`
        //   );
        // } catch (error) {
        //   console.error(`Consumer ${this.consumerId} processing error:`, error);
        //   // Reject and don't requeue - will go to DLX
        //   this.channel?.reject(msg, false);
        //   console.log(`Message sent to DLX queue: ${msg.content.toString()}`);
        // }
      });
    } catch (error) {
      console.error(`Consumer ${this.consumerId} consume error:`, error);
      setTimeout(() => this.connect(), 5000);
    }
  }

  private async processOrder(order: Order): Promise<void> {
    // Simulate processing logic
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() < 0.3) {
          reject(new Error("Simulated processing error"));
        } else {
          resolve();
        }
      }, 1000);
    });
  }
}

export { OrderConsumer };
