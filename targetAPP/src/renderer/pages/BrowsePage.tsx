import { StoreList } from "../components/StoreList";
import { StoreMenu } from "../components/StoreMenu";
import type { Category, Product, Store, StoreSummary } from "../types";

interface Props {
  categories: Category[];
  stores: StoreSummary[];
  activeCategory: string;
  selectedStore?: Store;
  products: Product[];
  searchTerm: string;
  onCategoryChange(id: string): void;
  onSelectStore(id: string): void;
  onAdd(product: Product): void;
}

export function BrowsePage(props: Props) {
  return (
    <>
      <aside className="sidebar">
        <StoreList
          categories={props.categories}
          stores={props.stores}
          activeCategory={props.activeCategory}
          selectedStoreId={props.selectedStore?.id}
          searchTerm={props.searchTerm}
          onCategoryChange={props.onCategoryChange}
          onSelectStore={props.onSelectStore}
        />
      </aside>
      <section className="content-area">
        <div className="content-header">
          <div>
            <span>Browse menu</span>
            <h1>{props.selectedStore ? props.selectedStore.name : "Choose a restaurant"}</h1>
          </div>
          <strong>{props.products.length} items</strong>
        </div>
        <StoreMenu
          store={props.selectedStore}
          products={props.products}
          searchTerm={props.searchTerm}
          onAdd={props.onAdd}
        />
      </section>
    </>
  );
}
