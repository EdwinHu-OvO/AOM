import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ElectronArtifactAdapter,
  GenericArtifactAdapter,
  InternalAsarFallbackBackend,
  inventoryAsar,
} from "../dist/index.js";
import { assert, writeSyntheticAsar } from "./helpers.mjs";

const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "aom-electron-static-"));
try {
  writeDirectoryFixture(fixtureRoot);
  const adapter = new ElectronArtifactAdapter("target:fixture-directory", fixtureRoot);
  const snapshot = await adapter.collectStaticSnapshot();

  assert(
    adapter.accepts({
      inspectionId: "inspection:test",
      inputLocator: fixtureRoot,
      containerType: "directory",
      runtimeCandidates: [{ runtime: "electron", confidence: 0.8 }],
      recommendedAdapter: "adapter:electron-artifact",
      evidence: [],
    }),
    "electron adapter should accept parser routing result",
  );
  assert(hasRole(snapshot, "renderer"), "should find renderer process component");
  assert(hasEndpoint(snapshot, "/api/login"), "should inspect compiled directory artifacts");
  assert(
    snapshot.artifacts.every((artifact) => !artifact.locator.includes("/src/")),
    "static analysis should not depend on source paths",
  );

  const resources = path.join(fixtureRoot, "Packaged.app", "Contents", "Resources");
  mkdirSync(resources, { recursive: true });
  const archive = path.join(resources, "app.asar");
  writeSyntheticAsar(archive, packagedFiles());
  const packaged = await new ElectronArtifactAdapter(
    "target:fixture-asar",
    path.join(fixtureRoot, "Packaged.app"),
  ).collectStaticSnapshot();

  assert(
    packaged.artifacts.some((artifact) => artifact.locator.includes("app.asar!/dist/main/main.js")),
    "should expose ASAR entries as virtual artifacts",
  );
  for (const role of ["main", "renderer", "backend"]) {
    assert(hasRole(packaged, role), `should restore ${role} process role from ASAR`);
  }
  assert(hasEndpoint(packaged, "/api/login"), "should inspect JavaScript inside ASAR");
  const rootArtifact = packaged.artifacts.find(
    (artifact) => artifact.kind === "application_bundle",
  );
  assert(
    rootArtifact?.metadata.analyzerTools.some(
      (entry) => entry.name === "@electron/asar" && entry.mode === "library",
    ),
    "should record the maintained ASAR analyzer in tool provenance",
  );
  assert(
    packaged.evidenceIds.some((id) => id.startsWith("evidence:tool:electron-asar:")),
    "should link analyzer tool evidence from the static snapshot",
  );
  assert(
    packaged.nodes.some(
      (node) => node.kind === "module_dependency" && node.label === "express",
    ),
    "should restore package dependencies without expanding node_modules",
  );
  assert(
    packaged.nodes.some((node) => node.kind === "native_module"),
    "should retain native module boundaries",
  );
  assert(
    packaged.edges.some((edge) => edge.relationship === "loads" && edge.rawId.includes("html:")),
    "should link renderer HTML to packaged assets",
  );

  const unsafeAsar = path.join(resources, "unsafe.asar");
  writeSyntheticAsar(unsafeAsar, { "../escape.js": "unsafe" });
  await assertRejects(
    () => inventoryAsar(unsafeAsar, "Contents/Resources/unsafe.asar"),
    "should reject ASAR path traversal entries",
  );

  const fallback = await inventoryAsar(
    archive,
    "Contents/Resources/app.asar",
    new InternalAsarFallbackBackend(),
  );
  assert(
    fallback.toolEvidence.tool.mode === "fallback",
    "should keep the bounded internal reader as an explicit fallback",
  );

  const unknownFile = path.join(fixtureRoot, "unknown.bin");
  writeFileSync(unknownFile, Buffer.from([0, 1, 2, 3]));
  const generic = await new GenericArtifactAdapter(
    "target:unknown-file",
    unknownFile,
  ).collectStaticSnapshot();
  assert(
    generic.adapterId === "adapter:generic-artifact",
    "should route unknown files to the generic artifact adapter",
  );
  assert(
    generic.nodes.some((node) => node.kind === "opaque_file"),
    "should preserve unknown files as bounded opaque artifacts",
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

function writeDirectoryFixture(root) {
  const files = {
    "dist/main/main.js": 'import { app } from "electron";',
    "dist/renderer/index.html": '<script src="./assets/app.js"></script>',
    "dist/renderer/assets/app.js": 'fetch("/api/login");',
    "dist/server/server.js": 'app.get("/api/orders");',
  };
  for (const [relativePath, text] of Object.entries(files)) {
    const destination = path.join(root, relativePath);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, text);
  }
}

function packagedFiles() {
  return {
    "package.json": JSON.stringify({
      name: "fixture-app",
      main: "dist/main/main.js",
      dependencies: { express: "^5.0.0" },
    }),
    "dist/main/main.js": 'import { app } from "electron"; import "../server/server.js";',
    "dist/main/preload.js": 'import { contextBridge } from "electron";',
    "dist/renderer/index.html":
      '<script type="module" src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css">',
    "dist/renderer/assets/app.js": 'fetch("/api/login");',
    "dist/renderer/assets/app.css": "body { color: black; }",
    "dist/server/server.js": 'import express from "express"; app.get("/api/orders");',
    "node_modules/native-addon/build/addon.node": "fixture-native-module",
  };
}

function hasRole(snapshot, role) {
  return snapshot.nodes.some(
    (node) => node.kind === "process_component" && node.label === role,
  );
}

function hasEndpoint(snapshot, endpoint) {
  return snapshot.nodes.some(
    (node) => node.kind === "api_endpoint" && node.label === endpoint,
  );
}

async function assertRejects(operation, message) {
  let rejected = false;
  try {
    await operation();
  } catch {
    rejected = true;
  }
  assert(rejected, message);
}
