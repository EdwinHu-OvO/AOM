import { createHash } from "node:crypto";
import path from "node:path";
import type { JsonValue, RawArtifactDescriptor } from "@aom/protocol";
import {
  ElectronAsarBackend,
  type AnalyzerAsarEntry,
  type AnalyzerAsarInventory,
  type AsarAnalyzerBackend,
} from "../analyzer/asar.js";
import type { AnalyzerToolEvidence } from "../analyzer/tool.js";
import { processRole, type ArtifactFile } from "./inventory.js";

const applicationRoots = new Set(["dist", "main", "render", "renderer"]);
const textExtensions = new Set([".css", ".html", ".js", ".json", ".mjs"]);
const nativeExtensions = new Set([".dll", ".dylib", ".exe", ".node", ".so"]);

export interface AsarInventory {
  archive: RawArtifactDescriptor;
  files: ArtifactFile[];
  packageJson?: Record<string, JsonValue>;
  installedModules: string[];
  entryCount: number;
  toolEvidence: AnalyzerToolEvidence;
}

export async function inventoryAsar(
  asarPath: string,
  archiveLocator: string,
  backend: AsarAnalyzerBackend = new ElectronAsarBackend(),
): Promise<AsarInventory> {
  const inventory = await backend.inspect(asarPath, archiveLocator);
  const packageEntry = inventory.entries.find((entry) => entry.path === "package.json");
  const packageJson = packageEntry
    ? JSON.parse(await packageEntry.readText()) as Record<string, JsonValue>
    : undefined;
  const files = inventory.entries
    .filter((entry) => shouldModel(entry.path))
    .map((entry) => virtualFile(archiveLocator, inventory, entry));
  const installedModules = [
    ...new Set(
      inventory.entries
        .map((entry) => moduleName(entry.path))
        .filter((value): value is string => value !== undefined),
    ),
  ].sort();

  return {
    archive: {
      artifactId: `artifact:electron:asar:${inventory.headerDigest.slice(0, 16)}`,
      kind: "archive",
      locator: archiveLocator,
      format: "asar",
      digest: `sha256:${inventory.headerDigest}`,
      metadata: {
        entryCount: inventory.entries.length,
        headerSize: inventory.headerSize,
        installedModuleCount: installedModules.length,
        processRole: "package",
        analyzerTool: {
          id: inventory.evidence.tool.id,
          name: inventory.evidence.tool.name,
          version: inventory.evidence.tool.version,
          mode: inventory.evidence.tool.mode,
        },
        analyzerEvidenceId: inventory.evidence.evidenceId,
      },
    },
    files,
    installedModules,
    ...(packageJson === undefined ? {} : { packageJson }),
    entryCount: inventory.entries.length,
    toolEvidence: inventory.evidence,
  };
}

function shouldModel(entryPath: string): boolean {
  if (entryPath === "package.json" || entryPath === "index.js") return true;
  if (entryPath.startsWith("node_modules/")) {
    return nativeExtensions.has(path.posix.extname(entryPath).toLowerCase());
  }
  return applicationRoots.has(entryPath.split("/")[0] ?? "");
}

function virtualFile(
  archiveLocator: string,
  inventory: AnalyzerAsarInventory,
  entry: AnalyzerAsarEntry,
): ArtifactFile {
  const extension = path.posix.extname(entry.path).toLowerCase();
  const identity = createHash("sha256")
    .update(`${inventory.headerDigest}:${entry.path}:${entry.integrity?.hash ?? ""}`)
    .digest("hex");
  return {
    relativePath: entry.path,
    descriptor: {
      artifactId: `artifact:electron:asar-entry:${identity.slice(0, 16)}`,
      kind: textExtensions.has(extension)
        ? "file"
        : nativeExtensions.has(extension)
          ? "native_module"
          : "opaque_file",
      locator: `${archiveLocator}!/${entry.path}`,
      format: extension.slice(1) || "binary",
      ...(entry.integrity?.hash
        ? { digest: `${entry.integrity.algorithm?.toLowerCase() ?? "sha256"}:${entry.integrity.hash}` }
        : {}),
      metadata: {
        processRole: processRole(entry.path),
        size: entry.size,
        archivePath: archiveLocator,
        virtual: true,
        unpacked: entry.unpacked,
      },
    },
    readText: () => entry.readText(),
  };
}

function moduleName(entryPath: string): string | undefined {
  if (!entryPath.startsWith("node_modules/")) return undefined;
  const parts = entryPath.split("/");
  if (parts[1]?.startsWith("@") && parts[2]) return `${parts[1]}/${parts[2]}`;
  return parts[1];
}
