# F75 backend selection and packet recovery (static only)

## Scope and evidence

Target: installed `C:/Program Files (x86)/AULA/F75/OemDrv.exe`, x86 PE, SHA-256 `1dfe4803efdbe14f66680f970a6d6f26108342fd49754234fa448dd0ebae44a7`. REA/Ghidra 12.1.4 analysis only. **No original application launch, HID API invocation, device query, setting change, reset, or firmware action was performed.** API names below describe instructions in the executable, not executed operations. A function named Get still sends a SetFeature request; it must not be considered harmless.

New successful Evidence is preserved in `evidence/phase2-backend-evidence.json`. Local evidence keys used below:

|Key|Evidence ID / operation|
|---|---|
|B1|`ev_17ace47f06909eeab794b5886cc23f015d8d927014c27f7f804dbfc3b9b3607d`, wrapper batch|
|B2|`ev_34a95fc595d6184ef55dedade1912308baefc8aa2a7ad6aca4dcd89c45290b25`, factory + primitive batch|
|B3|`ev_6a4b51799561842d9bec8e98971f9dfd0b9f88eb7351def0bcff3ca90618b4a0`, callers of 0x498fb0|
|B4|`ev_6ab1a84836adff57ee7fcfa7364319f31616695f842a82491338e8a8c064f2c4`, callers of 0x4993c0|
|B5|`ev_e16004593db5111cad9d00a3c49f7719c80b8ee6c5d19f30f93aa752919c2cee`, assembly 0x499640|
|B6|`ev_76e4252e6e4442611eb3378fe63f10da99d99c5c01384f37a5d79034378afede`, assembly 0x49a430|

Prior `rea-static-evidence.json` provides decompilation of 0x498fb0 (FindHIDDevice), 0x411830 (profile loading), 0x499600 and 0x49c020 (ApplySetting). Lighting/feature recovery in the companion workstream provides 0x49bbf0/0x49b910 and additional read wrappers; those observations are explicitly marked cross-workstream below.

## Backend linkage and concrete F75 applicability

**F-BACKEND-1 (observed configuration):** installed `Dev/kb/fr/KB.ini` lines 2–8 contain `Fw=24`, wired VID/PID `0x258a:0x010C`, wireless `0x3554:0xfa09`, and `CRC=1`. They identify the installed model definition, not a live device or current connection.

**F-BACKEND-2 (static fact, B2):** `FUN_0040bb80` (`COemDrvDlg::FindOurDevice` log) walks device definitions at global list `DAT_00652548`. The definition's `+0x18` is the integer logged as `fw`. If it is `0x18` (24) or `0x1a` (26), it allocates 0x2a0 bytes, calls base initializer 0x493500, and writes **`CDevG5KB::vftable`** into the first word. It initializes `object+4=0x916`, handle `+0xc=0`, definition pointer `+0x10=0`, and delegate `+0x23c=0`, among other fields. Then it sets `object+0x10=definition`, `object+8=dialog`, and calls vtable slot `+4`. A separate constructor at **0x498dc0**, recovered from selector 0x498e00, performs the same vtable/type initialization and takes the definition pointer. This is not an inference from a class-name string alone.

**D-BACKEND-3 (derived):** the installed F75 definition's decimal 24 selects the G5KB branch, rather than generic CDev916KB or CDevG5MS. `0x916` inside the object is a type field, not proof of the CDev916KB class. Other factory branches use Fw=25 for G5MS and Fw=22 for another constructor. The initial backend workstream left the INI-to-definition loader chain unresolved; the parent follow-up below now closes that static linkage using the loader assembly and list insertion. This does not establish live device selection or acceptance.

**F-BACKEND-4 (prior decompilation + B3):** 0x498fb0 logs `CDevG5KB::FindHIDDevice`; its concrete caller is 0x40bb80. It reads VID/PID at definition `+0/+2`, fw at `+0x18`, and matches an enumerated table with stride **0x22c**. For fw24 its intended main interface requires UsagePage **0xff00**, Usage **1**, FeatureReportByteLength **0x208**. Fw26 first requires page0xff02; it accepts usage2/feature520/input8, with a fallback branch accepting usage1/feature520 on that same page0xff02. This distinction follows the explicit pseudocode branches and has not been independently assembly-checked. Auxiliary observations recognize media page0x0c/usage1/input3 and wireless page0xff02/usage2/input20/output20/report-ID0x13. These auxiliary matches are not themselves the main fw24 feature interface.

For a main match, code contains CreateFileW access0x12019f/share3/OPEN_EXISTING/FILE_FLAG_OVERLAPPED. Optional six-byte password matching invokes 0x49a430. On success it stores the handle at `+0xc`, marks `+0x234=1`, copies the path at `+0x2c`, and obtains a version attribute. These are static selection conditions, not observed descriptor values from the connected keyboard.

