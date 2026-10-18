# Lighting and device-settings contracts — static recovery

## Scope

Standard AULA F75 as confirmed by owner; no HE/Pro display features assumed. No target launch, HID handle, keyboard report, setting change or reset was performed. This document is an encoder-design reference, not authorization to send packets.

Primary new Evidence: `ev_863a44ff37853356319607a8dc92df56bd5d072c8bad85fc598697a60385a8b5` (selected functions), plus prior loader/Apply batch `ev_31a2ec1c4fd73642f997f64de7bf1ac9eeb334bc616074be43e90b0a2de986ca`. Complete source/limitations: [lighting-phase2.json](evidence/lighting-phase2.json). Calling conventions and register-held arguments remain partly synthetic; all offsets below are **payload configuration offsets**, not HID report offsets.

## Which configuration layout applies?

Loader `0x411830` reads `SubFw` default 0 into profile offset `+0x2d8f`. Apply `0x49c020` selects `0x49b910` only when this byte equals 1; otherwise selects **`0x49bbf0`**. The installed KB.ini has no SubFw override. Therefore the ordinary `0x49bbf0` layout is the statically selected configuration-fill branch for this installed profile, assuming its established loader/Apply path. The alternative `FillCfg_LowDaly` layout must not be mixed into the ordinary encoder.

Both fill routines modify an existing 128-byte configuration buffer. Apply attempts to obtain the current configuration first, checks a `5A A5` trailer, then updates selected fields and sends the full 128-byte buffer through virtual slot `+0x6c`. This is read-modify-write, not an isolated brightness command; preserving unknown fields is essential. No flash durability or rollback guarantee follows from this pattern.

## Ordinary configuration layout (`0x49bbf0`)

| Payload offset | Observed assignment / role | Qualification |
|---|---|---|
| `0x03` | Debounce value from host model `+0x3340` | Written only if profile ShowDebounce field `+0x2d40` nonzero; units/allowed range not derived here |
| `0x09` | Boolean selected-effect index equals profile game/custom index | Custom/game-effect indicator, derived from profile comparison |
| `0x0a` | Selected effect's hardware selector | From 40-byte profile effect descriptor, not necessarily UI row number |
| `0x0b` | Profile base byte plus host model `+0x2440` | Semantic name not established; do not guess |
| `0x16` | Tap-related byte: zero when host mode `+0x3334` nonzero, else low byte `+0x3338` | Diagnostic labeling corroborated by alternative layout; exact meaning/range unresolved |
| `0x17` | Boolean host byte `+0x3342` equals zero | Only if profile `+0x2d58` equals 1; role unresolved |
| `0x18` | Sleep hardware-table value, or zero | Zero if host short `+0x333c` nonzero; otherwise table indexed by host `+0x333e` |
| `0x1a` | Wheel mode byte determined from configured key changes | Only if profile wheel-mode field `+0x2d9c` nonzero; not every knob capability proven |
| `0x38–0x39` | `FF FF` | Written in lighting branch; purpose unresolved |
| `0x3a–0x5f` | 19 effect pairs: brightness byte, packed speed/direction byte | Only if Apply lighting flag `0x02` set |
| `0x7e–0x7f` | `5A A5` when profile CRC flag nonzero | **Fixed trailer, not a demonstrated transport checksum** |

For effect entry i in the 19-entry loop, host brightness index maps through the configured hardware brightness table; speed index maps through the hardware speed table. The second byte is `(speedHW << 4) | (direction & 0x0f)`. Direction becomes zero for entries whose host direction-enabled byte is zero; otherwise it comes from profile `+0x2fa1`. This is a derived bit packing, not proof that all nibbles/ranges are valid for every effect.

The routine changes effect fields only with Apply mask `0x02`, but still updates several device settings and optional profile-specific bytes outside that branch. Consequently an apparent lighting apply can carry more than brightness. A nonzero device object state plus profile `CfgVal` may overwrite another caller-selected byte. Full buffer preservation is necessary but not sufficient for safe changes.

## UI-to-hardware parameter tables

The loader reads paired SleepUI/SleepHW, Speed/SpeedHW and Light/LightHW arrays and warns when counts disagree. This establishes translation tables rather than a universal unit conversion.

Installed F75 profile:

- Brightness UI/HW: `0..9` / `0..9`.
- Speed UI/HW: `0..4` / `0..4`.
- Sleep UI: `60,90,120,180,240,300,600,900,1200`.
- Sleep HW: `2,3,4,6,8,10,20,30,40`.
- Sleep ratio is 30:1 for these entries; UI labels suggest seconds, but firmware timer units are not independently validated.
- 20 `LedOptN` tuples are installed, while the ordinary config-fill loop writes 19 effect pairs. The distinction between ordinary effects, OFF/custom rows and actual row mapping must remain explicit.

