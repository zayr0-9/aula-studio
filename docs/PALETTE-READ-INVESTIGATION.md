# Corrected-driver palette read — offline investigation

> Superseded status: workspace already contains live query/wire and green/blue/red freshness evidence plus production color implementation from another workstream. See FIXED-COLOR-IMPLEMENTATION.md and evidence/palette-query-wire-verification.json. The candidate codec below remains an isolated offline artifact, not the production parser. Its lack of marker validation means it must not be promoted into transport. Current observed marker is payload506/507, not510/511. This report's proposed live query is no longer needed merely to establish basic support. Latest inspection found OemDrv running, so no new query was sent. Existing color-service tests (3) and native color offline encoder tests passed.

## Verified static evidence

Existing artifact `evidence/corrected-palette-static.json` records Ghidra analysis of corrected OemDrv.exe SHA2567c41a8af17b8d1577ac5660b8f0ce1be61da50fd33a5238158c62e6097292783. This investigation inspected those recorded decompilations, not a newly executed binary or fresh Ghidra run.

- FUN_0048c120 (resolved from address48c2fb) logs GetLedRgbTab failed and constructs command8A.
- For backend selector0x18 (Fw24), reportID expression evaluates6. Other backend branch yields9; do not generalize it.
- Length split into512-byte chunks; for a requested512-byte palette, chunk count1/index0 and length little-endian0002 produce candidate header `06 8A 00 00 01 00 00 02`, zero-filled request payload, total520bytes.
- Calls HidD_SetFeature then waits20ms and calls HidD_GetFeature, copying payload at byte8. Thus this is semantically a query but includes a USB OUT request, not zero device interaction.
- Function has vtable data reference610010. No direct callers were recovered; that does not establish absence of virtual calls or runtime use.
- Native routine retries sends, logs read failure then copies data anyway, and does not demonstrate response-header/actual-length checks. We must not copy those unsafe error semantics.
- Startup passive observation found short82 queries, not8A; color Save captures show0A setters, not palette reads. There is still no observed live8A transaction/response.

## Offline work completed

Added `app/src/protocol/palette-query-candidate.ts` and synthetic tests. Query codec encodes the derived single-chunk request. Proposed parser requires an explicit independently measured520byte response and exact echoed header, and copies512payload bytes. Header echo is an intentionally strict hypothesis, not a proven device contract. Tests use synthetic payloads; passing them establishes only codec behavior. No transport imports, native action or IPC exposes this candidate. Existing production lighting behavior is untouched.

No color setter or captured512byte palette replay was added. Even a syntactically valid520byte reply would not by itself prove live palette data: compare it to known captured palette values and later a controlled color change before depending on preservation. An echoed zero request must not be accepted as proof of device state.

## Boundary requiring owner authorization

A next optional experiment is one guarded command8A request/GetFeature pair, while official app and Studio are closed, with exact existing interface/caps/identity checks, same mutex, no retry, no palette/config setter and no restoration. Capture must independently establish completion length; bool-only HidD_GetFeature cannot do that. Validate response header and compare returned512bytes against known current color evidence; mismatches fail closed. Query could fail or be unsupported despite presence in host binary. Do not run it merely because offline implementation was authorized.

If live read works, subsequently establish palette freshness/readback on a coordinated known color change. Only then design production preservation and multistep config+palette failure handling. If read is unusable, explicitly ask whether the owner accepts a Studio-owned palette with first-Apply overwrite disclosure; never silently claim preservation.

## Other outstanding issue

Latest Fixed_on color capture supervisor did not stop its child on schedule. It was manually stopped after verification and no USBPcap process remained; PCAP integrity verified. Before another capture investigate supervisor lifecycle/stop reliability. Do not claim its120second bound is reliable until revalidated. No new capture, elevation, HID request or keyboard-setting change occurred in this offline investigation.
