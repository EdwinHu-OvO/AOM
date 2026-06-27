# PlateRun Launch-Owned Runtime Trace

Date: 2026-06-27 10:27:28 CST

## Goal

Validate the `launch_owned` lifecycle: AOM starts PlateRun, performs dynamic runtime analysis and
object-addressed actions, then closes the process it owns.

This is the counterpart to the attach-existing handoff trace. The expected behavior is different:

- `attach_existing` must not close or restart a user-started app.
- `launch_owned` may close the app AOM launched when the analyzer session ends.

## Target

Packaged PlateRun executable:

```text
../targetAPP/release/mac-arm64/PlateRun.app/Contents/MacOS/PlateRun
```

No PlateRun process was running before this experiment.

## Command

```text
cd AOM
node tests/integration/electron-runtime.mjs
```

The integration script uses `launchElectronAnalyzer()` to start PlateRun through Playwright
Electron, collect a runtime snapshot, execute object-addressed actions, drain events, collect a
second runtime snapshot, and then call `session.close()`.

## Result

```json
{
  "beforeNodes": 22,
  "afterNodes": 142,
  "actionTypes": [
    "wait_for",
    "set_text",
    "set_text",
    "scroll",
    "back",
    "click"
  ],
  "missingTargetRejected": true,
  "eventCount": 11
}
```

Observed behavior:

- AOM launched PlateRun successfully.
- The first runtime snapshot contained 22 nodes.
- AOM executed wait, text input, scroll, back, and click actions through observed object IDs.
- A deliberately missing DOM target was rejected instead of being reported as success.
- The login action changed runtime state; the second snapshot contained 142 nodes.
- The probe collected 11 runtime events.
- After `session.close()`, no PlateRun process remained.

## Conclusion

`launch_owned` currently provides the high-fidelity Electron dynamic path:

- runtime snapshot
- object-addressed action execution
- event collection
- post-action state observation
- owned process cleanup

This does not solve the default attach-existing gap for user-started apps without CDP. It does
prove the lifecycle split is working: AOM can fully operate a process it owns, while attach-existing
remains conservative for user-owned processes.
