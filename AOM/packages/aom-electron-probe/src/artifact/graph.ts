import type {
  JsonValue,
  RawArtifactDescriptor,
  RawStaticEdge,
  RawStaticNode,
} from "@aom/protocol";
import {
  artifactNode,
  ensureNode,
  graphEdge,
  normalizePath,
  resolveAsset,
} from "./graph-utils.js";
import { inspectHtml } from "./html.js";
import type { JavaScriptFacts } from "./javascript.js";
import type { ArtifactFile } from "./inventory.js";

export interface StaticGraph {
  nodes: RawStaticNode[];
  edges: RawStaticEdge[];
}

export function createBaseGraph(
  targetId: string,
  root: RawArtifactDescriptor,
  artifacts: RawArtifactDescriptor[],
): StaticGraph {
  const nodes = [
    artifactNode(`static:app:${targetId}`, "application", targetId, root),
    ...artifacts.map((artifact) =>
      artifactNode(`static:${artifact.artifactId}`, artifact.kind, artifact.locator, artifact)),
  ];
  const edges: RawStaticEdge[] = [];
  const roles = new Set(
    artifacts
      .map((artifact) => String(artifact.metadata.processRole ?? "shared"))
      .filter((role) => !["package", "shared"].includes(role)),
  );

  for (const role of roles) {
    const processId = `static:process:${role}`;
    nodes.push({
      rawId: processId,
      kind: "process_component",
      label: role,
      artifactId: root.artifactId,
      attributes: { role },
      evidenceIds: [`evidence:static:process:${role}`],
    });
    edges.push(graphEdge(`app:${role}`, `static:app:${targetId}`, processId, "contains"));
  }

  for (const artifact of artifacts) {
    const role = String(artifact.metadata.processRole ?? "shared");
    const target = `static:${artifact.artifactId}`;
    const source = roles.has(role) ? `static:process:${role}` : `static:app:${targetId}`;
    edges.push(graphEdge(
      `owner:${artifact.artifactId}`,
      source,
      target,
      roles.has(role) ? "loads" : "contains",
    ));
    const archivePath = artifact.metadata.archivePath;
    if (typeof archivePath === "string") {
      const archive = artifacts.find((candidate) => candidate.locator === archivePath);
      if (archive) {
        edges.push(graphEdge(
          `archive:${artifact.artifactId}`,
          `static:${archive.artifactId}`,
          target,
          "contains",
        ));
      }
    }
  }
  return { nodes, edges };
}

export function addPackageFacts(
  graph: StaticGraph,
  files: ArtifactFile[],
  packageJson: Record<string, JsonValue> | undefined,
  installedModules: string[] = [],
): void {
  if (!packageJson) return;
  const packageFile = files.find((file) => file.relativePath === "package.json");
  if (!packageFile) return;
  const packageNode = `static:${packageFile.descriptor.artifactId}`;
  const main = typeof packageJson.main === "string" ? packageJson.main : undefined;
  if (main) {
    const mainFile = files.find(
      (file) => normalizePath(file.relativePath) === normalizePath(main),
    );
    if (mainFile) {
      graph.edges.push(graphEdge(
        `entrypoint:${mainFile.descriptor.artifactId}`,
        packageNode,
        `static:${mainFile.descriptor.artifactId}`,
        "entrypoint",
      ));
    }
  }
  const dependencies = packageJson.dependencies;
  const declared = dependencies && !Array.isArray(dependencies) && typeof dependencies === "object"
    ? Object.keys(dependencies)
    : [];
  for (const dependency of [...new Set([...declared, ...installedModules])].sort()) {
    const id = `static:module:${encodeURIComponent(dependency)}`;
    ensureNode(graph.nodes, {
      rawId: id,
      kind: "module_dependency",
      label: dependency,
      artifactId: packageFile.descriptor.artifactId,
      artifactOffset: `package:dependencies:${dependency}`,
      attributes: {
        declared: declared.includes(dependency),
        installed: installedModules.includes(dependency),
      },
      evidenceIds: [`evidence:${id}`],
    });
    graph.edges.push(graphEdge(
      `package-dependency:${encodeURIComponent(dependency)}`,
      packageNode,
      id,
      "declares_dependency",
    ));
  }
}

export function addJavaScriptFacts(
  graph: StaticGraph,
  file: ArtifactFile,
  facts: JavaScriptFacts,
): void {
  const source = `static:${file.descriptor.artifactId}`;
  for (const dependency of facts.imports) {
    const id = `static:module:${encodeURIComponent(dependency)}`;
    ensureNode(graph.nodes, {
      rawId: id,
      kind: "module_dependency",
      label: dependency,
      artifactId: file.descriptor.artifactId,
      artifactOffset: `import:${dependency}`,
      attributes: {},
      evidenceIds: [`evidence:${id}`],
    });
    graph.edges.push(graphEdge(
      `dependency:${file.descriptor.artifactId}:${encodeURIComponent(dependency)}`,
      source,
      id,
      "depends_on",
    ));
  }
  for (const endpoint of facts.apiPaths) {
    const id = `static:endpoint:${encodeURIComponent(endpoint)}`;
    ensureNode(graph.nodes, {
      rawId: id,
      kind: "api_endpoint",
      label: endpoint,
      artifactId: file.descriptor.artifactId,
      artifactOffset: `string:${endpoint}`,
      attributes: {},
      evidenceIds: [`evidence:${id}`],
    });
    graph.edges.push(graphEdge(
      `endpoint:${file.descriptor.artifactId}:${encodeURIComponent(endpoint)}`,
      source,
      id,
      "references",
    ));
  }
}

export async function addHtmlFacts(
  graph: StaticGraph,
  file: ArtifactFile,
  files: ArtifactFile[],
  text?: string,
): Promise<void> {
  const facts = inspectHtml(text ?? await file.readText());
  for (const reference of [...facts.scripts, ...facts.stylesheets]) {
    const resolved = resolveAsset(file.relativePath, reference);
    const target = files.find(
      (candidate) => normalizePath(candidate.relativePath) === resolved,
    );
    if (!target) continue;
    graph.edges.push(graphEdge(
      `html:${file.descriptor.artifactId}:${target.descriptor.artifactId}`,
      `static:${file.descriptor.artifactId}`,
      `static:${target.descriptor.artifactId}`,
      "loads",
    ));
  }
}
