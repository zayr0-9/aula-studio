# Aula Studio

An Electron + React desktop controller and evidence-backed investigation of the standard wired ANSI AULA F75 keyboard.

## Start here

- [Agent instructions](AGENTS.md) — device safety rules and repository map.
- [Current handoff](docs/CURRENT-HANDOFF.md) — current implementation and latest per-key discovery.
- [macOS discovery handoff](docs/MACOS-DISCOVERY-HANDOFF.md) — ordered porting gates. Hardware support is currently Windows x64 only.
- [Per-key verification](docs/PER-KEY-VERIFICATION.md) — owner-confirmed digits1–4, captured vendor packets and successful static-table getter.
- [Research index](docs/README.md) — historical investigation; older status statements are superseded by current source and newer reports.

## Development

Use Node `>=24.18.0 <25` and the npm version pinned in [package.json](app/package.json).

```sh
cd app
npm ci --ignore-scripts
node node_modules/electron/install.js
npm test
npm run typecheck
npm run lint
npm run build
npm run test:electron
```

`npm run dev` starts Studio. On Windows x64, application startup can read the connected keyboard. On macOS hardware remains disabled; do not widen the platform check to run Windows helpers. Smoke tests use a mock backend, not real hardware. Dependencies/runtime require network access during setup. Clear an inherited `ELECTRON_RUN_AS_NODE` when launching Electron.

Current UI includes lighting, key assignments, opt-in knob controls, System/Light/Dark themes, a white keyboard variant, and reduced-motion-aware transitions. Mac discovery/transport is not implemented. Per-key indicators and external MCP/CLI automation are not enabled.

## Evidence and publication boundaries

This repository includes application sources, pinned dependency lockfile, research scripts, documentation, sanitized configuration/color/control-transfer evidence, and offline regression fixtures. Raw USB captures can contain keystrokes and are intentionally excluded, together with vendor executables/installers/extracted assets, dependencies, build output, logs and machine-local session data. Some historical documents refer to these local-only artifacts; their absence in a clone is intentional. Never reconstruct them by replaying historical settings buffers.

Reference source and excerpts retain their original licensing. [Third-party notices](THIRD-PARTY-NOTICES.md) describe the OpenRGB and motion-recipe provenance. No blanket project license is asserted for proprietary vendor material or third-party excerpts. A public repository is not a firmware compatibility or recovery guarantee.
