# Live HID metadata (no report queries)

## Scope and method

Explicitly approved metadata-only inspection of present HID interfaces matching **VID 258A / PID 010C**. Capture time: **2026-10-16T00:57:14.8530402Z**. Evidence: [`evidence/live-hid-metadata.json`](evidence/live-hid-metadata.json). Reproducible script: [`../scripts/inspect-live-hid-metadata.ps1`](../scripts/inspect-live-hid-metadata.ps1).

The entire script and its native declarations/control flow were read and inspected before execution. `Add-Type` compiled only the embedded metadata helper. SetupAPI enumerates present HID interfaces; the exact VID/PID path-token filter runs **before every CreateFile call**. Matching handles use desired access **0**, sharing **READ | WRITE**, disposition **OPEN_EXISTING**. Only `HidD_GetPreparsedData`, `HidP_GetCaps`, `HidP_GetButtonCaps`, and `HidP_GetValueCaps` inspect HID metadata; preparsed data, interface-detail allocations, interface lists, and device handles have finally/using cleanup.

No `HidD_GetFeature`, `HidD_SetFeature`, `ReadFile`, `WriteFile`, output-report transfer, direct `DeviceIoControl`, or serial-string API is declared or called. No report payloads, settings, macros, or raw hardware descriptors were read. No driver/system modification, elevation, official-app interaction, or reconnect occurred. Enumeration is capped at 512 interfaces, detail allocations at 65536 bytes, and the invocation had a 45-second tool timeout. The invocation succeeded with empty stderr.

### Native layout verification

Managed sizes/offsets were checked before opening any device, against Windows native HID/SetupAPI ABI definitions:

- x64 pointer size 8; `SP_DEVICE_INTERFACE_DATA` size 32 (x86 expected 28).
- Unicode interface-detail `cbSize` 8 on x64 (6 on x86), with path at byte offset 4.
- `HIDP_CAPS` size 64; feature-button-cap count at offset 58.
- `HIDP_BUTTON_CAPS` and `HIDP_VALUE_CAPS` size 72; usage union at offset 56; report ID byte at 2; range flag at 12.
- Value-cap report count at offset 20; explicit native padding and union offsets retained.
- `HidD_*` BOOLEAN returns marshalled as one byte; SetupAPI BOOL returns as four-byte BOOL. HIDP report-type enum marshalled as a native 32-bit integer, counts as USHORT. HIDP success checked against `0x00110000`.

These size/offset assertions passed in the running x64 process. This is ABI consistency checking plus successful native parsing, not an independent raw-descriptor comparison.

## Observations

All eight matching interfaces opened without a reported error. Global and per-interface error arrays are empty. The table abbreviates redacted paths to their nonunique MI/COL suffixes; full evidence paths retain only VID/PID/MI/COL and replace the instance component with `[REDACTED]`.

Lengths are Windows HIDP report byte lengths, including the report-ID byte convention (ID 0 denotes an unnumbered report). IDs are derived solely from successful button/value cap results, never guessed or probed. `—` means no IDs exposed by those caps for that report type.

| Redacted suffix | Top-level usage page / usage | Input bytes | Output bytes | Feature bytes | Input IDs | Output IDs | Feature IDs |
|---|---|---:|---:|---:|---|---|---|
| MI_00 | 0x0001 / 0x0006 | 9 | 2 | 0 | 0 | 0 | — |
| MI_01 / COL01 | 0x0001 / 0x0080 | 2 | 0 | 0 | 1 | — | — |
| MI_01 / COL02 | 0x000C / 0x0001 | 3 | 0 | 0 | 2 | — | — |
| MI_01 / COL03 | 0xFF00 / 0x0001 | 4 | 0 | 0 | 3 | — | — |
| MI_01 / COL04 | 0x0001 / 0x0006 | 16 | 0 | 0 | 4 | — | — |
| MI_01 / COL05 | 0xFF00 / 0x0001 | 0 | 0 | 6 | — | — | 5 |
| MI_01 / COL06 | 0xFF00 / 0x0001 | 8 | 0 | 520 | 6 | — | 6 |
| MI_01 / COL07 | 0x0001 / 0x0002 | 8 | 0 | 0 | 7 | — | — |

Vendor collection details directly exposed by caps:

- COL03: one input value cap, ID 3, page FF00, usage 0x002F, bit size 8, report count 3; no feature caps.
- COL05: one feature value cap, ID 5, page FF00, usage range 1–2, bit size 8, report count 1.
- COL06: one input button cap, ID 6, page FF00, usage 2; one feature value cap, ID 6, page FF00, usage range 1–2, bit size 8, report count 1.

The cap-level report counts are preserved as returned, not expanded to infer a complete payload layout. HIDP maximum byte lengths are the authoritative observations here for collection-level buffer sizing; counts alone do not explain all padding or descriptor layout.

## Inferences and limitations

The three FF00/1 top-level collections and COL06 feature length **520 / report ID 6** corroborate the existing offline expectation for the vendor interface. This is metadata compatibility evidence, **not** proof that any command, query, write, or setting operation is safe. It does not identify firmware, validate application protocol semantics, confirm per-ID payload lengths, or establish persistence/recovery behavior.

No device report query was attempted, and no command sequence is recommended by this inspection. Empty ID lists are not a claim that arbitrary other report IDs can safely be tried. Failure reporting preserves operation names and numeric Win32/NTSTATUS codes; none occurred in this capture. No escalation or alternate-access retry was needed.
