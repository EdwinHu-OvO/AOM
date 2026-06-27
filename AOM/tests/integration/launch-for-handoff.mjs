import {
  attachElectronAnalyzer,
  launchElectronForHandoff,
} from "../../packages/aom-electron-probe/dist/index.js";

const executablePath = process.env.AOM_ELECTRON_TEST_APP
  ?? "../targetAPP/release/mac-arm64/PlateRun.app/Contents/MacOS/PlateRun";
const targetId = "target:platerun-handoff";

const launched = await launchElectronForHandoff({
  targetId,
  executablePath,
  timeoutMs: 20_000,
});

const first = await launched.probe.collectRuntimeSnapshot();
const cdpUrl = launched.cdpUrl;
const processId = launched.processId;
assert(cdpUrl, "handoff launch should expose cdpUrl");
assert(processId, "handoff launch should expose processId");

await launched.close();
assert(await canDiscover(cdpUrl), "CDP endpoint should stay reachable after first detach");

const reattached = await attachElectronAnalyzer({ targetId, cdpUrl });
const second = await reattached.probe.collectRuntimeSnapshot();
await reattached.close();
assert(await canDiscover(cdpUrl), "CDP endpoint should stay reachable after second detach");

if (process.env.AOM_HANDOFF_CLEANUP === "1") {
  process.kill(processId);
}

console.log(JSON.stringify({
  processId,
  cdpUrl,
  firstNodes: first.nodes.length,
  secondNodes: second.nodes.length,
  retainedAfterDetach: await canDiscover(cdpUrl),
  cleanupRequested: process.env.AOM_HANDOFF_CLEANUP === "1",
}, null, 2));

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function canDiscover(cdpUrl) {
  try {
    const response = await fetch(`${cdpUrl}/json/list`);
    return response.ok;
  } catch {
    return false;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