**F-BACKEND-5 (B1/B2/B5):** wrappers first test **object+0x23c**. Nonzero delegates through that object's vtable; zero uses the local G5KB feature path. Examples: 0x499640 delegates slot0x60; 0x499850 slot0x64; 0x4998a0 slot0x68; 0x499aa0 slot0x6c; 0x499cf0 slot0x74; 0x49a140 slot0x7c; reset0x49a390 slot0x34; screen0x49a3e0 slot0x54. The constructor initializes this delegate to zero, so the directly selected wired G5KB object has the local path initially. Later delegate assignment and the wireless object lifecycle are not completely recovered here. **Do not apply these 520-byte packets to a 20-byte wireless interface merely because its VID/PID appears in KB.ini.**

## Local G5KB feature-report format

**F-PACKET-1 (B2, primitive 0x4993c0; B5 corroborates read wrapper):** fixed **0x208 = 520 bytes**, including the report ID. Payload chunks at most 0x200 = 512 bytes. This is a different path from the earlier generic 0x495540/0x4955a0 transport.

|Byte offset|Meaning established in local path|
|---|---|
|0|Report ID **6 for fw24**, otherwise9 in this routine's expression|
|1|Command selector|
|2|Command-specific subselector / layer|
|3|Zero|
|4|Total chunks = ceil(length/512), truncated to byte|
|5|Zero-based chunk index, truncated to byte|
|6–7|This chunk payload length, little endian|
|8–519|512-byte payload area; zero-filled before each request|

The report-ID expression is `((fw != 0x18)-1 & 0xfd)+9`; evaluation for fw24 is6 (0xfd+9 modulo256), not9. Assembly 0x49973b–0x49974b confirms CMP24 / SETNZ / DEC / ANDfd / ADD9.

Primitive operation1 copies outgoing payload then calls HidD_SetFeature. Operation2 calls SetFeature with a zero payload request, then GetFeature on the **same 520-byte buffer**, and copies returned bytes from offset8 into the caller's output. Fixed-size getters below inline the same pattern. Each chunk invokes helper0x4051f0 before send (usually argument0x14), retries SetFeature at most three times, calls helper with0x46 after failure, and for reads calls helper0x14 before GetFeature. The original workstream did not inspect helper units; the parent follow-up below resolves them as busy-wait milliseconds. Required firmware timing remains unverified.

### Selector map from wrapper callsites

|Entry|Diagnostic role|Byte1|Byte2|Length / behavior|
|---|---|---:|---|---|
|0x499600 (prior)|SetMatrix|03|caller subselector|caller length; primitive operation1|
|0x499640 (B1/B5)|matrix-like generic read|83|caller subselector|caller length, chunks<=512|
|0x499850 (B1)|SetMacro|05|0|caller length, operation1|
|0x4998a0 (B1)|GetMacro|85|0|caller length, inline read loop|
|0x499aa0 (B2)|SetLED|04|0|caller length, operation1|
|0x499cf0 (B2)|SetGame|06|caller subselector|caller length, operation1|
|0x49a140 (B2)|SetLedRgbTab|0a|0|caller length, operation1|
|0x49a390 (B2)|ResetDevice|11|0|length1, operation1; destructive semantics not tested|
|0x49a3e0 (B2)|SetScreenParam|0b|0|caller length, operation1; inclusion does not prove F75 has screen|
|0x49a430 (B1/B6)|GetPassword|82|1|six bytes, total1/index0|
|0x49a5c0 (B1)|ReadPower|87|2|two bytes, total1/index0|

Cross-workstream decompilation recovered GetLED0x499af0 selector84, GetGame0x499d50 selector86, GetRealData0x499f60 selector88; consult lighting/feature evidence for full contracts. No device communication was performed to validate any selector.

0x49a5c0 returns payload byte0 through an optional output pointer. The second optional output is true only when `(payload[1]&0xf0)!=0` and `(payload[1]&0x0f)==0`. Interpreting this as charging or link status is not proven by bit arithmetic alone.

## ABI and failure hazards confirmed in assembly

**F-HAZARD-1 (B5):** the pseudocode retry check `counter<0` is real, not a decompiler typo. Counter ESI starts3 at0x49977e; failed sends decrement at0x49979d; loop continues only while >0; after exhaustion it is0, but **0x4997ac uses JL**, so the error branch is not taken. The code proceeds into GetFeature at0x4997c7 despite all three SetFeature calls failing. Failed GetFeature only logs, then copies payload anyway (0x4997ce–0x4997f3). Therefore a success-looking return or output buffer is not a validated transaction acknowledgement. Do not copy these failure semantics into a future client.

