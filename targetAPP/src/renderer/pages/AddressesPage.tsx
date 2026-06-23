import { AddressBook } from "../components/AddressBook";
import type { Address } from "../types";

interface Props {
  addresses: Address[];
  selectedAddress?: Address;
  selectedAddressId: string;
  onSelect(id: string): void;
  onCreate(address: Omit<Address, "id">): Promise<void>;
}

export function AddressesPage(props: Props) {
  return (
    <>
      <aside className="sidebar">
        <section className="sidebar-panel page-sidebar">
          <span>Saved places</span>
          <h2>{props.addresses.length} addresses</h2>
          <p>{props.selectedAddress ? props.selectedAddress.detail : "Pick the address used for delivery."}</p>
        </section>
      </aside>
      <section className="content-area">
        <div className="content-header">
          <div>
            <span>Account</span>
            <h1>Delivery addresses</h1>
          </div>
          <strong>{props.selectedAddress?.label ?? "None selected"}</strong>
        </div>
        <AddressBook
          addresses={props.addresses}
          selectedAddressId={props.selectedAddressId}
          onSelect={props.onSelect}
          onCreate={props.onCreate}
        />
      </section>
    </>
  );
}
