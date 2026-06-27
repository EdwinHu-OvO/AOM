import { ElectronArtifactAdapter } from "@aom/electron-probe";
import type { EvidenceRef, RawStaticSnapshot } from "@aom/protocol";

export async function collectStatic(
  targetId: string,
  artifactLocator: string | undefined,
): Promise<{ staticSnapshot: RawStaticSnapshot; evidence: EvidenceRef[] }> {
  if (artifactLocator) {
    const adapter = new ElectronArtifactAdapter(targetId, artifactLocator);
    const staticSnapshot = await adapter.collectStaticSnapshot();
    return { staticSnapshot, evidence: [] };
  }
  const timestamp = Date.now();
  return {
    staticSnapshot: {
      snapshotId: `snapshot:static:minimal:${timestamp}`,
      targetId,
      platform: "electron",
      timestamp,
      adapterId: "adapter:runtime-only",
      artifacts: [],
      nodes: [],
      edges: [],
      evidenceIds: [],
    },
    evidence: [],
  };
}
