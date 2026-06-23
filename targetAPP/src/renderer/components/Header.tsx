import { MapPin, Search, UserRound, X } from "lucide-react";
import type { Address, AppPage, User } from "../types";

interface Props {
  user: User;
  selectedAddress?: Address;
  activePage: AppPage;
  searchTerm: string;
  onPageChange(page: AppPage): void;
  onSearchChange(value: string): void;
}

const navItems: { id: AppPage; label: string }[] = [
  { id: "browse", label: "Browse" },
  { id: "addresses", label: "Addresses" },
  { id: "orders", label: "Orders" }
];

export function Header({ user, selectedAddress, activePage, searchTerm, onPageChange, onSearchChange }: Props) {
  return (
    <header className="topbar">
      <div>
        <span className="brand-mark compact">PlateRun</span>
        <div className="delivery-chip">
          <MapPin size={16} />
          <span>{selectedAddress ? `${selectedAddress.label}: ${selectedAddress.detail}` : "Choose address"}</span>
        </div>
      </div>
      <nav className="header-nav" aria-label="Primary">
        {navItems.map((item) => (
          <button
            className={activePage === item.id ? "active" : ""}
            key={item.id}
            onClick={() => onPageChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="search-box">
        <Search size={18} />
        <input
          aria-label="Search food or restaurants"
          placeholder="Search food or restaurants"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        {searchTerm && (
          <button aria-label="Clear search" onClick={() => onSearchChange("")}>
            <X size={16} />
          </button>
        )}
      </div>
      <div className="user-chip">
        <UserRound size={18} />
        <span>{user.name}</span>
      </div>
    </header>
  );
}
