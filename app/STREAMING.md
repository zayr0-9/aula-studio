# Temporary full-keyboard streaming

## Use

Lighting → Temporary streaming. Turn onboard lighting OFF first (keyboard shortcut or official app), close official app, acknowledge prerequisites. This release refuses any mode other than observed ordinary off; it does not guess custom-mode transitions.

- Paint individual: select one/multiple physical keys, choose color, Paint selection. Select all, fill/clear board and agent-color draft preset available.
- Solid, coarse rainbow wave, breathe, and walking-key modes.
- Local brightness0–100%; default25%. Draft keyboard preview is not hardware readback.
- Start sends an explicit profile. Editing only changes draft; Apply changes replaces latest profile. Stop ceases frames; observed firmware expiry returns to off. No saved snapshot/config/static table is written or restored.
- Fixed minimum800ms after acknowledgement, one frame outstanding. Effects intentionally coarse, not high-FPS animation.
-30minute native session cap; renderer heartbeat loss stops the session. Closing/crashing/navigating the main renderer stops it. Switching app pages retains session because panel remains mounted.
- Hardware errors latch streaming until restart. No retries. Stop remains available.

## Architecture and safety

`shared/stream.ts` validates exact semantic profiles and builds90sparse RGBtriplets from80owner-accepted keys. `main/stream-session.ts` owns helper lifecycle, latest-only profile, frame acknowledgements/pacing, startup/frame/renderer watchdogs and bounded shutdown. `native/stream-session.ps1` reuses production C# identity/capability/process guards and takes lifetime native mutex; only08direct frames after fresh off-mode admission. Native stdin bounded8192characters,2500mslease,800msminimum gap,30mincap. EOF/Stop dispose without restore. Synchronous HID calls can hang; main requests termination after timeout but cannot prove an in-flight hardware call did not apply.

Main reserves shared BrightnessService before launch and releases only on actual helper close. Other lighting/remapping transactions refuse during reservation, without poisoning the normal queue. IPC checks exact trusted main frame, argument count and profile; no renderer paths, reports or executable commands accepted. Static manual digit test remains a separate existing feature, cannot run concurrently.

No MCP/HTTP/Graviton adapter is added. Agent colors is a draft preset only, not live agent status. No overlay with onboard effects and no persistence guarantee. Starting no longer changes onboard mode automatically.

## Validation

102Node tests passed including11fake-child session tests and profile/arbitration tests. Typecheck, lint, changed-file formatting and production build passed. Mocked Electron test exercises opt-in Start, draft-only preset changes, Apply and Stop with no hardware. Native stream compile/offline encoding, gap/mapping, bounded reader and off-mode admission tests passed, as did existing native brightness/static offline tests. Integrated live session has not been run during this implementation; owner previously accepted direct08on all80keys in a240frame800mswalking test. That evidence does not imply unattended long-session acceptance.
