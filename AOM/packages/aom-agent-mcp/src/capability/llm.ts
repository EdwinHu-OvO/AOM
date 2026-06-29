import type { AnalysisOutput } from "../analysis/types.js";
import type { LlmRecognizerConfig } from "../config.js";
import type { CapabilityCandidate, CapabilityRecognitionTrace } from "./types.js";
import { validateCandidates } from "./validate.js";

export async function recognizeCapabilities(
  analysis: AnalysisOutput,
  config: LlmRecognizerConfig | undefined,
): Promise<CapabilityRecognitionTrace | undefined> {
  if (!config?.enabled) return undefined;
  try {
    let request = await requestCandidates(analysis, config);
    let validation = validateCandidates(analysis, request.candidates, config);
    const maxRepairAttempts = config.schemaRepairAttempts ?? 1;
    while (
      validation.accepted.length === 0
      && validation.rejected.length > 0
      && request.repairAttempts < maxRepairAttempts
    ) {
      request = await repairCandidates(analysis, config, request.rawContent, validation.rejected, request.repairAttempts + 1);
      validation = validateCandidates(analysis, request.candidates, config);
    }
    analysis.capabilities = [...analysis.capabilities, ...validation.accepted];
    return {
      provider: "openai_compatible",
      model: config.model,
      enabled: true,
      candidates: request.candidates,
      accepted: validation.accepted.length,
      rejected: validation.rejected,
      repairAttempts: request.repairAttempts,
    };
  } catch (error) {
    return {
      provider: "openai_compatible",
      model: config.model,
      enabled: true,
      candidates: [],
      accepted: 0,
      rejected: [],
      repairAttempts: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function requestCandidates(
  analysis: AnalysisOutput,
  config: LlmRecognizerConfig,
): Promise<CandidateRequest> {
  const rawContent = await chatCompletion(config, [
    { role: "system", content: systemPrompt() },
    { role: "user", content: JSON.stringify(recognitionPack(analysis)) },
  ]);
  return { candidates: parseCandidates(rawContent), rawContent, repairAttempts: 0 };
}

async function repairCandidates(
  analysis: AnalysisOutput,
  config: LlmRecognizerConfig,
  previousOutput: string,
  validationErrors: Array<{ name: string; reason: string }>,
  repairAttempts: number,
): Promise<CandidateRequest> {
  const rawContent = await chatCompletion(config, [
    { role: "system", content: repairPrompt() },
    {
      role: "user",
      content: JSON.stringify({
        recognitionPack: recognitionPack(analysis),
        previousOutput,
        validationErrors,
      }),
    },
  ]);
  return { candidates: parseCandidates(rawContent), rawContent, repairAttempts };
}

async function chatCompletion(
  config: LlmRecognizerConfig,
  messages: Array<{ role: "system" | "user"; content: string }>,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 15_000);
  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: headers(config),
      body: JSON.stringify(requestBody(config, messages)),
    });
    if (!response.ok) {
      const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 240);
      throw new Error(`llm_recognizer_http_${response.status}${detail ? `: ${detail}` : ""}`);
    }
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return payload.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timeout);
  }
}

interface CandidateRequest {
  candidates: CapabilityCandidate[];
  rawContent: string;
  repairAttempts: number;
}

function recognitionPack(analysis: AnalysisOutput): Record<string, unknown> {
  const context = analysis.contextPack as {
    currentScreen?: { label?: string; views?: unknown[]; stateFacts?: unknown[] };
    dataFlows?: unknown[];
  };
  return {
    graphId: analysis.graph.graphId,
    currentScreenId: analysis.graph.currentScreenId,
    currentScreen: {
      label: context.currentScreen?.label,
      views: (context.currentScreen?.views ?? []).slice(0, 80),
      stateFacts: (context.currentScreen?.stateFacts ?? []).slice(0, 80),
    },
    dataFlows: (context.dataFlows ?? []).slice(0, 40),
    existingCapabilities: analysis.capabilities.map((item) => item.capability.name),
  };
}

function systemPrompt(): string {
  return [
    "You identify application capabilities from AOM graph context.",
    "Return JSON only. Do not include markdown, comments, prose, or hidden reasoning.",
    "The exact top-level shape is {\"candidates\":[...]} with zero or more candidates.",
    "Each candidate must include: name:string, confidence:number from 0 to 1, reason:string.",
    "Each candidate must include either targetViewId from currentScreen.views or exact targetLabel from currentScreen.views.",
    "Optional fields: description, action:\"click\"|\"set_text\", inputSlot, inputSlots, expectedEffect.",
    "Use action click for buttons/tabs/links and set_text only for input-like views with an input slot.",
    "If no current-screen view supports a capability, return {\"candidates\":[]}.",
    "Do not invent DOM selectors, coordinates, APIs, hidden app state, or views not present in the input.",
    "Good generic names include search_content, open_profile, open_video, switch_tab, play_media.",
    "Example: {\"candidates\":[{\"name\":\"search_content\",\"targetLabel\":\"Search\",\"action\":\"set_text\",\"inputSlot\":\"query\",\"confidence\":0.82,\"reason\":\"Search input is visible on the current screen\"}]}",
  ].join(" ");
}

function repairPrompt(): string {
  return [
    "Repair a capability recognizer JSON response so it passes the supplied validator errors.",
    "Return JSON only with exact shape {\"candidates\":[...]} and no markdown or prose.",
    "Preserve only candidates that can cite an existing current-screen targetViewId or exact targetLabel.",
    "Every candidate must include name:string, confidence:number from 0 to 1, reason:string.",
    "Do not add new app facts, selectors, coordinates, APIs, or targets beyond the recognitionPack.",
    "If the previous output cannot be repaired safely, return {\"candidates\":[]}.",
  ].join(" ");
}

