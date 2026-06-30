#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const releaseId = process.argv[2] ?? "0.1.0-dev.1";
const root = process.cwd();
const outDir = path.join(root, "releases", releaseId);
const packages = [
  { name: "@aom/protocol", dir: "packages/aom-protocol-ts" },
  { name: "@aom/electron-probe", dir: "packages/aom-electron-probe" },
  { name: "@aom/agent-mcp", dir: "packages/aom-agent-mcp" },
  { name: "@aom/console", dir: "packages/aom-console" },
];

if (!existsSync(path.join(root, "pnpm-workspace.yaml"))) {
  throw new Error("run from the AOM/ workspace root");
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

cleanBuildOutputs();
run("pnpm", ["build"]);
run("cargo", ["build", "--workspace"]);

for (const item of packages) {
  run("pnpm", ["--filter", item.name, "pack", "--pack-destination", outDir]);
}

const workspaceArchive = `aom-${releaseId}-workspace.tar.gz`;
run("tar", [
  "-czf",
  path.join(outDir, workspaceArchive),
  "--exclude",
  "node_modules",
  "--exclude",
  "target",
  "--exclude",
  "logs",
  "--exclude",
  "releases",
  "--exclude",
  ".DS_Store",
  "-C",
  root,
  ".",
]);

const artifacts = readdirSync(outDir)
  .filter((item) => item.endsWith(".tgz") || item.endsWith(".tar.gz"))
  .sort();
const checksums = artifacts.map((fileName) => ({
  fileName,
  sha256: sha256(path.join(outDir, fileName)),
}));
const manifest = {
  releaseId,
  channel: "dev",
  generatedAt: new Date().toISOString(),
  git: {
    commit: capture("git", ["rev-parse", "HEAD"]),
    branch: capture("git", ["branch", "--show-current"]),
    dirty: capture("git", ["status", "--short"]).length > 0,
  },
  build: {
    commands: ["pnpm build", "cargo build --workspace"],
    rust: "debug workspace build; binaries are not treated as cross-machine artifacts",
    javascript: "workspace packages packed with pnpm pack after TypeScript build",
  },
  artifacts,
  checksums,
};

writeFileSync(
  path.join(outDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
writeFileSync(
  path.join(outDir, "SHA256SUMS"),
  `${checksums.map((item) => `${item.sha256}  ${item.fileName}`).join("\n")}\n`,
);

console.log(outDir);

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status}`);
  }
}

function cleanBuildOutputs() {
  for (const item of packages) {
    const packageDir = path.join(root, item.dir);
    rmSync(path.join(packageDir, "dist"), { recursive: true, force: true });
    for (const fileName of readdirSync(packageDir)) {
      if (fileName.endsWith(".tsbuildinfo")) {
        rmSync(path.join(packageDir, fileName), { force: true });
      }
    }
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) return "";
  return result.stdout.trim();
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}
