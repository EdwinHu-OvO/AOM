import type { PlaywrightElectronSession } from "@aom/electron-probe";
import type { EvidenceRef, RawRuntimeSnapshot, RawStaticSnapshot } from "@aom/protocol";
import type { AnalysisOutput } from "../analysis/types.js";
import type { AOMRuntimeConfig } from "../config.js";
import type { ContextDelta } from "../context/delta.js";

export interface AgentSession {
  sessionId: string;
  targetId: string;
  lifecycle: "attach_existing" | "launch_for_handoff";
  cdpUrl?: string;
  processId?: number;
  artifactLocator?: string;
  runtime: PlaywrightElectronSession;
  staticSnapshot: RawStaticSnapshot;
  analyzerEvidence: EvidenceRef[];
  config?: AOMRuntimeConfig;
  lastSnapshot?: RawRuntimeSnapshot;
  lastAnalysis?: AnalysisOutput;
  lastDelta?: ContextDelta;
}
