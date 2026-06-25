import path from "node:path";
import type {
  ArtifactInspection,
  RawArtifactDescriptor,
  RawStaticSnapshot,
} from "@aom/protocol";
import { ElectronAsarBackend, type AsarAnalyzerBackend } from "../analyzer/asar.js";
import {
  electronFusesTool,
  inspectElectronFuses,
} from "../analyzer/fuses.js";
import { toolMetadata } from "../analyzer/tool.js";
import { inventoryAsar, type AsarInventory } from "./asar.js";
import {
  addHtmlFacts,
  addJavaScriptFacts,
  addPackageFacts,
  createBaseGraph,
} from "./graph.js";
import { inventoryArtifacts, type ArtifactFile } from "./inventory.js";
import { inspectJavaScriptText } from "./javascript.js";
import type { StaticAnalysisAdapter } from "../types.js";

export class ElectronArtifactAdapter implements StaticAnalysisAdapter {
  readonly adapterId = "adapter:electron-artifact";
  readonly tools;

  constructor(
    readonly targetId: string,
    private readonly artifactRoot: string,
    private readonly asarBackend: AsarAnalyzerBackend = new ElectronAsarBackend(),
  ) {
    this.tools = [this.asarBackend.tool, electronFusesTool] as const;
  }

  accepts(inspection: ArtifactInspection): boolean {
    return inspection.recommendedAdapter === this.adapterId;
  }

  async collectStaticSnapshot(): Promise<RawStaticSnapshot> {
    const outerFiles = await inventoryArtifacts(this.artifactRoot);
    const archives = await this.readArchives(outerFiles);
    const fuseInspection = await inspectElectronFuses(this.artifactRoot);
    const files = [
      ...outerFiles.filter((file) => path.extname(file.relativePath).toLowerCase() !== ".asar"),
      ...archives.flatMap((archive) => archive.files),
    ];
    const evidence = [
      ...archives.map((archive) => archive.toolEvidence),
      fuseInspection.evidence,
    ];
    const root = this.rootArtifact(
      fuseInspection.values,
      toolMetadata(evidence),
    );
    const artifacts = [
      root,
      ...outerFiles
        .filter((file) => path.extname(file.relativePath).toLowerCase() !== ".asar")
        .map((file) => file.descriptor),
      ...archives.map((archive) => archive.archive),
      ...archives.flatMap((archive) => archive.files.map((file) => file.descriptor)),
    ];
    const graph = createBaseGraph(this.targetId, root, artifacts.slice(1));

    for (const archive of archives) {
      addPackageFacts(
        graph,
        archive.files,
        archive.packageJson,
        archive.installedModules,
      );
    }
    for (const file of files) {
      const extension = path.posix.extname(file.relativePath).toLowerCase();
      const text = await this.readText(file);
      if (text === undefined) continue;
      if (extension === ".js" || extension === ".mjs") {
        addJavaScriptFacts(
          graph,
          file,
          inspectJavaScriptText(file.relativePath, text),
        );
      } else if (extension === ".html") {
        await addHtmlFacts(graph, file, files, text);
      }
    }

    return {
      snapshotId: `snapshot:static:${Date.now()}`,
      targetId: this.targetId,
      platform: "electron",
      timestamp: Date.now(),
      adapterId: this.adapterId,
      artifacts,
      nodes: graph.nodes,
      edges: graph.edges,
      evidenceIds: [
        ...new Set([
          ...graph.nodes.flatMap((node) => node.evidenceIds),
          ...evidence.map((item) => item.evidenceId),
        ]),
      ],
    };
  }

  private async readArchives(files: ArtifactFile[]): Promise<AsarInventory[]> {
    const archives: AsarInventory[] = [];
    for (const file of files) {
      if (
        path.extname(file.relativePath).toLowerCase() === ".asar"
        && file.absolutePath !== undefined
      ) {
        archives.push(await inventoryAsar(
          file.absolutePath,
          file.descriptor.locator,
          this.asarBackend,
        ));
      }
    }
    return archives;
  }

  private async readText(file: ArtifactFile): Promise<string | undefined> {
    const extension = path.posix.extname(file.relativePath).toLowerCase();
    if (![".html", ".js", ".mjs"].includes(extension)) return "";
    try {
      return await file.readText();
    } catch (error) {
      file.descriptor.metadata.analysisStatus = "partial";
      file.descriptor.metadata.analysisError = error instanceof Error
        ? error.message
        : "artifact_read_failed";
      return undefined;
    }
  }

  private rootArtifact(
    electronFuses: Record<string, import("@aom/protocol").JsonValue>,
    analyzerMetadata: Record<string, import("@aom/protocol").JsonValue>,
  ): RawArtifactDescriptor {
    return {
      artifactId: `artifact:electron:root:${encodeURIComponent(this.targetId)}`,
      kind: "application_bundle",
      locator: this.artifactRoot,
      metadata: { platform: "electron", electronFuses, ...analyzerMetadata },
    };
  }
}
