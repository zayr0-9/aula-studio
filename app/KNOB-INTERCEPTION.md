# Opt-in knob interception session

Prototype stage: interception plus F75 semantic counters only. No custom action execution, input injection, arbitrary shortcut/shell IPC, firmware/matrix/config writes or driver installation. Existing lighting unchanged.

## User contract

Off by default, no startup registration. Consent checkbox explicitly warns: volume up/down/mute from ALL devices are suppressed while active. Only unique F75 VID258A/PID010C MI01 COL02 Consumer Control Raw Input emits clockwise/counterclockwise/press counters. No source-timing heuristic. Normal keys not retained. A separate visible emergency window has immediate Disable/close control. Session max15minutes. Preference not persisted.

## Ownership and fail-safe

Main owns fixed non-elevated PowerShell child, bounded NDJSON parser; semantic events only, no raw device/input bytes in renderer. IPC main-frame/URL authorized, zero arguments, no arbitrary actions. Polling status while enabled renews renderer lease; main renews native stdin lease500ms, stops on renderer inactivity2.5s/helper inactivity4s. Native monotonic2.5s lease is terminal and checked in EVERY hook callback independently of UI timer. EOF/stop/invalid command expire; late renewals cannot revive. Fifteen-minute bound independently checked. Queue256entries, drain at most100/tick, output parser8KiB. Any topology change stops session. Named local mutex and unique target enumeration; actual HID descriptor decodes consumer usages. Hook callback only blocks AD/AE/AF and never emits actions or writes output.

Disable stops renewal, sends stop, waits for close ownership, schedules kill after3s. Normal app shutdown awaits owned helper exit alongside lighting shutdown. Navigation/reload/render crash/window close disable; panel unmount normally disables. A race where enable resolves after unmount is bounded by heartbeat expiry. Forced OS kill relies on EOF/lease expiry and OS hook cleanup. Other software may remove low-level hooks or alter input; cannot promise continuous suppression in all conditions. Elevated Studio rejected by native helper. No packaged ASAR/signing setup yet.

## Validation

55 Node tests passed, including startup/semantic parser, bounds, failure ownership, heartbeat loss, existing regressions. Native CompileCheck passes without registrations/hooks. tests/native-knob-lease.ps1 exercises Live/Renew on an uninitialized instance: live, expiry, late renewal, terminal stop and15minute bound pass without calling any input APIs. Typecheck/lint/format/build pass. Hardware-disabled Electron smoke pass after clearing inherited ELECTRON_RUN_AS_NODE only in command environment; first attempt failed because inherited flag ran Electron as Node. Static independent review found no blocker; shutdown wait and stopping text improved following review. This does NOT prove new persistent helper registration/descriptor decoding on live F75; previous diagnostics used separate helpers.

## Manual acceptance

Restart Studio non-elevated. On Overview/Lighting consent and Enable interception. Startup may take a few seconds. Confirm active warning, turn each direction and press: counters should change; volume/mute should not. Disable and confirm native window closes/volume returns. Re-enable then reload/navigate away or close Studio: helper should close and volume return. If backend startup errors, global suppression should never remain beyond2.5s since last lease; emergency window close is available. No action mapping is enabled yet; choose first bounded action separately after this session behavior is accepted.

## Computer-control profiles (2026-10-18)

Supersedes the counters-only scope above. Five fixed session-only profiles are now selected before Enable; switching requires Disable first:

| Profile   | Clockwise  | Counterclockwise | Press        |
| --------- | ---------- | ---------------- | ------------ |
| Media     | Volume up  | Volume down      | Play/pause   |
| Scroll    | Wheel down | Wheel up         | Middle click |
| Zoom      | Ctrl+=     | Ctrl+-           | Ctrl+0       |
| Tabs      | Ctrl+Tab   | Ctrl+Shift+Tab   | Ctrl+T       |
| Undo/redo | Ctrl+Y     | Ctrl+Z           | Ctrl+Shift+Z |

Shortcuts use focused app; mouse actions use pointer location and Windows scroll routing. Behavior is app/layout dependent. No arbitrary shortcut/shell command, persistence, startup activation, keyboard configuration/matrix write or extra driver. Native helper accepts only fixed profile names; main validates exact one-argument IPC and session revalidates before launch. Consent, emergency Disable, lease,15minute limit and topology guards retained. Global suppression remains ALL devices' volume/mute; only F75 COL02 dispatches actions.

Native SendInput uses correctly sized x64 INPUT batches containing balanced presses/releases. Own injected media events bypass suppression only with injected flag plus exact extraInfo marker; marker is loop identification, not a security/authentication boundary. Dispatch occurs outside the hook; skips events with physical Ctrl/Shift/Alt/Win held. This check cannot eliminate races. Bounded one-action-per50ms tick with additional30/sec ceiling; stale events older150ms/backlog discarded, never replayed as catch-up burst. Counters now count successfully injected actions, not all observed detents.

Partial/failed SendInput closes session with no retry. Windows may insert only a prefix, leaving keys logically held: press/release Ctrl and Shift if necessary (middle mouse button for a partial middle-click). Balanced batches reduce risk but do not guarantee cleanup on partial OS delivery. Elevated/secure apps may reject injection; no elevation workaround. A successful SendInput return does not prove the target app handled the shortcut. Native error text is not forwarded to renderer; unexpected helper closure can appear as stopped.

Offline validation: all15 action encodings, exact fields, ABI offsets/sizes, balanced releases, invalid profile/event rejection and own-hook bypass; lease tests pass without input APIs. Node profile validation/forwarding regressions pass. No live input injection performed as part of implementation; manual acceptance of each profile and Disable/lease behavior remains required. Electron build passes; full smoke currently blocked by existing System-theme live appearance assertion (light remained light after mocked dark theme change), before post-theme UI checks.

## Live profile switching

Supersedes the disable-before-switch restriction above. Profile selection is now available during an active session. Main validates the semantic profile and sends a bounded `profile:<name>` command to the existing helper; only one request may be outstanding. Native UI thread clears pending detents, changes profile between complete action batches, and acknowledges the selected name. Renderer commits its selection only after that acknowledgment. Two-second acknowledgment timeout, child exit, Disable or invalid output rejects the pending change; timeout fails closed by stopping interception. No helper restart, suppression gap, counter reset, lease renewal or15minute extension occurs when switching. Starting/stopping/busy controls remain gated. Live acceptance of initial profiles was reported by owner; live switching requires separate acceptance.
