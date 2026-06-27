import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { assert } from "./helpers.mjs";

const fixture = mkdtempSync(path.join(os.tmpdir(), "aom-stdio-web-"));
const copyFixture = mkdtempSync(path.join(os.tmpdir(), "aom-stdio-copy-"));
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

  mkdirSync(path.join(copyFixture, "dist"), { recursive: true });
  writeFileSync(path.join(copyFixture, "index.html"), '<script src="./dist/app.js"></script>');
  writeFileSync(path.join(copyFixture, "dist/app.js"), 'fetch("/api/copied");');
  const copiedReady = await request({
    commandType: "initialize",
    data: {
      target: {
        targetId: "target:static-copy",
        platform: "web",
        connection: { lifecycle: "copy_for_static_analysis" },
      },
      artifactLocator: copyFixture,
      adapterId: "adapter:web-artifact",
    },
  });
  assert(copiedReady.replyType === "ready", "copy lifecycle should initialize");
  rmSync(copyFixture, { recursive: true, force: true });
  const copiedSnapshot = await request({ commandType: "collect_static" });
  assert(copiedSnapshot.replyType === "static_snapshot", "should analyze copied artifact");
  assert(
    copiedSnapshot.data.value.nodes.some((node) => node.label === "/api/copied"),
    "static analysis should use copied artifact after original is removed",
  );

  const attachWithoutEndpoint = await request({
    commandType: "initialize",
    data: {
      target: {
        targetId: "target:attached",
        platform: "electron",
        connection: { lifecycle: "attach_existing" },
      },
      executablePath: "/tmp/should-not-launch",
    },
  });
  assert(
    attachWithoutEndpoint.replyType === "error",
    "attach_existing must not fall back to launching the executable",
  );
  assert(
    attachWithoutEndpoint.data.message.includes("attach_existing_requires_cdp_url"),
    "attach_existing should require an explicit CDP endpoint",
  );

  const handoffWithoutExecutable = await request({
    commandType: "initialize",
    data: {
      target: {
        targetId: "target:handoff",
        platform: "electron",
        connection: { lifecycle: "launch_for_handoff" },
      },
    },
  });
  assert(
    handoffWithoutExecutable.replyType === "error",
    "launch_for_handoff should require an executable",
  );
  assert(
    handoffWithoutExecutable.data.message.includes("launch_for_handoff_requires_executable_path"),
    "launch_for_handoff should report missing executable explicitly",
  );

  const ack = await request({ commandType: "shutdown" });
  assert(ack.replyType === "ack", "stdio analyzer should shut down cleanly");
} finally {
  child.stdin.end();
  child.kill();
  rmSync(fixture, { recursive: true, force: true });
  rmSync(copyFixture, { recursive: true, force: true });
}

async function request(command) {
  child.stdin.write(`${JSON.stringify(command)}\n`);
  const reply = await replies.next();
  if (reply.done) throw new Error("analyzer exited before reply");
  return JSON.parse(reply.value);
}