**F-HAZARD-2 (B6):** GetPassword's ABI is nonstandard in decompiler output: the device object is read via inherited **EDI** at0x49a49c, destination is saved from ECX at0x49a454, and the handle is a stack argument. The function returns EAX1 at0x49a572 and EAX0 on explicit failure, despite the pseudocode declaring `void`. 0x499640 similarly returns EAX1 at0x4996e0 and EAX0 on explicit errors. Treat auto-generated prototypes and apparent omitted buffer arguments with caution. Wrappers calling0x4993c0 expect a status, while its pseudocode also declares void.

**F-HAZARD-3:** local read loops shown here do not validate response command, chunk index, or length before copying. This differs from generic transport logic elsewhere. Payload chunk count/index are only one byte; mathematical maximum lengths and device limits are not inferred to be supported. Presence of ResetDevice and password access disproves any blanket 'feature reports are safe' claim.

## CRC=1 is not a recovered packet checksum

**F-CRC-1 (prior 0x411830):** `GetPrivateProfileIntW(OPT,CRC,1,...)` writes one byte to profile **+0x2f95**. Installed KB.ini explicitly sets1. The local feature-report packet builder0x4993c0 does not reference this field or append a computed CRC.

**F-CRC-2 (cross-workstream 0x49bbf0):** when +0x2f95 is enabled, the serialized configuration trailer bytes **[0x7e]=0x5a, [0x7f]=0xa5** are set. This is a marker, not evidence of a polynomial CRC or checksum over each packet. The alternate config builder0x49b910 is selected by ApplySetting when profile+0x2d8f=1. Distinguish configuration-payload markers from transport framing; exact feature payload contracts remain in the companion lighting/feature documentation.

## Validation, limitations, and session accounting

Requests are recorded in `phase2-backend-1.json` (19 selectors, deduplicating to five canonical wrapper entries), `phase2-backend-2.json` (factory, primitive, six wrappers, xref, two assemblies), and attempted `phase2-backend-3.json`. Batches1 and2 returned every requested operation and close_binary in durable JSONL artifacts. Initial foreground batch1 exceeded180s; its bounded durable rerun completed. Batch2 shell wait reported timeout but its artifact subsequently contained all results and close. Batch3 foreground exceeded180s and returned only open_binary: **its unreturned queries are not claimed as successful evidence**. No further sessions were started. These are analysis/import contention limits, not device results.

Current gaps after parent follow-up: exhaustive virtual lifecycle/slot contracts; later delegate assignments/active wireless transport; response format confirmation; connected hardware revision/actual descriptors; maximum transaction lengths and firmware acceptance. Loader chain, numeric vtable base and timing-helper units were subsequently recovered below. Static factory linkage and format recovery are substantial, but they neither authorize IO nor establish command safety. Future work can remain offline: recover the missing loader and delegate setters, reconcile payload serializers, add parser-only fixtures and packet decoders. No hardware tests are required or proposed by this document.

## Parent follow-up: INI-to-factory chain closed statically

[final-linkage-phase2.json](evidence/final-linkage-phase2.json) preserves loader batch `ev_68a4d2acd5ede0dca4d10e09425de0be706220b4eab82c056d57806ff1547463`, inserter batch `ev_bcf71e42c9581ce6a127dfd68ee8256098daf87aff7d3ba8412fce09eb0cecdd`, and assembly `ev_429768832c3a00f5a92da318e4f5de29e8a366fb9ac277e0bb9554a9fe6bd70f`.

Loader **0x411530** reads `[OPT] VID/PID/VID_Wireless/PID_Wireless/Fw/Psd` and copies a `0x314`-byte definition to heap. VID/PID are first two ushort fields (offsets0/2), wireless IDs offsets4/6. Assembly0x411654 pushes the Fw-key address,0x411663 calls GetPrivateProfileIntW, and0x41167f stores EAX at stack+0x40 after six subsequent pushes (24 bytes). Relative to canonical stack this is+0x28; copied definition begins stack+0x10, so **Fw is definition+0x18**. At0x4117e7–0x4117ed it copies0xc5 dwords from that definition base;0x4117f0 sets ESI=`0x652538` and calls list inserter0x44e2b0. Inserter writes list head at owner+0x10=`0x652548`, exactly the list factory0x40bb80 traverses. Thus installed Fw24 → definition+0x18 → G5KB factory branch is statically linked, rather than merely a numerical coincidence. GUI initializer0x457e90 calls the factory.

The key/macro workstream additionally recovered **G5KB vtable base0x6247f4**, including converter slot+0x98→0x49a920; see [key-and-macro-contracts.md](key-and-macro-contracts.md). The timing helper0x4051f0 was independently decompiled in [lighting-and-settings-contracts.md](lighting-and-settings-contracts.md): arguments are QPC-based busy-wait milliseconds (20 nominal,70 failed-send spacing). Earlier gap statements above are historical workstream limits; these loader/vtable-base/timing gaps are now resolved to this extent. Exhaustive virtual lifecycle, later delegate assignments/wireless route, live descriptors and live hardware behavior remain unresolved.
