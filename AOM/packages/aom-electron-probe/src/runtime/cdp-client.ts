import type { CdpClient } from "../types.js";

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: Error): void;
}

export class WebSocketCdpClient implements CdpClient {
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly listeners = new Map<string, Set<(params: Record<string, unknown>) => void>>();

  private constructor(private readonly socket: WebSocket) {
    socket.addEventListener("message", (event) => this.handleMessage(String(event.data)));
  }

  static async connect(url: string): Promise<WebSocketCdpClient> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error(`CDP connection failed: ${url}`)), {
        once: true,
      });
    });
    return new WebSocketCdpClient(socket);
  }

  send<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method: string, listener: (params: Record<string, unknown>) => void): void {
    const listeners = this.listeners.get(method) ?? new Set();
    listeners.add(listener);
    this.listeners.set(method, listeners);
  }

  async close(): Promise<void> {
    const error = new Error("CDP connection closed");
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    this.listeners.clear();
    if (
      this.socket.readyState === WebSocket.CLOSING
      || this.socket.readyState === WebSocket.CLOSED
    ) {
      return;
    }
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 1_000);
      this.socket.addEventListener(
        "close",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
      this.socket.close();
    });
  }

  private handleMessage(text: string): void {
    const message = JSON.parse(text) as {
      id?: number;
      method?: string;
      params?: Record<string, unknown>;
      result?: unknown;
      error?: { message: string };
    };
    if (message.id !== undefined) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
      return;
    }
    if (message.method) {
      for (const listener of this.listeners.get(message.method) ?? []) {
        listener(message.params ?? {});
      }
    }
  }
}

interface CdpTarget {
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

export async function discoverElectronPage(
  baseUrl: string,
  matches: (target: CdpTarget) => boolean = (target) => target.type === "page",
): Promise<CdpTarget> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/json/list`);
  if (!response.ok) {
    throw new Error(`CDP discovery failed with status ${response.status}`);
  }
  const targets = await response.json() as CdpTarget[];
  const target = targets.find(
    (candidate) => candidate.webSocketDebuggerUrl !== undefined && matches(candidate),
  );
  if (!target) throw new Error("No matching Electron CDP page target found");
  return target;
}
