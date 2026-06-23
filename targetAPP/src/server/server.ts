import cors from "cors";
import express from "express";
import http from "node:http";
import { addressesByUser, categories, ordersByUser, stores, users } from "./data.js";
import type { Address, OrderItem } from "./types.js";

const sessions = new Map<string, string>();

function getUserId(req: express.Request) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  return sessions.get(token);
}

function requireUser(req: express.Request, res: express.Response) {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ message: "Please sign in again." });
    return undefined;
  }
  return userId;
}

function orderTotal(storeId: string, items: OrderItem[]) {
  const store = stores.find((entry) => entry.id === storeId);
  if (!store) return undefined;
  return items.reduce((sum, item) => {
    const product = store.products.find((entry) => entry.id === item.productId);
    return sum + (product ? product.price * item.quantity : 0);
  }, store.deliveryFee);
}

export function createMockApi() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post("/api/login", (req, res) => {
    const { phone, password } = req.body as { phone?: string; password?: string };
    const user = users.find((entry) => entry.phone === phone && entry.password === password);
    if (!user) {
      res.status(401).json({ message: "Phone number or password is incorrect." });
      return;
    }
    const token = `mock-${user.id}-${Date.now()}`;
    sessions.set(token, user.id);
    res.json({ token, user: { id: user.id, name: user.name, phone: user.phone } });
  });

  app.get("/api/me", (req, res) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = users.find((entry) => entry.id === userId);
    res.json({ id: user?.id, name: user?.name, phone: user?.phone });
  });

  app.get("/api/categories", (_req, res) => res.json(categories));

  app.get("/api/stores", (req, res) => {
    const category = String(req.query.category ?? "all");
    const result = category === "all" ? stores : stores.filter((store) => store.categoryId === category);
    res.json(result.map(({ products, ...store }) => ({
      ...store,
      productCount: products.length,
      menuKeywords: products.flatMap((product) => [product.name, product.description])
    })));
  });

  app.get("/api/stores/:id", (req, res) => {
    const store = stores.find((entry) => entry.id === req.params.id);
    if (!store) {
      res.status(404).json({ message: "Store not found." });
      return;
    }
    res.json(store);
  });

  app.get("/api/addresses", (req, res) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    res.json(addressesByUser.get(userId) ?? []);
  });

  app.post("/api/addresses", (req, res) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    const address = { id: `addr-${Date.now()}`, ...(req.body as Omit<Address, "id">) };
    const addresses = addressesByUser.get(userId) ?? [];
    addresses.push(address);
    addressesByUser.set(userId, addresses);
    res.status(201).json(address);
  });

  app.post("/api/orders", (req, res) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    const { storeId, addressId, mode, scheduledAt, items } = req.body;
    const total = orderTotal(storeId, items ?? []);
    if (!total || !addressId || !mode || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: "Order information is incomplete." });
      return;
    }
    const order = { id: `ord-${Date.now()}`, storeId, addressId, mode, scheduledAt, items, total, createdAt: new Date().toISOString() };
    const orders = ordersByUser.get(userId) ?? [];
    orders.unshift(order);
    ordersByUser.set(userId, orders);
    res.status(201).json(order);
  });

  app.get("/api/orders", (req, res) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    res.json(ordersByUser.get(userId) ?? []);
  });

  return app;
}

export async function startMockApi(port = 0) {
  const app = createMockApi();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Mock API failed to bind.");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}
