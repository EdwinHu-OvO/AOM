import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { FloatingCartButton } from "./components/FloatingCartButton";
import { Header } from "./components/Header";
import { LoginView } from "./components/LoginView";
import { AddressesPage } from "./pages/AddressesPage";
import { BrowsePage } from "./pages/BrowsePage";
import { CartPage } from "./pages/CartPage";
import { OrdersPage } from "./pages/OrdersPage";
import type { Address, AppPage, CartItem, Category, DeliveryMode, Order, Product, Store, StoreSummary, User } from "./types";

const defaultSchedule = () => {
  const value = new Date(Date.now() + 90 * 60 * 1000);
  value.setMinutes(Math.ceil(value.getMinutes() / 15) * 15, 0, 0);
  return value.toISOString().slice(0, 16);
};

export default function App() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStore, setSelectedStore] = useState<Store>();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [mode, setMode] = useState<DeliveryMode>("now");
  const [scheduledAt, setScheduledAt] = useState(defaultSchedule());
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState<AppPage>("browse");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void Promise.all([api.categories(), api.stores(selectedCategory)]).then(([nextCategories, nextStores]) => {
      setCategories(nextCategories);
      setStores(nextStores);
      if (!selectedStore && nextStores[0]) void selectStore(nextStores[0].id);
    });
  }, [selectedCategory]);

  async function login(phone: string, password: string) {
    const result = await api.login(phone, password);
    setToken(result.token);
    setUser(result.user);
    const [nextAddresses, nextOrders] = await Promise.all([api.addresses(result.token), api.orders(result.token)]);
    setAddresses(nextAddresses);
    setSelectedAddressId(nextAddresses[0]?.id ?? "");
    setOrders(nextOrders);
  }

  async function selectStore(id: string) {
    const store = await api.store(id);
    setSelectedStore(store);
    setCart([]);
    setPage("browse");
  }

  function addProduct(product: Product) {
    setCart((items) => {
      const existing = items.find((item) => item.product.id === product.id);
      if (existing) {
        return items.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...items, { product, quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, change: number) {
    setCart((items) =>
      items
        .map((item) => item.product.id === productId ? { ...item, quantity: item.quantity + change } : item)
        .filter((item) => item.quantity > 0)
    );
  }

  async function createAddress(address: Omit<Address, "id">) {
    const nextAddress = await api.createAddress(token, address);
    setAddresses((items) => [...items, nextAddress]);
    setSelectedAddressId(nextAddress.id);
  }

  async function checkout() {
    if (!selectedStore) return;
    const order = await api.createOrder(token, {
      storeId: selectedStore.id,
      addressId: selectedAddressId,
      mode,
      scheduledAt: mode === "scheduled" ? scheduledAt : undefined,
      items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity }))
    });
    setOrders((items) => [order, ...items]);
    setCart([]);
    setNotice(`Order placed with ${selectedStore.name}.`);
    setPage("orders");
    window.setTimeout(() => setNotice(""), 3200);
  }

  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId),
    [addresses, selectedAddressId]
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleStores = useMemo(() => {
    if (!normalizedSearch) return stores;
    return stores.filter((store) =>
      [store.name, store.categoryId, ...store.tags, ...store.menuKeywords].some((value) =>
        value.toLowerCase().includes(normalizedSearch)
      )
    );
  }, [stores, normalizedSearch]);

  const visibleProducts = useMemo(() => {
    if (!selectedStore) return [];
    if (!normalizedSearch) return selectedStore.products;
    return selectedStore.products.filter((product) =>
      [product.name, product.description].some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [selectedStore, normalizedSearch]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.price * item.quantity, cart.length ? selectedStore?.deliveryFee ?? 0 : 0),
    [cart, selectedStore]
  );
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  function renderPage() {
    if (page === "cart") {
      return (
        <CartPage
          store={selectedStore}
          addresses={addresses}
          selectedAddress={selectedAddress}
          selectedAddressId={selectedAddressId}
          items={cart}
          mode={mode}
          scheduledAt={scheduledAt}
          canCheckout={cart.length > 0 && Boolean(selectedAddressId)}
          onSelectAddress={setSelectedAddressId}
          onCreateAddress={createAddress}
          onModeChange={setMode}
          onScheduleChange={setScheduledAt}
          onIncrement={(id) => changeQuantity(id, 1)}
          onDecrement={(id) => changeQuantity(id, -1)}
          onCheckout={checkout}
        />
      );
    }
    if (page === "addresses") {
      return (
        <AddressesPage
          addresses={addresses}
          selectedAddress={selectedAddress}
          selectedAddressId={selectedAddressId}
          onSelect={setSelectedAddressId}
          onCreate={createAddress}
        />
      );
    }
    if (page === "orders") return <OrdersPage orders={orders} stores={stores} />;
    return (
      <BrowsePage
        categories={categories}
        stores={visibleStores}
        activeCategory={selectedCategory}
        selectedStore={selectedStore}
        products={visibleProducts}
        searchTerm={searchTerm}
        onCategoryChange={setSelectedCategory}
        onSelectStore={selectStore}
        onAdd={addProduct}
      />
    );
  }

  if (!user) return <LoginView onLogin={login} />;

  return (
    <main className="app-shell">
      <Header
        user={user}
        selectedAddress={selectedAddress}
        activePage={page}
        searchTerm={searchTerm}
        onPageChange={setPage}
        onSearchChange={setSearchTerm}
      />
      {notice && <div className="toast">{notice}</div>}
      <div className="workspace">{renderPage()}</div>
      {page !== "cart" && (
        <FloatingCartButton itemCount={cartCount} total={cartTotal} onClick={() => setPage("cart")} />
      )}
    </main>
  );
}
