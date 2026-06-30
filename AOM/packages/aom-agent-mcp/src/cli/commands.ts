import type { AOMRuntimeConfig } from "../config.js";
import { helpFor } from "./help.js";
import { initCommand } from "./init.js";
import {
  assertAuditLevel,
  assertLogLevel,
  auditLevels,
  ensureFeature,
  featureNames,
  logLevels,
  parseValue,
  readConfig,
  setDottedValue,
  writeConfig,
} from "./schema.js";

export interface CliResult {
  changed: boolean;
  data: unknown;
  text: string;
}

export function runCommand(args: string[], filePath: string): CliResult {
  const moduleName = firstModule(args);
  if (!moduleName || moduleName === "-help") return ok(helpFor(), false);
  if (args.includes("-help")) return ok(helpFor(moduleName), false);
  const config = readConfig(filePath);
  switch (moduleName) {
    case "-feature":
      return featureCommand(args.slice(1), config, filePath);
    case "-log":
      return logCommand(args.slice(1), config, filePath);
    case "-config":
      return configCommand(args.slice(1), config, filePath);
    case "-init":
      return initCommand(args.slice(1), config, filePath);
    default:
      throw new Error(`unknown_function: ${moduleName}`);
  }
}

function featureCommand(args: string[], config: AOMRuntimeConfig, filePath: string): CliResult {
  const action = args[0];
  switch (action) {
    case "-list":
      return ok(featureList(config), false);
    case "-show":
      return ok(showFeature(config, required(args[1], "feature_required")), false);
    case "-enable":
      return update(filePath, config, enableFeature(config, required(args[1], "feature_required"), true));
    case "-disable":
      return update(filePath, config, enableFeature(config, required(args[1], "feature_required"), false));
    case "-set":
      return update(filePath, config, setFeatureValue(config, required(args[1], "feature_key_required"), required(args[2], "value_required")));
    default:
      throw new Error(`unknown_feature_action: ${action ?? "missing"}`);
  }
}

function logCommand(args: string[], config: AOMRuntimeConfig, filePath: string): CliResult {
  config.logging ??= {};
  const action = args[0];
  switch (action) {
    case "-show":
      return ok(config.logging, false);
    case "-level":
      config.logging.level = assertLogLevel(required(args[1], "level_required"));
      return update(filePath, config, { logging: config.logging });
    case "-set":
      config.logging.modules ??= {};
      config.logging.modules[required(args[1], "module_required")] = assertLogLevel(required(args[2], "level_required"));
      return update(filePath, config, { logging: config.logging });
    case "-audit-level":
      config.logging.auditLevel = assertAuditLevel(required(args[1], "audit_level_required"));
      return update(filePath, config, { logging: config.logging });
    default:
      throw new Error(`unknown_log_action: ${action ?? "missing"}`);
  }
}

function configCommand(args: string[], config: AOMRuntimeConfig, filePath: string): CliResult {
  switch (args[0]) {
    case "-path":
      return ok({ path: filePath }, false);
    case "-show":
      return ok(redactedConfig(config), false);
    case "-validate":
      return ok(validateConfig(config, filePath), false);
    default:
      throw new Error(`unknown_config_action: ${args[0] ?? "missing"}`);
  }
}

function featureList(config: AOMRuntimeConfig): unknown {
  const configured = config.features ?? {};
  return featureNames.map((name) => ({
    name,
    enabled: Boolean(configured[name]?.enabled ?? legacyEnabled(config, name)),
    configured: Boolean(configured[name]),
  }));
}

function showFeature(config: AOMRuntimeConfig, name: string): unknown {
  return {
    name,
    config: config.features?.[name] ?? {},
    legacy: name === "llm_capability_recognizer" ? redactedRecognizer(config) : undefined,
  };
}

function enableFeature(config: AOMRuntimeConfig, name: string, enabled: boolean): unknown {
  ensureFeature(config, name).enabled = enabled;
  if (name === "llm_capability_recognizer") {
    config.capabilityRecognizer ??= { enabled, provider: "openai_compatible", baseUrl: "", model: "" };
    config.capabilityRecognizer.enabled = enabled;
  }
  return showFeature(config, name);
}

function setFeatureValue(config: AOMRuntimeConfig, key: string, rawValue: string): unknown {
  const dot = key.indexOf(".");
  if (dot <= 0) throw new Error("feature_key_must_be_feature_dot_key");
  const feature = key.slice(0, dot);
  const nestedKey = key.slice(dot + 1);
  const value = parseValue(rawValue);
  setDottedValue(ensureFeature(config, feature), nestedKey, value);
  if (feature === "llm_capability_recognizer") syncRecognizer(config, nestedKey, value);
  return showFeature(config, feature);
}

function syncRecognizer(config: AOMRuntimeConfig, key: string, value: unknown): void {
  config.capabilityRecognizer ??= { enabled: false, provider: "openai_compatible", baseUrl: "", model: "" };
  if (key === "base_url" || key === "baseUrl") config.capabilityRecognizer.baseUrl = String(value);
  else if (key === "model") config.capabilityRecognizer.model = String(value);
  else if (key === "enabled") config.capabilityRecognizer.enabled = Boolean(value);
  else if (key === "temperature" && typeof value === "number") config.capabilityRecognizer.temperature = value;
  else if (key === "top_p" && typeof value === "number") config.capabilityRecognizer.topP = value;
  else if (key === "max_tokens" && typeof value === "number") config.capabilityRecognizer.maxTokens = value;
}

function validateConfig(config: AOMRuntimeConfig, filePath: string): unknown {
  if (config.logging?.level) assertLogLevel(config.logging.level);
  if (config.logging?.auditLevel) assertAuditLevel(config.logging.auditLevel);
  for (const [moduleName, level] of Object.entries(config.logging?.modules ?? {})) {
    assertLogLevel(level);
    if (!moduleName.trim()) throw new Error("empty_log_module_name");
  }
  return { ok: true, path: filePath, logLevels, auditLevels, knownFeatures: featureNames };
}

function update(filePath: string, config: AOMRuntimeConfig, data: unknown): CliResult {
  writeConfig(filePath, config);
  return { changed: true, data, text: renderHuman(data) };
}

function ok(data: unknown, changed: boolean): CliResult {
  return { changed, data, text: typeof data === "string" ? data : renderHuman(data) };
}

function firstModule(args: string[]): string | undefined {
  return args.find((item) => !["-file", "-format"].includes(item) && item.startsWith("-"));
}

function required(value: string | undefined, message: string): string {
  if (!value) throw new Error(message);
  return value;
}

function legacyEnabled(config: AOMRuntimeConfig, name: string): boolean | undefined {
  return name === "llm_capability_recognizer" ? config.capabilityRecognizer?.enabled : undefined;
}

function redactedConfig(config: AOMRuntimeConfig): Record<string, unknown> {
  const result: Record<string, unknown> = { ...config };
  if (config.capabilityRecognizer) result.capabilityRecognizer = redactedRecognizer(config);
  return result;
}

function redactedRecognizer(config: AOMRuntimeConfig): AOMRuntimeConfig["capabilityRecognizer"] {
  const recognizer = config.capabilityRecognizer;
  return recognizer ? { ...recognizer, ...(recognizer.apiKey ? { apiKey: "<redacted>" } : {}) } : undefined;
}

function renderHuman(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
