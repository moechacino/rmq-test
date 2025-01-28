import { OrderConsumerLog } from "./consumer-log";

// Start consumers
async function startConsumer(id: string) {
  const consumer = new OrderConsumerLog(id);
  await consumer.connect();
}

startConsumer("C-5");
