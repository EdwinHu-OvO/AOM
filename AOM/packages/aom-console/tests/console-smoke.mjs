import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const dir = mkdtempSync(path.join(tmpdir(), "aom-console-"));
const file = path.join(dir, "audit.jsonl");
writeFileSync(file, `${JSON.stringify({
  auditId: "audit:test:1",
  timestamp: "2026-06-27T00:00:00.000Z",
  kind: "mcp_tool_call",
  toolName: "aom.invoke_view",
  sessionId: "demo",
  ok: true,
  durationMs: 12,
  arguments: { label: "Search" },
  summary: { type: "action", eventCount: 1 },
})}\n`);

const text = spawnSync(
  process.execPath,
  ["dist/bin/aom-console.js", "audit", "--file", file],
  { cwd: new URL("..", import.meta.url), encoding: "utf8" },
);

assert.equal(text.status, 0, text.stderr);
assert.match(text.stdout, /AOM Console Audit/);
assert.match(text.stdout, /aom\.invoke_view/);

const json = spawnSync(
  process.execPath,
  ["dist/bin/aom-console.js", "audit", "--file", file, "--json"],
  { cwd: new URL("..", import.meta.url), encoding: "utf8" },
);
const parsed = JSON.parse(json.stdout);
assert.equal(parsed.recordCount, 1);
