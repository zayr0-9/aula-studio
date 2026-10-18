# HID transport: static evidence, not an F75 command specification

## Scope and provenance

This note interprets previously collected static analysis only. No application/device execution, HID requests, settings changes, reset, or firmware operation was performed for this workstream. **No command below is classified as safe. In particular, an application-level read/query may send a SetFeature request first.**

Target: `C:/Program Files (x86)/AULA/F75/OemDrv.exe`, native x86 PE, SHA-256 `1dfe4803efdbe14f66680f970a6d6f26108342fd49754234fa448dd0ebae44a7`. Provider: Ghidra 12.1.4 via REA. Addresses are Ghidra default-space virtual addresses, not file offsets. Evidence comes from shared captures `aulaTaskContext`, `aulaInitial`, `aulaHid`, `aulaDecompile`, and `aulaPseudo`, plus already collected configuration text.

`CDevG5KB::AccessData` and `CDevG5MS::AccessData` are **original diagnostic-string labels**, not recovered source-level function symbols. Functions are synthetic Ghidra names (`FUN_004993c0`, `FUN_0049dd30`, etc.). KB/MS suggest keyboard/mouse families; they do not establish runtime backend selection for this F75. PDB load state is unknown; original types and calling conventions are not established.

## Critical backend-selection warning

**The generic mouse-labelled backend at `0x49dd30` may not apply to the F75. Do not transplant its checksum, byte offsets, report ID, retries, or command constants into an F75 implementation.** The installed executable contains multiple HID backends. Both highlighted routines call the same HID APIs but build different headers and implement different response/error paths.

Collected `Dev/kb/fr/KB.ini` (UTF-16LE BOM) provides useful *selection clues*, not device observations:

- Line 2: `Fw=24` (decimal 24 equals `0x18`).
- Lines 3–6: configured wired `VID=0x258a`, `PID=0x010C`; wireless `VID_Wireless=0x3554`, `PID_Wireless=0xfa09`.
- Line 8: `CRC=1`; line 9: `MatrixLen=128`; lines 10–11 identify AULA F75 / F75.
- `Cfg.ini:4` says `Title=AULA F75`; `Cfg.ini:6` says `Appdir=BYCOMBO4`.

The KB-labelled routine tests a nested object field against `0x18`, which numerically matches `Fw=24`. This is a plausible lead for an F75-specific path, **not proof that the field is populated by `Fw` or that this routine is selected**. `CRC=1` also does not prove use of the MS checksum routine; it could select another keyboard variant. Constructor/factory dispatch, configuration-field assignment, virtual-table targets, actual HID interface/report descriptors, firmware revision and wired/wireless routing remain unverified. Configuration IDs must not be presented as observed connected-device IDs.

## Direct API evidence

Evidence E1 identifies `HidD_SetFeature` thunk `0x5ca028`, `HidD_GetFeature` thunk `0x5ca02e`, `HidD_GetAttributes` thunk `0x5c9ffe`, and `HidP_GetCaps` thunk `0x5ca010`. E3/E4 independently list the wrappers and both highlighted transports among SetFeature/GetFeature callers. There are many other callers: this is not an exhaustive backend specification. The imports also include ReadFile/WriteFile, but imports alone do not prove their use for these transports.

## Thin wrappers: `0x4955a0` / `0x495630` (E6)

| Property | `FUN_004955a0` | `FUN_00495630` |
|---|---|---|
| Diagnostic | `SendCommand Err=%d` | `GetCommand Err=%d` |
| Buffer preparation | Byte 0 set from `in_CL`; source copied at +1 | Byte 0 set from `in_CL` |
| API | SetFeature(handle, buffer, payload length + 1) | GetFeature(handle, buffer, payload length + 1) |
| Success | Return 1 | Copy returned bytes at +1 to destination, return 1 |
| Failure | Up to three attempts; Sleep(200) after each failed attempt; log GetLastError and return 0 | Same retry/sleep/error pattern |

The leading byte is consistent with Windows HID's report-ID slot; its actual value is caller supplied and unknown here. These wrappers do **not** themselves show the 8-byte header or fixed `0x208` transfer used by the chunked routines. Null source/destination is rejected, but scratch-buffer initialization happens before that check. Capacity validation is not visible. `in_CL`, `in_EDX`, `unaff_ESI`, and `unaff_EBX` show that the decompiler has not recovered the complete ABI; the printed parameter lists are not usable function prototypes. Failure sleeps include the last failed attempt in the displayed control flow. GetLastError is obtained after sleeping, not immediately after the failed API.

## Inferred feature-buffer layouts (E6)

