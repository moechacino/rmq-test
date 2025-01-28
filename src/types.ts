export interface Order {
  id: string;
  marketplace: "shopee" | "tokopedia" | "lazada";
  status: "unpaid" | "new-order" | "ready-to-ship" | "shipping" | "completed" | "cancelled";
  createdAt: Date;
}
