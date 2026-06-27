import { ChromeRemoteInterfaceClient } from "./cdp.js";
import { discoverElectronPage, WebSocketCdpClient } from "../runtime/cdp-client.js";
import type { CdpClient } from "../types.js";

export async function connectCdp(cdpUrl: string): Promise<CdpClient> {
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
