# Knob signal investigation — observation before remapping

Effect expansion paused. No knob setters, hooks, event injection, installs or HID report requests issued in this investigation.

## Corrected-model observations

- Present F75 composite device includes MI01 COL02 named HID-compliant consumer control device, separate keyboard collections MI00/MI01 COL04 and vendor feature COL06. COL02 is the strongest knob observation candidate; physical signal source not yet proven.
- Corrected model1 KB.ini has ;Wheel followed by K81=0,0,0,0,0x09,0x01,0x0700001D,84. Zero-area special entry at matrix84; not proof of independent clockwise/counterclockwise/press remapping or standard HID usage29. Do not send it as a packet.
- Old binary static lead config1A wheel-mode is conditional and from wrong original package; not sufficient for corrected firmware remap. Corrected wheel serializer/caller analysis still needed. Firmware remap paths remain excluded pending verified contracts.

## Windows feasibility

Microsoft Raw Input distinguishes source device via RAWINPUTHEADER.hDevice and GetRawInputDeviceInfo. Registration uses usage page/usage TLC, not an exact VID/PID path, so filter before retaining payloads. Consumer page0C/usage1 can be observed without registering ordinary keyboard TLC or a global keylogger. A bounded diagnostic observer is implemented in scripts/observe-knob.ps1, compile-only validated. It registers consumer only, accepts only exact F75 MI01 COL02 path, limits30seconds/256reports/4096byte packets, discards other devices without retaining payloads, cleans registration on close and sends no device setters. Events remain in memory until exit/console output. No observation has been run yet.

Potential wire semantics are consumer usages Volume Increment(E9), Decrement(EA), Mute(E2), but report IDs, bit/array representation, press/release/repeats and per-detent behavior are not yet observed. Do not label arbitrary bytes based on those expectations. Use preparsed HID descriptor/usage decoding or controlled trace before binding actions. Windows may instead route media keys through keyboard messages; empty consumer trace is inconclusive, not proof knob absent.

Raw Input observation is NOT suppression. RIDEV_NOLEGACY concerns mouse/keyboard legacy messages for the application, not system-wide blocking of consumer volume. Low-level keyboard hook can suppress some keyboard events but KBDLLHOOKSTRUCT has no device handle; naive blocking of volume/mute intercepts other devices too. Correlating asynchronous Raw Input with hooks is not a guaranteed race-free device-specific interception method. WM_APPCOMMAND is also device-independent. Do not promise consumer reports will appear in WH_KEYBOARD_LL until tested.

For flexible Studio actions without original volume/mute side effects, options remain: verified onboard remap to otherwise-unused keys subsequently recognized by Studio; a dedicated supported HID/device filter solution (higher installation/security complexity, no installs now); or explicit opt-in global media-key interception (affects other devices, not preferred). No choice committed before signal observation.

Sources inspected:
- https://learn.microsoft.com/en-us/windows/win32/inputdev/about-raw-input
- https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-rawinputdevice
- https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-kbdllhookstruct

## Coordinated next observation

Run observer normally (not elevated) when owner ready; volume/mute remain active. Only slow input sequence: clockwise3detents, pause; counterclockwise3detents, pause; one click; pause; two clicks separated. Avoid other media controls.30second window auto-closes and outputs target consumer report bytes/times. Do not start silently because knob motions require owner participation. No USBPcap or general interrupt capture needed. Then map events and evaluate suppression separately; no custom actions yet.

## Corrected executable follow-up

Fresh REA/Ghidra immutable static analysis completed on corrected hash7c41a8af17b8d1577ac5660b8f0ce1be61da50fd33a5238158c62e6097292783. Evidence: [knob-corrected-static.json](evidence/knob-corrected-static.json). No vendor execution or device I/O.

- Loader FUN_00410a70 reads WheelMode default0 into config object+2D90. KnobIndex is an optional string parsed for up to4values. The parser's register arguments/destination need further assembly tracing; do not infer support from a string alone.
- Serializer FUN_0048d680 only enters wheel-mode block when profile+2D90 is nonzero. It checks up to4configured indices at+2D94, compares key records with defaults, and writes configuration body1A to0 or low WheelMode byte when differences found. This is a conditional key-remapping mode flag, NOT standalone clockwise/counterclockwise action encoding.
- None of installed model1/F75KR/wired profiles declares WheelMode or KnobIndex. Therefore shipped default loader configuration leaves this branch disabled. It does not establish hardware incapability or authorize enabling the option experimentally.
- Special K81 Wheel record alone still does not expose3independent bindings. Do not edit vendor INI or send guessed matrix/config1A writes to enable it.

Pure decoder app/src/protocol/knob-input.ts now recognizes only observed3byte reportID2 usagesE9/EA/E2/0; rejects unknowns and remains unconnected to production input/action paths. Source identity must be established by listener, not decoder. Neutral is not a second action, and no unobserved hold/double-click/acceleration behavior added.

Windows distinction remains: Raw Input proves source-specific observation; keyboard low-level hooks can potentially suppress mapped media keys but do not expose hDevice. Microsoft explicitly documents RIDEV_NOLEGACY only suppressing legacy events for the registering application, not global consumer-volume behavior. We have NOT established device-specific suppression without a filter driver or a verified firmware remap. Next worthwhile interactive test is an observation-only WH_KEYBOARD_LL comparison restricted to VK_VOLUME_UP/ DOWN/MUTE; inspect pass-through events to determine whether volume path even reaches hook. Never log ordinary keys or block volume in this initial test. No hook was installed in this follow-up.
