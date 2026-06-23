# targetAPP Guidelines

## Purpose

`targetAPP/` is a standalone consumer-facing demo application. Treat it as a normal cross-platform product app first. It should not contain AOM-specific shortcuts, hidden automation aids, or special object markers.

## Architecture

Keep the Electron app layered:

- `src/main/`: Electron lifecycle, desktop window creation, preload bridge, and process-level wiring.
- `src/server/`: mock backend API, mock data, API types, and in-memory server state.
- `src/renderer/`: React frontend, product UI, client API calls, and presentation styles.
- `assets/`: static app assets owned by the demo.

The renderer should communicate with the backend through HTTP API calls. Do not import server data directly into renderer components.

## Product Requirements

The demo should feel like a general ToC food delivery app. Preserve support for:

- account/password login
- restaurant categories and restaurant switching
- distinct products per restaurant
- immediate delivery and scheduled delivery
- multiple saved delivery addresses and active address selection
- checkout against the mock backend

## Style

Use TypeScript and React for renderer code. Keep files focused and preferably under 150 lines, with 200 lines as the hard upper bound. Split large UI, API, data, and style concerns into smaller files.

Avoid app copy that explains the demo or references internal architecture. The UI should present itself as a real app, not as a test fixture.
