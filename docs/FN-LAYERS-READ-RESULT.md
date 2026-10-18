# Fresh Fn-layer read result — 2026-10-18

Owner confirmed official app and Studio closed and authorized reads. Process checks found neither OemDrv nor Electron nor active capture. No elevation required. Diagnostic reused production exact collection enumeration, attributes/capabilities verification, native mutex, OemDrv checks before opening and each feature operation. Corrected binary getter FUN_0048b5d0 supplies caller layer as secondary header byte (docs/evidence/matrix-corrected-static.json); no guessed setter used.

## Execution and evidence

- Script: scripts/query-fn-layers-once.ps1.
- CompileCheck passed without device I/O.
- OfflineTest passed: layer0/1/2 query headers and zero request payloads; invalid layer, response length, header and trailer refusal. No device I/O in offline modes.
- One live invocation completed in bounded20second shell call. Exactly3 command83 SetFeature query requests and3 GetFeature responses, no retries, assignment writes, configuration setters or restoration.
- Fresh evidence: evidence/fn-layers-read-20261018-111532.json; SHA256 c5375e0f91488ca8f5ede98c908ae4bae3a655621e4ba91c70bf37a5516eb0ec.
- All3 response headers match `06 83 <layer> 00 01 00 00 02`; all trailers match `00 00 5A A5`.
- All512 payload bytes of each fresh response exactly equal the corresponding official restoration setter in brightness-20261018-105839.pcap frames7,9,11. Only control transfers were inspected. Capture provenance/hashes in evidence/remaining-modifiers-fn-capture.json.

| Layer | Physical1/slot7 | Original Fn/slot53 |
| --- | --- | --- |
|0|00 00 00 1E|0D 00 00 00|
|1|07 00 00 05|00 00 00 00|
|2|00 00 00 00|00 00 00 00|

This independently confirms current layer contents match the recorded restoration writes. It does not establish durability, actual transfer length (GetFeature boolean ABI), physical Fn semantics or recovery. Snapshots are evidence, never automatic restoration sources.

## Consequences for implementation

Fresh reading/preservation of layers1/2 is now demonstrated on this keyboard, rather than inferred from setter captures. Production Fn editing is still disabled; this diagnostic adds no IPC or startup read behavior.

Important: original physical Fn is present only in layer0, with zero entries in layers1/2. Do not impose an invariant that every working Fn key must already contain FN in all layers: it would reject this actual original state. The official assignment of a new Fn location explicitly writes FN in all3 layers. Preserve original Fn's existing multilayer entries until a verified replacement is established; do not normalize its zero entries or claim their behavior is understood from bytes alone.

Before implementation: define safe session provenance/restoration for overwritten nonbase entries; stage and verify replacement first; warn about non-atomic multilayer writes; enforce last-Fn protection from fresh backend state, not stale renderer state. Original-Fn reassignment semantics across nonbase layers and physical acceptance remain open. No automatic live writes were authorized or performed by this read task.
