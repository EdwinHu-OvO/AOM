import { ReceiptText } from "lucide-react";
import type { Order, StoreSummary } from "../types";

interface Props {
  orders: Order[];
  stores: StoreSummary[];
}

export function OrderHistory({ orders, stores }: Props) {
  return (
    <section className="side-section">
      <div className="section-heading compact-heading">
        <h2>Recent orders</h2>
        <ReceiptText size={18} />
      </div>
      <div className="order-list">
        {orders.length === 0 && <p className="muted">No orders yet.</p>}
        {orders.map((order) => {
          const store = stores.find((entry) => entry.id === order.storeId);
          return (
            <article className="order-card" key={order.id}>
              <strong>{store?.name ?? "Restaurant"}</strong>
              <span>{order.mode === "now" ? "Deliver now" : `Scheduled ${order.scheduledAt}`}</span>
              <b>${order.total.toFixed(2)}</b>
            </article>
          );
        })}
      </div>
    </section>
  );
}
