# Repository Guidelines

## Project Structure & Module Organization

This repository contains AOM, short for Application Object Model: an experimental Agent-facing object layer for non-Web apps. AOM lets Agents query structure, runtime state, events, storage, APIs, and data flow instead of relying on screenshots, OCR, and coordinate clicks.

Use the two top-level modules intentionally:

- `AOM/`: the AOM runtime, static indexer, object schema, event listeners, capability model, and Agent query APIs.
- `targetAPP/`: the generic demo application used as an external target app for product and workflow experiments.

Keep shared documentation in the repository root. Place source, tests, fixtures, and assets inside the owning module, such as `AOM/src/`, `AOM/tests/`, `targetAPP/src/`, and `targetAPP/assets/`.

Use layered guidance documents. The root `AGENTS.md` describes repository-wide boundaries. Module-specific instructions belong in that module, such as `targetAPP/AGENTS.md`, and override root guidance only for files under that subtree.

Keep AOM design and progress documentation under `AOM/docs/`. Organize those documents by layer and module, matching the AOM architecture: protocol, Adapter Host, Analysis Layer, Capability Layer, Safety Gateway, Agent Interaction Layer, Console, target app coordination, and testing. Use `AOM/docs/progress.md` only as a lightweight index; detailed progress belongs in module-specific files under `AOM/docs/progress/`.

`targetAPP/` must remain a generic consumer application. Do not add AOM-only affordances, special selectors, hidden test controls, or instrumentation conveniences to the demo app unless a future task explicitly changes that product requirement.

## Build, Test, and Development Commands

No build system is configured yet. When adding tooling, prefer predictable commands:

- `pnpm install`: install JavaScript or TypeScript dependencies.
- `pnpm dev`: run the active module in development mode.
- `pnpm test`: run unit and integration tests.
- `pnpm build`: create production or distributable artifacts.

Avoid committing generated folders such as `node_modules/`, `dist/`, `build/`, or temporary runtime logs.

## Coding Style & Naming Conventions

Favor typed interfaces for AOM pages, components, APIs, stores, events, capabilities, and verification evidence. Use stable object IDs over visual coordinates. Prefer 2-space indentation for JavaScript, TypeScript, JSON, YAML, and Markdown; use 4 spaces for Python.

Design modules for high cohesion and low coupling. Split responsibilities into reusable components, services, schemas, or adapters. Without a clear reason, keep files under 150 lines; 200 lines is the upper limit and should trigger refactoring.

## Testing Guidelines

Tests should demonstrate the AOM workflow: query objects, understand capabilities, execute actions, listen for side effects, and verify results. Add unit tests for schema and indexer logic, integration tests for listeners, and end-to-end tests against `targetAPP/`. Name tests after behavior, such as `login-flow.test.ts`.

## Commit & Pull Request Guidelines

Use short, imperative commit messages such as `Add runtime event listener`. Pull requests should include a summary, test results, affected module, linked issue, and screenshots or traces for demo-app changes.

## Agent-Specific Instructions

Treat AOM as the source of truth for Agent operation. New features should improve at least one of three qualities: stability through structured object references, explainability through linked runtime evidence, or reusability through named capabilities such as login, search, add-to-cart, checkout, or view-order.

During AOM development, keep implementation and documentation in sync in both directions. When code changes affect architecture, protocol, module boundaries, capabilities, safety policy, or verification behavior, update the relevant design or progress document in `AOM/docs/`. When a design document changes implementation expectations, update or create the matching code, tests, fixtures, or follow-up progress entry. Leave design documents for meaningful AOM work so later agents can understand why the module was shaped that way, not just what files changed.
