import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { AnalysisInput, AnalysisOutput } from "./types.js";

export async function runAnalysis(input: AnalysisInput): Promise<AnalysisOutput> {
  const bridge = bridgeCommand();
  const child = spawn(bridge.command, bridge.args, { cwd: workspaceRoot(), stdio: ["pipe", "pipe", "pipe"] });
  child.stdin.end(JSON.stringify(input));
  const [stdout, stderr, code] = await Promise.all([
    readStream(child.stdout),
    readStream(child.stderr),
    waitForExit(child),
  ]);
  if (code !== 0) throw new Error(`analysis_bridge_failed: ${stderr || code}`);
  return JSON.parse(stdout) as AnalysisOutput;
}

function bridgeCommand(): { command: string; args: string[] } {
  if (process.env.AOM_ANALYSIS_BRIDGE) return { command: process.env.AOM_ANALYSIS_BRIDGE, args: [] };
  const binary = path.join(workspaceRoot(), "target", "debug", "aom-analysis-bridge");
  if (existsSync(binary) && isFresh(binary, path.join(workspaceRoot(), "crates"))) {
    return { command: binary, args: [] };
  }
  return {
    command: "cargo",
    args: ["run", "--quiet", "-p", "aom-analysis-server", "--bin", "aom-analysis-bridge"],
  };
}

function workspaceRoot(): string {
  return path.resolve(new URL("../../../../", import.meta.url).pathname);
}

function readStream(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    let text = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      text += String(chunk);
    });
    stream.on("error", reject);
    stream.on("end", () => resolve(text));
  });
}

function waitForExit(child: ReturnType<typeof spawn>): Promise<number | null> {
  return new Promise((resolve) => child.on("close", resolve));
}

function isFresh(binary: string, cratesRoot: string): boolean {
  const builtAt = statSync(binary).mtimeMs;
  return newestRustSource(cratesRoot) <= builtAt;
}

function newestRustSource(root: string): number {
  let newest = 0;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) newest = Math.max(newest, newestRustSource(fullPath));
    else if (entry.name.endsWith(".rs") || entry.name === "Cargo.toml") {
      newest = Math.max(newest, statSync(fullPath).mtimeMs);
    }
  }
  return newest;
}
