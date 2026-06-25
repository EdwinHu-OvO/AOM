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

export interface RawArtifactDescriptor {
  artifactId: string;
  kind: string;
  locator: string;
  format?: string;
  digest?: string;
  metadata: Record<string, JsonValue>;
}

export interface RawStaticNode {
  rawId: string;
  kind: string;
  label?: string;
  artifactId: string;
  artifactOffset?: string;
  attributes: Record<string, JsonValue>;
  evidenceIds: string[];
}

export interface RawStaticEdge {
  rawId: string;
  fromRawId: string;
  toRawId: string;
  relationship: string;
  evidenceIds: string[];
}

export interface RawStaticSnapshot {
  snapshotId: string;
  targetId: string;
  platform: string;
  timestamp: number;
  adapterId: string;
  artifacts: RawArtifactDescriptor[];
  nodes: RawStaticNode[];
  edges: RawStaticEdge[];
  evidenceIds: string[];
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

export interface RawRuntimeNode {
  rawId: string;
  kind: string;
  role?: string;
  label?: string;
  value?: JsonValue;
  attributes: Record<string, JsonValue>;
  children: string[];
}

export interface RawRuntimeSnapshot {
  snapshotId: string;
  targetId: string;
  platform: string;
  timestamp: number;
  nodes: RawRuntimeNode[];
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
