import { FormEvent, useState } from "react";
import { Home, Plus } from "lucide-react";
import type { Address } from "../types";

interface Props {
  addresses: Address[];
  selectedAddressId?: string;
  onSelect(id: string): void;
  onCreate(address: Omit<Address, "id">): Promise<void>;
}

export function AddressBook({ addresses, selectedAddressId, onSelect, onCreate }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: "", receiver: "", phone: "", detail: "" });

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onCreate(form);
    setForm({ label: "", receiver: "", phone: "", detail: "" });
    setShowForm(false);
  }

  return (
    <section className="side-section">
      <div className="section-heading compact-heading">
        <h2>Delivery address</h2>
        <button className="icon-text" onClick={() => setShowForm((value) => !value)}>
          <Plus size={16} /> Add
        </button>
      </div>
      <div className="address-list">
        {addresses.map((address) => (
          <button
            className={address.id === selectedAddressId ? "address-card selected" : "address-card"}
            key={address.id}
            onClick={() => onSelect(address.id)}
          >
            <Home size={17} />
            <span>
              <strong>{address.label}</strong>
              <small>{address.receiver} · {address.phone}</small>
              <small>{address.detail}</small>
            </span>
          </button>
        ))}
      </div>
      {showForm && (
        <form className="address-form" onSubmit={submit}>
          <input placeholder="Label" value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} required />
          <input placeholder="Receiver" value={form.receiver} onChange={(event) => setForm({ ...form, receiver: event.target.value })} required />
          <input placeholder="Phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
          <textarea placeholder="Street, building, apartment" value={form.detail} onChange={(event) => setForm({ ...form, detail: event.target.value })} required />
          <button className="secondary-action" type="submit">Save address</button>
        </form>
      )}
    </section>
  );
}
