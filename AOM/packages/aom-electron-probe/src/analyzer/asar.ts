import { createHash } from "node:crypto";
import {
  extractFile,
  getRawHeader,
  listPackage,
  statFile,
} from "@electron/asar";
import type { AnalyzerToolDescriptor, AnalyzerToolEvidence } from "./tool.js";

const maxEntries = 100_000;
const maxTextBytes = 16 * 1024 * 1024;

export interface AnalyzerAsarEntry {
  path: string;
  size: number;
  unpacked: boolean;
  integrity?: { algorithm?: string; hash?: string };
  readText(): Promise<string>;
}

export interface AnalyzerAsarInventory {
  entries: AnalyzerAsarEntry[];
  headerDigest: string;
  headerSize: number;
  evidence: AnalyzerToolEvidence;
}

export interface AsarAnalyzerBackend {
  readonly tool: AnalyzerToolDescriptor;
  inspect(asarPath: string, locator: string): Promise<AnalyzerAsarInventory>;
}

export class ElectronAsarBackend implements AsarAnalyzerBackend {
  readonly tool: AnalyzerToolDescriptor = {
    id: "tool:electron-asar",
    name: "@electron/asar",
    version: "4.2.0",
    mode: "library",
    capabilities: ["asar_list", "asar_stat", "asar_extract"],
  };

  async inspect(asarPath: string, locator: string): Promise<AnalyzerAsarInventory> {
    const header = getRawHeader(asarPath);
    const paths = listPackage(asarPath, { isPack: false })
      .map(normalizeEntryPath)
      .filter((entryPath) => entryPath.length > 0);
    if (paths.length > maxEntries) {
      throw new Error(`ASAR entry limit exceeded: ${paths.length}`);
    }
    const entries = paths.flatMap((entryPath) => {
      const entry = statFile(asarPath, entryPath, false);
      if ("files" in entry || "link" in entry) return [];
      const integrity = entry.integrity;
      return [{
        path: entryPath,
        size: entry.size,
        unpacked: entry.unpacked,
        ...(integrity
          ? {
              integrity: {
                algorithm: integrity.algorithm,
                hash: integrity.hash,
              },
            }
          : {}),
        readText: async () => {
          if (entry.size > maxTextBytes) {
            throw new Error(`ASAR text entry limit exceeded: ${entryPath}`);
          }
          return extractFile(asarPath, entryPath, false).toString("utf8");
        },
      }];
    });
    const headerDigest = createHash("sha256").update(header.headerString).digest("hex");
    return {
      entries,
      headerDigest,
      headerSize: header.headerSize,
      evidence: {
        evidenceId: `evidence:tool:electron-asar:${headerDigest.slice(0, 16)}`,
        tool: this.tool,
        operation: "inspect_archive",
        locator,
        metadata: { entryCount: entries.length },
      },
    };
  }
}

function normalizeEntryPath(entryPath: string): string {
  const normalized = entryPath.replaceAll("\\", "/").replace(/^\/+/, "");
  const parts = normalized.split("/");
  if (parts.some((part) => part === ".." || part === "." || part === "")) {
    throw new Error(`Unsafe ASAR entry path: ${entryPath}`);
  }
  return normalized;
}
