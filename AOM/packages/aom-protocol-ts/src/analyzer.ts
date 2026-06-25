import type { EvidenceRef } from "./aom.js";
import type {
  RawAction,
  RawActionResult,
  RawEvent,
  RawRuntimeSnapshot,
  RawStaticSnapshot,
} from "./raw.js";
import type { TargetDescriptor } from "./target.js";

export interface AnalyzerSessionConfig {
  target: TargetDescriptor;
  artifactLocator?: string;
  executablePath?: string;
  adapterId?: string;
}

export type AnalyzerCommand =
  | { commandType: "initialize"; data: AnalyzerSessionConfig }
  | { commandType: "collect_static" }
  | { commandType: "collect_runtime" }
  | { commandType: "drain_events" }
  | { commandType: "execute_action"; data: RawAction }
  | { commandType: "shutdown" };

export interface AnalyzerReady {
  adapterId?: string;
  probeId?: string;
  evidence: EvidenceRef[];
}

export interface AnalyzerResult<T> {
  value: T;
  evidence: EvidenceRef[];
}

export interface AnalyzerFailure {
  code: string;
  message: string;
  retryable: boolean;
  evidence: EvidenceRef[];
}

export type AnalyzerReply =
  | { replyType: "ready"; data: AnalyzerReady }
  | { replyType: "static_snapshot"; data: AnalyzerResult<RawStaticSnapshot> }
  | { replyType: "runtime_snapshot"; data: AnalyzerResult<RawRuntimeSnapshot> }
  | { replyType: "events"; data: AnalyzerResult<RawEvent[]> }
  | { replyType: "action_result"; data: AnalyzerResult<RawActionResult> }
  | { replyType: "ack"; data: AnalyzerResult<boolean> }
  | { replyType: "error"; data: AnalyzerFailure };
