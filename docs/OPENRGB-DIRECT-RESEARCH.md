# F75 direct lighting: pinned research and offline encoder

## Scope and provenance

Steps 1–2 only. No HID enumeration, queries, writes, capture, native worker, IPC, UI integration or refresh loop was added or run. This is a candidate protocol implementation, not physical acceptance.

Pinned OpenRGB commit: `8e16de27858cf2be6af54a33ce003df74cb9fd3e` (resolved from master through GitHub API during this investigation).

[Saved reference source](evidence/openrgb-direct-reference.json) contains seven upstream files with their original notices, URLs and commit, plus the inherited Shutdown excerpt. Tests consume this local evidence; they do not fetch a moving branch.

Upstream links at the pinned commit:

- [Detector](https://github.com/CalcProgrammer1/OpenRGB/blob/8e16de27858cf2be6af54a33ce003df74cb9fd3e/Controllers/SinowealthController/SinowealthControllerDetect.cpp)
- [F75 device table / overlay](https://github.com/CalcProgrammer1/OpenRGB/blob/8e16de27858cf2be6af54a33ce003df74cb9fd3e/Controllers/SinowealthController/SinowealthKeyboard10cController/SinowealthKeyboard10cDevices.cpp)
- [Direct sender](https://github.com/CalcProgrammer1/OpenRGB/blob/8e16de27858cf2be6af54a33ce003df74cb9fd3e/Controllers/SinowealthController/SinowealthKeyboard10cController/SinowealthKeyboard10cController.cpp)
- [RGB controller](https://github.com/CalcProgrammer1/OpenRGB/blob/8e16de27858cf2be6af54a33ce003df74cb9fd3e/Controllers/SinowealthController/SinowealthKeyboard10cController/RGBController_SinowealthKeyboard10c.cpp)
- [Layout manager](https://github.com/CalcProgrammer1/OpenRGB/blob/8e16de27858cf2be6af54a33ce003df74cb9fd3e/KeyboardLayoutManager/KeyboardLayoutManager.cpp)
- [Inherited shutdown](https://github.com/CalcProgrammer1/OpenRGB/blob/8e16de27858cf2be6af54a33ce003df74cb9fd3e/RGBController/RGBController.cpp#L1973)

## Detection trace — reference only, not adopted

Detector registration uses VID258A/PID010C, interface1, usage pageFF00, usage1. DetectSinowealthKeyboard10c prepares a zero-initialized520-byte command beginning `06 82 01 00 01 00 06 00`, sends a feature report and reads a feature report through DetectUsages, then takes response byte13 as model ID. The table maps CDhex to AULA F75.

DetectUsages expects at least three unclaimed matching usage-page paths. It probes matching paths and accepts send/get returns greater than−1, without requiring full response length or validating the response header before the model lookup. Its path grouping/probing and process-local claims are not Studio's exact-collection safety contract. Do not copy its detector or treat modelCD as independently observed on the owner's keyboard: no model query was performed here. Preserve Studio's complete unique MI_01/COL06 enumeration, attributes/caps/reportID checks, official-app exclusion and native mutex for any future hardware step.

## Direct report contract

SetLEDsDirect constructs a zeroed520-byte feature report:

| Report offset | Value |
| --- | --- |
| 0..7 | `06 08 00 00 01 00 7A 01` |
| 8+3*i | red for sparse hardware slot i |
| 9+3*i | green |
| 10+3*i | blue |

Header length is LE16 017Ahex =378 bytes =126 RGB triples. The sender writes the supplied colors, calls hid_send_feature_report with all520bytes, then sleeps1ms. It does not inspect the send return or perform direct-color readback. No palette marker, config write or checksum is added by this path.

F75 SetupZones uses the ANSI_QWERTY layout plus the F75 overlay and sizes its LED/color vector to maximum mapped index+1, NOT physical key count. The result is90slots (0..89), of which80 are actual keys. Consequently report278..385 (remaining declared payload) and386..519 (remaining buffer) remain zero. Studio's offline encoder additionally refuses nonblack values in unassigned F75 slots; this restriction is ours, not a claim upstream validates them.

## Mapping derivation

Layout manager assembles main+function zones, applies default_values in row/column order, applies ANSI removal of ISO-only keys, then F75 edits add navigation/arrows and remove RAlt/Menu. Zero is a valid LED index (Escape); layout holes are FFFFFFFFhex. Do not compact indices.

Physical row order (gaps omitted); each entry is key:index:

```text
Esc:0 F1:12 F2:18 F3:24 F4:30 F5:36 F6:42 F7:48 F8:54 F9:60 F10:66 F11:72 F12:78
Backquote:1 1:7 2:13 3:19 4:25 5:31 6:37 7:43 8:49 9:55 0:61 Minus:67 Equal:73 Backspace:79 Delete:85
Tab:2 Q:8 W:14 E:20 R:26 T:32 Y:38 U:44 I:50 O:56 P:62 [:68 ]:74 Backslash:80 PgUp:86
Caps:3 A:9 S:15 D:21 F:27 G:33 H:39 J:45 K:51 L:57 Semicolon:63 Quote:69 Enter:81 PgDn:87
LShift:4 Z:10 X:16 C:22 V:28 B:34 N:40 M:46 Comma:52 Period:58 Slash:64 RShift:70 Up:82 End:88
LCtrl:5 LWin:11 LAlt:17 Space:35 Fn:53 RCtrl:59 Left:77 Down:83 Right:89
```

Unassigned:6,23,29,41,47,65,71,75,76,84. This is an upstream-derived candidate mapping, not live-verified. Physical Backslash naming is independent of OS English-UK output. Exported row/column numbers enumerate physical keys in each row, not OpenRGB matrix spacing or screen coordinates. Knob rotation/press is not an RGB key entry here.

## Lifecycle and exit

Constructor starts Direct mode and a keepalive thread. Thread checks every500ms; while Direct and more than1second since last update it schedules another update. Actual interval depends on scheduling; this is not a measured firmware timeout. Source comment says updates prevent reverting out of direct mode.

DeviceUpdateMode is empty. Off selection has no explicit off/restore report in these methods. Destructor calls inherited Shutdown (joins device update thread, locks access/signaling, waits outstanding signal calls), then stops/joins keepalive, closes HID and unclaims the selected device path. Neither that inherited function nor these device methods send an explicit onboard-effect restore. Thus timeout behavior, lighting on disconnect/process crash, and exact previous-effect restoration remain unverified; do not promise them or invent an exit packet.

## Offline implementation and tests

`app/src/protocol/f75-direct.ts` is an isolated pure TypeScript module, not imported by production application code. It exposes immutable physical mapping; conversion from exactly80 semantic key colors to90fresh sparse slots; encoding of exactly90validated RGB slots into a new520-byte buffer. RGB values are integer0..255. Brightness is Studio-local finite0..100percent, including fractional values, scaled linearly and rounded to nearest byte. No onboard brightness/config changes occur. This brightness policy is ours, not copied from OpenRGB.

`app/tests/f75-direct.test.mjs` checks pinned source header/model evidence, full mapping, Escape/Fn/Ctrl, every isolated LED across the complete report, zero gaps/tail, new-buffer and input preservation, complete semantic mapping, scaling/rounding and invalid inputs. Offline byte correctness is not firmware compatibility or visual smoothness evidence.

## Licensing boundary

Referenced OpenRGB files identify GPL-2.0-or-later and retain upstream authorship notices in the research archive. No upstream C++ implementation is compiled, bundled or imported by Studio. The TypeScript encoder is newly written from protocol observations, with provenance documented here; no OpenRGB runtime/library is added. This is not a legal determination that source-derived mapping/protocol work is exempt from licensing obligations. The archived source remains third-party GPL material; attribution alone is not a substitute for required license/source terms. Before redistribution or copying/adapting further implementation, resolve project licensing and GPL obligations; do not silently relicense upstream material or claim that this establishes clean-room independence.

## Next gate — not executed

Review an explicit bounded owner-coordinated single dim uniform-color frame experiment with existing exact-device guards, no background stream, no automatic retries or restoration. Establish direct timeout/reversion and then isolated-key mapping physically before implementing Start/Stop or animations. Any direct mode's lifecycle/concurrency design must explicitly account for the project's existing fresh-config/write/readback rule rather than bypass it silently; direct frames do not currently have a demonstrated readback equivalent.

## Validation result

43 Node tests passed, including six new direct-codec tests (the isolated-frame test exercises all80physical LEDs). Typecheck, lint, repository format check and production build passed. An initial narrow inferred Set type caused a TypeScript check failure; explicitly typing it Set<number> fixed that and all checks above were rerun. No dependencies or existing runtime source were changed. Electron smoke/native HID helper compilation were not rerun: this module has no runtime integration and no native code changed. No hardware operations occurred.