function requestBody(
  config: LlmRecognizerConfig,
  messages: Array<{ role: "system" | "user"; content: string }>,
): Record<string, unknown> {
  return {
    model: config.model,
    temperature: config.temperature ?? 0,
    ...(config.topP !== undefined ? { top_p: config.topP } : {}),
    ...(config.maxTokens !== undefined ? { max_tokens: config.maxTokens } : {}),
    response_format: { type: "json_object" },
    messages,
  };
}

function parseCandidates(content: string): CapabilityCandidate[] {
  const parsed = JSON.parse(stripFence(content)) as Record<string, unknown> | unknown[];
  const rawCandidates = Array.isArray(parsed)
    ? parsed
    : firstArray(parsed, ["candidates", "capabilities", "actions", "items"]);
  return rawCandidates.map(normalizeCandidate);
}

function stripFence(content: string): string {
  return content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
}

function firstArray(value: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const found = value[key];
    if (Array.isArray(found)) return found;
  }
  return [];
}

function normalizeCandidate(value: unknown): CapabilityCandidate {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const action = normalizeAction(stringValue(
    raw.action ?? raw.kind ?? raw.actionType ?? raw.operation,
  ));
  const inputSlot = stringValue(
    raw.inputSlot ?? raw.input_slot ?? raw.slot ?? raw.inputName ?? raw.input_name,
  );
  const inputSlots = normalizeInputSlots(raw.inputSlots ?? raw.input_slots, inputSlot);
  const description = stringValue(raw.description ?? raw.summary);
  const targetViewId = stringValue(raw.targetViewId ?? raw.target_view_id ?? raw.viewId ?? raw.view_id ?? raw.nodeId ?? raw.node_id);
  const targetLabel = stringValue(raw.targetLabel ?? raw.target_label ?? raw.targetViewLabel ?? raw.target_view_label ?? raw.viewLabel ?? raw.label);
  const expectedEffect = stringValue(raw.expectedEffect ?? raw.expected_effect ?? raw.effect ?? raw.expectedResult);
  return {
    name: stringValue(raw.name ?? raw.capabilityName ?? raw.capability_name ?? raw.capability ?? raw.intent ?? raw.actionName) ?? "",
    ...(description ? { description } : {}),
    ...(targetViewId ? { targetViewId } : {}),
    ...(targetLabel ? { targetLabel } : {}),
    ...(action ? { action } : {}),
    ...(inputSlot ? { inputSlot } : {}),
    ...(inputSlots ? { inputSlots } : {}),
    ...(expectedEffect ? { expectedEffect } : {}),
    confidence: confidenceValue(raw.confidence ?? raw.confidenceScore ?? raw.confidence_score ?? raw.score ?? raw.probability) ?? Number.NaN,
    reason: stringValue(raw.reason ?? raw.rationale ?? raw.explanation ?? raw.why) ?? "No recognizer reason provided",
  };
}

function normalizeAction(value: string | undefined): CapabilityCandidate["action"] | undefined {
  if (!value) return undefined;
  const lowered = value.toLowerCase();
  if (["click", "tap", "press", "open", "select"].includes(lowered)) return "click";
  if (["set_text", "type", "input", "fill", "search", "enter_text"].includes(lowered)) return "set_text";
  return undefined;
}

function normalizeInputSlots(value: unknown, fallback?: string): CapabilityCandidate["inputSlots"] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => {
        const dataKind = stringValue(item.dataKind ?? item.data_kind ?? item.kind);
        const required = booleanValue(item.required);
        const sensitive = booleanValue(item.sensitive);
        return {
          name: stringValue(item.name ?? item.slot ?? item.key) ?? fallback ?? "input",
          ...(dataKind ? { dataKind } : {}),
          ...(required !== undefined ? { required } : {}),
          ...(sensitive !== undefined ? { sensitive } : {}),
        };
      });
  }
  return fallback ? [{ name: fallback, dataKind: "text", required: true, sensitive: false }] : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function confidenceValue(value: unknown): number | undefined {
  if (typeof value === "number") return value > 1 ? value / 100 : value;
  if (typeof value !== "string") return undefined;
  const lowered = value.trim().toLowerCase();
  const numeric = Number(lowered.replace(/%$/, ""));
  if (Number.isFinite(numeric)) return numeric > 1 ? numeric / 100 : numeric;
  if (["high", "strong"].includes(lowered)) return 0.85;
  if (["medium", "moderate"].includes(lowered)) return 0.65;
  if (["low", "weak"].includes(lowered)) return 0.35;
  return undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function headers(config: LlmRecognizerConfig): Record<string, string> {
  const result: Record<string, string> = {
    "Content-Type": "application/json",
    ...expandedHeaders(config.headers ?? {}),
  };
  const key = apiKey(config);
  if (key) result.Authorization = `Bearer ${key}`;
  return result;
}

function apiKey(config: LlmRecognizerConfig): string | undefined {
  if (config.apiKey) return config.apiKey;
  if (!config.apiKeyEnv) return undefined;
  return process.env[config.apiKeyEnv] ?? literalKeyFallback(config.apiKeyEnv);
}

function literalKeyFallback(value: string): string | undefined {
  return /^[A-Z_][A-Z0-9_]*$/.test(value) ? undefined : value;
}

function expandedHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, expandEnv(value)]),
  );
}

function expandEnv(value: string): string {
  return value.replace(/\$([A-Z_][A-Z0-9_]*)/g, (_, name: string) => process.env[name] ?? "");
}
