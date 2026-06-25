import type {
  ArtifactInspection,
  RawAction,
  RawActionResult,
  RawEvent,
  RawRuntimeSnapshot,
  RawStaticSnapshot,
} from "@aom/protocol";
import type { AnalyzerToolDescriptor } from "./analyzer/tool.js";

export interface StaticAnalysisAdapter {
  readonly adapterId: string;
  readonly targetId: string;
  readonly tools: readonly AnalyzerToolDescriptor[];
  accepts(inspection: ArtifactInspection): boolean;
  collectStaticSnapshot(): Promise<RawStaticSnapshot>;
}

export interface RuntimeProbe {
  readonly probeId: string;
  readonly targetId: string;
  readonly tool: AnalyzerToolDescriptor | undefined;
  collectRuntimeSnapshot(): Promise<RawRuntimeSnapshot>;
  drainEvents(): Promise<RawEvent[]>;
  executeAction(action: RawAction): Promise<RawActionResult>;
}

export interface CdpClient {
  send<T>(method: string, params?: Record<string, unknown>): Promise<T>;
  on(method: string, listener: (params: Record<string, unknown>) => void): void;
  close?(): Promise<void>;
}