Both chunked routines pass **`0x208` = 520 bytes** to the HID API, with an inferred 8-byte header and up to `0x200` = 512 payload bytes. Offsets below refer to the API buffer, **including byte 0**, not necessarily raw USB on-wire bytes. These are observed assignments interpreted as field roles, not a validated protocol schema.

| Offset | KB-labelled `0x4993c0` | MS-labelled `0x49dd30` |
|---|---|---|
| 0 | If nested field `*(*(param_1+0x10)+0x18)` equals `0x18`, expression yields `0x106`, truncated to byte `0x06`; otherwise `0x09` | `0x09` |
| 1 | `param_4`: unknown selector/command role | Additive byte checksum over offsets 2 through 519, modulo 256 |
| 2 | `param_5`: unknown selector/command role | Low byte of `param_4`; diagnostic names it command ID; compared to reply byte 2 |
| 3 | Zero | `param_5`: unknown selector/subcommand role |
| 4 | Total chunk count, truncated to byte | Same; forced to 1 for nonpositive signed length |
| 5 | Zero-based chunk index, truncated to byte | Same |
| 6–7 | Current payload length, low byte then high byte | Same |
| 8–519 | Zero-filled payload area; source copied for operation 1 | Same |

For positive lengths, count arithmetic corresponds to ceiling(length/512); the final chunk can be shorter but the API transfer stays 520 bytes. Byte-sized count/index impose unresolved large-transfer limits; there is no demonstrated overflow policy. The KB path does not show the MS additive-checksum calculation. The MS diagnostic calls some failures “CRC”, but the visible outgoing byte computation is **addition**, not a demonstrated polynomial CRC. No complete response checksum validation is established here.

## KB-labelled `FUN_004993c0` / `0x4993c0` (E6, E8)

- Rejects a zero handle or signed length below 1; accepts operations 1 and 2 only.
- For each chunk, invokes `FUN_004051f0(param_7)`, clears the full buffer and builds the KB header. The helper looks timing-related from placement/arguments but its implementation was not inspected; milliseconds are not established for that helper.
- Operation 1 copies caller bytes to payload. Operation 2 leaves request payload zeroed. Both call **SetFeature first**.
- SetFeature loop starts at 3, breaks on success, otherwise decrements and calls `FUN_004051f0(0x46)` before retrying. The displayed post-loop test is `iVar4 < 0`; three failures appear to leave it at 0. Thus the pseudocode does **not** establish reliable exhaustion/error handling. Do not silently repair this to `<= 0` or claim a source-code bug without instruction-level verification.
- Operation 2 then invokes the timing helper again, makes one GetFeature call using the **same buffer**, logs an API failure, and still copies payload bytes to the caller in the displayed pseudocode. A failed read therefore does not establish valid returned data. No reply command-ID or checksum check is shown in this routine.
- The decompiled return type is void; no dependable boolean-success contract is established.

## MS-labelled `FUN_0049dd30` / `0x49dd30` (E6, E7)

- Rejects zero handle; accepts operations 1 and 2. Unlike KB, its do/while structure permits a zero-length request: count 1, payload length 0. Signed/nonpositive-length behavior is a decompiler observation, not a recommended input domain.
- Builds the MS header and additive checksum, then starts a three-attempt SetFeature loop. On API failure it logs error and command ID. Errors `0x48f` or `6` branch directly to exit; other failures log a retry.
- On SetFeature success, waits with `WaitForSingleObject(*(HANDLE *)(param_1+0x294), 0x1e)` (30 ms). If the wait returns 0 **and** object byte `param_1+0x29f` equals the low command byte, it logs `AccessData CRC err ... retry now`. Otherwise it proceeds. This is not an ordinary demonstrated positive-acknowledgement test; the event producer and field writer have not been traced. A nonzero wait result is not necessarily a valid response (timeout and failure semantics are unresolved).
- For operation 2, it invokes `FUN_004051f0(param_7)`, zeroes a **separate** 520-byte reply area, seeds reply byte 0 with `0x09`, and calls GetFeature. API failure exits. It compares outgoing byte 2 with reply byte 2; mismatch logs the string at `0x624dd8` and exits. Only after that comparison does it copy reply payload to the caller. No validation of reply count, chunk index, length or checksum is shown here.
- Retry tails call `Sleep(0x3c)` (60 ms), including the final unsuccessful tail in the displayed flow. The outer continuation tests `-1 < iVar2`; zero after three failures can still satisfy this test. Exhaustion must not be portrayed as a confirmed clean abort.
- Ghidra splits adjacent stack storage into `local_414[522]`, `local_20a`, and `local_204[512]`, while accesses initialize a reply region at `local_414+0x208`. Interpreting `local_20a` as reply byte 2 and `local_204` as reply payload follows stack-offset relationships, not a recovered original C array definition. Apparent out-of-bounds C expressions are a reason to inspect assembly, not standalone proof of original memory corruption.

