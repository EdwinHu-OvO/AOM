export type DeliveryMode = "now" | "scheduled";

export interface User {
  id: string;
  name: string;
  phone: string;
  password: string;
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

export interface Store {
  id: string;
  name: string;
  categoryId: string;
  rating: number;
  deliveryMinutes: number;
  deliveryFee: number;
  image: string;
  tags: string[];
  products: Product[];
}

export interface OrderItem {
  productId: string;
  quantity: number;
}

export interface Order {
  id: string;
  storeId: string;
  addressId: string;
  mode: DeliveryMode;
  scheduledAt?: string;
  items: OrderItem[];
  total: number;
  createdAt: string;
}
