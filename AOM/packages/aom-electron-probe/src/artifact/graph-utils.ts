import path from "node:path";
import type {
  RawArtifactDescriptor,
  RawStaticEdge,
  RawStaticNode,
} from "@aom/protocol";

export function artifactNode(
  rawId: string,
  kind: string,
  label: string,
  artifact: RawArtifactDescriptor,
): RawStaticNode {
  return {
    rawId,
    kind,
    label,
    artifactId: artifact.artifactId,
    attributes: artifact.metadata,
    evidenceIds: [`evidence:static:${artifact.artifactId}`],
  };
}

export function graphEdge(
  id: string,
  from: string,
  to: string,
  relationship: string,
): RawStaticEdge {
  return {
    rawId: `static:edge:${id}`,
    fromRawId: from,
    toRawId: to,
    relationship,
    evidenceIds: [`evidence:static:edge:${id}`],
  };
}

export function ensureNode(nodes: RawStaticNode[], candidate: RawStaticNode): void {
  if (!nodes.some((node) => node.rawId === candidate.rawId)) nodes.push(candidate);
}

export function resolveAsset(htmlPath: string, reference: string): string {
  const clean = reference.split(/[?#]/)[0] ?? reference;
  const relative = clean.startsWith("/") ? `.${clean}` : clean;
  return normalizePath(path.posix.join(path.posix.dirname(normalizePath(htmlPath)), relative));
}

export function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}
