import type { AnalysisOutput, ExecutableCapability } from "../analysis/types.js";

export interface ContextRouteInput {
  task?: string;
  limit?: number;
}

export interface ContextWindowInput extends ContextRouteInput {
  windowId?: string;
  offset?: number;
}

export interface RoutedContext {
  pageSummary: Record<string, unknown>;
  routedBy: {
    strategy: "task_window_router";
    task?: string;
    selectedWindowIds: string[];
  };
  windows: ContextWindow[];
  handles: ContextHandle[];
}

export interface ContextWindow {
  windowId: string;
  kind: "ui" | "data_flow" | "event" | "capability";
  title: string;
  scope: {
    offset: number;
    limit: number;
    total: number;
    taskRelevant: boolean;
    foldedBy: Array<"structure" | "task" | "repetition">;
  };
  beforeSummary: WindowSummary;
  window: {
    items: WindowItem[];
    repeatedGroups: RepeatedGroup[];
  };
  afterSummary: WindowSummary;
  handles: {
    previous?: string;
    next?: string;
    fullGraph?: string;
  };
}

interface WindowSummary {
  range: { start: number; end: number; total: number };
  summary: string;
  itemCount: number;
  sourceIds: string[];
  confidence: number;
  summarizer: "deterministic";
}

interface ContextHandle {
  handle: string;
  windowId: string;
  purpose: string;
  offset: number;
  limit: number;
}

interface WindowItem {
  id: string;
  kind: string;
  role?: string;
  label: string;
  actions?: string[];
  rawReference?: string;
  operationKind?: string;
  expectedEffect?: string;
  capabilityNames?: string[];
  relation?: string;
  fromLabel?: string;
  toLabel?: string;
  eventType?: string;
  targetViewLabel?: string;
  path?: string;
  confidence?: number;
}

interface RepeatedGroup {
  key: string;
  count: number;
  sampleLabels: string[];
  itemIds: string[];
  handle: string;
}

interface WindowSource {
  id: string;
  kind: ContextWindow["kind"];
  title: string;
  foldedBy: ContextWindow["scope"]["foldedBy"];
  items: WindowItem[];
}

export function routeContext(analysis: AnalysisOutput, input: ContextRouteInput = {}): RoutedContext {
  const sources = windowSources(analysis);
  const limit = clampLimit(input.limit);
  const selected = routeWindowIds(sources, input.task);
  const windows = selected.map((id) =>
    buildWindow(requiredSource(sources, id), { ...input, windowId: id, limit, offset: 0 })
  );
  return {
    pageSummary: pageSummary(analysis, sources),
    routedBy: {
      strategy: "task_window_router",
      ...(input.task ? { task: input.task } : {}),
      selectedWindowIds: selected,
    },
    windows,
    handles: windows.flatMap((window) => windowHandles(window, limit)),
  };
}

export function contextWindow(
  analysis: AnalysisOutput,
  input: ContextWindowInput = {},
): ContextWindow {
  const sources = windowSources(analysis);
  const windowId = input.windowId ?? routeWindowIds(sources, input.task)[0] ?? "ui:primary_actions";
  return buildWindow(requiredSource(sources, windowId), input);
}

function windowSources(analysis: AnalysisOutput): WindowSource[] {
  const context = contextPack(analysis);
  const views = context.currentScreen?.views ?? [];
  const facts = context.currentScreen?.stateFacts ?? [];
  const dataFlows = context.dataFlows ?? [];
  const events = context.transition?.observedEvents ?? [];
  const capabilities = analysis.capabilities ?? [];
  const capabilityIndex = capabilityNamesByTarget(capabilities);
  const uiItems = views.map((view) => viewItem(view, capabilityIndex));
  const factItems = facts.map((fact) => factItem(fact));
  return [
    {
      id: "ui:primary_actions",
      kind: "ui",
      title: "Primary Actions",
      foldedBy: ["structure", "task"],
      items: rankPrimaryActions(uiItems),
    },
    {
      id: "ui:header",
      kind: "ui",
      title: "Header And Navigation",
      foldedBy: ["structure", "task"],
      items: uiItems.filter(isHeaderLike),
    },
    {
      id: "ui:main",
      kind: "ui",
      title: "Main Surface",
      foldedBy: ["structure", "repetition"],
      items: [...uiItems.filter((item) => !isHeaderLike(item)), ...factItems],
    },
    {
      id: "dataflow:all",
      kind: "data_flow",
      title: "Data Flow",
      foldedBy: ["task"],
      items: dataFlows.map(dataFlowItem),
    },
    {
      id: "event:recent",
      kind: "event",
      title: "Recent Events",
      foldedBy: ["task"],
      items: events.map(eventItem),
    },
    {
      id: "capability:all",
      kind: "capability",
      title: "Capabilities",
      foldedBy: ["task"],
      items: capabilities.map(capabilityItem),
    },
  ];
}

