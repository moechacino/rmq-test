import dotenv from "dotenv";
dotenv.config();

export const config = {
  amqpUrl: process.env.AMQP_URL || "",
  exchange: "orders.exchange",
  queue: "orders.processing",
  dlx: {
    exchange: "orders.dlx.exchange",
    queue: "orders.dlx.queue",
    messageTTL: 60000, // 60 seconds
  },
  batch_size: 10000, // 1000 request
  interval_request: 1000, // 1 second

  marketplace: {
    shopee: {
      exchange: "shopee.exchange",
      queues: [
        "shopee.orders.a",
        "shopee.orders.b",
        "shopee.orders.c",
        "shopee.orders.d",
        "shopee.orders.e",
        "shopee.orders.f",
        "shopee.orders.g",
        "shopee.orders.h",
        "shopee.orders.i",
        "shopee.orders.j",
        "shopee.orders.k",
        "shopee.orders.l",
      ],
    },
    tokopedia: {
      exchange: "tokopedia.exchange",
      queues: [
        "tokopedia.orders.a",
        "tokopedia.orders.b",
        "tokopedia.orders.c",
        "tokopedia.orders.d",
        "tokopedia.orders.e",
        "tokopedia.orders.f",
        "tokopedia.orders.g",
        "tokopedia.orders.h",
        "tokopedia.orders.i",
        "tokopedia.orders.j",
        "tokopedia.orders.k",
        "tokopedia.orders.l",
      ],
    },
    lazada: {
      exchange: "lazada.exchange",
      queues: [
        "lazada.orders.a",
        "lazada.orders.b",
        "lazada.orders.c",
        "lazada.orders.d",
        "lazada.orders.e",
        "lazada.orders.f",
        "lazada.orders.g",
        "lazada.orders.h",
        "lazada.orders.i",
        "lazada.orders.j",
        "lazada.orders.k",
        "lazada.orders.l",
      ],
    },
  },
};
