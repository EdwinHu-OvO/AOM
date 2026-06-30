import { existsSync } from "node:fs";
import type { AOMFeatureConfig, AOMRuntimeConfig } from "../config.js";
import { writeConfig } from "./schema.js";
import type { CliResult } from "./commands.js";

export function initCommand(args: string[], config: AOMRuntimeConfig, filePath: string): CliResult {
  switch (args[0] ?? "-guide") {
    case "-guide":
      return setupGuide(config, filePath);
    case "-check":
      return ok(initCheck(config, filePath), false);
    case "-write-default": {
      const merged = mergeDefaults(config);
      writeConfig(filePath, merged);
      return ok({ written: true, path: filePath, check: initCheck(merged, filePath) }, true);
    }
    default:
      throw new Error(`unknown_init_action: ${args[0]}`);
  }
}

function setupGuide(config: AOMRuntimeConfig, filePath: string): CliResult {
  const check = initCheck(config, filePath);
  return {
    changed: false,
    data: check,
    text: [
      "AOM setup guide",
      "",
      `Config path: ${filePath}`,
      `Config exists: ${check.exists ? "yes" : "no"}`,
      "",
      "Recommended first steps:",
      "  ./AOM-cli -init -check",
      "  ./AOM-cli -init -write-default",
      "  ./AOM-cli -feature -list",
      "  ./AOM-cli -log -show",
      "",
      "Common configuration:",
      "  ./AOM-cli -feature -enable dynamic_call_chain",
      "  ./AOM-cli -feature -set dynamic_call_chain.max_steps 4",
      "  ./AOM-cli -feature -enable llm_capability_recognizer",
      "  ./AOM-cli -feature -set llm_capability_recognizer.model qwen3.6:35b",
      "  ./AOM-cli -log -level info",
      "  ./AOM-cli -log -audit-level normal",
      "",
      "Boundary:",
      "  -init only guides and writes configuration defaults.",
      "  It does not launch apps, manage sessions, run analysis, or invoke actions.",
    ].join("\n"),
  };
}

function initCheck(config: AOMRuntimeConfig, filePath: string): {
  ok: boolean;
  path: string;
  exists: boolean;
  missing: string[];
  recommendations: string[];
} {
  const missing = [
    ...(!config.features ? ["features"] : []),
    ...(!config.features?.dynamic_call_chain ? ["features.dynamic_call_chain"] : []),
    ...(!config.features?.llm_capability_recognizer ? ["features.llm_capability_recognizer"] : []),
    ...(!config.logging ? ["logging"] : []),
    ...(!config.logging?.level ? ["logging.level"] : []),
    ...(!config.logging?.auditLevel ? ["logging.auditLevel"] : []),
  ];
  return {
    ok: missing.length === 0,
    path: filePath,
    exists: existsSync(filePath),
    missing,
    recommendations: missing.length > 0
      ? ["Run ./AOM-cli -init -write-default to merge safe baseline defaults."]
      : ["Config baseline is present. Use -feature and -log commands for targeted changes."],
  };
}

function mergeDefaults(config: AOMRuntimeConfig): AOMRuntimeConfig {
  const result: AOMRuntimeConfig = {
    ...config,
    features: { ...defaultFeatures(), ...(config.features ?? {}) },
    logging: {
      ...config.logging,
      level: config.logging?.level ?? "info",
      auditLevel: config.logging?.auditLevel ?? "normal",
      modules: {
        mcp: "info",
        analysis: "info",
        capability: "info",
        orchestration: "info",
        recognizer: "warn",
        ...(config.logging?.modules ?? {}),
      },
    },
  };
  result.features!.llm_capability_recognizer = {
    ...result.features!.llm_capability_recognizer,
    enabled: config.capabilityRecognizer?.enabled
      ?? result.features!.llm_capability_recognizer?.enabled
      ?? false,
  };
  return result;
}

function defaultFeatures(): Record<string, AOMFeatureConfig> {
  return {
    context_delta: { enabled: true },
    context_window: { enabled: true, default_limit: 12 },
    dynamic_call_chain: { enabled: true, max_steps: 4 },
    llm_capability_recognizer: { enabled: false },
    compact_agent_payload: { enabled: true },
    console_audit: { enabled: true },
    dataflow_graph: { enabled: true },
    static_copy_analysis: { enabled: true },
    handoff_runtime: { enabled: true },
    mcp_server: { enabled: true },
  };
}

function ok(data: unknown, changed: boolean): CliResult {
  return { changed, data, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) };
}
