# PlateRun Dynamic Analysis Trace

## Goal

Run the current AOM Electron dynamic path against the packaged macOS target and verify:

- runtime object discovery
- object-addressed actions
- DOM and network events
- state change after a real workflow
- sensitive-data handling in Evidence

The target was `targetAPP/release/mac-arm64/PlateRun.app`. No AOM-specific selector, hidden control, or instrumentation was added to the app.

## Analyzer Path

```text
Playwright Electron
  -> renderer CDP session
  -> ElectronRuntimeProbe
  -> RawRuntimeSnapshot / RawActionResult / RawEvent
```

Tool descriptor:

```text
name: playwright
version: 1.61.0
capabilities:
  electron_launch
  dom_actions
  cdp_session
```

## Initial Snapshot

The first `RawRuntimeSnapshot` contained 22 visible runtime nodes.

The login controls were selected from protocol facts:

- phone input: `role=input`, `inputType=text`
- password input: `role=input`, `inputType=password`
- submit control: `role=button`, label `Sign in`

The workflow did not use source-code selectors. Each action used the `rawId` returned by the runtime snapshot.

## Actions

Three `RawAction` messages were executed:

```text
set_text phone: ok
set_text password: ok
click Sign in: ok
```

Each result returned an action Evidence ID.

## Events

The probe collected 11 events:

```text
network_request: 3
network_response: 3
surface_text_input: 2
surface_click: 1
state_change: 2
```

Observed network flow:

```text
POST /api/login -> 200
GET /api/addresses -> 200
GET /api/orders -> 200
```

## Resulting State

The post-action snapshot contained 142 runtime nodes, up from 22.

Observed labels included:

- `Mina Chen`
- `Browse`
- `Addresses`
- `Orders`
- `Restaurants`
- restaurant category labels

This proves the current dynamic path can observe a state transition instead of only reporting action dispatch success.

## Evidence Redaction Finding

The first run exposed a defect: raw CDP request parameters included the login body and authorization token in network Evidence.

The runtime adapter now emits a bounded structured summary:

- preserves request ID, URL, method, resource type and response status
- preserves non-sensitive headers
- replaces authorization, cookie and API-key headers with `[redacted]`
- omits request bodies and reports only `hasBody` and `bodyBytes`

The repeated real workflow verified:

```text
credentials absent: true
Bearer token absent: true
postData absent: true
actions and state transition still successful: true
```

## Current Capability Level

This test demonstrates a working Electron dynamic collector and action executor for renderer-visible Web surfaces.

It does not yet provide:

- stable AOM identity across snapshots
- static/dynamic graph fusion
- semantic capability mining
- Gateway authorization
- native dialog or non-Chromium accessibility coverage
- automatic verification policy beyond comparing raw snapshots and events
