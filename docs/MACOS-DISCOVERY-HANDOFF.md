# macOS discovery handoff — F75 Studio

## Start here: instructions to the agent on the Mac

Read root `AGENTS.md`, this file, then current source. This is a discovery/porting handoff, **not a claim of macOS compatibility**. Preserve the working Windows implementation. All hardware acceptance below is Windows-only unless new Mac evidence explicitly proves otherwise.

Owner wants to continue on their Mac after cloning. Priority: **knob identification/interception first**, then lighting transport and existing controls. Owner authorizes bounded, guarded lighting queries/investigation without repeatedly asking; coordinate whenever physical knob motions/color verification are needed. Do not interpret this as permission for firmware/reset/key-matrix writes, driver/system-extension installs, changing macOS security, unsolicited permission prompts, or globally blocking media keys without explicit opt-in. No need to revisit the resolved Windows Fn/Ctrl problem unless owner reports recurrence.

First response should summarize inspected state, propose the smallest next Mac observation, and explain any permission prompt before triggering it. Do not immediately run a HID seizure or suppression experiment.

## Hardware and established Windows state

- Standard **ANSI/QWERTY AULA F75**, USB cable; not HE, MAX or display Pro. Windows English UK was OS character layout, not keyboard firmware geometry.
- USB VID `0x258A`, PID `0x010C`. Windows MI01 COL02 is consumer-control input; MI01 COL06 is vendor feature control, usage pageFF00/usage1, reportID6, feature520bytes, input8bytes. Windows interface/collection path strings **are not portable identities**.
- Re-enumerate macOS HID services, parent USB interface/registry ancestry, location/serial if available, report descriptors, usage page/usage and report IDs. Refuse ambiguous matches. Do not assume macOS splits/group collections exactly like Windows or that VID/PID alone proves the right endpoint.
- Corrected official Windows app hash `7c41a8af17b8d1577ac5660b8f0ce1be61da50fd33a5238158c62e6097292783`; original French/ISO package was wrong. Old static RE artifacts are leads only. `Fw=24` is host backend selector, NOT firmware version.

Owner has accepted Windows: three effects, Neon_stream speed, Fixed_on/Neon_stream brightness, Individual/Global brightness behavior, Fixed_on RGB/Colourful, and opt-in knob interception/counters. No custom knob action mappings yet. Lighting and knob interception are separate services; don't couple their startup or permissions.

## Clone and establish reproducible baseline

From repo root (use local paths, never D:/Projects on Mac):

```sh
sw_vers
uname -m
xcode-select -p
cd app
node --version
npm --version
# Read package.json engines/packageManager before installing anything.
# Current requirement: Node >=24.18.0 <25, packageManager npm@11.16.0.
# With owner-approved tooling in place, use npm ci (do not regenerate lockfile).
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
npm run test:electron
npm run dev
```

Record Apple Silicon/intel architecture, macOS version, Node/npm/Electron versions and exact test results. Clear inherited `ELECTRON_RUN_AS_NODE` in the individual smoke/dev command environment if needed; don't alter global shell configuration. Existing Windows PowerShell native tests cannot run natively on Mac: mark skipped, not passed. Pure Node tests remain useful. Electron smoke uses a hardware-disabled mock and does not prove Mac transport.

Inspect `git status --short` first and preserve user work. Verify evidence files exist in clone: ignored research files/raw PCAP/Windows installed binaries and portable REA tools may not be tracked. If absent, report exactly which evidence is missing; do not fabricate/re-download proprietary binaries or copy private raw recordings. Prefer sanitized `docs/evidence` and source tests. No automatic git commits, dependency upgrades or package installs beyond scoped setup authorization.

Current app `hardwareEnabled` gate and spawn paths assume Windows x64. Keep macOS disabled until a real backend is validated. Do not merely broaden `process.platform` check and run PowerShell/Windows HID code on Darwin.

## Critical files and evidence (repo-relative)

