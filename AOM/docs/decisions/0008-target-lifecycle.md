# ADR 0008: Target Lifecycle And User-Controlled Apps

## Status

Accepted.

## Context

AOM is meant to work with applications the user is actually using. Restarting or closing a target
application just because AOM wants to analyze it breaks that contract: the user may lose state,
Agent actions may interrupt a human workflow, and handoff steps that require user input become
impossible.

Some analysis still benefits from offline access to packaged artifacts. That should not require
touching the live process. When live attachment is unavailable, AOM should prefer analyzing a copy
of the program artifact.

## Decision

Add `TargetConnection.lifecycle` with three modes:

- `attach_existing`: AOM attaches to an already running target through a declared endpoint such as
  CDP. Closing the AOM session must only detach from the debugging transport. It must not close,
  restart, or relaunch the target app.
- `launch_owned`: AOM starts the target process and owns that process lifecycle. Closing the session
  may close the process AOM launched.
- `copy_for_static_analysis`: AOM analyzes a copied/offline artifact and does not create a runtime
  probe.

For already running applications, runtime analyzers must not silently fall back to launching from
`executablePath`. If `attach_existing` is requested without a usable endpoint, initialization fails
with an explicit error.

Even when AOM launches a target, the target remains a real app surface. The user must be able to
operate it while AOM observes and acts. Agent workflows must be able to pause for user-controlled
steps instead of monopolizing the application.

## Current Implementation

The Electron Analyzer supports:

- Playwright `launch_owned` sessions, where `close()` closes the launched Electron app.
- CDP `attach_existing` sessions, where `close()` only closes the CDP client.
- `copy_for_static_analysis`, which copies the artifact to a temporary analysis directory, points
  the static adapter at that copy, and skips runtime probe creation.

`AnalyzerSession` prefers `target.connection.cdpUrl` over `executablePath`. This ensures an attach
request cannot accidentally become an owned launch.

When an `attach_existing` request also provides an artifact locator, `AnalyzerSession` uses the same
copy-before-static-analysis path. Static inspection can therefore read packaged files without
mutating or locking the live program bundle. Temporary copies are removed when the analyzer session
closes.

## Consequences

- Live analysis and action can run while the app remains open.
- Static analysis that might need files should use artifact copies instead of disturbing the live
  target.
- Future Gateway and Agent Server work must preserve lifecycle semantics in audit logs and user
  confirmations.
- Attach mode still requires the target to expose an allowed debugging endpoint. If a production app
  does not expose one, AOM may need a user-approved relaunch into a debug-enabled copy or a platform
  specific attach mechanism.
