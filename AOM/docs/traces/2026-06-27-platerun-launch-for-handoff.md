# PlateRun Launch-For-Handoff Runtime Trace

Date: 2026-06-27

## Goal

Validate the curved-runtime mode:

1. AOM launches PlateRun with an explicit debugging endpoint.
2. AOM attaches through CDP and collects runtime structure.
3. AOM detaches without closing PlateRun.
4. AOM reattaches later through the same CDP endpoint.
5. AOM detaches again and leaves the app available to the user.

This differs from `launch_owned`: AOM starts the app, but it does not retain close ownership after
handoff.

## Implementation Path

Protocol lifecycle:

```text
launch_for_handoff
```

Electron Analyzer behavior:

```text
detached spawn PlateRun --remote-debugging-port=<port>
wait for CDP page discovery
wait for runtime snapshot nodes
attach via CDP
close only detaches CDP client
```

The app remains a normal GUI surface while AOM is attached or detached.

## Run

Manual integration command:

```text
cd AOM
node tests/integration/launch-for-handoff.mjs
```

Observed output before the runtime-ready wait fix:

```json
{
  "processId": 14865,
  "cdpUrl": "http://127.0.0.1:64604",
  "firstNodes": 0,
  "secondNodes": 22,
  "retainedAfterDetach": true,
  "cleanupRequested": false
}
```

The first snapshot was collected too early because CDP page discovery completed before the renderer
surface was ready. The analyzer now waits for a non-empty runtime snapshot before returning a
`launch_for_handoff` session.

After detach, the same endpoint remained reachable:

```text
http://127.0.0.1:64604/json/list
```

The endpoint reported a PlateRun page target:

```text
title: PlateRun
type: page
url: file:///Users/edwinh/Desktop/AOM/targetAPP/release/mac-arm64/PlateRun.app/Contents/Resources/app.asar/dist/renderer/index.html
```

The endpoint was held by PlateRun:

```text
PlateRun 14865 ... TCP 127.0.0.1:64604 (LISTEN)
```

A later reattach through the same CDP endpoint succeeded:

```json
{
  "nodes": 142
}
```

The WebSocket CDP client now implements `close()`, so AOM-side detach releases the local Node event
loop instead of hanging after reattach.

## Conclusion

`launch_for_handoff` provides the current curved-runtime path:

- AOM can launch a debuggable app without modifying targetAPP source.
- AOM can intervene through CDP.
- AOM can detach and leave the app running.
- AOM can reattach later through the same endpoint while it remains available.

This does not replace a future native AOM runtime or OS-level fallback adapter. It gives the current
PoC a practical way to create a runtime-capable app session while preserving user handoff.
