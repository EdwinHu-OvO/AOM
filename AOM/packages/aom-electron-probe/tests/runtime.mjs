import {
  ElectronRuntimeProbe,
  chromeRemoteInterfaceTool,
  playwrightTool,
} from "../dist/index.js";
import { assert } from "./helpers.mjs";

class FakeCdpClient {
  listeners = new Map();
  failNextEvaluation = false;
  expressions = [];

  async send(method, params = {}) {
    if (method !== "Runtime.evaluate") return {};
    this.expressions.push(String(params.expression));
    if (this.failNextEvaluation) {
      this.failNextEvaluation = false;
      return {
        result: {},
        exceptionDetails: {
          text: "Uncaught",
          exception: { description: "Error: target_not_found" },
        },
      };
    }
    const expression = String(params.expression);
    if (expression.includes("document.querySelectorAll")) {
      return {
        result: {
          value: [{
            rawId: "dom:html > body > button",
            kind: "dom_element",
            role: "button",
            label: "Checkout",
            attributes: { tagName: "button", disabled: false, inputType: null },
            children: [],
          }],
        },
      };
    }
    if (expression.includes("events.splice")) {
      return {
        result: {
          value: [
            {
              type: "surface_click",
              rawId: "dom:html > body > button",
              label: "Checkout",
            },
            {
              type: "surface_text_input",
              rawId: "dom:html > body > input",
            },
            { type: "state_change", mutationCount: 2 },
          ],
        },
      };
    }
    return { result: { value: true } };
  }

  on(method, listener) {
    this.listeners.set(method, listener);
  }

  emit(method, params) {
    this.listeners.get(method)?.(params);
  }
}

const client = new FakeCdpClient();
const probe = new ElectronRuntimeProbe(
  "target:platerun-electron",
  client,
  chromeRemoteInterfaceTool,
);
const runtimeSnapshot = await probe.collectRuntimeSnapshot();
client.emit("Network.requestWillBeSent", {
  requestId: "request:login",
  type: "Fetch",
  request: {
    url: "http://127.0.0.1:4545/api/login",
    method: "POST",
    headers: { Authorization: "Bearer secret", "Content-Type": "application/json" },
    hasPostData: true,
    postData: '{"password":"secret"}',
  },
});
client.emit("Page.frameNavigated", { frame: { url: "file:///next.html" } });
const events = await probe.drainEvents();
const action = await probe.executeAction({
  actionId: "action:click-checkout",
  targetId: "target:platerun-electron",
  type: "click",
  targetRawId: "dom:html > body > button",
  params: {},
});

assert(runtimeSnapshot.nodes[0]?.role === "button", "should collect runtime DOM snapshot");
assert(events.some((event) => event.type === "network_request"), "should collect network event");
assert(events.some((event) => event.type === "surface_click"), "should collect click event");
assert(events.some((event) => event.type === "surface_text_input"), "should collect input event");
assert(events.some((event) => event.type === "navigation"), "should collect navigation event");
assert(events.some((event) => event.type === "state_change"), "should collect state event");
assert(action.ok, "should execute CDP-backed click action");
const requestEvent = events.find((event) => event.type === "network_request");
assert(
  requestEvent?.payload.metadata.headers.Authorization === "[redacted]",
  "should redact authorization headers from network evidence",
);
assert(
  !JSON.stringify(requestEvent).includes("password"),
  "should omit request bodies from network evidence",
);
assert(
  probe.tool?.name === "chrome-remote-interface",
  "should expose the active runtime analyzer tool",
);
assert(
  playwrightTool.capabilities.includes("electron_launch"),
  "should publish Playwright Electron launch capability",
);

client.failNextEvaluation = true;
const failedAction = await probe.executeAction({
  actionId: "action:missing-target",
  targetId: "target:platerun-electron",
  type: "click",
  targetRawId: "dom:#missing",
  params: {},
});
assert(!failedAction.ok, "should report Runtime.evaluate exceptions as action failures");
assert(
  failedAction.message?.includes("target_not_found"),
  "should preserve the runtime exception description",
);

const actionCases = [
  {
    actionId: "action:set-text",
    targetId: "target:platerun-electron",
    type: "set_text",
    targetRawId: "dom:#query",
    params: { value: "noodles" },
    marker: "dispatchEvent",
  },
  {
    actionId: "action:scroll",
    targetId: "target:platerun-electron",
    type: "scroll",
    params: { deltaY: 250 },
    marker: "scrollBy",
  },
  {
    actionId: "action:back",
    targetId: "target:platerun-electron",
    type: "back",
    params: {},
    marker: "history.back",
  },
  {
    actionId: "action:wait",
    targetId: "target:platerun-electron",
    type: "wait_for",
    targetRawId: "dom:#ready",
    params: { timeoutMs: 100 },
    marker: "wait_timeout",
  },
];
for (const { marker, ...candidate } of actionCases) {
  const result = await probe.executeAction(candidate);
  assert(result.ok, `${candidate.type} should succeed`);
  assert(
    client.expressions.at(-1)?.includes(marker),
    `${candidate.type} should map to its CDP expression`,
  );
}
