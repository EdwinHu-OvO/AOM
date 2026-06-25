import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { RawArtifactDescriptor } from "@aom/protocol";

const supportedExtensions = new Set([".asar", ".css", ".html", ".js", ".json", ".mjs"]);

export interface ArtifactFile {
  descriptor: RawArtifactDescriptor;
  absolutePath?: string;
  relativePath: string;
  readText(): Promise<string>;
}

export function processRole(relativePath: string): string {
  const normalized = relativePath.split(path.sep).join("/");
  if (normalized === "index.js") return "bootstrap";
  if (normalized.includes("/main/") || normalized.startsWith("main/")) return "main";
  if (
    normalized.includes("/renderer/")
    || normalized.includes("/render/")
    || normalized.startsWith("renderer/")
    || normalized.startsWith("render/")
  ) return "renderer";
  if (normalized.includes("/server/") || normalized.startsWith("server/")) return "backend";
  return "shared";
}

function artifactFormat(extension: string): string {
  return extension.slice(1) || "binary";
}

export async function inventoryArtifacts(root: string): Promise<ArtifactFile[]> {
  const files: ArtifactFile[] = [];

  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory)) {
      const absolutePath = path.join(directory, entry);
      const info = await stat(absolutePath);
      if (info.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      const extension = path.extname(entry).toLowerCase();
      if (!supportedExtensions.has(extension)) continue;
      const relativePath = path.relative(root, absolutePath);
      const digest = createHash("sha256").update(await readFile(absolutePath)).digest("hex");
      const artifactId = `artifact:electron:${digest.slice(0, 16)}`;
      files.push({
        absolutePath,
        relativePath,
        readText: () => readFile(absolutePath, "utf8"),
        descriptor: {
          artifactId,
          kind: extension === ".asar" ? "archive" : "file",
          locator: relativePath.split(path.sep).join("/"),
          format: artifactFormat(extension),
          digest: `sha256:${digest}`,
          metadata: { processRole: processRole(relativePath), size: info.size },
        },
      });
    }
  }

  await visit(root);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}
