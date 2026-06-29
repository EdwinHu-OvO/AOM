import type { RawActionResult } from "@aom/protocol";
import type { AOMEdge, AOMNode } from "@aom/protocol";
import type { AnalysisOutput } from "../analysis/types.js";

export interface ContextDeltaCause {
  actionId?: string;
  actionType?: string;
  toolName?: "aom.invoke_capability" | "aom.invoke_view";
  capabilityName?: string;
  targetNodeId?: string;
  targetLabel?: string;
  inputSummary?: Record<string, unknown>;
}

export interface ContextDelta {
  baselineGraphId: string;
  previousGraphId: string;
  currentGraphId: string;
  cause: ContextDeltaCause;
  ui: {
    added: NodeRef[];
    removed: NodeRef[];
    updated: NodeUpdate[];
    stable: {
      screenChanged: boolean;
      primaryRegionChanged: boolean;
    };
  };
  data: {
    addedObjects: NodeRef[];
    updatedObjects: NodeUpdate[];
  };
  network: {
    requests: EndpointObservation[];
    responses: EndpointObservation[];
  };
  dataFlow: {
    addedEdges: EdgeRef[];
    removedEdges: EdgeRef[];
  };
  capabilities: {
    added: string[];
    removed: string[];
    changed: CapabilityDelta[];
    recommendedNext: string[];
    recommendedTargets: RecommendedTarget[];
  };
  outcome: {
    status: "no_change" | "changed" | "verified" | "ambiguous" | "failed";
    summary: string;
    evidenceIds: string[];
    nextStepHint?: string;
  };
}

interface NodeRef {
  id: string;
  type: string;
  label?: string;
  role?: string;
  actions?: string[];
  confidence?: number;
}

