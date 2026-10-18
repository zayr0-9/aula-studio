# AULA F75 Studio — agent instructions

## Purpose and scope

This repository reverse-engineers the owner's standard AULA F75 and builds a safer, simpler Windows Electron controller. Hardware is the USB-cabled standard ANSI/QWERTY F75, not HE, display Pro, or MAX. Windows input layout is English UK; do not confuse OS character mapping with physical key assignments.

Work on the requested feature only. Read current source and relevant evidence before changing protocol behavior. Keep changes localized; do not rewrite architecture, install dependencies, modify lockfiles, or change unrelated settings without a clear need. Do not commit or mutate git history unless requested.

## Repository map

- `app/`: Electron + React + TypeScript + Tailwind application, using electron-vite. Run npm commands here.
- `app/src/main/`: authorized IPC handlers, serialized lighting service, bounded Windows helper adapter.
- `app/src/preload/`: narrow typed context bridge; no generic device access.
- `app/src/renderer/src/`: live lighting controls alongside a separate simulator/design preview.
- `app/native/brightness.ps1`: bundled fixed-action PowerShell/C# Windows HID helper. Despite its name, it also implements allowlisted effect and speed operations.
- `app/src/protocol/`: pure offline protocol codecs. Some are intentionally restricted to historical capture scope; do not treat them as the complete native implementation.
- `app/tests/`: Node regression tests, sanitized capture fixtures, native offline tests, hardware-disabled Electron smoke test.
- `docs/` and `docs/evidence/`: reverse-engineering findings and control-transfer evidence. Check dates, executable identity and limitations.
- `capture-tools/`: bounded USBPcap supervisor, private raw PCAPs and tool setup/recovery notes.
- `scripts/`: investigation helpers. Historical helpers are not the production transport.
- `driver-comparison/`: vendor package research; installers are evidence, not scripts to execute.
- Root REA runners, analysis JSON/JSONL and logs: investigation artifacts, not application code. Read applicable instructions in the separate REA tool repository before using it.

## Development commands (Windows PowerShell)

Portable Node is available at `D:\Projects\tools\node-v24.18.0-win-x64`. The package requires Node >=24.18.0 <25 and pins its npm version in `package.json`.

```powershell
cd D:\Projects\aula\app
$env:PATH = "D:\Projects\tools\node-v24.18.0-win-x64;" + $env:PATH
npm.cmd run dev
```

