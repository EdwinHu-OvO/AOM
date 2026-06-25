import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type {
  ArtifactInspection,
  RawArtifactDescriptor,
  RawStaticSnapshot,
} from "@aom/protocol";
import type { AnalyzerToolDescriptor } from "../analyzer/tool.js";
import type { StaticAnalysisAdapter } from "../types.js";
import { artifactNode, graphEdge } from "./graph-utils.js";
import { GenericWebArtifactAdapter } from "./web.js";

const nodeFileTool: AnalyzerToolDescriptor = {
  id: "tool:node-file-metadata",
  name: "Node.js fs",
  version: process.version,
  mode: "library",
  capabilities: ["file_metadata", "file_digest"],
};

export class GenericArtifactAdapter implements StaticAnalysisAdapter {
  readonly adapterId = "adapter:generic-artifact";
  readonly tools = [nodeFileTool] as const;

  constructor(
    readonly targetId: string,
    private readonly locator: string,
  ) {}

  accepts(inspection: ArtifactInspection): boolean {
    return inspection.recommendedAdapter === undefined
      || inspection.recommendedAdapter === this.adapterId;
  }

  async collectStaticSnapshot(): Promise<RawStaticSnapshot> {
    if ((await stat(this.locator)).isDirectory()) {
      const snapshot = await new GenericWebArtifactAdapter(
        this.targetId,
        this.locator,
      ).collectStaticSnapshot();
      return { ...snapshot, adapterId: this.adapterId };
    }
    const bytes = await readFile(this.locator);
    const digest = createHash("sha256").update(bytes).digest("hex");
    const root = this.rootArtifact();
    const artifact: RawArtifactDescriptor = {
      artifactId: `artifact:generic:${digest.slice(0, 16)}`,
      kind: "opaque_file",
      locator: this.locator,
      format: path.extname(this.locator).slice(1) || "binary",
      digest: `sha256:${digest}`,
      metadata: {
        size: bytes.length,
        analyzerTool: toolMetadata(),
      },
    };
    const appId = `static:app:${this.targetId}`;
    const artifactId = `static:${artifact.artifactId}`;
    return {
      snapshotId: `snapshot:static:${Date.now()}`,
      targetId: this.targetId,
      platform: "unknown",
      timestamp: Date.now(),
      adapterId: this.adapterId,
      artifacts: [root, artifact],
      nodes: [
        artifactNode(appId, "application", this.targetId, root),
        artifactNode(artifactId, artifact.kind, artifact.locator, artifact),
      ],
      edges: [graphEdge(`generic:${artifact.artifactId}`, appId, artifactId, "contains")],
      evidenceIds: [
        `evidence:static:${root.artifactId}`,
        `evidence:static:${artifact.artifactId}`,
      ],
    };
  }

  private rootArtifact(): RawArtifactDescriptor {
    return {
      artifactId: `artifact:generic:root:${encodeURIComponent(this.targetId)}`,
      kind: "application_artifact",
      locator: this.locator,
      metadata: { analyzerTool: toolMetadata() },
    };
  }
}

function toolMetadata() {
  return {
    id: nodeFileTool.id,
    name: nodeFileTool.name,
    version: nodeFileTool.version,
    mode: nodeFileTool.mode,
    capabilities: nodeFileTool.capabilities,
  };
}
