import amqp from "amqplib";
async function sendMessage() {
  const connection = await amqp.connect("amqp://localhost");
  const channel = await connection.createConfirmChannel();

  // Menggunakan exchange yang tidak ada atau salah penulisan
  const exchange = "nonexistent_exchange"; // Exchange yang tidak ada
  const routingKey = "test_routing_key"; // Routing key yang tidak valid
  const message = "Hello, this will trigger NACK!";

  // Mencoba mengirim pesan ke exchange yang tidak ada
  channel.publish(exchange, routingKey, Buffer.from(message), {}, (err: any, ok: any) => {
    if (err) {
      console.log("Message NACK received:", err);
    } else {
      console.log("Message Acknowledged");
    }
  });

  // Menangani callback untuk NACK
  channel.on("return", (message: any) => {
    console.log("Message returned: ", message);
  });

  // Menutup koneksi setelah pengujian selesai
  setTimeout(() => {
    channel.close();
    connection.close();
  }, 500);
}

sendMessage().catch(console.error);
