import { Clock, Star } from "lucide-react";
import type { Category, StoreSummary } from "../types";

interface Props {
  categories: Category[];
  stores: StoreSummary[];
  activeCategory: string;
  selectedStoreId?: string;
  searchTerm: string;
  onCategoryChange(id: string): void;
  onSelectStore(id: string): void;
}

export function StoreList({
  categories,
  stores,
  activeCategory,
  selectedStoreId,
  searchTerm,
  onCategoryChange,
  onSelectStore
}: Props) {
  return (
    <section className="sidebar-panel store-column">
      <div className="section-heading">
        <h2>Restaurants</h2>
        <span>{stores.length} open now</span>
      </div>
      <div className="category-tabs">
        {categories.map((category) => (
          <button
            className={category.id === activeCategory ? "active" : ""}
            key={category.id}
            onClick={() => onCategoryChange(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>
      <div className="store-list">
        {stores.length === 0 && (
          <p className="muted">No restaurants match {searchTerm ? `"${searchTerm}"` : "this category"}.</p>
        )}
        {stores.map((store) => (
          <button
            className={`store-card ${store.id === selectedStoreId ? "selected" : ""}`}
            key={store.id}
            onClick={() => onSelectStore(store.id)}
          >
            <span className="store-art" style={{ background: store.image }} />
            <span className="store-body">
              <strong>{store.name}</strong>
              <span className="tag-line">{store.tags.join(" · ")}</span>
              <span className="metrics">
                <span><Star size={14} /> {store.rating}</span>
                <span><Clock size={14} /> {store.deliveryMinutes} min</span>
                <span>${store.deliveryFee.toFixed(0)} delivery</span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
