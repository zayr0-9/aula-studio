# Restricted wired F75 brightness service

Only explicit Read / Apply buttons contact hardware. The rest of the UI remains a simulator. No startup query, polling, raw-report IPC, remapping, resets, firmware operations, palette writes, saved device configuration, retries or restoration writes.

## Flow

Renderer integer 0–9 → restricted preload → main-frame/URL-authorized IPC → bounded serialized main-process transaction → fixed Windows PowerShell executable and bundled script → exact HID enumeration/capability checks → fresh configuration query → one brightness write → fresh query and all-128-byte comparison. Only a brightness integer returns to the renderer.

- Windows x64 only; no additional dependencies or execution-policy bypass.
- Unique VID258A/PID010C/MI01/COL06 path, native VID/PID attributes, usage FF00/1, feature length520, input length8, one feature value capability, zero feature button capabilities, report ID6.
- Only observed Neon_stream (selector11, custom0), valid header, padding, 5A/A5 markers and brightness0–9 accepted.
- Each Apply reads a new configuration and preserves every byte except configuration offset4E. Never reads historical fixtures/baselines for device writes.
- OemDrv process checks before opening and before every feature operation. Close the official app and do not reopen it during an operation. This check cannot atomically prevent the app from launching immediately afterward.
- Main queue capped at8; named global mutex prevents concurrent helper transactions; Electron single-instance lock. Interrupted mutex ownership fails closed.
- Any transport/validation failure latches the main service off until app restart. Pending work is refused. Do not assume a failed write did not apply.
- Normal app shutdown refuses/discards queued work and waits for the active transaction before exiting; closing the window is not cancellation. Forced process termination/OS shutdown cannot guarantee completion.
- Helper runs outside Electron main, with15-second process timeout and4KiB output limit. Synchronous Windows HID calls can still block in the OS; a timeout is not a guarantee that a write did not reach hardware. No subsequent transaction runs in the faulted app.
- HidD_GetFeature exposes only success, not actual transferred length. Each read uses a new zeroed520-byte buffer and validates the complete header, markers and zero tail. This is not independent length attestation. The captured wire response was136bytes.

## Validation and use

Offline protocol fixtures replay both corrected ANSI-app cycles and historical cycles. Service tests cover serialization, invalid IPC values, verification mismatch, fault latching and bounded queue. Native helper compile-only mode does not acquire a mutex, enumerate, open or query devices. Electron smoke test uses a disabled mock backend; it does not exercise the real main-process transport.

After closing official software, use **Read from keyboard** first. If supported, select a level and click **Apply brightness to keyboard**. The UI reports success only after readback. On failure, stop and inspect; restart and read fresh rather than resending blindly. Hardware acceptance testing of this implementation remains pending; do not infer it from prior standalone helper success.

No full-device backup/recovery assurance or persistence guarantee is provided. IDs/capabilities establish the scoped interface, not universal compatibility across F75 firmware revisions. Packaging/signing and ASAR unpack rules are not yet configured; this helper is bundled by electron-vite for the existing development/build preview workflow.

## Allowlisted effect selection extension

The same queue, mutex, device checks, process checks and fault latch now cover `effect:read` / `effect:set` alongside brightness. Only selectors1(Fixed_on),11(Neon_stream),17(Blossoming) are accepted. Native ReadEffect reads the current allowlisted effect; SetEffect reads fresh configuration, changes only configuration0x0A, sends command04 once and verifies all128bytes. No palette resend and no historical buffers. Existing brightness Read/Set still require Neon_stream; other effects do not reuse Neon_stream's brightness offset. UI invalidates brightness after effect changes and requires explicit Read to refresh it.

This extension supersedes the earlier brightness-only scope statements above; all other safety limits still apply. Configuration-only effect switching is experimental pending the following visual acceptance test:

1. Close the official app. Restart Studio dev mode so the main/preload/helper changes load.
2. Read from keyboard; select Fixed_on and Apply effect. Confirm steady lighting and verified-success status.
3. Select Blossoming and Apply effect. Confirm visible animation matches the official app and verified-success status.
4. Select Neon_stream and Apply effect. Confirm expected animation, then Read to refresh brightness.
5. If any operation fails or the physical effect is wrong, stop; do not resend or add a guessed palette command.

Offline extension validation:23 tests pass (mixed brightness/effect serialization, allowlist rejection, shared fault latch, captured byte differences and prior regressions), native compile-only passes, typecheck/build/lint/format and disabled-backend Electron smoke pass. No new effect commands have been sent by the assistant. Full native HID path and physical palette omission require owner testing; mock service tests do not establish those.

## Neon_stream speed extension

Full-range official capture SHA25666c3fd7b655ef9da0c3288c41c8597383c5cabed955a16956259fc322fa3451a establishes config0x4F upper nibble speeds4→0→1→2→3→4 (47/07/17/27/37/47 hex). Lower nibble7 unchanged. First Save selects Neon_stream from Blossoming; later writes only change speed. Six Saves captured, not the requested seventh unchanged Save; final4 has no subsequent readback. Intermediate queries match previous writes; palettes identical. Evidence: ../docs/evidence/neon-stream-speed-range.json. Owner confirmed Blossoming speed does not change; no Blossoming speed support exposed. Owner previously accepted all three effect switches without palette resend and reported no keyboard regression.