`LedOpt%d` loader stores 40-byte descriptors; it reorders leading tuple fields and sets an enabled byte, then copies optional color-related values. Do not copy the INI tuple verbatim into a feature report. The selected UI index is resolved through this descriptor table to a hardware selector. Per-effect capabilities must be respected instead of displaying every control for every effect.

## Per-key RGB data and colors

Apply includes separate RGB-table upload through virtual slot `+0x7c`; special/game paths also use slot `+0x74`. It constructs buffers of different sizes in family-dependent branches, including `0x1a4` and `0x200`, with marker assignments visible in some branches. This is separate from the 128-byte ordinary configuration body. Exact per-key RGB ordering, physical-key map, custom/game storage and command applicability require additional serializer recovery; no generic linear `82 × RGB` assumption is justified.

The ordinary fill routine's optional side-LED branch assigns different offsets and color enumerations for family `0x1a` versus other families. The installed profile does not establish a supported side-light interface, and the owner excludes display Pro hardware. These generic paths are documented only to prevent accidentally using them.

## Read/query leads

| Function | Diagnostic / selector | Notes |
|---|---|---|
| `0x499af0` | GetLED, primary selector `0x84`, secondary 0 | Sets a request using SetFeature, then GetFeature; caller chooses payload length; Apply requests 128 bytes |
| `0x499d50` | GetGame, primary `0x86`, caller secondary selector | Chunked query, backend delegation possible |
| `0x499f60` | GetRealData, primary `0x88`, secondary 0 | Chunked query; meaning/applicability not established |
| `0x49a190` | GetLedRgbTab, primary `0x8a`, secondary 0 | Same query/send-first caveat; backend delegation through slot `+0x80` |

These recovered getters share the 520-byte API-buffer path and have questionable decompiled exhaustion/error propagation. Some copy payload after logging GetFeature failure. Response data must never be trusted merely because a wrapper returned; correlate transport status, header/length and expected validity markers in a future implementation.

## Alternative low-delay layout (not selected by default SubFw=0)

`0x49b910` diagnostics explicitly name configuration offset 2 (Debounce), offset 8 (Tap), and offset 9 (Sleep). Selected effect appears at `0x21`, selected brightness/packed speed at `0x22/0x23`, and per-effect entries are indexed by hardware selector rather than simply sequential UI order. Its fields do **not** match the ordinary layout. Preserve as an alternate-family clue; do not use these offsets for the installed default branch.

## Hazards and unresolved gates

- `0x49a390` is labelled ResetDevice and sends primary selector `0x11`, operation 1, length 1 or delegates to virtual reset slot. It is a blocked hazard, not a feature to test.
- `0x49a3e0` is SetScreenParam selector `0x0b`; screen/GIF paths are generic and excluded from standard-F75 support absent evidence.
- Fixed `5A A5` validity markers do not prove complete correctness or cryptographic integrity.
- No command has been issued; live response format, exact effect mapping, RGB payload, readback consistency and persistence durability remain unverified.
- First cold lighting analysis and one subsequent request-set attempt exceeded shell 180-second deadlines during concurrent Ghidra imports. The successful batch and prior Evidence support the claims here; failed attempts are not treated as evidence.

## Readiness implications

An Electron model should separate selected effect, per-effect options, custom RGB, device settings, and opaque preserved configuration. A future encoder should require a known layout/profile and reject invalid indices/unknown backend. Use the recovered setter/vtable mapping below and in the key/macro evidence; supported effect rows, still-unresolved written fields and active transport applicability remain gates before any separately authorized hardware work. Develop fixture tests and a recovery procedure separately. No live testing is part of this work.

## Setter mapping and timing follow-up

Additional successful static batch `ev_e2281c21cbe93077deb8b42e685fdda64a337a822edcbc402abe1974ed0af25a` establishes local wrappers: `0x499aa0` SetLED → operation 1, primary `04`, secondary 0; `0x499cf0` SetGame → primary `06`, caller secondary; `0x49a140` SetLedRgbTab → primary `0A`, secondary 0. All use `0x4993c0` unless object `+0x23c` delegates. Getter RGB is `0x49a190` primary `8A`. Payload pointers may be register-held and decompiler prototypes remain incomplete. Numeric local vtable mapping and live selection still require the backend evidence; selector symmetry is not proof of equivalent safety.

Helper `0x4051f0` is now inspected: it busy-waits using QueryPerformanceCounter/Frequency until elapsed seconds ×1000 reaches the integer argument. Thus its arguments are milliseconds in this implementation: typical spacing 20ms and failed-send spacing 70ms. This resolves the earlier timing-helper uncertainty; it does not establish required firmware timing or justify blocking Electron's UI thread. A future service should schedule asynchronously and serialize transactions.
