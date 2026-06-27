import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
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
  if (existsSync(binary)) return { command: binary, args: [] };
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
