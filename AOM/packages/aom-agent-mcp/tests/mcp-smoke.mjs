import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runAnalysis } from "../dist/analysis/bridge.js";

const auditFile = path.join(mkdtempSync(path.join(tmpdir(), "aom-audit-")), "audit.jsonl");
const child = spawn(
  process.execPath,
  ["dist/bin/aom-mcp-server.js"],
  {
    cwd: new URL("..", import.meta.url),
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, AOM_AUDIT_LOG: auditFile },
  },
);
const replies = createInterface({ input: child.stdout, crlfDelay: Infinity })[Symbol.asyncIterator]();

try {
  const initialized = await request(1, "initialize", {});
  assert.equal(initialized.result.serverInfo.name, "aom-mcp-server");

  const listed = await request(2, "tools/list", {});
  const toolNames = listed.result.tools.map((tool) => tool.name);
  assert.ok(toolNames.includes("aom.launch_for_handoff"));
  assert.ok(toolNames.includes("aom.context_pack"));
  assert.ok(toolNames.includes("aom.analysis_graph"));
  assert.ok(toolNames.includes("aom.detach"));
  assert.ok(toolNames.includes("aom.invoke_capability"));
  assert.ok(toolNames.includes("aom.invoke_view"));

  const status = await request(3, "tools/call", {
    name: "aom.session_status",
    arguments: {},
  });
  assert.equal(status.result.content[0].type, "text");
  assert.match(status.result.content[0].text, /"sessions"/);
  const auditRecord = JSON.parse(readFileSync(auditFile, "utf8").trim());
  assert.equal(auditRecord.toolName, "aom.session_status");
  assert.equal(auditRecord.ok, true);

  const analysis = await runAnalysis(fixtureInput());
  const screen = analysis.contextPack.currentScreen;
  assert.ok(screen.productGroups.some((item) => item.name === "Tonkotsu Ramen"));
  assert.equal(analysis.contextPack.cart.itemCount, 0);
  assert.ok(analysis.contextPack.dataFlows.length > 0);
  assert.ok(analysis.capabilities.some((item) => item.capability.name === "add_to_cart"));
} finally {
  child.stdin.end();
  child.kill();
}

function fixtureInput() {
  return JSON.parse(readFileSync(
    new URL("../../../docs/traces/2026-06-25-phase2-iteration3/raw-bundle.json", import.meta.url),
    "utf8",
  ));
}

async function request(id, method, params) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  const reply = await replies.next();
  if (reply.done) throw new Error("mcp server exited before reply");
  return JSON.parse(reply.value);
}
