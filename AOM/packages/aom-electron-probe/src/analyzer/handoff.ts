import { spawn } from "node:child_process";
import { createServer, type AddressInfo } from "node:net";
import { chromeRemoteInterfaceTool } from "./cdp.js";
import { connectCdp } from "./cdp-connect.js";
import { ElectronRuntimeProbe } from "../runtime/electron.js";
import { discoverElectronPage } from "../runtime/cdp-client.js";
import type { PlaywrightElectronSession } from "./playwright.js";

export interface HandoffElectronLaunchOptions {
  targetId: string;
  executablePath: string;
  args?: string[];
  timeoutMs?: number;
  remoteDebuggingPort?: number;
  cdpHost?: string;
}

export async function launchElectronForHandoff(
  options: HandoffElectronLaunchOptions,
): Promise<PlaywrightElectronSession> {
  const port = options.remoteDebuggingPort ?? await findOpenPort();
  const host = options.cdpHost ?? "127.0.0.1";
  const cdpUrl = `http://${host}:${port}`;
  const child = spawn(
    options.executablePath,
    [`--remote-debugging-port=${port}`, ...(options.args ?? [])],
    { detached: true, stdio: "ignore" },
  );
  if (!child.pid) throw new Error("launch_for_handoff_missing_process_id");
  child.unref();

  await waitForHandoffCdp(cdpUrl, child, options.timeoutMs ?? 30_000);
  const client = await connectCdp(cdpUrl);
  const probe = new ElectronRuntimeProbe(options.targetId, client, chromeRemoteInterfaceTool);
  await waitForRuntimeProbe(probe, options.timeoutMs ?? 30_000);
  return {
    probe,
    tool: chromeRemoteInterfaceTool,
    lifecycle: "launch_for_handoff",
    closesTarget: false,
    cdpUrl,
    processId: child.pid,
    close: async () => {
      await client.close?.();
    },
  };
}

async function waitForHandoffCdp(
  cdpUrl: string,
  child: ReturnType<typeof spawn>,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let childExit: string | undefined;
  child.once("exit", (code, signal) => {
    childExit = `child exited before CDP was ready: code=${code ?? "null"} signal=${signal ?? "null"}`;
  });
  child.once("error", (error) => {
    childExit = `child failed before CDP was ready: ${error.message}`;
  });
  while (Date.now() < deadline) {
    if (childExit) throw new Error(childExit);
    try {
      await discoverElectronPage(cdpUrl);
      return;
    } catch {
      await sleep(100);
    }
  }
  throw new Error(`launch_for_handoff_cdp_timeout: ${cdpUrl}`);
}

async function waitForRuntimeProbe(
  probe: ElectronRuntimeProbe,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snapshot = await probe.collectRuntimeSnapshot();
    if (snapshot.nodes.length > 0) return;
    await sleep(100);
  }
  throw new Error("launch_for_handoff_runtime_timeout");
}

async function findOpenPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      server.close(() => resolve(address.port));
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
