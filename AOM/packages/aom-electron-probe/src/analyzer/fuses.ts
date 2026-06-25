import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  FuseState,
  FuseV1Options,
  getCurrentFuseWire,
} from "@electron/fuses";
import type { JsonValue } from "@aom/protocol";
import type { AnalyzerToolDescriptor, AnalyzerToolEvidence } from "./tool.js";

export const electronFusesTool: AnalyzerToolDescriptor = {
  id: "tool:electron-fuses",
  name: "@electron/fuses",
  version: "2.1.2",
  mode: "library",
  capabilities: ["electron_fuse_read"],
};

export interface ElectronFuseInspection {
  binaryPath?: string;
  values: Record<string, JsonValue>;
  evidence: AnalyzerToolEvidence;
}

export async function inspectElectronFuses(
  artifactRoot: string,
): Promise<ElectronFuseInspection> {
  const binaryPath = await findElectronBinary(artifactRoot);
  if (!binaryPath) return unavailable(artifactRoot, "electron_binary_not_found");
  try {
    const wire = await getCurrentFuseWire(binaryPath);
    const values: Record<string, JsonValue> = { version: wire.version };
    for (const [name, index] of Object.entries(FuseV1Options)) {
      if (typeof index !== "number") continue;
      const state = wire[index];
      values[name] = stateName(state);
    }
    return {
      binaryPath,
      values,
      evidence: evidence(artifactRoot, {
        binaryPath,
        status: "available",
        fuseCount: Object.keys(values).length - 1,
      }),
    };
  } catch (error) {
    return unavailable(
      artifactRoot,
      error instanceof Error ? error.message : "fuse_read_failed",
      binaryPath,
    );
  }
}

async function findElectronBinary(root: string): Promise<string | undefined> {
  if (path.extname(root).toLowerCase() !== ".app") return undefined;
  const directory = path.join(root, "Contents", "MacOS");
  try {
    for (const entry of (await readdir(directory)).sort()) {
      const candidate = path.join(directory, entry);
      if ((await stat(candidate)).isFile()) return candidate;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function unavailable(
  locator: string,
  reason: string,
  binaryPath?: string,
): ElectronFuseInspection {
  return {
    ...(binaryPath ? { binaryPath } : {}),
    values: { status: "unavailable", reason },
    evidence: evidence(locator, { status: "unavailable", reason }),
  };
}

function evidence(
  locator: string,
  metadata: Record<string, JsonValue>,
): AnalyzerToolEvidence {
  return {
    evidenceId: `evidence:tool:electron-fuses:${encodeURIComponent(locator)}`,
    tool: electronFusesTool,
    operation: "read_fuse_wire",
    locator,
    metadata,
  };
}

function stateName(state: FuseState | undefined): string {
  if (state === FuseState.ENABLE) return "enabled";
  if (state === FuseState.DISABLE) return "disabled";
  if (state === FuseState.REMOVED) return "removed";
  if (state === FuseState.INHERIT) return "inherit";
  return "unknown";
}
