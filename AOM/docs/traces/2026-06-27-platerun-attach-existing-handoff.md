# PlateRun Attach-Existing And Handoff Trace

Date: 2026-06-27 10:09:46 CST

## Goal

Validate the `attach_existing` lifecycle against a PlateRun instance that was started by the user
before AOM attached.

The lifecycle invariant being tested:

- AOM must not close, restart, or relaunch a user-started target app.
- If runtime takeover is impossible, AOM must fail explicitly and leave the app under user control.

## Target

User-started app:

```text
/Users/edwinh/Desktop/AOM/targetAPP/release/mac-arm64/PlateRun.app/Contents/MacOS/PlateRun
```

Observed process group:

```text
86228 PlateRun main process
86230 PlateRun gpu helper
86231 PlateRun network utility helper
86232 PlateRun renderer helper
```

The process command lines did not include `--remote-debugging-port` or another CDP endpoint flag.

The only PlateRun-owned listening port observed was:

```text
127.0.0.1:4545
```

That port is the PlateRun mock API, not a Chrome DevTools Protocol endpoint.

Common CDP discovery ports were checked and were closed:

```text
http://127.0.0.1:9222/json/version
http://127.0.0.1:9223/json/version
http://127.0.0.1:9224/json/version
```

## Attempt 1: Attach Without CDP URL

Analyzer request:

```json
{
  "commandType": "initialize",
  "data": {
    "target": {
      "targetId": "target:platerun-prestarted",
      "platform": "electron",
      "appName": "PlateRun",
      "connection": {
        "lifecycle": "attach_existing"
      }
    },
    "artifactLocator": "../targetAPP/release/mac-arm64/PlateRun.app",
    "executablePath": "../targetAPP/release/mac-arm64/PlateRun.app/Contents/MacOS/PlateRun"
  }
}
```

Result:

```text
replyType: error
code: analyzer_operation_failed
message: attach_existing_requires_cdp_url
```

This proves AOM did not fall back to `executablePath` and did not relaunch PlateRun.

## Attempt 2: Treat API Port As CDP

Analyzer request used:

```text
target.connection.cdpUrl = "http://127.0.0.1:4545"
```

Result:

```text
replyType: error
code: analyzer_operation_failed
message: fetch failed
```

This proves the analyzer did not mistake the PlateRun mock API for a runtime debugging transport.

## Handoff Check

After both attempts, the original process IDs were still alive:

```text
86228 PlateRun main process
86230 PlateRun gpu helper
86231 PlateRun network utility helper
86232 PlateRun renderer helper
```

AOM closed only its analyzer session. It did not terminate or restart the user-started app.

## Conclusion

Dynamic takeover did not succeed because the prestarted PlateRun instance did not expose a CDP
endpoint. The lifecycle behavior was correct:

- no silent relaunch
- no process termination
- no accidental attach to the business API port
- explicit failure semantics
- control remained with the user

To test a successful attach-existing takeover, PlateRun must be started with an explicit,
user-approved CDP endpoint, for example `--remote-debugging-port=<port>`. That should be treated as
a user-controlled debug launch, not as AOM silently restarting the app.
