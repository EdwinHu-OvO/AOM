import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface AOMRuntimeConfig {
  capabilityRecognizer?: LlmRecognizerConfig;
  features?: Record<string, AOMFeatureConfig>;
  logging?: AOMLoggingConfig;
}

export interface AOMFeatureConfig {
  enabled?: boolean;
  [key: string]: unknown;
}

export interface AOMLoggingConfig {
  level?: AOMLogLevel;
  modules?: Record<string, AOMLogLevel>;
  auditLevel?: AOMAuditLevel;
}

export type AOMLogLevel = "off" | "error" | "warn" | "info" | "debug" | "trace";
export type AOMAuditLevel = "off" | "summary" | "normal" | "verbose" | "full";

export interface LlmRecognizerConfig {
  enabled: boolean;
  provider: "openai_compatible";
  baseUrl: string;
  model: string;
  apiKey?: string;
  apiKeyEnv?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  maxCandidates?: number;
  minConfidence?: number;
  schemaRepairAttempts?: number;
}

export function loadAomConfig(filePath = defaultConfigPath()): AOMRuntimeConfig {
  if (!existsSync(filePath)) return {};
  return JSON.parse(readFileSync(filePath, "utf8")) as AOMRuntimeConfig;
}

export function defaultConfigPath(): string {
  return process.env.AOM_CONFIG
    ?? path.resolve(new URL("../../../aom.config.json", import.meta.url).pathname);
}
