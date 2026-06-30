import { spawnSync } from "node:child_process";
import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const configFile = path.join(mkdtempSync(path.join(tmpdir(), "aom-cli-")), "aom.config.json");
const cli = new URL("../dist/bin/AOM-cli.js", import.meta.url).pathname;

writeFileSync(configFile, JSON.stringify({
  capabilityRecognizer: {
    enabled: false,
    provider: "openai_compatible",
    baseUrl: "http://127.0.0.1:8000/v1",
    model: "qwen",
    apiKey: "secret-test-key",
  },
}, null, 2));

assert.match(run(["-help"]), /feature flags and logging/);
assert.match(run(["-feature", "-help"]), /Feature configuration commands/);
assert.match(run(["-log", "-help"]), /Logging configuration commands/);
assert.match(run(["-config", "-help"]), /Config inspection commands/);
assert.match(run(["-init", "-help"]), /Setup guide commands/);
assert.match(run(["-file", configFile, "-init"]), /AOM setup guide/);
const initCheckBefore = JSON.parse(run(["-file", configFile, "-format", "json", "-init", "-check"]));
assert.equal(initCheckBefore.ok, false);
assert.ok(initCheckBefore.missing.includes("features"));

const list = JSON.parse(run(["-file", configFile, "-format", "json", "-feature", "-list"]));
assert.ok(list.some((item) => item.name === "llm_capability_recognizer"));

run(["-file", configFile, "-feature", "-enable", "dynamic_call_chain"]);
run(["-file", configFile, "-feature", "-set", "dynamic_call_chain.max_steps", "5"]);
run(["-file", configFile, "-feature", "-set", "llm_capability_recognizer.model", "qwen3.6:35b"]);
run(["-file", configFile, "-feature", "-enable", "llm_capability_recognizer"]);
run(["-file", configFile, "-log", "-level", "debug"]);
run(["-file", configFile, "-log", "-set", "orchestration", "trace"]);
run(["-file", configFile, "-log", "-audit-level", "verbose"]);

const saved = JSON.parse(readFileSync(configFile, "utf8"));
assert.equal(saved.features.dynamic_call_chain.enabled, true);
assert.equal(saved.features.dynamic_call_chain.max_steps, 5);
assert.equal(saved.features.llm_capability_recognizer.enabled, true);
assert.equal(saved.features.llm_capability_recognizer.model, "qwen3.6:35b");
assert.equal(saved.capabilityRecognizer.enabled, true);
assert.equal(saved.capabilityRecognizer.model, "qwen3.6:35b");
assert.equal(saved.capabilityRecognizer.apiKey, "secret-test-key");
assert.equal(saved.logging.level, "debug");
assert.equal(saved.logging.modules.orchestration, "trace");
assert.equal(saved.logging.auditLevel, "verbose");

run(["-file", configFile, "-init", "-write-default"]);
const initialized = JSON.parse(readFileSync(configFile, "utf8"));
assert.equal(initialized.capabilityRecognizer.apiKey, "secret-test-key");
assert.equal(initialized.features.dynamic_call_chain.max_steps, 5);
assert.equal(initialized.features.context_delta.enabled, true);
assert.equal(initialized.features.llm_capability_recognizer.enabled, true);
assert.equal(initialized.logging.level, "debug");
assert.equal(initialized.logging.modules.orchestration, "trace");
assert.equal(initialized.logging.modules.mcp, "info");
const initCheckAfter = JSON.parse(run(["-file", configFile, "-format", "json", "-init", "-check"]));
assert.equal(initCheckAfter.ok, true);

const shown = run(["-file", configFile, "-config", "-show"]);
assert.match(shown, /<redacted>/);
assert.doesNotMatch(shown, /secret-test-key/);
assert.match(run(["-file", configFile, "-config", "-validate"]), /"ok": true/);

const invalid = spawnSync(process.execPath, [cli, "-file", configFile, "-log", "-level", "chatty"], {
  encoding: "utf8",
});
assert.notEqual(invalid.status, 0);
assert.match(invalid.stderr, /invalid_log_level/);

function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${result.stderr}\n${result.stdout}`);
  return result.stdout.trim();
}
