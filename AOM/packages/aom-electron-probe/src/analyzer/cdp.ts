import CDP from "chrome-remote-interface";
import type { CdpClient } from "../types.js";
import type { AnalyzerToolDescriptor } from "./tool.js";

export const chromeRemoteInterfaceTool: AnalyzerToolDescriptor = {
  id: "tool:chrome-remote-interface",
  name: "chrome-remote-interface",
  version: "0.34.0",
  mode: "protocol",
  capabilities: ["cdp_discovery", "cdp_commands", "cdp_events"],
};

export interface CdpConnectionOptions {
  host?: string;
  port?: number;
  secure?: boolean;
  target?: string | ((targets: CDP.Target[]) => CDP.Target);
}

export class ChromeRemoteInterfaceClient implements CdpClient {
  private constructor(private readonly client: CDP.Client) {}

  static async connect(options: CdpConnectionOptions = {}): Promise<ChromeRemoteInterfaceClient> {
    const targetOption = options.target;
    const target = typeof targetOption === "function"
      ? (targets: CDP.Target[]) => targetOption(targets)
      : targetOption;
    const client = await CDP({
      ...(options.host ? { host: options.host } : {}),
      ...(options.port ? { port: options.port } : {}),
      ...(options.secure ? { secure: options.secure } : {}),
      ...(target ? { target } : {}),
    });
    return new ChromeRemoteInterfaceClient(client);
  }

  send<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const client = this.client as unknown as {
      send(name: string, value: Record<string, unknown>): Promise<unknown>;
    };
    return client.send(method, params) as Promise<T>;
  }

  on(method: string, listener: (params: Record<string, unknown>) => void): void {
    this.client.on(method, (params) => listener(params as Record<string, unknown>));
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
