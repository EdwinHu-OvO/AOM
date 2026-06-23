export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type RawEventType =
  | "surface_snapshot"
  | "surface_click"
  | "surface_text_input"
  | "lifecycle"
  | "navigation"
  | "network_request"
  | "network_response"
  | "storage_read"
  | "storage_write"
  | "state_change"
  | "error";

export interface RawEventSource {
  adapterId: string;
  probeId: string;
  sourceType: string;
}

export interface RawRef {
  rawId: string;
  kind?: string;
  label?: string;
}

export interface RawEvent {
  eventId: string;
  targetId: string;
  platform: string;
  timestamp: number;
  sequence: number;
  type: RawEventType;
  source: RawEventSource;
  subject?: RawRef;
  object?: RawRef;
  payload: Record<string, JsonValue>;
  evidenceIds: string[];
}

export interface RawRuntimeSnapshot {
  snapshotId: string;
  targetId: string;
  platform: string;
  timestamp: number;
  nodes: JsonValue[];
  evidenceIds: string[];
}

export type RawActionType = "click" | "set_text" | "scroll" | "back" | "wait_for";

export interface RawAction {
  actionId: string;
  targetId: string;
  type: RawActionType;
  targetRawId?: string;
  params: Record<string, JsonValue>;
}

export interface RawActionResult {
  actionId: string;
  targetId: string;
  ok: boolean;
  errorCode?: string;
  message?: string;
  evidenceIds: string[];
}