ReadSpeed/SetSpeed are Neon_stream-only. Each SetSpeed reads fresh state, preserves low nibble with `(fresh & 0x0F) | (speed << 4)`, preserves every other config byte, sends command04 once and verifies all128bytes. Same IPC authorization, shared queue/mutex/fault latch; no palette write or retry. UI speed0–4 disabled until explicit Read in Neon_stream and invalidated on effect switches. Speed is not mapped to frames/seconds and direction flags in low nibble are not modified.

Validation: native compile-only,26 offline tests, lint/format, typecheck/build, disabled-backend Electron smoke passed. Native hardware speed acceptance remains pending; no custom speed writes were executed during implementation. Restart dev process, close official app, Read in Neon_stream and test Apply speed4→0→2→4, observing physical animation and verified success. Stop on failure. Packaging, HID returned-length and official-app race limitations remain as documented above.

## Unified per-effect brightness slider

Native fixed map now resolves brightness from each freshly queried effect: Fixed_on1→config0x3A; Neon_stream11→config0x4E; Blossoming17 unsupported. Renderer supplies only brightness0–9, never offsets. No global brightness synchronization or cached configuration is introduced: switching effects retains their device-stored brightness values and automatically reads supported brightness/speed to refresh the single slider. Unsupported brightness is disabled with an explanation. Set changes only the mapped brightness byte and retains full readback verification, guards and shared serialization. No matrix/palette commands added.

Fixed_on evidence: ../docs/evidence/fixed-on-brightness.json. Official capture isolated9→4→0→9 at0x3A, owner physically confirmed. Later unrelated matrix03 writes in that capture are excluded; cause unknown. Blossoming attempted brightness Saves changed no bytes and owner reported no physical effect.

Validation:27 Node tests passed; tests/native-brightness-offline.ps1 compiled the production C# source and invoked only pure WithBrightness via reflection, passing50 fixture-based mapping/preservation cases covering both effects and levels0–9, invalid bounds and unsupported modes. No device enumeration or access in that test. Native CompileCheck, typecheck/build/lint/format and mock-disabled Electron smoke passed. Electron emitted GPU command-buffer diagnostics during teardown, but smoke assertions passed and process exited0. No hardware transactions performed during implementation.

Acceptance pending: close official app, restart dev process, Read; switch Fixed_on and verify slider automatically refreshes, Apply9→4→0→9; switch Neon_stream and verify its own brightness refreshes; switch Blossoming and verify brightness disabled. Speed remains Neon_stream-only. This section supersedes earlier Neon_stream-only brightness/UI-manual-refresh statements.

## Optional Global / Individual brightness

Brightness behavior selector defaults to Individual (existing per-effect device values). Global seeds its shared value from the last read brightness when enabled, updates it only after successful brightness Apply, and carries it to supported targets on effect Apply. Unapplied slider drafts are not carried. If Global starts on Blossoming with no known brightness, the next supported effect initializes it from a read; no value is guessed. Blossoming receives only an effect change, retains the shared value, and keeps brightness disabled. Toggling behavior itself performs no device I/O. Choice and shared value are session-only, consistent with current no-persistence UI.

New restricted effect:set-brightness IPC accepts target1/11 and brightness0–9 only, using the same queue/fault latch. Native SetEffectBrightness reads fresh configuration once, sets target effect and only that target's mapped brightness in a single command04 write, and verifies all128bytes. No intermediate effect-only write, raw reports, palette, matrix, retries or restoration. Other effects' stored brightness remains untouched. Source may be Blossoming; target may not be.

Validation:30 Node tests passed; native offline reflection tests passed50 existing plus60 combined encoder cases covering sources1/11/17, targets1/11 and all brightness values, preservation, bounds and immutability. Lint/format/typecheck/build and hardware-disabled Electron smoke passed. No real keyboard writes during implementation. Acceptance: in Global apply Fixed_on brightness1 then switch Neon_stream; expect1 immediately. Traverse Blossoming and return; expect retained1. In Individual set different values and verify switching recalls each. Restart returns Individual by design. Combined command behavior awaits physical acceptance.

## Unsupported ordinary-effect recovery

ReadEffect now accepts any byte selector from structurally valid ordinary configuration; unsupported active effects are displayed as unsupported, not faults. UI clears brightness/speed/color state, retains a supported desired selection, and leaves explicit effect Apply enabled after the read. No automatic overwrite. SetEffect targets remain1/11/17 only, combined targets1/11 only. Native queries preserve header/padding/marker checks and still refuse nonzero custom flag; unknown ordinary selector no longer invalidates the read. Fresh selector replacement preserves all other configuration bytes. Custom/Self-define transition remains excluded. Actual transport/marker/custom validation failures still latch off.

Validation:37 Node tests pass; production native validator offline test accepts ordinary selectors0/1/4/11/17/255 and rejects corrupted markers/custom flag; typecheck/lint/format/build pass. No hardware operations performed. Acceptance: restart dev process once to load fix, change onboard to an unsupported ordinary effect, Read should show unsupported notice with parameter controls disabled, then explicitly Apply supported effect and verify refresh. No restart needed merely for unsupported ordinary state after this fix.
