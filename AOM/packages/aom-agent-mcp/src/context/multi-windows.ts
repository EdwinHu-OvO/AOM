import type { AnalysisOutput } from "../analysis/types.js";
import { contextWindow, type ContextWindow } from "./windows.js";

export type CursorDirection = "current" | "next" | "previous" | "reset";

export interface ContextCursorState {
  cursorId: string;
  windowId: string;
  offset: number;
  limit: number;
  graphId?: string;
}

export interface ContextWindowsInput {
  task?: string;
  requests: ContextWindowRequest[];
  avoidCollisions?: boolean;
  defaultLimit?: number;
}

export interface ContextWindowRequest {
  cursorId?: string;
  windowId?: string;
  offset?: number;
  limit?: number;
  direction?: CursorDirection;
}

export interface ContextWindowsResult {
  strategy: "agent_directed_multi_cursor_windows";
  graphId: string;
  task?: string;
  collisionPolicy: {
    avoidCollisions: boolean;
    resolvedCount: number;
    collisions: CursorCollision[];
  };
  cursors: ContextCursorState[];
  windows: Array<ContextWindow & { cursor: WindowCursorMeta }>;
}

export interface CursorCollision {
  cursorId: string;
  windowId: string;
  requestedRange: Range;
  resolvedRange: Range;
  resolution: "shifted" | "clamped" | "accepted_overlap";
}

interface WindowCursorMeta { cursorId: string; direction: CursorDirection; requestedOffset: number; resolvedOffset: number; limit: number; collisionAvoided: boolean }

interface Range { start: number; end: number }

export function contextWindows(analysis: AnalysisOutput, input: ContextWindowsInput, cursorMap: Map<string, ContextCursorState>): ContextWindowsResult {
  if (input.requests.length === 0) throw new Error("context_windows_requests_required");
  const avoidCollisions = input.avoidCollisions !== false;
  const allocations = new Map<string, Range[]>();
  const collisions: CursorCollision[] = [];
  const windows = input.requests.map((request, index) => {
    const planned = planCursor(request, index, cursorMap, input.defaultLimit);
    const probe = contextWindow(analysis, windowInput(planned, input.task));
    const resolved = avoidCollisions
      ? avoidCollision(planned, probe.scope.total, allocations.get(planned.windowId) ?? [])
      : { offset: planned.offset, collision: undefined };
    const window = contextWindow(analysis, windowInput({ ...planned, offset: resolved.offset }, input.task));
    const range = rangeFor(window.scope.offset, window.scope.limit, window.scope.total);
    allocations.set(planned.windowId, [...(allocations.get(planned.windowId) ?? []), range]);
    const cursor = {
      cursorId: planned.cursorId,
      windowId: planned.windowId,
      offset: window.scope.offset,
      limit: window.scope.limit,
      graphId: analysis.graph.graphId,
    };
    cursorMap.set(planned.cursorId, cursor);
    if (resolved.collision) collisions.push(resolved.collision);
    return {
      ...window,
      cursor: {
        cursorId: planned.cursorId,
        direction: planned.direction,
        requestedOffset: planned.offset,
        resolvedOffset: window.scope.offset,
        limit: window.scope.limit,
        collisionAvoided: Boolean(resolved.collision && resolved.collision.resolution !== "accepted_overlap"),
      },
    };
  });
  return {
    strategy: "agent_directed_multi_cursor_windows",
    graphId: analysis.graph.graphId,
    ...(input.task ? { task: input.task } : {}),
    collisionPolicy: {
      avoidCollisions,
      resolvedCount: collisions.filter((item) => item.resolution !== "accepted_overlap").length,
      collisions,
    },
    cursors: [...cursorMap.values()],
    windows,
  };
}

function planCursor(
  request: ContextWindowRequest,
  index: number,
  cursorMap: Map<string, ContextCursorState>,
  defaultLimit: number | undefined,
): Required<ContextWindowRequest> {
  const existing = request.cursorId ? cursorMap.get(request.cursorId) : undefined;
  const windowId = request.windowId ?? existing?.windowId ?? "ui:primary_actions";
  const limit = positiveInt(request.limit ?? existing?.limit ?? defaultLimit ?? 12);
  const direction = request.direction ?? "current";
  const baseOffset = existing?.offset ?? 0;
  const offset = request.offset ?? offsetForDirection(baseOffset, limit, direction);
  return {
    cursorId: request.cursorId ?? `${windowId}:${index + 1}`,
    windowId,
    offset: Math.max(0, offset),
    limit,
    direction,
  };
}

function windowInput(planned: Required<ContextWindowRequest>, task: string | undefined): {
  windowId: string;
  offset: number;
  limit: number;
  task?: string;
} {
  return {
    windowId: planned.windowId,
    offset: planned.offset,
    limit: planned.limit,
    ...(task ? { task } : {}),
  };
}

function avoidCollision(
  planned: Required<ContextWindowRequest>,
  total: number,
  allocated: Range[],
): { offset: number; collision?: CursorCollision } {
  const requested = rangeFor(planned.offset, planned.limit, total);
  if (allocated.every((range) => !overlaps(requested, range))) return { offset: planned.offset };
  let offset = planned.offset;
  for (let attempt = 0; attempt <= allocated.length; attempt += 1) {
    offset = nextOffset(offset, planned.limit, total);
    const candidate = rangeFor(offset, planned.limit, total);
    if (allocated.every((range) => !overlaps(candidate, range))) {
      return { offset, collision: collision(planned, requested, candidate, "shifted") };
    }
  }
  const clamped = Math.max(0, total - planned.limit);
  const clampedRange = rangeFor(clamped, planned.limit, total);
  return {
    offset: clamped,
    collision: collision(planned, requested, clampedRange, overlapsAny(clampedRange, allocated) ? "accepted_overlap" : "clamped"),
  };
}

function offsetForDirection(base: number, limit: number, direction: CursorDirection): number {
  if (direction === "next") return base + limit;
  if (direction === "previous") return Math.max(0, base - limit);
  if (direction === "reset") return 0;
  return base;
}

function nextOffset(offset: number, limit: number, total: number): number {
  if (total <= 0) return 0;
  const next = offset + limit;
  return next < total ? next : Math.max(0, offset - limit);
}

function rangeFor(offset: number, limit: number, total: number): Range {
  return { start: offset, end: Math.min(total, offset + limit) };
}

function overlaps(left: Range, right: Range): boolean {
  return left.start < right.end && right.start < left.end;
}

function overlapsAny(candidate: Range, ranges: Range[]): boolean {
  return ranges.some((range) => overlaps(candidate, range));
}

function collision(
  planned: Required<ContextWindowRequest>,
  requestedRange: Range,
  resolvedRange: Range,
  resolution: CursorCollision["resolution"],
): CursorCollision {
  return { cursorId: planned.cursorId, windowId: planned.windowId, requestedRange, resolvedRange, resolution };
}

function positiveInt(value: number): number {
  return Math.min(50, Math.max(1, Number.isFinite(value) ? Math.floor(value) : 12));
}
