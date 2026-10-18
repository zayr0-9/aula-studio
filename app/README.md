# F75 Studio — historical scaffold notes

**Read [current project setup](../README.md) and [current handoff](../docs/CURRENT-HANDOFF.md) first.** The offline-only statements below describe the initial scaffold, not the current Windows implementation. Current Studio can read hardware on startup; per-key automation remains gated. Smoke tests use mocked hardware and may show a window to exercise real frame/media-query events.

React19 + TypeScript6 + Tailwind4 + Electron44 + electron-vite6/Vite8, ESLint flat config and Prettier. Exact dependencies and npm lockfile are pinned. TypeScript6 was selected because the current typescript-eslint peer range excludes TypeScript7.

**Hardware communication is disabled by design.** No HID/USB dependency, device opening, raw packet IPC, firmware/reset or official-app integration exists. Lighting controls affect a session-only simulator. Remapping/macros are placeholders; keyboard drawing is illustrative, not the recovered82-key geometry. Prior COL06 metadata is labelled historical evidence, not a live connection indicator.

## Run (PowerShell)

```powershell
$env:PATH='D:\Projects\tools\node-v24.18.0-win-x64;'+$env:PATH
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npm.cmd run dev
```

Renderer hot reload is provided by Vite/React; electron-vite watches main/preload. Server binds127.0.0.1:5173 with strict port. Stop with Ctrl+C. No dev server is deliberately left running after setup.

## Checks

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run format:check
npm.cmd run test:electron
```

The Electron smoke test creates a hidden offline window, verifies renderer loading, the narrow shell-info preload bridge, simulator mode, and absence of renderer Node require. Tests are scaffold checks, not protocol/hardware acceptance tests. `test:electron` needs a graphical Windows session and Electron runtime.

## Installation / download policy

Dependencies were installed locally with `npm install --ignore-scripts --no-audit --no-fund`. Only Electron's inspected install script was then invoked explicitly to download its runtime, verified by bundled publisher checksums, with cache under D:/Projects/tools/electron-cache. No global PATH/system Node changes or keyboard/capture-driver installations were made. npm registry metadata and package integrity establish provenance/integrity, not a complete supply-chain audit.

For reproducible reinstall, use `npm ci --ignore-scripts`; then `node node_modules/electron/install.js` to install the runtime explicitly. Do not set arbitrary Electron mirrors or disable checksum verification.

## Boundaries

- `src/main`: window lifecycle, permission denial, navigation/new-window restrictions, sender-checked read-only shell-info IPC.
- `src/preload`: frozen allowlisted bridge; no ipcRenderer export.
- `src/shared`: small typed contract.
- `src/renderer`: UI/session-only simulation.

Sandbox/context isolation/web security enabled; Node integration disabled. Development CSP permits loopback HMR and inline styles; the production build rewrites connect-src to 'none'. App packaging/signing, OS installer, persistence, real protocol library, device service and hardware testing remain future work. Build produces out/; it is not a distributable installer.

See [investigation status](../docs/PHASE3-STATUS.md) for metadata findings, capture limits and next presence-required steps.
