# Electron Toolchain Integration Trace

## Scope

Replace production low-level Electron analysis paths with local maintained tools while preserving AOM protocol output and internal fallbacks.

## Installed Locally

The following packages were added only to `@aom/electron-probe`:

```text
@electron/asar 4.2.0
@electron/fuses 2.1.2
playwright 1.61.0
chrome-remote-interface 0.34.0
@types/chrome-remote-interface 0.34.0
```

No global npm installation or Playwright browser download was performed.

## Static Regression

PlateRun packaged app:

```text
artifacts: 15
nodes: 103
edges: 122
API endpoints: 7
process roles: main, renderer, backend
ASAR entries: 3,970
```

harderTestApp:

```text
artifacts: 317
nodes: 668
edges: 1,175
API endpoints: 0
process roles: bootstrap, main, renderer
ASAR entries: 7,928
```

These match the pre-toolchain graph sizes. Both snapshots identify `@electron/asar` as the archive backend.

`@electron/fuses` successfully read both real Electron binaries. PlateRun exposes all nine current V1 fuse values. The older harderTestApp wire reports unsupported newer fuse positions as `unknown`.

## Dynamic Regression

The first PlateRun launch produced an empty renderer because Vite emitted absolute `/assets/...` URLs for a `file://` page. This was a normal packaging defect, not an AOM instrumentation issue.

After setting Vite `base: "./"` and rebuilding:

```text
runtime backend: playwright
runtime nodes: 22
roles: input, button
set_text action: success
renderer: app.asar/dist/renderer/index.html
```

This is the first real packaged Electron launch, renderer CDP connection, runtime snapshot and protocol action completed by the AOM dynamic path.

## Verification

- `pnpm --filter @aom/electron-probe test`
- Real static analysis of PlateRun and harderTestApp
- Real Playwright launch and runtime collection against PlateRun
- `pnpm dist:mac` after the generic Vite packaging fix