Validation, from `app/`:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd run build
npm.cmd run test:electron
powershell.exe -NoProfile -NonInteractive -File native/brightness.ps1 -Action CompileCheck
powershell.exe -NoProfile -NonInteractive -File tests/native-brightness-offline.ps1
```

- Native `CompileCheck` compiles only; it must never enumerate/open/query hardware.
- Native offline tests invoke pure production encoding methods with fixture buffers; keep them free of device access.
- Electron smoke test uses a hardware-disabled mock backend. It is not real transport or physical acceptance testing.
- Node tests use Node 24 native TypeScript stripping. Avoid unsupported syntax such as parameter properties in directly imported modules.
- Format only changed files when possible. Restart the dev process after main/preload/native changes when performing acceptance tests.
- Report commands actually run and their results. Never equate compile/mock success with successful hardware behavior.

## Non-negotiable hardware safety

1. No guessed vendor packets, firmware/update operations, pairing, resets, key-matrix/remapping, or macros. Do not automatically launch installers, elevate, restart Windows, disable security, or alter drivers.
2. Obtain task-specific authorization and coordinate live captures/queries/writes with the owner. Ordinary offline tests and app startup must not silently contact the keyboard. A request to implement a feature is not permission to run unrelated device experiments.
3. Exact target: unique HID path VID `258A`, PID `010C`, `MI_01`, `COL06`; verify native attributes, usage page `FF00`, usage `1`, feature report length `520`, input length `8`, report ID `6` and expected value/button capabilities. Preserve complete enumeration and ambiguity refusal.
4. Refuse access while official `OemDrv.exe` runs. Recheck before opening and every feature operation. Process checks cannot eliminate a launch race; do not claim exclusive ownership over official software.
5. Serialize entire read/modify/write/readback transactions through the shared service queue and native mutex, including new lighting features. Retain single-instance behavior, bounded queue, timeout, shutdown handling and failure latch.
6. Read fresh configuration before every write. Preserve unrelated bytes and packed bits. Never use captured fixtures or historical baseline buffers as restoration/configuration sources.
7. Validate response header, markers, mode, bounds and padding. Verify all 128 configuration bytes after writes. Fail closed; no blind retries or automatic stale-buffer restoration. An error/timeout does not prove the write did not apply.
8. Keep IPC semantic and allowlisted: numbers/effect selectors, not report buffers, offsets, device paths, shell commands, arbitrary actions or executable paths. Validate argument counts/values in main, authorize the exact main frame/URL, and retain renderer sandbox, context isolation and disabled Node integration.
9. `HidD_GetFeature` returns success, not actual transferred length. Fresh zeroed buffers and marker checks are not independent length attestation. Synchronous native calls and forced termination still have uncertainty.
10. No complete keyboard backup/recovery or persistence guarantee exists. Do not promise universal F75 firmware/revision compatibility.

## Verified lighting contracts and implemented scope

Read current native/helper/service/UI source before relying on this summary.

- HID report: 520 bytes including ID `6`; 8-byte header, at most512-byte payload. Config body128, query command `84`, setter `04`, fixed config trailer `5A A5` at offsets `7E/7F` (not a calculated checksum). Captured configuration response is136 bytes on wire.
- Ordinary captured mode requires config custom flag `0x09 = 0`; selector at config `0x0A`.
- Effect allowlist: Fixed_on=`1`, Neon_stream=`11`, Blossoming=`17`. Configuration-only switching without palette resend was owner-tested successfully.
- Brightness0–9 map: Fixed_on config`0x3A`; Neon_stream config`0x4E`. Resolve using fresh active/target effect. Blossoming brightness has no observed effect and stays disabled.
- Neon_stream speed0–4 is config`0x4F` upper nibble; preserve low nibble. Blossoming speed has no observed effect; Fixed_on/Blossoming speed controls stay disabled. Owner tested Neon_stream speed successfully.
- One brightness slider abstracts the map. UI refreshes supported values on effect changes.
- Current source also supports session-only Individual/Global brightness behavior. `SetEffectBrightness` sets target effect plus its mapped brightness in one configuration write, preserving other fields. Targets1/11 only; Blossoming retains the desired shared value but has no brightness write. Unapplied drafts are not carried. See `app/BRIGHTNESS-SERVICE.md` and global-brightness tests; combined-operation physical acceptance must not be inferred from source/tests alone.
- No custom palette/color operations are currently exposed through production IPC. Do not generalize brightness/effect success to palette safety.

## Color investigation — current open boundary

Owner verified Fixed_on red/green/blue and Colourful behavior: on means rainbow; off applies the chosen solid color globally. Captured palette command `0A` changes Fixed_on's first RGB triplet at payload offsets21–23 (report29–31). Config`0x3B` changed `47`↔`40` hex during the observed toggle sequence; preserve unrelated bits and do not infer a universal toggle encoding for other modes.

- Evidence: `docs/evidence/fixed-on-colors.json`.
- Startup observation: `docs/evidence/palette-startup-observation.json`. Only short command82/secondary1 queries were observed, not palette query8A.
- Official UI retains stale local lighting state when reopened after onboard changes. This proves lack of UI synchronization, not that the keyboard cannot return palette data.
- Old binary static analysis has a candidate `8A` GetLedRgbTab path, but it is NOT a verified current-app/live palette contract. Investigate corrected binary before any guarded query.
- Next task is to establish usable fresh palette read/preservation, or explicitly agree on a Studio-owned local palette with first-Apply overwrite disclosure. Never silently replay the captured512-byte palette and claim unrelated colors were preserved.
- Config+palette operations are multiple writes, not atomic; establish failure/readback behavior before exposing them.

## Evidence/provenance and capture rules

The original app package used a French/ISO profile inconsistent with the owner's ANSI keyboard. User reset onboard settings and installed the corrected package. Do not reuse old layout/matrix data to fix anything.

Corrected installed root: `C:\Program Files (x86)\AULA\F75`; corrected executable SHA256 `7c41a8af17b8d1577ac5660b8f0ce1be61da50fd33a5238158c62e6097292783`. Configs include `Dev/kb/1`, `F75KR`, `wired`; model1 matches observed ANSI geometry. Old executable hash starts `1dfe4803`; its static findings are leads, not proof of identical behavior in the replacement. `Fw=24` is a backend selector, not a firmware version. Do not launch either executable merely to inspect it.

- `app/BRIGHTNESS-SERVICE.md` is append-only historical documentation with later sections superseding earlier claims. Some earlier docs still say simulator-only or acceptance pending. Distinguish current source, capture facts, user acceptance and unverified inferences.
- `scripts/query-configuration-once.ps1` is historical; its brightness-test mode was blocked after layout reset. Do not re-enable/replay historical baselines.
- Capture helper validates a known USBPcap root/address/location and stops after120 seconds or a size bound. Revalidate mapping after reconnects; never assume an address remains correct.
- Capture only the authorized keyboard, not all USB devices. Raw PCAP may contain keystrokes: keep private, extract control transfers only, never inspect/display interrupt input unnecessarily. Do not ask for sensitive typing during capture.
- Save hashes, frame numbers, isolated differences and limitations. Later unrelated matrix03 writes in the Fixed_on brightness capture are excluded from lighting evidence; cause unknown. Never replay them.
- The owner considers the earlier Fn/Ctrl issue resolved and will report recurrence. Do not repeatedly ask them to retest it. Ask only relevant new physical-effect/acceptance questions.

## Engineering and reporting

Keep React UI changes separate from native transport; prefer event-triggered operations and existing state patterns. No new abstraction/dependency unless justified. Preserve simulator/live-control separation and honest status text. Never represent a preview as device state.

For meaningful changes: inspect → implement localized changes → add regression tests → run narrow tests then typecheck/lint/build/smoke as appropriate → summarize changed files, actual validation and remaining live risks. Use clickable absolute file links in responses. Keep user guidance concise and provide exact capture sequences only after recording is verified active.

## macOS continuation

When working on macOS discovery or porting, first read [docs/MACOS-DISCOVERY-HANDOFF.md](docs/MACOS-DISCOVERY-HANDOFF.md). It contains the ordered knob/lighting discovery workflow, Windows-verified contracts, source files, permission/suppression limitations and acceptance gates. Current native helpers are Windows-only; do not enable Darwin hardware support merely by widening the platform check. Record actual Mac findings separately in docs/MACOS-DISCOVERY-RESULTS.md when that work is performed.
