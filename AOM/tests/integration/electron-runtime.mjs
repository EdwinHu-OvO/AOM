import { launchElectronAnalyzer } from "../../packages/aom-electron-probe/dist/index.js";

const executablePath = process.env.AOM_ELECTRON_TEST_APP
  ?? "../targetAPP/release/mac-arm64/PlateRun.app/Contents/MacOS/PlateRun";
const targetId = "target:platerun-integration";
const session = await launchElectronAnalyzer({
  targetId,
  executablePath,
  timeoutMs: 20_000,
});

try {
  const before = await session.probe.collectRuntimeSnapshot();
  const phone = findNode(before.nodes, (node) => node.attributes.inputType === "text");
  const password = findNode(before.nodes, (node) => node.attributes.inputType === "password");
  const submit = findNode(before.nodes, (node) => node.role === "button");
  const actions = [
    action("wait", "wait_for", phone.rawId, { timeoutMs: 1_000 }),
    action("phone", "set_text", phone.rawId, { value: "13800001111" }),
    action("password", "set_text", password.rawId, { value: "demo123" }),
    action("scroll", "scroll", undefined, { deltaY: 100 }),
    action("back", "back", undefined, {}),
    action("login", "click", submit.rawId, {}),
  ];
  const results = [];
  for (const candidate of actions) {
    results.push(await session.probe.executeAction(candidate));
  }
  const missing = await session.probe.executeAction(
    action("missing", "click", "dom:#missing", {}),
  );
  await new Promise((resolve) => setTimeout(resolve, 800));
  const events = await session.probe.drainEvents();
  const after = await session.probe.collectRuntimeSnapshot();
  const serialized = JSON.stringify(events);

  assert(results.every((result) => result.ok), "all five action types should succeed");
  assert(!missing.ok, "missing DOM targets should fail");
  assert(after.nodes.length > before.nodes.length, "login should change runtime state");
  for (const type of [
    "surface_text_input",
    "surface_click",
    "state_change",
    "network_request",
    "network_response",
  ]) {
    assert(events.some((event) => event.type === type), `should collect ${type}`);
  }
  assert(!serialized.includes("demo123"), "events must not contain passwords");
  assert(!serialized.includes("Bearer "), "events must not contain bearer tokens");
  assert(!serialized.includes("postData"), "events must not contain request bodies");

  console.log(JSON.stringify({
    beforeNodes: before.nodes.length,
    afterNodes: after.nodes.length,
    actionTypes: actions.map((candidate) => candidate.type),
    missingTargetRejected: !missing.ok,
    eventCount: events.length,
  }, null, 2));
} finally {
  await session.close();
}

function action(id, type, targetRawId, params) {
  return {
    actionId: `action:integration:${id}`,
    targetId,
    type,
    ...(targetRawId === undefined ? {} : { targetRawId }),
    params,
  };
}

function findNode(nodes, predicate) {
  const node = nodes.find(predicate);
  if (!node) throw new Error("required runtime node not found");
  return node;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
