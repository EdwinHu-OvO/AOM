export type DeliveryMode = "now" | "scheduled";
export type AppPage = "browse" | "cart" | "addresses" | "orders";

export interface User {
  id: string;
  name: string;
  phone: string;
}

export interface Address {
  id: string;
  label: string;
  receiver: string;
  phone: string;
  detail: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  popular?: boolean;
}

export interface StoreSummary {
  id: string;
  name: string;
  categoryId: string;
  rating: number;
  deliveryMinutes: number;
  deliveryFee: number;
  image: string;
  tags: string[];
  menuKeywords: string[];
  productCount: number;
}

export interface Store extends Omit<StoreSummary, "productCount" | "menuKeywords"> {
  products: Product[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  storeId: string;
  addressId: string;
  mode: DeliveryMode;
  scheduledAt?: string;
  total: number;
  createdAt: string;
}

declare global {
  interface Window {
    nativeApp?: {
      apiBase: string;
    };
  }
}
