import gatewayRequestFixture from "../../../tests/fixtures/gateway-request.json" with { type: "json" };
import rawEventFixture from "../../../tests/fixtures/raw-event.json" with { type: "json" };
import { createProtocolMessage } from "../src/envelope.js";
import type { GatewayRequest, RawEvent } from "../src/index.js";

const rawEvent = rawEventFixture as unknown as RawEvent;
const gatewayRequest = gatewayRequestFixture as unknown as GatewayRequest;

if (rawEvent.type !== "surface_click") {
  throw new Error("raw event fixture should preserve the surface_click enum value");
}

if (gatewayRequest.params.capabilityId !== "capability:search_product") {
  throw new Error("gateway request fixture should preserve capabilityId");
}

const message = createProtocolMessage("message:fixture-001", "request", {
  payloadType: "gateway_request",
  payload: gatewayRequest,
});

if (message.payload.payloadType !== "gateway_request") {
  throw new Error("protocol envelope should preserve payloadType");
}