| Area | Files |
|---|---|
| Rules / UI setup | `AGENTS.md`, `app/package.json`, `app/electron.vite.config.ts` |
| Main lifecycle / security | `app/src/main/index.ts`, `app/src/preload/index.ts`, `app/src/renderer/src/env.d.ts` |
| Knob session controller / contract | `app/src/main/knob-session.ts`, `app/src/shared/knob.ts`, `app/src/protocol/knob-input.ts` |
| Current knob native implementation | `app/native/knob-session.ps1` |
| Knob UI | `app/src/renderer/src/KnobPanel.tsx`, `app/KNOB-INTERCEPTION.md` |
| Knob evidence | `docs/KNOB-SIGNAL-RESULT.md`, `docs/KNOB-HOOK-RESULT.md`, `docs/KNOB-COMBINED-RESULT.md`, `docs/KNOB-SUPPRESSION-RESULT.md`, `docs/KNOB-INPUT-INVESTIGATION.md`, `docs/evidence/knob-corrected-static.json` |
| Windows lighting transport | `app/native/brightness.ps1`, `app/src/main/windows-brightness.ts`, `app/src/main/helper-error.ts` |
| Shared lighting service / UI | `app/src/main/brightness-service.ts`, `app/src/shared/color.ts`, `app/src/renderer/src/BrightnessPanel.tsx` |
| Protocol / fixtures | `app/src/protocol/`, `app/tests/fixtures/`, `docs/evidence/` |
| Lighting contracts | `app/BRIGHTNESS-SERVICE.md`, `docs/FIXED-COLOR-IMPLEMENTATION.md`, `docs/EFFECT-SELECTION-CAPTURE.md`, `docs/PALETTE-FRESHNESS-RESULT.md` |

Read current implementations over stale prose. Many docs are append-only and later corrections supersede earlier claims. `palette-query-candidate.ts` is deliberately offline-only and less strict than production; it is NOT the Mac transport specification. `effect-catalog.ts` includes unverified static effects and MUST NOT automatically expand the write allowlist.

## Track A — knob discovery and interception

### A1. Establish source-specific input, without suppression

Use public IOKit HID APIs (`IOHIDManager`, `IOHIDDevice`, `IOHIDElement`) in a small native diagnostic/helper (Swift or Objective-C/C as justified by available toolchain). No third-party driver or broad keyboard hook needed merely to observe consumer input. First enumerate metadata only; then explicitly start a visible bounded observation when owner is ready.

- Match this USB device and consumer-control top-level usage, but validate actual descriptor/service identity rather than hardcode Windows COL02.
- Register only consumer-control input; ignore/discard ordinary typing and all other devices. Preserve event timestamp/source identity. Bound recording30seconds/event count and memory. Stop on disconnect/ambiguity/error; remove callbacks and close handles deterministically.
- Observe input values/usages and, if necessary, raw report callback; establish whether callback includes reportID or supplies it separately. Never assume Windows buffer layout.
- Windows observed report format: `02 E9 00` clockwise/volume increment, `02 EA 00` counterclockwise/decrement, `02 E2 00` press/mute, `02 00 00` neutral. Consumer usagesE9/EA/E2, reportID2; this is a hypothesis to verify on Mac, not guaranteed callback bytes.
- Ask for one slow clockwise detent, pause3s, one counterclockwise, pause3s, one press. Verify releases, held press, fast rotation/repeats separately before designing action semantics.
- No synthetic events or ordinary keyboard logging. No need to re-open USBPcap files with keystrokes.

### A2. Establish system media-event path, still pass-through

Investigate Quartz/CGEvent taps, AppKit media/system-defined event handling and IOKit HID callbacks using **current Apple documentation for the target OS**. Determine which API actually receives these consumer controls. Do not assume `CGEventType` keyDown captures media keys or use undocumented event encodings as an unqualified production contract.

- Start listen-only before active filtering where possible. Record only volume/mute semantics, no normal key contents.
- Explain Accessibility/Input Monitoring requirements and which process/bundle gets permission (Terminal, helper, Electron dev app or packaged app). Query preflight where available; request owner consent before prompting. Never edit TCC databases, use sudo to bypass, disable SIP or install accessibility workarounds.
- Compare source-tagged HID and system events on one monotonic timebase. Windows simultaneous test showed1:1 slow actions, Raw Input preceding hook1–2ms; **ordering is empirical, not guaranteed**, and not portable to Mac.
- Event taps may lack reliable source-device identity; PID/injection metadata is not physical HID identity. Never equate timestamp proximity with guaranteed per-device suppression.

### A3. Evaluate suppression strategies explicitly

Options to investigate, not preapproved implementations:

