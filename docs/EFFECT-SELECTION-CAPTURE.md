# Correct ANSI app — effect-selection capture

Owner sequence: Neon_stream → Fixed_on → Blossoming → Neon_stream, Save each. USBPcap capture stopped automatically; capinfos parsed446 packets successfully. SHA2564586370910928bd95d33900470a5d28aad83145f1f55407e547e734b25c26760. Raw capture remains private in capture-tools/brightness-20261016-112519.pcap. Only control-transfer bytes extracted; interrupt payloads were not inspected.

Evidence: [ansi-effect-selection.json](evidence/ansi-effect-selection.json).

| Save | Query / response / config / palette frames | Selector at config0x0A | Changes from fresh queried config |
| --- | --- | --- | --- |
| Neon_stream |37/40/41/43|11|brightness0x4E6→9|
| Fixed_on |47/50/51/53|1|selector11→1 only|
| Blossoming |57/60/61/63|17|selector1→17 only|
| Neon_stream |67/70/71/73|11|selector17→11 only|

Every cycle: command84 query, GetFeature136-byte response, command04 configuration520-byte report, command0A palette520-byte report. All decoded control statuses zero. All four palette reports identical. Successive queries exactly match preceding configuration writes, verifying first three writes. Final Neon_stream write is not followed by a query in this capture.

Initial Save also set the stored Neon_stream brightness6→9; do not describe the whole capture as exclusively selector changes. Remaining three writes change only config0x0A. This does not establish semantic brightness/speed/color behavior in every mode: settings may be per-effect. Installed model1 LedOpt IDs1/11/17 corroborate the IDs; option lines are not independently decoded capability contracts.

Offline capture test checks exact headers/lengths/zero tails, selector changes, preservation of all other configuration bytes, identical palettes and intermediate readbacks. Existing brightness service remains Neon_stream-only and unchanged by this capture analysis.

Next implementation boundary: allowlist these three effect selectors; fresh-read/preserve/write/full-readback contract, no historical buffers. Whether identical palette resend can be omitted for effect switching still requires a supervised configuration-only effect test. Do not generalize the earlier brightness-only palette omission result to effects. No custom effect write was performed during this capture.
