import type { EvidenceRef } from "@aom/protocol";
import type { AnalyzerToolDescriptor } from "./tool.js";

export function analyzerEvidence(
  targetId: string,
  operation: string,
  locator: string,
  tools: readonly AnalyzerToolDescriptor[],
): EvidenceRef[] {
  return tools.map((tool) => ({
    evidenceId: evidenceId(targetId, operation, tool.id),
    sourceEventId: `analyzer:${operation}:${targetId}`,
    summary: `${tool.name} ${operation}`,
    toolName: tool.name,
    toolVersion: tool.version,
    sourceLocator: locator,
    metadata: {
      toolId: tool.id,
      mode: tool.mode,
      capabilities: tool.capabilities,
      operation,
    },
  }));
}

export function evidenceId(
  targetId: string,
  operation: string,
  toolId: string,
): string {
  return `evidence:analyzer:${encodeURIComponent(targetId)}:${operation}:${encodeURIComponent(toolId)}`;
}