1. Active event tap filtering of only volume-up/down/mute. If global rather than per-device, disclose global scope and require session opt-in, exactly like Windows. Test whether returning a filtered event actually prevents system volume/mute; receiving an event is not proof of blocking.
2. Device-level exclusive/seize access (`kIOHIDOptionsTypeSeizeDevice` or supported alternative) may have different scope/permissions. **Do not try it without first establishing that only consumer collection is seized**, whether the composite keyboard/mouse would be affected, and a verified release path plus owner approval. Do not seize the whole keyboard as a shortcut.
3. Genuine per-device filter/system extension has significant install/signing/security implications; do not install one or present it as necessary without comparing public user-space options.
4. Firmware remap remains unverified: corrected app has WheelMode/KnobIndex branch but shipped profile defaults disabled; no safe3action remap contract. Never flip config1A or matrix slots based on static speculation.

Windows success proves only: exact F75 source observation plus global AD/AE/AF hook suppression can work together. All Windows hook events were marked injected; do not blindly ignore injected events on either OS or infer a particular generating process.

### A4. Preserve current session safety design

Only integrate once source identification and suppression scope are established. Reuse semantic contract `clockwise`, `counterclockwise`, `press` and status/counters, not raw bytes/paths in IPC. Current helper emits NDJSON ready/alive/action and accepts only lease/stop.

- Off by default, consent UI, clear GLOBAL warning if applicable, always-visible emergency Disable and15minute session bound.
- Parent owns helper; retain until exit, explicit disable/EOF/parent death cleanup; normal shutdown awaits exit. Renderer reload/navigation/crash/window close disables. Respect existing single-instance behavior.
- Native monotonic lease expires after2.5s and is terminal; late heartbeat cannot revive it. Check expiry inside suppression callback independently of potentially blocked UI/output loop. Parent renews every500ms; heartbeat loss stops leases. Never auto-enable from persisted preferences.
- Bound output/event queues and parser. No callback blocking IO or arbitrary action execution. Handle event tap disabled-by-timeout/userInput messages safely: fail open/stop with visible status, never silently claim active interception after hook removal. Sleep/wake/reconnect require revalidation.
- Registration can emit arrival notifications for already-present devices. Windows initial implementation mistakenly closed on every notification; fixed to distinguish pinned initial arrival versus removal/new conflicting target. Don't repeat this startup bug with Mac callbacks.
- Existing session is interception + counters only. Action mappings will be a separate bounded feature; no shell commands/scripts/arbitrary keystrokes added implicitly during port.

Acceptance: opt-in enable, counters for each action, original volume/mute blocked only under stated scope, Disable restores normal behavior, helper crash/parent kill/hung-output/renderer reload expires safely, unplug/replug never blocks typing, another device's media keys behave according to disclosure. Verify multiple identical F75 ambiguity and denied permissions. Mark every manual result separately.

## Track B — existing lighting controls on macOS

### B1. Implement transport boundary, not a second protocol guess

Use `IOHIDDeviceGetReport` / `IOHIDDeviceSetReport` feature APIs or another justified maintained transport. Check Apple's signatures/reportID convention on target platform and verify with a bounded read first: Windows520byte buffer includes ID6; macOS APIs have separate reportID parameter and may expect/include bytes differently. **Do not blindly strip or duplicate ID6.** Use returned `CFIndex` length and IOReturn, not requested buffer capacity. Some report getters require a preceding feature OUT query; explain that queries are not literal zero-device-write operations.

Identify unique vendor usageFF00/1 service and observed report descriptor/capabilities; map parent USB interface rather than assume Windows MI01/COL06 strings. Preserve source identity through reconnect. Do not use consumer device handle for vendor features just because VID/PID matches. First test fresh config read and compare sane header/markers without sending settings writes. No concurrent vendor/third-party RGB app access; Windows OemDrv process check has no direct Mac equivalent. Determine relevant local conflicting applications; don't falsely promise exclusive ownership.

### B2. Proven Windows protocol contracts to revalidate

All offsets below are **configuration/palette payload offsets**, unless explicitly called report offset.

