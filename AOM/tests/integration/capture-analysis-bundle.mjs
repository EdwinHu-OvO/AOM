import { writeFileSync } from "node:fs";
import path from "node:path";
import { AnalyzerSession } from "../../packages/aom-electron-probe/dist/index.js";

const destination = process.argv[2];
if (!destination) {
  throw new Error("usage: node capture-analysis-bundle.mjs <output.json>");
}
const targetId = "target:platerun-analysis";
const artifactLocator = "../targetAPP/release/mac-arm64/PlateRun.app";
const executablePath = `${artifactLocator}/Contents/MacOS/PlateRun`;
const session = new AnalyzerSession();

try {
  const ready = await session.handle({
    commandType: "initialize",
    data: {
      target: { targetId, platform: "electron", appName: "PlateRun" },
      artifactLocator,
      executablePath,
      adapterId: "adapter:electron-artifact",
    },
  });
  assertReply(ready, "ready");
  const staticReply = await session.handle({ commandType: "collect_static" });
  const beforeReply = await session.handle({ commandType: "collect_runtime" });
  assertReply(staticReply, "static_snapshot");
  assertReply(beforeReply, "runtime_snapshot");
  const before = beforeReply.data.value;
  const phone = required(before.nodes.find((node) => node.attributes.inputType === "text"));
  const password = required(before.nodes.find((node) => node.attributes.inputType === "password"));
  const submit = required(before.nodes.find((node) => node.role === "button"));
  for (const action of [
    rawAction("phone", "set_text", phone.rawId, { value: "13800001111" }),
    rawAction("password", "set_text", password.rawId, { value: "demo123" }),
    rawAction("login", "click", submit.rawId, {}),
  ]) {
    const reply = await session.handle({ commandType: "execute_action", data: action });
    assertReply(reply, "action_result");
    if (!reply.data.value.ok) throw new Error(`action failed: ${action.actionId}`);
  }
  await new Promise((resolve) => setTimeout(resolve, 800));
  const eventsReply = await session.handle({ commandType: "drain_events" });
  const afterReply = await session.handle({ commandType: "collect_runtime" });
  assertReply(eventsReply, "events");
  assertReply(afterReply, "runtime_snapshot");
  const evidence = [
    ...ready.data.evidence,
    ...staticReply.data.evidence,
    ...beforeReply.data.evidence,
    ...eventsReply.data.evidence,
    ...afterReply.data.evidence,
  ];
  writeFileSync(destination, JSON.stringify({
    targetId,
    staticSnapshot: staticReply.data.value,
    before,
    events: eventsReply.data.value,
    after: afterReply.data.value,
    analyzerEvidence: uniqueEvidence(evidence),
  }, null, 2));
  console.log(path.resolve(destination));
} finally {
  await session.close();
}

function rawAction(id, type, targetRawId, params) {
  return { actionId: `action:analysis:${id}`, targetId, type, targetRawId, params };
}

function assertReply(reply, type) {
  if (reply.replyType !== type) {
    throw new Error(`expected ${type}, received ${reply.replyType}`);
  }
}

function required(value) {
  if (!value) throw new Error("required runtime node missing");
  return value;
}

function uniqueEvidence(evidence) {
  return [...new Map(evidence.map((item) => [item.evidenceId, item])).values()];
}
