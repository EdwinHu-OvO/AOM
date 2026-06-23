import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createProtocolMessage } from "../dist/envelope.js";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const workspaceDir = fileURLToPath(new URL("../../..", import.meta.url));

function fixture(name) {
  return JSON.parse(readFileSync(`${workspaceDir}/tests/fixtures/${name}`, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const rawEvent = fixture("raw-event.json");
const gatewayRequest = fixture("gateway-request.json");

assert(rawEvent.type === "surface_click", "raw event fixture should preserve surface_click");
assert(
  gatewayRequest.params.capabilityId === "capability:search_product",
  "gateway request fixture should preserve capabilityId",
);

const message = createProtocolMessage("message:fixture-001", "request", {
  payloadType: "gateway_request",
  payload: gatewayRequest,
});
const decoded = JSON.parse(JSON.stringify(message));

assert(decoded.payload.payloadType === "gateway_request", "envelope should round-trip payloadType");
assert(
  decoded.payload.payload.method === "aom.invoke",
  "envelope should round-trip gateway request method",
);

const snapshotMessage = createProtocolMessage("message:snapshot-001", "snapshot", {
  payloadType: "raw_runtime_snapshot",
  payload: {
    snapshotId: "snapshot:001",
    targetId: "target:platerun-electron",
    platform: "electron",
    timestamp: 1,
    nodes: [],
    evidenceIds: [],
  },
});

assert(
  snapshotMessage.payload.payloadType === "raw_runtime_snapshot",
  "runtime snapshot payload should use Phase 0 naming",
);

void packageDir;
