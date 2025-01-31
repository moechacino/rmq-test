import amqp from "amqplib";

const EXCHANGE_NAME = "test_exchange";

async function publishMessages() {
  const connection = await amqp.connect("amqp://localhost");
  const channel = await connection.createConfirmChannel(); // Publisher Confirms Mode

  await channel.assertExchange(EXCHANGE_NAME, "direct", { durable: true });

  let unconfirmedCount = 0;
  const totalMessages = 500000; // Kirim banyak pesan agar broker overload

  for (let i = 1; i <= totalMessages; i++) {
    const message = `Message ${i}`;
    const sent = channel.publish(EXCHANGE_NAME, "test_key", Buffer.from(message), {});

    if (!sent) {
      console.log(`RabbitMQ buffer penuh pada pesan ${i}, kemungkinan pesan akan tetap unconfirmed.`);
      break; // Hentikan jika buffer penuh
    }

    unconfirmedCount++;

    if (i % 1000 === 0) {
      await new Promise((resolve) => channel.waitForConfirms());
      console.log(`Batch 1000 pesan dikonfirmasi.`);
      unconfirmedCount = 0;
    }
  }

  console.log(`Total pesan unconfirmed: ${unconfirmedCount}`);
  setTimeout(() => connection.close(), 5000);
}

publishMessages();
