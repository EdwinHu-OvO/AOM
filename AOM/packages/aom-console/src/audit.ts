import { existsSync, readFileSync } from "node:fs";
import { defaultAuditPath, type AuditRecord } from "@aom/agent-mcp";

export interface AuditOptions {
  file?: string;
  limit?: number;
  json?: boolean;
}

export function loadAuditRecords(file = defaultAuditPath()): AuditRecord[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as AuditRecord);
}

export function renderAudit(options: AuditOptions = {}): string {
  const file = options.file ?? defaultAuditPath();
  const records = loadAuditRecords(file);
  const selected = typeof options.limit === "number"
    ? records.slice(Math.max(0, records.length - options.limit))
    : records;
  if (options.json) {
    return JSON.stringify({ file, recordCount: records.length, records: selected }, null, 2);
  }
  return [
    "AOM Console Audit",
    `file: ${file}`,
    `records: ${records.length}`,
    "",
    ...selected.map(renderRecord),
  ].join("\n");
}

function renderRecord(record: AuditRecord): string {
  const status = record.ok ? "ok" : "failed";
  const session = record.sessionId ? ` session=${record.sessionId}` : "";
  return [
    `[${record.timestamp}] ${status} ${record.toolName}${session} ${record.durationMs}ms`,
    `  args: ${inline(record.arguments)}`,
    `  result: ${inline(record.summary)}`,
    ...(record.error ? [`  error: ${record.error}`] : []),
  ].join("\n");
}

function inline(value: unknown): string {
  return JSON.stringify(value);
}
