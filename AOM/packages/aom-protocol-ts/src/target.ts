export type TargetPlatform = "electron" | "android" | "flutter" | "web" | "debug_mock";

export interface TargetConnection {
  cdpUrl?: string;
  adbSerial?: string;
  websocketUrl?: string;
  pid?: number;
}

export interface TargetDescriptor {
  targetId: string;
  platform: TargetPlatform;
  appName?: string;
  packageName?: string;
  processName?: string;
  connection?: TargetConnection;
  securityProfile?: string;
}

