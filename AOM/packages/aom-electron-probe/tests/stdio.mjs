import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { assert } from "./helpers.mjs";

const fixture = mkdtempSync(path.join(os.tmpdir(), "aom-stdio-web-"));
const child = spawn(
  process.execPath,
  ["dist/bin/aom-electron-analyzer.js"],
  { cwd: new URL("..", import.meta.url), stdio: ["pipe", "pipe", "inherit"] },
);
const replies = createInterface({ input: child.stdout, crlfDelay: Infinity })[Symbol.asyncIterator]();

try {
  mkdirSync(path.join(fixture, "dist"), { recursive: true });
  writeFileSync(path.join(fixture, "index.html"), '<script src="./dist/app.js"></script>');
  writeFileSync(path.join(fixture, "dist/app.js"), 'fetch("/api/session");');

  const ready = await request({
    commandType: "initialize",
    data: {
      target: { targetId: "target:stdio-web", platform: "web" },
      artifactLocator: fixture,
      adapterId: "adapter:web-artifact",
    },
  });
  assert(ready.replyType === "ready", "stdio analyzer should initialize");
  assert(ready.data.adapterId === "adapter:web-artifact", "should close generic web routing");

  const snapshot = await request({ commandType: "collect_static" });
  assert(snapshot.replyType === "static_snapshot", "should return a static snapshot reply");
  assert(snapshot.data.value.adapterId === "adapter:web-artifact", "should preserve routed adapter");
  assert(
    snapshot.data.value.nodes.some((node) => node.label === "/api/session"),
    "should analyze generic web artifacts through stdio",
  );
  assert(
    snapshot.data.evidence.some((item) => item.toolName === "@electron/asar"),
    "should transport analyzer tool provenance",
  );

  const ack = await request({ commandType: "shutdown" });
  assert(ack.replyType === "ack", "stdio analyzer should shut down cleanly");
} finally {
  child.stdin.end();
  child.kill();
  rmSync(fixture, { recursive: true, force: true });
}

async function request(command) {
  child.stdin.write(`${JSON.stringify(command)}\n`);
  const reply = await replies.next();
  if (reply.done) throw new Error("analyzer exited before reply");
  return JSON.parse(reply.value);
}