interface NodeUpdate {
  id: string;
  type: string;
  label?: string;
  changedFields: string[];
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

interface EdgeRef {
  id: string;
  from: string;
  to: string;
  type: string;
  confidence?: number;
}

interface EndpointObservation {
  id: string;
  method?: string;
  path?: string;
  label: string;
  kind: "request" | "response" | "endpoint";
  evidenceIds: string[];
}

interface CapabilityDelta {
  name: string;
  before?: string;
  after?: string;
}

interface RecommendedTarget {
  toolName: "aom.invoke_view" | "aom.invoke_capability";
  action: "click" | "set_text";
  viewId?: string;
  capabilityId?: string;
  label?: string;
  reason: string;
}

export function buildContextDelta(input: {
  before: AnalysisOutput;
  after: AnalysisOutput;
  cause?: ContextDeltaCause;
  actionResult?: RawActionResult;
  eventCount?: number;
}): ContextDelta {
  const cause = normalizeCause(input.cause, input.actionResult);
  const beforeNodes = byId(input.before.graph.nodes);
  const afterNodes = byId(input.after.graph.nodes);
  const beforeEdges = byId(input.before.graph.edges);
  const afterEdges = byId(input.after.graph.edges);
  const addedNodes = input.after.graph.nodes.filter((node) => !beforeNodes.has(node.id));
  const removedNodes = input.before.graph.nodes.filter((node) => !afterNodes.has(node.id));
  const updatedNodes = input.after.graph.nodes
    .flatMap((node) => nodeUpdate(beforeNodes.get(node.id), node))
    .slice(0, 30);
  const addedEdges = input.after.graph.edges.filter((edge) => !beforeEdges.has(edge.id));
  const removedEdges = input.before.graph.edges.filter((edge) => !afterEdges.has(edge.id));
  const uiAdded = addedNodes.filter((node) => node.type === "view").map(nodeRef).slice(0, 30);
  const uiRemoved = removedNodes.filter((node) => node.type === "view").map(nodeRef).slice(0, 30);
  const dataAdded = addedNodes.filter(isDataNode).map(nodeRef).slice(0, 30);
  const capabilityChanges = compareCapabilities(input.before, input.after);
  const network = endpointObservations(addedNodes, addedEdges, input.after.graph.nodes);
  const dataFlowAdded = addedEdges.filter(isDataFlowEdge).map(edgeRef).slice(0, 40);
  const dataFlowRemoved = removedEdges.filter(isDataFlowEdge).map(edgeRef).slice(0, 40);
  const recommendations = recommendedNextActions(cause, uiAdded, network.requests, input.after);
  const outcome = outcomeFor({
    ...(input.actionResult?.ok !== undefined ? { actionOk: input.actionResult.ok } : {}),
    eventCount: input.eventCount ?? 0,
    cause,
    uiAdded,
    uiRemoved,
    dataAdded,
    network,
    dataFlowAdded,
    capabilityChanges,
    recommendedNext: recommendations.names,
    evidenceIds: evidenceIds([...addedNodes, ...addedEdges]),
  });
  return {
    baselineGraphId: input.before.graph.graphId,
    previousGraphId: input.before.graph.graphId,
    currentGraphId: input.after.graph.graphId,
    cause,
    ui: {
      added: uiAdded,
      removed: uiRemoved,
      updated: updatedNodes.filter((item) => item.type === "view"),
      stable: {
        screenChanged: input.before.graph.currentScreenId !== input.after.graph.currentScreenId,
        primaryRegionChanged: uiAdded.length > 0 || uiRemoved.length > 0,
      },
    },
    data: {
      addedObjects: dataAdded,
      updatedObjects: updatedNodes.filter((item) => isDataType(item.type)),
    },
    network,
    dataFlow: {
      addedEdges: dataFlowAdded,
      removedEdges: dataFlowRemoved,
    },
    capabilities: {
      added: capabilityChanges.added,
      removed: capabilityChanges.removed,
      changed: capabilityChanges.changed,
      recommendedNext: recommendations.names,
      recommendedTargets: recommendations.targets,
    },
    outcome,
  };
}

function normalizeCause(
  cause: ContextDeltaCause | undefined,
  actionResult: RawActionResult | undefined,
): ContextDeltaCause {
  return {
    ...(actionResult?.actionId ? { actionId: actionResult.actionId } : {}),
    ...cause,
  };
}

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function nodeUpdate(before: AOMNode | undefined, after: AOMNode): NodeUpdate[] {
  if (!before) return [];
  const changedFields: string[] = [];
  const beforeSummary = nodeSummary(before);
  const afterSummary = nodeSummary(after);
  for (const key of Object.keys(afterSummary)) {
    if (JSON.stringify(beforeSummary[key]) !== JSON.stringify(afterSummary[key])) {
      changedFields.push(key);
    }
  }
  return changedFields.length > 0
    ? [{
        id: after.id,
        type: after.type,
        ...(after.label ? { label: after.label } : {}),
        changedFields,
        before: beforeSummary,
        after: afterSummary,
      }]
    : [];
}

function nodeSummary(node: AOMNode): Record<string, unknown> {
  return {
    label: node.label,
    confidence: node.confidence,
    role: stringFeature(node, "role"),
    actions: arrayFeature(node, "actions"),
    operationKind: stringFeature(node, "operationKind"),
  };
}

function nodeRef(node: AOMNode): NodeRef {
  const role = stringFeature(node, "role");
  const actions = arrayFeature(node, "actions");
  return {
    id: node.id,
    type: node.type,
    ...(node.label ? { label: node.label } : {}),
    ...(role ? { role } : {}),
    ...(actions ? { actions } : {}),
    confidence: node.confidence,
  };
}

function edgeRef(edge: AOMEdge): EdgeRef {
  return {
    id: edge.id,
    from: edge.from,
    to: edge.to,
    type: edge.type,
    confidence: edge.confidence,
  };
}

function endpointObservations(
  addedNodes: AOMNode[],
  addedEdges: AOMEdge[],
  allNodes: AOMNode[],
): ContextDelta["network"] {
  const nodeIndex = byId(allNodes);
  const endpoints = new Map<string, AOMNode>();
  for (const node of addedNodes) {
    if (node.type === "api_endpoint" || node.type === "message") endpoints.set(node.id, node);
  }
  for (const edge of addedEdges) {
    if (edge.type !== "requests") continue;
    const to = nodeIndex.get(edge.to);
    const from = nodeIndex.get(edge.from);
    if (to && (to.type === "api_endpoint" || to.type === "message")) endpoints.set(to.id, to);
    if (from && (from.type === "api_endpoint" || from.type === "message")) endpoints.set(from.id, from);
  }
  const observations = [...endpoints.values()].map(endpointObservation);
  return {
    requests: observations.filter((item) => item.kind !== "response").slice(0, 30),
    responses: observations.filter((item) => item.kind === "response").slice(0, 30),
  };
}

function endpointObservation(node: AOMNode): EndpointObservation {
  const label = node.label ?? node.id;
  const method = stringFeature(node, "method");
  const path = stringFeature(node, "path") ?? pathFromLabel(label);
  return {
    id: node.id,
    label,
    kind: /^2\d\d response|response/i.test(label) ? "response" : node.type === "api_endpoint" ? "endpoint" : "request",
    ...(method ? { method } : {}),
    ...(path ? { path } : {}),
    evidenceIds: node.evidenceIds,
  };
}

function pathFromLabel(label: string): string | undefined {
  const match = label.match(/(?:GET|POST|PUT|PATCH|DELETE|response from)\s+([^\s]+)/i);
  return match?.[1];
}

function compareCapabilities(before: AnalysisOutput, after: AnalysisOutput): {
  added: string[];
  removed: string[];
  changed: CapabilityDelta[];
} {
  const beforeCaps = capabilityMap(before);
  const afterCaps = capabilityMap(after);
  const added = [...afterCaps.keys()].filter((name) => !beforeCaps.has(name));
  const removed = [...beforeCaps.keys()].filter((name) => !afterCaps.has(name));
  const changed = [...afterCaps.entries()].flatMap(([name, afterAvailability]) => {
    const beforeAvailability = beforeCaps.get(name);
    return beforeAvailability && beforeAvailability !== afterAvailability
      ? [{ name, before: beforeAvailability, after: afterAvailability }]
      : [];
  });
  return { added, removed, changed };
}

function capabilityMap(analysis: AnalysisOutput): Map<string, string> {
  return new Map(analysis.capabilities.map((item) => [item.capability.name, item.availability]));
}

function outcomeFor(input: {
  actionOk?: boolean;
  eventCount: number;
  cause: ContextDeltaCause;
  uiAdded: NodeRef[];
  uiRemoved: NodeRef[];
  dataAdded: NodeRef[];
  network: ContextDelta["network"];
  dataFlowAdded: EdgeRef[];
  capabilityChanges: { added: string[]; removed: string[]; changed: CapabilityDelta[] };
  recommendedNext: string[];
  evidenceIds: string[];
}): ContextDelta["outcome"] {
  if (input.actionOk === false) {
    return {
      status: "failed",
      summary: "Action dispatch failed; do not infer application state changes from this attempt.",
      evidenceIds: input.evidenceIds,
    };
  }
  const searchIntent = isSearchIntent(input.cause);
  const searchNetwork = [...input.network.requests, ...input.network.responses].some(isSearchEndpoint);
  const hasVisibleResults = input.uiAdded.filter((item) => item.type === "view" && item.actions?.includes("click")).length >= 3;
  if (searchIntent && (searchNetwork || hasVisibleResults)) {
    return {
      status: "verified",
      summary: "Search appears complete: AOM observed search-related network/data-flow activity and/or a refreshed clickable result list.",
      evidenceIds: input.evidenceIds,
      nextStepHint: "Open a relevant result from ui:main or ui:primary_actions instead of repeating the search.",
    };
  }
  const changedCount = input.uiAdded.length
    + input.uiRemoved.length
    + input.dataAdded.length
    + input.network.requests.length
    + input.network.responses.length
    + input.dataFlowAdded.length
    + input.capabilityChanges.added.length
    + input.capabilityChanges.removed.length
    + input.capabilityChanges.changed.length;
  if (changedCount === 0 && input.eventCount === 0) {
    return {
      status: "no_change",
      summary: "No runtime events or graph changes were observed after the action.",
      evidenceIds: input.evidenceIds,
    };
  }
  if (changedCount === 0) {
    return {
      status: "ambiguous",
      summary: `${input.eventCount} runtime event(s) were observed, but no stable AOM graph change was detected.`,
      evidenceIds: input.evidenceIds,
    };
  }
  return {
    status: "changed",
    summary: [
      `${input.uiAdded.length} UI node(s) added`,
      `${input.network.requests.length + input.network.responses.length} network observation(s)`,
      `${input.dataFlowAdded.length} data-flow edge(s) added`,
    ].join("; "),
    evidenceIds: input.evidenceIds,
    ...(input.recommendedNext.length > 0 ? { nextStepHint: `Consider ${input.recommendedNext.join(", ")} next.` } : {}),
  };
}

function recommendedNextActions(
  cause: ContextDeltaCause,
  uiAdded: NodeRef[],
  requests: EndpointObservation[],
  analysis: AnalysisOutput,
): { names: string[]; targets: RecommendedTarget[] } {
  const result = new Set<string>();
  const targets: RecommendedTarget[] = [];
  if (isSearchIntent(cause) && (uiAdded.some((item) => item.actions?.includes("click")) || requests.some(isSearchEndpoint))) {
    result.add("open_content_result");
    targets.push(...uiAdded.filter(isLikelyContentResult).map(recommendedViewTarget));
    targets.push(...contentResultTargets(analysis));
  }
  for (const capability of analysis.capabilities) {
    const name = capability.capability.name;
    if (/open_.*(result|video|content)|view_.*(result|video|content)/i.test(name)) result.add(name);
  }
  return { names: [...result].slice(0, 6), targets: targets.slice(0, 8) };
}

function contentResultTargets(analysis: AnalysisOutput): RecommendedTarget[] {
  return analysis.graph.nodes
    .filter((node) => node.type === "view")
    .map(nodeRef)
    .filter((node) => node.actions?.includes("click") && isLikelyContentResult(node))
    .slice(0, 8)
    .map(recommendedViewTarget);
}

function recommendedViewTarget(node: NodeRef): RecommendedTarget {
  return {
    toolName: "aom.invoke_view",
    action: "click",
    viewId: node.id,
    ...(node.label ? { label: node.label } : {}),
    reason: "Clickable content/result candidate observed after search.",
  };
}

function isLikelyContentResult(node: NodeRef): boolean {
  const label = (node.label ?? "").trim();
  if (label.length < 4) return false;
  if (/^(首页|精选|动态|我的|热门|推荐|直播|追番|link|submit input|刷新页面)$/i.test(label)) return false;
  if (/text input|搜索|search/i.test(label)) return false;
  return true;
}

function isSearchIntent(cause: ContextDeltaCause): boolean {
  const text = [
    cause.capabilityName,
    cause.actionType,
    cause.targetLabel,
    ...Object.values(cause.inputSummary ?? {}).map(String),
  ].join(" ");
  return /search|query|find|搜索|查找|科技资讯/i.test(text);
}

function isSearchEndpoint(item: EndpointObservation): boolean {
  return /search|suggest|query/i.test(`${item.path ?? ""} ${item.label}`);
}

function isDataFlowEdge(edge: AOMEdge): boolean {
  return edge.type === "flows_to" || edge.type === "renders_as" || edge.type === "updates" || edge.type === "has_effect";
}

function isDataNode(node: AOMNode): boolean {
  return isDataType(node.type);
}

function isDataType(type: string): boolean {
  return type === "data_object" || type === "data_field" || type === "storage_key" || type === "message";
}

function stringFeature(node: AOMNode, key: string): string | undefined {
  const value = node.features[key];
  return typeof value === "string" ? value : undefined;
}

function arrayFeature(node: AOMNode, key: string): string[] | undefined {
  const value = node.features[key];
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;
}

function evidenceIds(items: Array<AOMNode | AOMEdge>): string[] {
  return [...new Set(items.flatMap((item) => item.evidenceIds))].slice(0, 30);
}
