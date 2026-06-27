import type { ToolDefinition } from "./types.js";

export const tools: ToolDefinition[] = [
  {
    name: "aom.launch_for_handoff",
    description: "Launch a debuggable app, attach AOM, and allow later detach without closing it.",
    inputSchema: objectSchema({
      sessionId: stringSchema("Stable AOM session id. Defaults to platerun."),
      appPath: stringSchema("Optional .app directory path. AOM resolves Contents/MacOS automatically."),
      executablePath: stringSchema("Optional packaged app executable path."),
      timeoutMs: numberSchema("Launch and runtime readiness timeout in milliseconds."),
    }),
  },
  {
    name: "aom.attach_existing",
    description: "Attach to an existing CDP endpoint without owning or closing the target app.",
    inputSchema: objectSchema({
      sessionId: stringSchema("Stable AOM session id."),
      cdpUrl: stringSchema("CDP http/ws endpoint."),
      appPath: stringSchema("Optional .app directory path for read-only static analysis."),
      artifactLocator: stringSchema("Optional app artifact path for read-only static analysis."),
    }, ["cdpUrl"]),
  },
  {
    name: "aom.snapshot",
    description: "Collect the current raw runtime snapshot for an active AOM session.",
    inputSchema: sessionSchema(),
  },
  {
    name: "aom.context_pack",
    description: "Return Rust AnalysisService context pack, capabilities, data flows, and graph summary.",
    inputSchema: sessionSchema(),
  },
  {
    name: "aom.analysis_graph",
    description: "Return the full current AOM graph from Rust AnalysisService.",
    inputSchema: sessionSchema(),
  },
  {
    name: "aom.capabilities",
    description: "List currently discovered MVP executable capabilities and risk metadata.",
    inputSchema: sessionSchema(),
  },
  {
    name: "aom.invoke_capability",
    description: "Invoke an AOM executable capability using its graph-backed action plan.",
    inputSchema: objectSchema({
      sessionId: stringSchema("Active AOM session id."),
      capabilityId: stringSchema("Capability id, such as search_product or add_to_cart."),
      inputs: {
        type: "object",
        description:
          "Capability inputs declared by the AOM capability action plan. Examples: search_product uses { query }; add_to_cart can use { product }.",
        additionalProperties: true,
      },
    }, ["sessionId", "capabilityId"]),
  },
  {
    name: "aom.invoke_view",
    description: "Invoke a specific AOM current-screen view by viewId or label.",
    inputSchema: objectSchema({
      sessionId: stringSchema("Active AOM session id."),
      viewId: stringSchema("AOM view id from contextPack.currentScreen.views."),
      label: stringSchema("Exact view label when viewId is not known."),
      action: stringSchema("Action type, usually click or set_text."),
      value: stringSchema("Text value for set_text."),
    }, ["sessionId"]),
  },
  {
    name: "aom.detach",
    description: "Detach AOM from a session. Handoff-launched apps keep running.",
    inputSchema: sessionSchema(),
  },
  {
    name: "aom.session_status",
    description: "List active AOM interaction sessions.",
    inputSchema: objectSchema({}),
  },
];

function sessionSchema(): ToolDefinition["inputSchema"] {
  return objectSchema({ sessionId: stringSchema("Active AOM session id.") }, ["sessionId"]);
}

function objectSchema(
  properties: Record<string, unknown>,
  required?: string[],
): ToolDefinition["inputSchema"] {
  return { type: "object", properties, ...(required ? { required } : {}) };
}

function stringSchema(description: string): Record<string, string> {
  return { type: "string", description };
}

function numberSchema(description: string): Record<string, string> {
  return { type: "number", description };
}
