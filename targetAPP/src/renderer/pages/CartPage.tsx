import { AddressBook } from "../components/AddressBook";
import { CartPanel } from "../components/CartPanel";
import type { Address, CartItem, DeliveryMode, Store } from "../types";

interface Props {
  store?: Store;
  addresses: Address[];
  selectedAddress?: Address;
  selectedAddressId: string;
  items: CartItem[];
  mode: DeliveryMode;
  scheduledAt: string;
  canCheckout: boolean;
  onSelectAddress(id: string): void;
  onCreateAddress(address: Omit<Address, "id">): Promise<void>;
  onModeChange(mode: DeliveryMode): void;
  onScheduleChange(value: string): void;
  onIncrement(productId: string): void;
  onDecrement(productId: string): void;
  onCheckout(): Promise<void>;
}

export function CartPage(props: Props) {
  return (
    <>
      <aside className="sidebar">
        <section className="sidebar-panel page-sidebar">
          <span>Checkout</span>
          <h2>{props.store?.name ?? "No restaurant selected"}</h2>
          <p>{props.selectedAddress ? props.selectedAddress.detail : "Select a delivery address before ordering."}</p>
        </section>
      </aside>
      <section className="content-area">
        <div className="content-header">
          <div>
            <span>Cart</span>
            <h1>Review and place order</h1>
          </div>
          <strong>{props.items.length} items</strong>
        </div>
        <div className="cart-page-grid">
          <CartPanel
            store={props.store}
            items={props.items}
            mode={props.mode}
            scheduledAt={props.scheduledAt}
            canCheckout={props.canCheckout}
            onModeChange={props.onModeChange}
            onScheduleChange={props.onScheduleChange}
            onIncrement={props.onIncrement}
            onDecrement={props.onDecrement}
            onCheckout={props.onCheckout}
          />
          <AddressBook
            addresses={props.addresses}
            selectedAddressId={props.selectedAddressId}
            onSelect={props.onSelectAddress}
            onCreate={props.onCreateAddress}
          />
        </div>
      </section>
    </>
  );
}