function buildWindow(source: WindowSource, input: ContextWindowInput): ContextWindow {
  const limit = clampLimit(input.limit);
  const offset = clampOffset(input.offset, source.items.length, limit);
  const items = source.items.slice(offset, offset + limit);
  const before = source.items.slice(0, offset);
  const after = source.items.slice(offset + limit);
  return {
    windowId: source.id,
    kind: source.kind,
    title: source.title,
    scope: {
      offset,
      limit,
      total: source.items.length,
      taskRelevant: isTaskRelevant(source, input.task),
      foldedBy: source.foldedBy,
    },
    beforeSummary: summarizeSlice(before, { start: 0, total: source.items.length }),
    window: {
      items,
      repeatedGroups: repeatedGroups(source.id, items, offset, limit),
    },
    afterSummary: summarizeSlice(after, {
      start: Math.min(source.items.length, offset + limit),
      total: source.items.length,
    }),
    handles: {
      ...(offset > 0 ? { previous: handle(source.id, Math.max(0, offset - limit), limit) } : {}),
      ...(offset + limit < source.items.length ? { next: handle(source.id, offset + limit, limit) } : {}),
      fullGraph: `graph:subgraph:${source.id}`,
    },
  };
}

function pageSummary(analysis: AnalysisOutput, sources: WindowSource[]): Record<string, unknown> {
  const context = contextPack(analysis);
  const capabilities = analysis.capabilities.map((item) => item.capability.name);
  return {
    targetId: analysis.graph.targetId,
    screen: context.currentScreen?.label ?? "Application screen",
    availableCapabilities: capabilities,
    uiWindows: sources.filter((source) => source.kind === "ui").map((source) => ({
      windowId: source.id,
      title: source.title,
      itemCount: source.items.length,
    })),
    dataFlowWindows: sources.filter((source) => source.kind === "data_flow").map((source) => ({
      windowId: source.id,
      title: source.title,
      itemCount: source.items.length,
    })),
    graphPreserved: true,
    dataFlowPreserved: true,
    summary: [
      `${sources.find((source) => source.id === "ui:primary_actions")?.items.length ?? 0} primary actions`,
      `${sources.find((source) => source.id === "ui:main")?.items.length ?? 0} main surface items`,
      `${sources.find((source) => source.id === "dataflow:all")?.items.length ?? 0} data-flow edges`,
    ].join("; "),
  };
}

function routeWindowIds(sources: WindowSource[], task = ""): string[] {
  const lowered = task.toLowerCase();
  const selected = new Set<string>(["ui:primary_actions", "dataflow:all"]);
  if (/(search|query|find|搜索|查找)/i.test(lowered)) selected.add("ui:header");
  if (/(video|feed|list|result|视频|列表|结果|主页)/i.test(lowered)) selected.add("ui:main");
  if (/(event|request|network|verify|事件|请求|验证)/i.test(lowered)) selected.add("event:recent");
  if (/(capability|action|能力|操作)/i.test(lowered)) selected.add("capability:all");
  if (!task.trim()) selected.add("ui:header");
  return [...selected].filter((id) => sources.some((source) => source.id === id));
}

function viewItem(view: ContextView, capabilityIndex: Map<string, string[]>): WindowItem {
  const capabilityNames = capabilityIndex.get(view.id);
  return {
    id: view.id,
    kind: "view",
    role: view.role,
    label: view.label,
    actions: view.actions,
    ...(view.rawReference ? { rawReference: view.rawReference } : {}),
    ...(view.operationKind ? { operationKind: view.operationKind } : {}),
    ...(view.expectedEffect ? { expectedEffect: view.expectedEffect } : {}),
    ...(capabilityNames ? { capabilityNames } : {}),
  };
}

function factItem(fact: ContextFact): WindowItem {
  return {
    id: fact.id,
    kind: "state_fact",
    label: fact.label,
    confidence: fact.confidence,
  };
}

function dataFlowItem(flow: ContextDataFlow): WindowItem {
  return {
    id: `${flow.fromId}->${flow.toId}`,
    kind: "data_flow",
    label: `${flow.fromLabel} -> ${flow.toLabel}`,
    relation: flow.relation,
    fromLabel: flow.fromLabel,
    toLabel: flow.toLabel,
    confidence: flow.confidence,
  };
}

function eventItem(event: ContextEvent): WindowItem {
  return {
    id: `event:${event.sequence}`,
    kind: "event",
    label: event.label,
    eventType: event.eventType,
    ...(event.targetViewLabel ? { targetViewLabel: event.targetViewLabel } : {}),
    ...(event.path ? { path: event.path } : {}),
  };
}

function capabilityItem(capability: ExecutableCapability): WindowItem {
  const firstStep = capability.actionPlan[0];
  return {
    id: capability.capability.id,
    kind: "capability",
    label: capability.capability.name,
    actions: capability.actionPlan.map((step) => step.kind),
    operationKind: capability.availability,
    expectedEffect: capability.capability.expectedEffects.join("; "),
    capabilityNames: [capability.capability.name],
    confidence: capability.capability.confidence,
    ...(firstStep?.targetLabel ? { targetViewLabel: firstStep.targetLabel } : {}),
  };
}

function rankPrimaryActions(items: WindowItem[]): WindowItem[] {
  return [...items].sort((left, right) => actionScore(right) - actionScore(left));
}

