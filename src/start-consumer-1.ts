import { OrderConsumer } from "./consumer";

// Start consumers
async function startConsumer(id: string) {
  const consumer = new OrderConsumer(id);
  await consumer.connect();
}

startConsumer("C-1");
