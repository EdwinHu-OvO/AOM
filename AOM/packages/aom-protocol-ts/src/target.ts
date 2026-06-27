export type TargetPlatform = "electron" | "android" | "flutter" | "web" | "debug_mock";

export type TargetLifecycle =
  | "attach_existing"
  | "launch_owned"
  | "copy_for_static_analysis";

export interface TargetConnection {
  lifecycle?: TargetLifecycle;
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
