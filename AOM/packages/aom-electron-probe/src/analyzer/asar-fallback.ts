import {
  readAsarEntryText,
  readAsarIndex,
} from "../artifact/asar-reader.js";
import type {
  AnalyzerAsarInventory,
  AsarAnalyzerBackend,
} from "./asar.js";
import type { AnalyzerToolDescriptor } from "./tool.js";

export class InternalAsarFallbackBackend implements AsarAnalyzerBackend {
  readonly tool: AnalyzerToolDescriptor = {
    id: "tool:aom-asar-fallback",
    name: "AOM bounded ASAR reader",
    version: "0.1.0",
    mode: "fallback",
    capabilities: ["asar_list", "asar_extract"],
  };

  async inspect(asarPath: string, locator: string): Promise<AnalyzerAsarInventory> {
    const index = await readAsarIndex(asarPath);
    return {
      entries: index.entries.map((entry) => ({
        path: entry.path,
        size: entry.size ?? 0,
        unpacked: entry.unpacked ?? false,
        ...(entry.integrity ? { integrity: entry.integrity } : {}),
        readText: () => readAsarEntryText(asarPath, index, entry),
      })),
      headerDigest: index.headerDigest,
      headerSize: index.headerSize,
      evidence: {
        evidenceId: `evidence:tool:aom-asar:${index.headerDigest.slice(0, 16)}`,
        tool: this.tool,
        operation: "inspect_archive",
        locator,
        metadata: { entryCount: index.entries.length },
      },
    };
  }
}
