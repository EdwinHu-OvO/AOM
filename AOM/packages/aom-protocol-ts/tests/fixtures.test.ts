import artifactInspectionFixture from "../../../tests/fixtures/artifact-inspection.json" with { type: "json" };
import analyzerCommandFixture from "../../../tests/fixtures/analyzer-command.json" with { type: "json" };
import gatewayRequestFixture from "../../../tests/fixtures/gateway-request.json" with { type: "json" };
import rawEventFixture from "../../../tests/fixtures/raw-event.json" with { type: "json" };
import rawStaticSnapshotFixture from "../../../tests/fixtures/raw-static-snapshot.json" with { type: "json" };
import { createProtocolMessage } from "../src/envelope.js";
import type {
  AnalyzerCommand,
  ArtifactInspection,
  GatewayRequest,
  RawEvent,
  RawStaticSnapshot,
} from "../src/index.js";

const rawEvent = rawEventFixture as unknown as RawEvent;
const gatewayRequest = gatewayRequestFixture as unknown as GatewayRequest;
const staticSnapshot = rawStaticSnapshotFixture as unknown as RawStaticSnapshot;
const artifactInspection = artifactInspectionFixture as unknown as ArtifactInspection;
const analyzerCommand = analyzerCommandFixture as unknown as AnalyzerCommand;

if (rawEvent.type !== "surface_click") {
  throw new Error("raw event fixture should preserve the surface_click enum value");
}

if (gatewayRequest.params.capabilityId !== "capability:search_product") {
  throw new Error("gateway request fixture should preserve capabilityId");
}

if (staticSnapshot.nodes[0]?.kind !== "component") {
  throw new Error("static snapshot fixture should preserve component graph nodes");
}

if (artifactInspection.runtimeCandidates[0]?.runtime !== "electron") {
  throw new Error("artifact inspection fixture should preserve runtime candidates");
}

if (
  analyzerCommand.commandType !== "initialize"
  || analyzerCommand.data.adapterId !== "adapter:electron-artifact"
) {
  throw new Error("analyzer command fixture should preserve adapter routing");
}

const message = createProtocolMessage("message:fixture-001", "request", {
  payloadType: "gateway_request",
  payload: gatewayRequest,
});

if (message.payload.payloadType !== "gateway_request") {
  throw new Error("protocol envelope should preserve payloadType");
}
