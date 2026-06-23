import { OrderHistory } from "../components/OrderHistory";
import type { Order, StoreSummary } from "../types";

interface Props {
  orders: Order[];
  stores: StoreSummary[];
}

export function OrdersPage({ orders, stores }: Props) {
  return (
    <>
      <aside className="sidebar">
        <section className="sidebar-panel page-sidebar">
          <span>History</span>
          <h2>{orders.length} orders</h2>
          <p>Recent orders appear here after checkout.</p>
        </section>
      </aside>
      <section className="content-area">
        <div className="content-header">
          <div>
            <span>Orders</span>
            <h1>Recent orders</h1>
          </div>
          <strong>{orders.length} total</strong>
        </div>
        <OrderHistory orders={orders} stores={stores} />
      </section>
    </>
  );
}
