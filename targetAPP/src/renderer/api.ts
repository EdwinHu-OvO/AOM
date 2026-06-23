import type { Address, Category, DeliveryMode, Order, Store, StoreSummary, User } from "./types";

const apiBase = window.nativeApp?.apiBase ?? "http://127.0.0.1:4545";

interface LoginResult {
  token: string;
  user: User;
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(error.message ?? "Request failed.");
  }
  return response.json() as Promise<T>;
}

export const api = {
  login(phone: string, password: string) {
    return request<LoginResult>("/api/login", {
      method: "POST",
      body: JSON.stringify({ phone, password })
    });
  },
  categories() {
    return request<Category[]>("/api/categories");
  },
  stores(category: string) {
    return request<StoreSummary[]>(`/api/stores?category=${encodeURIComponent(category)}`);
  },
  store(id: string) {
    return request<Store>(`/api/stores/${id}`);
  },
  addresses(token: string) {
    return request<Address[]>("/api/addresses", {}, token);
  },
  createAddress(token: string, address: Omit<Address, "id">) {
    return request<Address>("/api/addresses", { method: "POST", body: JSON.stringify(address) }, token);
  },
  orders(token: string) {
    return request<Order[]>("/api/orders", {}, token);
  },
  createOrder(
    token: string,
    payload: {
      storeId: string;
      addressId: string;
      mode: DeliveryMode;
      scheduledAt?: string;
      items: { productId: string; quantity: number }[];
    }
  ) {
    return request<Order>("/api/orders", { method: "POST", body: JSON.stringify(payload) }, token);
  }
};
