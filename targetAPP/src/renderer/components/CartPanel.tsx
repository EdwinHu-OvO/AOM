import { CalendarClock, Minus, Plus, ShoppingBag, Truck } from "lucide-react";
import type { CartItem, DeliveryMode, Store } from "../types";

interface Props {
  store?: Store;
  items: CartItem[];
  mode: DeliveryMode;
  scheduledAt: string;
  canCheckout: boolean;
  onModeChange(mode: DeliveryMode): void;
  onScheduleChange(value: string): void;
  onIncrement(productId: string): void;
  onDecrement(productId: string): void;
  onCheckout(): Promise<void>;
}

export function CartPanel(props: Props) {
  const subtotal = props.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const fee = props.store ? props.store.deliveryFee : 0;
  const total = subtotal + fee;

  return (
    <section className="side-section cart-section">
      <div className="section-heading compact-heading">
        <h2>Your order</h2>
        <ShoppingBag size={18} />
      </div>
      <div className="delivery-toggle">
        <button className={props.mode === "now" ? "active" : ""} onClick={() => props.onModeChange("now")}>
          <Truck size={16} /> Now
        </button>
        <button className={props.mode === "scheduled" ? "active" : ""} onClick={() => props.onModeChange("scheduled")}>
          <CalendarClock size={16} /> Schedule
        </button>
      </div>
      {props.mode === "scheduled" && (
        <input className="schedule-input" type="datetime-local" value={props.scheduledAt} onChange={(event) => props.onScheduleChange(event.target.value)} />
      )}
      <div className="cart-items">
        {props.items.length === 0 && <p className="muted">Add items from a menu to start.</p>}
        {props.items.map((item) => (
          <div className="cart-row" key={item.product.id}>
            <span>
              <strong>{item.product.name}</strong>
              <small>${item.product.price.toFixed(2)}</small>
            </span>
            <div className="quantity">
              <button onClick={() => props.onDecrement(item.product.id)}><Minus size={14} /></button>
              <b>{item.quantity}</b>
              <button onClick={() => props.onIncrement(item.product.id)}><Plus size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="totals">
        <span>Subtotal <b>${subtotal.toFixed(2)}</b></span>
        <span>Delivery <b>${fee.toFixed(2)}</b></span>
        <strong>Total <b>${total.toFixed(2)}</b></strong>
      </div>
      <button className="primary-action" disabled={!props.canCheckout} onClick={props.onCheckout}>
        Place order
      </button>
    </section>
  );
}
