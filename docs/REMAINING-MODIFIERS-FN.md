# Remaining modifier and Fn capture (2026-10-18)

## Verified control traffic

Owner authorized elevated bounded keyboard-only capture, accepted UAC, and operated corrected official app. USBPcap3/address2 matched expected composite topology and PnP location before launch. Capture supervisor enforced 120-second bound; second capture stopped early by identifying its exact elevated USBPcap process and output path. No Studio setter or live query was executed in this investigation. Raw PCAP remains private; only USB control transfers were inspected.

Sanitized evidence: [remaining-modifiers-fn-capture.json](evidence/remaining-modifiers-fn-capture.json). Physical1/slot7 was assigned LeftWin, LeftAlt, RightCtrl, RightShift in first capture. Standalone entries are respectively `00 08 00 00`, `00 04 00 00`, `00 10 00 00`, `00 20 00 00`. All layer0 payload differences from canonical snapshot are confined to slot7. These corroborate canonical default slots11,17,59,70. No Alt/Win/right-modifier shortcut combinations captured; do not infer those encodings from standalone captures.

Second capture contains six full command03 setters: layers0,1,2 for physical1→FN, then layers0,1,2 for restoration. Each transfer is520bytes; secondary header byte2 selects layer. Only slot7 differs between the two phases within each layer:

| Layer | FN assignment | Restore original1 |
| --- | --- | --- |
|0|0D 00 00 00|00 00 00 1E|
|1|0D 00 00 00|07 00 00 05|
|2|0D 00 00 00|00 00 00 00|

The original physical Fn slot53 remains unchanged. Final layer0 setter payload equals canonical snapshot's entire512byte payload. All12 second-capture control records report USB success. This proves recorded packets, not independent readback, output behavior, persistence or complete recovery. No pretest layer1/2 snapshots exist; the restored values there cannot be treated as verified prior state.

## Fn implementation gate

Do not add FN to existing base-layer MappingEncoding/WithMapping or permit changing slot53 through SetMapping. Its behavior is multilayer, unlike the captured ordinary modifiers. Current MatrixQuery/ValidateMatrix accept only layer0; widening them alone is not enough to establish live layer1/2 compatibility.

Required follow-up, owner-coordinated with official app and Studio closed:

1. Add a narrowly allowlisted diagnostic for fresh layer1/2 reads using corrected binary getter evidence; preserve unique target verification, mutex, OemDrv checks, header/signature checks, bounded operation and no retries. Independently verify response headers and semantics; do not assume the capture's setter alone verifies queries.
2. Establish all three fresh layers before any Fn write. Preserve arbitrary unrelated entries, including special entries. Never initialize or restore from the captured default layers.
3. Stage replacement Fn on all required layers, verify all512bytes of each layer, then permit original Fn reassignment only with fresh proof another physical location retains accessible FN on the required layers. Never remove the original first. Enforce in backend, not just the renderer.
4. Treat each multilayer write as non-atomic. Any failure blocks further writes and reports which stage may have applied; no blind retry or stale rollback. Keep original Fn intact through replacement staging. Re-read all affected layers before returning success.
5. Define how an existing replacement Fn is removed/restored without losing its former nonbase assignments. Device FN entries do not encode what they replaced; safe restoration may require explicit scope and session provenance rather than guessing an original default.
6. Expose as advanced operation, not normal target-grid action. Warning modal must explain multilayer changes, non-atomic failure, no full backup/recovery guarantee and retained/replacement Fn requirement. Modal confirmation cannot substitute for backend validation.
7. Offline tests: malformed headers/layers, source/target allowlists, complete per-layer preservation, last-Fn refusal, stale renderer state, sequential failure injection at every write/readback, and renderer cancellation/no default confirmation. Owner physical acceptance remains separate.

User agreed: both moving Fn and reassigning its original physical key are desired; advanced explicit operation with warning modal, and replacement Fn verified before original reassignment. This is not authorization to guess unverified multilayer query/restoration contracts.

## Follow-up: fresh reads verified

See [FN-LAYERS-READ-RESULT.md](FN-LAYERS-READ-RESULT.md). One guarded live query sequence returned valid layers0/1/2, all512 payload bytes matching each captured restoration setter. This satisfies the fresh multilayer-read investigation gate on this keyboard. Fn production editing remains disabled pending safe mutation/restoration semantics.

Correction to proposed cross-layer invariant above: original Fn slot53 contains FN only in layer0 and zero entries in layers1/2. Preserve that actual state; do not require an original working Fn to contain FN in every layer. The captured newly assigned Fn does have FN entries in all3 layers. Backend last-Fn protection must account for this distinction without guessing firmware lookup behavior.
