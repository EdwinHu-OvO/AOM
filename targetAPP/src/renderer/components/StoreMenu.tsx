import { Plus, Star } from "lucide-react";
import type { Product, Store } from "../types";

interface Props {
  store?: Store;
  products?: Product[];
  searchTerm: string;
  onAdd(product: Product): void;
}

export function StoreMenu({ store, products, searchTerm, onAdd }: Props) {
  if (!store) {
    return (
      <section className="menu-column empty-state">
        <h2>Pick a restaurant</h2>
        <p>Select a restaurant to see its menu and start an order.</p>
      </section>
    );
  }

  return (
    <section className="menu-column">
      <div className="restaurant-cover" style={{ background: store.image }}>
        <div>
          <h1>{store.name}</h1>
          <p>{store.tags.join(" · ")}</p>
        </div>
        <span><Star size={16} /> {store.rating}</span>
      </div>
      <div className="section-heading">
        <h2>Menu</h2>
        <span>{products?.length ?? store.products.length} items</span>
      </div>
      <div className="product-list">
        {products?.length === 0 && (
          <p className="muted">No menu items match "{searchTerm}".</p>
        )}
        {(products ?? store.products).map((product) => (
          <article className="product-row" key={product.id}>
            <div>
              <div className="product-title">
                <strong>{product.name}</strong>
                {product.popular && <span>Popular</span>}
              </div>
              <p>{product.description}</p>
              <b>${product.price.toFixed(2)}</b>
            </div>
            <button aria-label={`Add ${product.name}`} onClick={() => onAdd(product)}>
              <Plus size={18} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