function actionScore(item: WindowItem): number {
  let score = 0;
  if (item.capabilityNames?.length) score += 5;
  if (item.actions?.includes("set_text")) score += 4;
  if (item.actions?.includes("click")) score += 2;
  if (/(search|query|搜索)/i.test(`${item.label} ${item.expectedEffect ?? ""}`)) score += 3;
  if (item.role === "button") score += 1;
  return score;
}

function isHeaderLike(item: WindowItem): boolean {
  const raw = item.rawReference ?? "";
  const label = item.label.toLowerCase();
  return raw.includes("header")
    || /首页|精选|动态|我的|search|搜索|nav|profile/.test(label)
    || item.actions?.includes("set_text") === true;
}

function repeatedGroups(
  windowId: string,
  items: WindowItem[],
  offset: number,
  limit: number,
): RepeatedGroup[] {
  const groups = new Map<string, WindowItem[]>();
  for (const item of items) {
    const key = `${item.kind}:${item.role ?? ""}:${item.actions?.join(",") ?? ""}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.length >= 3)
    .map(([key, group]) => ({
      key,
      count: group.length,
      sampleLabels: group.slice(0, 3).map((item) => item.label),
      itemIds: group.map((item) => item.id),
      handle: handle(windowId, offset + limit, limit),
    }));
}

function summarizeSlice(
  items: WindowItem[],
  range: { start: number; total: number },
): WindowSummary {
  const end = items.length === 0 ? range.start : range.start + items.length - 1;
  const roles = countBy(items, (item) => item.role ?? item.kind);
  const actions = countBy(items.flatMap((item) => item.actions ?? []), (item) => item);
  const labels = items
    .map((item) => item.label)
    .filter(Boolean)
    .slice(0, 6);
  return {
    range: { start: range.start, end, total: range.total },
    summary: items.length === 0
      ? "No items in this range."
      : `${items.length} items before/after this window; roles=${formatCounts(roles)}; actions=${formatCounts(actions)}; sample=${labels.join(" | ")}`,
    itemCount: items.length,
    sourceIds: items.slice(0, 20).map((item) => item.id),
    confidence: 0.8,
    summarizer: "deterministic",
  };
}

function windowHandles(window: ContextWindow, limit: number): ContextHandle[] {
  return [
    ...(window.handles.previous
      ? [{
          handle: window.handles.previous,
          windowId: window.windowId,
          purpose: "Open previous slice with summarized border.",
          offset: Math.max(0, window.scope.offset - limit),
          limit,
        }]
      : []),
    ...(window.handles.next
      ? [{
          handle: window.handles.next,
          windowId: window.windowId,
          purpose: "Open next slice with summarized border.",
          offset: window.scope.offset + limit,
          limit,
        }]
      : []),
  ];
}

function handle(windowId: string, offset: number, limit: number): string {
  return `window:${windowId}:${offset}:${limit}`;
}

function capabilityNamesByTarget(capabilities: ExecutableCapability[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const capability of capabilities) {
    for (const step of capability.actionPlan) {
      if (!step.targetNodeId) continue;
      const names = result.get(step.targetNodeId) ?? [];
      names.push(capability.capability.name);
      result.set(step.targetNodeId, names);
    }
  }
  return result;
}

function isTaskRelevant(source: WindowSource, task = ""): boolean {
  return routeWindowIds([source], task).includes(source.id);
}

function requiredSource(sources: WindowSource[], id: string): WindowSource {
  const source = sources.find((candidate) => candidate.id === id);
  if (!source) throw new Error(`unknown_context_window: ${id}`);
  return source;
}

function clampLimit(value: unknown): number {
  return Math.min(50, Math.max(1, typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 12));
}

function clampOffset(value: unknown, total: number, limit: number): number {
  const requested = Math.max(0, typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 0);
  if (total === 0 || requested < total) return requested;
  return Math.max(0, total - limit);
}

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const result = new Map<string, number>();
  for (const item of items) {
    const value = key(item) || "unknown";
    result.set(value, (result.get(value) ?? 0) + 1);
  }
  return result;
}

function formatCounts(counts: Map<string, number>): string {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([key, value]) => `${key}:${value}`)
    .join(",") || "none";
}

function contextPack(analysis: AnalysisOutput): ContextPack {
  return analysis.contextPack as ContextPack;
}

interface ContextPack {
  currentScreen?: {
    label?: string;
    views?: ContextView[];
    stateFacts?: ContextFact[];
  };
  transition?: { observedEvents?: ContextEvent[] };
  dataFlows?: ContextDataFlow[];
}

interface ContextView {
  id: string;
  role: string;
  label: string;
  actions: string[];
  rawReference?: string;
  operationKind?: string;
  expectedEffect?: string;
}

interface ContextFact {
  id: string;
  kind: string;
  label: string;
  confidence: number;
}

interface ContextDataFlow {
  fromId: string;
  fromLabel: string;
  toId: string;
  toLabel: string;
  relation: string;
  confidence: number;
}

interface ContextEvent {
  sequence: number;
  eventType: string;
  label: string;
  targetViewLabel?: string;
  path?: string;
}
