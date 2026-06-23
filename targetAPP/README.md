# PlateRun Electron Demo

PlateRun is a generic cross-platform food delivery demo built with Electron, React, Vite, and an Express mock backend.

## Layers

- `src/main/`: Electron desktop shell and preload bridge.
- `src/server/`: mock backend with login, restaurants, addresses, and orders.
- `src/renderer/`: React consumer app that talks to the backend over HTTP.

## Run

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts the Electron app and its bundled mock API. The bundled API listens on `http://127.0.0.1:4545`.

To run only the mock API:

```bash
pnpm dev:api
```

Demo login:

- Phone: `13800001111`
- Password: `demo123`

## Verify

```bash
pnpm test
pnpm build
```

`pnpm test` runs TypeScript checks for both the renderer and Electron/backend code. `pnpm build` compiles the Electron main/backend code and builds the Vite renderer bundle.
