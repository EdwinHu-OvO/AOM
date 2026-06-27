import { _electron, type CDPSession, type ElectronApplication } from "playwright";
import { chromeRemoteInterfaceTool, ChromeRemoteInterfaceClient } from "./cdp.js";
import { ElectronRuntimeProbe } from "../runtime/electron.js";
import type { CdpClient } from "../types.js";
import { discoverElectronPage, WebSocketCdpClient } from "../runtime/cdp-client.js";
import type { AnalyzerToolDescriptor } from "./tool.js";

export const playwrightTool: AnalyzerToolDescriptor = {
  id: "tool:playwright-electron",
  name: "playwright",
  version: "1.61.0",
  mode: "library",
  capabilities: ["electron_launch", "dom_actions", "cdp_session"],
};

export interface PlaywrightElectronLaunchOptions {
  targetId: string;
  executablePath: string;
  args?: string[];
  timeoutMs?: number;
}

export interface PlaywrightElectronSession {
  probe: ElectronRuntimeProbe;
  tool: AnalyzerToolDescriptor;
  lifecycle: "attach_existing" | "launch_owned";
  closesTarget: boolean;
  close(): Promise<void>;
}

export async function launchElectronAnalyzer(
  options: PlaywrightElectronLaunchOptions,
): Promise<PlaywrightElectronSession> {
  const app = await _electron.launch({
    executablePath: options.executablePath,
    args: options.args ?? [],
  });
  const timeout = options.timeoutMs ?? 30_000;
  const page = await app.firstWindow({ timeout });
  await page.waitForFunction(
    () => document.readyState !== "loading" && document.body?.children.length > 0,
    undefined,
    { timeout },
  );
  const cdp = await app.context().newCDPSession(page);
  const probe = new ElectronRuntimeProbe(
    options.targetId,
    new PlaywrightCdpClient(cdp),
    playwrightTool,
  );
  return {
    probe,
    tool: playwrightTool,
    lifecycle: "launch_owned",
    closesTarget: true,
    close: () => app.close(),
  };
}

export interface ElectronAttachOptions {
  targetId: string;
  cdpUrl: string;
}

export async function attachElectronAnalyzer(
  options: ElectronAttachOptions,
): Promise<PlaywrightElectronSession> {
  const client = await connectCdp(options.cdpUrl);
  return {
    probe: new ElectronRuntimeProbe(options.targetId, client, chromeRemoteInterfaceTool),
    tool: chromeRemoteInterfaceTool,
    lifecycle: "attach_existing",
    closesTarget: false,
    close: async () => {
      await client.close?.();
    },
  };
}

async function connectCdp(cdpUrl: string): Promise<CdpClient> {
  if (cdpUrl.startsWith("ws://") || cdpUrl.startsWith("wss://")) {
    return WebSocketCdpClient.connect(cdpUrl);
  }
  if (cdpUrl.startsWith("http://") || cdpUrl.startsWith("https://")) {
    const target = await discoverElectronPage(cdpUrl);
    if (!target.webSocketDebuggerUrl) throw new Error("cdp_target_missing_websocket_url");
    return WebSocketCdpClient.connect(target.webSocketDebuggerUrl);
  }
  const parsed = Number(cdpUrl);
  if (Number.isInteger(parsed) && parsed > 0) {
    return ChromeRemoteInterfaceClient.connect({ port: parsed });
  }
  throw new Error("unsupported_cdp_url");
}

class PlaywrightCdpClient implements CdpClient {
  constructor(private readonly session: CDPSession) {}

  send<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const session = this.session as unknown as {
      send(name: string, value: Record<string, unknown>): Promise<unknown>;
    };
    return session.send(method, params) as Promise<T>;
  }

  on(method: string, listener: (params: Record<string, unknown>) => void): void {
    const session = this.session as unknown as {
      on(name: string, callback: (value: Record<string, unknown>) => void): void;
    };
    session.on(method, listener);
  }

  async close(): Promise<void> {
    await this.session.detach();
  }
}
