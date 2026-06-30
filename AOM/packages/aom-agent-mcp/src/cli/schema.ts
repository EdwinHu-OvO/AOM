import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { AOMAuditLevel, AOMLogLevel, AOMRuntimeConfig } from "../config.js";
import { defaultConfigPath } from "../config.js";

export const featureNames = [
  "context_delta",
  "context_window",
  "dynamic_call_chain",
  "llm_capability_recognizer",
  "compact_agent_payload",
  "console_audit",
  "dataflow_graph",
  "static_copy_analysis",
  "handoff_runtime",
  "mcp_server",
] as const;

export const logLevels: AOMLogLevel[] = ["off", "error", "warn", "info", "debug", "trace"];
export const auditLevels: AOMAuditLevel[] = ["off", "summary", "normal", "verbose", "full"];

export function resolveConfigPath(args: string[]): string {
  const index = args.indexOf("-file");
  return index >= 0 && args[index + 1] ? path.resolve(args[index + 1]!) : defaultConfigPath();
}

export function readConfig(filePath: string): AOMRuntimeConfig {
  if (!existsSync(filePath)) return {};
  return JSON.parse(readFileSync(filePath, "utf8")) as AOMRuntimeConfig;
}

export function writeConfig(filePath: string, config: AOMRuntimeConfig): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`);
}

export function ensureFeature(config: AOMRuntimeConfig, name: string): Record<string, unknown> {
  config.features ??= {};
  config.features[name] ??= {};
  return config.features[name] as Record<string, unknown>;
}

export function setDottedValue(target: Record<string, unknown>, dottedKey: string, value: unknown): void {
  const parts = dottedKey.split(".").filter(Boolean);
  if (parts.length === 0) throw new Error("key_required");
  let current = target;
  for (const part of parts.slice(0, -1)) {
    if (!current[part] || typeof current[part] !== "object" || Array.isArray(current[part])) current[part] = {};
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
}

export function parseValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

export function assertLogLevel(value: string): AOMLogLevel {
  if (!logLevels.includes(value as AOMLogLevel)) throw new Error(`invalid_log_level: ${value}`);
  return value as AOMLogLevel;
}

export function assertAuditLevel(value: string): AOMAuditLevel {
  if (!auditLevels.includes(value as AOMAuditLevel)) throw new Error(`invalid_audit_level: ${value}`);
  return value as AOMAuditLevel;
}