Nearby `0x49e090` (E6) repeats the MS-style query flow using command byte `0x41`, selector from its argument, and helper argument `0x14`, unless it delegates via an object at `in_ECX+0x23c` through vtable offset `+0x60`. This supports the existence of specialized query/delegation paths; **it neither identifies the meaning of command `0x41` nor makes it an F75 command**.

## Evidence register (full IDs)

- **E1 — import/procedure search:** `ev_190c530f828ad3615503bcd6ccb52b2b1320ddcdf092bf62b62dd7109d1d8cea`; HID thunk addresses listed above.
- **E2 — diagnostic/string search:** `ev_103073a415b3873fdf3473ef55d749c8e70d9434eed51944a46be121022cc67e`; command-mismatch string `0x624dd8`, GetFeature error `0x624e68`, SetFeature error `0x624ec0`, retry `0x624f18`; configuration path strings `0x60e7d4` and `0x60fe5c`.
- **E3 — callers of `0x5ca028`:** `ev_ce428a7d0e6e9f33d0f25a8b379957dfe79809d51b7c4d6a42b38ec27adb8de0`; includes `0x4955a0`, `0x4993c0`, `0x49dd30`, `0x49e090`.
- **E4 — callers of `0x5ca02e`:** `ev_3b077c3f0a69790e3ae10b23b33b4716fca308f79c95da6cce49ba73bd15ee1d`; includes `0x495630`, `0x4993c0`, `0x49dd30`, `0x49e090`.
- **E5 — mismatch-string xrefs at `0x624dd8`:** `ev_f2f5a9e165b1637f2e677ff57d10f4ff7edd1f20f79465f4f1d713b1eebe30e4`; references include `0x49dff9` (inside `0x49dd30`) and `0x49e309` (inside `0x49e090`), plus `0x49e5f9`, `0x49e909`, `0x49ec04`, `0x49eedf`, `0x49f19c`, `0x49f427`, `0x49f6e7`.
- **E6 — batch pseudocode:** `ev_1e76ad8ec8e70dc647db0450bfb3d9c53d66d9f2fc2161afa39d04ea01b38dd7`; analyzed entries include `0x4955a0`, `0x495630`, `0x4993c0`, `0x49dd30`, `0x49e090`. This is the source of layout/control-flow interpretations, not a runtime trace.
- **E7 — callers of `0x49dd30`:** `ev_ebe69dee63ad5b3c75b23af9cf5eca159685f8aa5c651b354043982b91937911`.
- **E8 — callers of `0x4993c0`:** `ev_6ab1a84836adff57ee7fcfa7364319f31616695f842a82491338e8a8c064f2c4`.

Configuration text is separately captured in `aulaConfigTextEvidence` / `aulaConfigFindings`; no REA evidence ID was supplied for those file reads. Line references above preserve provenance without inventing IDs.

## Limitations and next static questions

No HID descriptors, actual report length/capabilities, runtime traces, caller ABI reconstruction, instruction-level verification of suspicious loop conditions, helper-body analysis, event producer, or confirmed backend mapping were obtained in this workstream. Register-derived pointers and synthetic signatures make caller roles uncertain. The observed 520-byte API buffer is not proof that a connected F75 interface accepts it.

Before implementing communication, statically trace configuration `Fw`/`CRC` assignments into factory/vtable selection, distinguish wired/wireless delegation, inspect caller argument/register setup, verify buffer offsets and exhaustion branches against instructions, and identify event/response parsing. Retain command meanings as unknown until stronger evidence exists. Neither query naming, official-app provenance, nor successful API return establishes lack of device side effects.

## Subsequent code linkage and durable evidence

The parent analysis additionally inspected G5KB finder `0x498fb0`: its family-`0x18` path filters configured VID/PID plus derived UsagePage `0xff00`, Usage 1 and feature-report length 520. Installed `Fw=24` and observed candidate VID/PID strengthen this lead, but backend factory dispatch and the live report descriptor remain unverified. See [application-architecture.md](application-architecture.md) for the exact claim boundaries and code map. Complete selected pseudocode and REA Evidence IDs/profile metadata are preserved in [rea-static-evidence.json](evidence/rea-static-evidence.json), not only memory-only REPL state.