- Report total520bytes: ID6 + command/reserved/chunk header8bytes + up to512payload.
- Configuration query header `06 84 00 00 01 00 80 00`; zero remainder. Setter `06 04 00 00 01 00 80 00` plus fresh128byte configuration, zero rest. Captured incoming config136bytes, Windows API capacity520. Marker config7E/7F=`5A A5` fixed, NOT calculated checksum. Ordinary custom flag config09=0, effect selector0A.
- Effect write allowlist: Fixed_on1, Neon_stream11, Blossoming17. Single selector-only command04 works without palette resend on owner hardware. Do not enable other catalog effects from INI alone.
- Brightness0–9: Fixed_on3A, Neon_stream4E; map by fresh active/target effect. Blossoming unsupported.
- Neon_stream speed0–4: config4F upper nibble; preserve low nibble. No speed controls for Fixed_on/Blossoming.
- Global brightness optional/session-only: target1/11 effect selector plus mapped brightness in one04write; retain other effect's stored brightness. Individual default. Carry last applied, not unsaved draft. Blossoming retains shared desired value but no brightness write.
- Palette query header `06 8A 00 00 01 00 00 02`, zero512payload, then getter. Live Windows wire response520 verified and red/green/blue freshness established. Exact production validation is in current helper.
- Palette marker **payload506/507 (report514/515)**=`5A A5`; final4bytes zero. Earlier docs incorrectly described missing end marker; **do not synthesize marker at510/511**. Production validates reserved tail420..511 except marker. Preserve full fresh512bytes.
- Fixed_on RGB at palette payload21..23 (report29..31). Palette setter command0A. Colourful toggle config3B low nibble0(solid)/7(rainbow); preserve upper nibble. Not a universal toggle for other effects.
- Color production sequence: fresh config → fresh palette → config recheck → derive only known config bits/RGB → config04 write/full128 verification → palette0A write/full512 readback → config reverify. Multiple writes are **not atomic**; error may leave partial state. No retries or stale rollback.

Preserve whole-transaction shared queue, bounded queue, operation timeout, shutdown wait and shared fault latch across all lighting actions. Fresh state for each operation; never send captured fixture buffers as current settings. Validate response header, mode, markers, lengths and bounds. Renderer must never supply packet bytes, offsets, report IDs, arbitrary actions or executable paths. Retain sandbox/contextIsolation, sender main-frame/URL checks and semantic allowlisted IPC.

### B3. Staged hardware validation

1. Mac enumeration/caps only, then one config query; save sanitized metadata, query header, actual API length/status and full validated response privately in evidence (not normal keystrokes).
2. One guarded palette query, verify actual length/marker and current known color. Do not claim freshness from header/API success alone.
3. Read-only UI uses actual values; unsupported platform gracefully disabled before backend readiness.
4. Supervised brightness9→8→9, with fresh read before each, full readback. Then three effect switches, speed4→0→2→4, Fixed_on RGB and Colourful. Never combine all unverified changes in first test.
5. Fault/permission/disconnect/coexistence/reconnect tests; verify no automatic retry, background query or stale restoration. No firmware/reset/matrix/macro testing.

## Boundaries for a minimal cross-platform design

```text
Sandboxed shared React UI / semantic IPC
  -> shared session + validation / lighting queue
     -> Windows helper (preserve working implementation)
     -> macOS helper (discovered and independently validated)
  <- semantic knob events or validated lighting results only
```

Keep raw platform-specific APIs outside renderer/shared contracts. Prefer a small native helper over fragile Electron ABI addons if existing architecture/toolchain supports it, but inspect requirements before choosing. No new dependency or large refactor just for platform detection. Production build must package the correct architecture/helper (arm64 vs x86_64), fixed path and executable permissions; assess signing, hardened runtime, entitlements and stable app identity for TCC. Don't assume a signed terminal permission automatically transfers to packaged helper. No packaging/signing/notarization claims until actually tested.

## Deliverables for each discovery step

- Record `docs/MACOS-DISCOVERY-RESULTS.md`: machine/OS/toolchain, exact commands, source identity, API status/lengths, permissions requested/granted, observed versus inferred behavior and unresolved blockers.
- Save small sanitized evidence with provenance and no ordinary keystrokes; preserve limits and failures, not only successes.
- Add pure codec/session lifecycle tests, then platform-native compile/offline checks, then explicit real-device results. Maintain Windows tests/build behavior.
- End each phase with what is implemented, what is merely observed, what was physically verified and the single next owner action if needed. No repeated permission requests for already-scoped safe investigation, but never silently widen to whole-device capture or blocking scope.

## Apple documentation entry points (research, not verified portability claims)

Consult current SDK headers and Apple docs on the Mac:
- https://developer.apple.com/documentation/iokit/iohidmanager
- https://developer.apple.com/documentation/iokit/iohiddevice
- https://developer.apple.com/documentation/coregraphics/cgevent/tapcreate(tap:place:options:eventsofinterest:callback:userinfo:)
- https://developer.apple.com/documentation/coregraphics/cgpreflightlisteneventaccess()
- https://developer.apple.com/documentation/coregraphics/cgrequestlisteneventaccess()

Availability, permissions, media-event routing and seizure behavior are open questions. These links are starting points, not evidence that interception or lighting currently works on macOS.
