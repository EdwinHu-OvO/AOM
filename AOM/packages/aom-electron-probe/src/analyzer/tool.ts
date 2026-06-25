import type { JsonValue } from "@aom/protocol";

export type AnalyzerToolMode = "library" | "protocol" | "fallback";

export interface AnalyzerToolDescriptor {
  id: string;
  name: string;
  version: string;
  mode: AnalyzerToolMode;
  capabilities: string[];
}

export interface AnalyzerToolEvidence {
  evidenceId: string;
  tool: AnalyzerToolDescriptor;
  operation: string;
  locator: string;
  metadata: Record<string, JsonValue>;
}

export function toolMetadata(
  evidence: AnalyzerToolEvidence[],
): Record<string, JsonValue> {
  return {
    analyzerTools: evidence.map((item) => ({
      id: item.tool.id,
      name: item.tool.name,
      version: item.tool.version,
      mode: item.tool.mode,
      capabilities: item.tool.capabilities,
      operation: item.operation,
      locator: item.locator,
      evidenceId: item.evidenceId,
      metadata: item.metadata,
    })),
  };
}
