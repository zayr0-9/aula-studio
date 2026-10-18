# Corrected app palette-read investigation

Static-only Ghidra12.1.4 via existing REA runner. Target native x86 OemDrv.exe SHA2567c41a8af17b8d1577ac5660b8f0ce1be61da50fd33a5238158c62e6097292783. No app execution, HID handles, captures or custom device requests performed. Evidence: [corrected-palette-static.json](evidence/corrected-palette-static.json).

## Verified code facts

- GetLedRgbTab diagnostic string0x60f678 references function0x48c120.
- Function0x48c120 creates a zeroed520-byte report, command0x8A, secondary0/reserved0, chunk count/index and LE16 chunk length. Backend field0x18 chooses reportID6. It sends HidD_SetFeature, waits20ms, calls HidD_GetFeature and copies payload to caller.
- Query length is caller-provided and chunk size capped512. For a512-byte request, derived header is `06 8A 00 00 01 00 00 02` plus512 zero bytes. This is source-derived, NOT a captured/live-verified request.
- Function delegates through object+0x23C when populated; direct branch applicability to this live device is not fully traced. The reportID/backend and observed feature format are consistent with earlier verified config operations, not proof of firmware query support.
- Only recovered xref to0x48c120 is data address0x610010 (consistent with virtual table storage); direct caller query returned empty. Indirect/virtual invocation is not ruled out by empty direct callers.
- Code has weak failure handling: retry counter tested `<0` after exhaustion to0 and payload copied even after GetFeature failure. Do not reuse wrapper success semantics.

## Decision

A palette read implementation exists in the corrected binary. This disproves the claim that the executable has no read routine, but does not establish that normal startup uses it or that keyboard firmware implements it successfully. Existing startup capture saw only82/1 initialization queries, and owner observed stale local UI.

Do not add color/palette setters until separately coordinated validation establishes fresh palette reads. Recommended next operation: owner closes official app and Studio, then authorize one guarded512-byte8A request/GetFeature pair under existing unique-interface/caps/mutex/process guards and bounded child timeout; no automatic retries, no0A palette setter, no04 configuration setter. Capture control transfers to attest actual response length/header. Validate echoed header, full512payload and5A/A5 marker if present, and correlate Fixed_on RGB against a known just-applied official color while noting concurrent state/host-profile uncertainty. An all-zero response, API success or matching stale fixture alone is not proof of usable fresh palette retrieval. Query remains a SetFeature-before-GetFeature operation; not literal USB read-only, and firmware side effects cannot be excluded by the function name.

If query unsupported or unreliable, discuss Studio-owned full palette and explicit overwrite disclosure. No silent captured-palette replay. Current production color IPC remains absent and app source unchanged.
