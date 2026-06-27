import { writeFileSync } from "node:fs";
import path from "node:path";
import { AnalyzerSession } from "../../packages/aom-electron-probe/dist/index.js";

const destination = process.argv[2];
if (!destination) {
  throw new Error("usage: node capture-cart-analysis-bundle.mjs <output.json>");
}

const targetId = "target:platerun-cart-analysis";
const artifactLocator = "../targetAPP/release/mac-arm64/PlateRun.app";
const executablePath = `${artifactLocator}/Contents/MacOS/PlateRun`;
const session = new AnalyzerSession();

try {
  const ready = await request("initialize", {
    target: { targetId, platform: "electron", appName: "PlateRun" },
    artifactLocator,
    executablePath,
    adapterId: "adapter:electron-artifact",
  });
  const staticReply = await request("collect_static");
  const login = await request("collect_runtime");
  await act(login.data.value, "text", "set_text", { value: "13800001111" });
  await act(login.data.value, "password", "set_text", { value: "demo123" });
  await act(login.data.value, "button", "click", {}, "Sign in");
  await delay(800);
  await request("drain_events");

  const beforeReply = await request("collect_runtime");
  const add = required(
    beforeReply.data.value.nodes.find((node) => node.label === "Add Pan-fried Gyoza"),
  );
  const actionReply = await session.handle({
    commandType: "execute_action",
    data: rawAction("add-gyoza", "click", add.rawId, {}),
  });
  assertReply(actionReply, "action_result");
  if (!actionReply.data.value.ok) throw new Error("add-to-cart action failed");
  await delay(200);

  const eventsReply = await request("drain_events");
  const afterReply = await request("collect_runtime");
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
    before: beforeReply.data.value,
    events: eventsReply.data.value,
    after: afterReply.data.value,
    analyzerEvidence: uniqueEvidence(evidence),
  }, null, 2));
  console.log(path.resolve(destination));
} finally {
  await session.close();
}

async function request(commandType, data) {
  const reply = await session.handle({ commandType, ...(data ? { data } : {}) });
  const expected = {
    initialize: "ready",
    collect_static: "static_snapshot",
    collect_runtime: "runtime_snapshot",
    drain_events: "events",
  }[commandType];
  assertReply(reply, expected);
  return reply;
}

async function act(snapshot, inputType, type, params, label) {
  const node = required(snapshot.nodes.find((candidate) =>
    label ? candidate.label === label : candidate.attributes.inputType === inputType
  ));
  const reply = await session.handle({
    commandType: "execute_action",
    data: rawAction(inputType, type, node.rawId, params),
  });
  assertReply(reply, "action_result");
  if (!reply.data.value.ok) throw new Error(`${type} action failed`);
}

function rawAction(id, type, targetRawId, params) {
  return { actionId: `action:cart:${id}`, targetId, type, targetRawId, params };
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

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
