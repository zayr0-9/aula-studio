# Palette freshness — green/blue confirmation

Owner applied Fixed_on solid green (Colourful off, brightness9) through correct official app, confirmed green-ready with app closed. One guarded8A query returned RGB0,255,0. Owner repeated for blue and closed app; one guarded query returned0,0,255. Studio and OemDrv processes absent before each query; native guards rechecked official app before open and every feature operation. No custom setters, retries or restoration.

Comparison of complete520-byte API buffers: only report offsets30 and31 (palette payload22 and23) differ, green255→0 and blue0→255. Red report29 remains0. All other bytes identical including echoed header and zero tail. This confirms getter tracks these freshly applied Fixed_on colors, not merely our initial red fixture. Evidence: [green](evidence/palette-query-green.json), [blue](evidence/palette-query-blue.json).

No new USB capture was started for green/blue queries; HidD_GetFeature success and buffer validation do not independently attest actual transferred length. Initial one-query capture separately established520-byte wire response. Getter payload tail remains0000, unlike official setter marker5AA5. Do not silently treat getter reserved/padding bytes as ordinary stored palette colors. This verifies two fresh color states on this device, not general firmware or all palette entries.

Helper scripts/query-palette-once.ps1 now accepts allowlisted EvidenceLabel once/green/blue so prior evidence is preserved. Query requests unchanged. Production app source not changed in freshness test.

Next implementation: guard Fixed_on only, query fresh configuration and palette; modify only RGB payload21..23 while preserving other meaningful palette data; form observed0A setter header and required5AA5 trailer distinctly from getter representation. Validate reserved/tail contract from captured writes, compare full meaningful palette readback, and handle config Colourful toggle plus palette as non-atomic operations with no blind rollback/retry. Do not claim color controls implemented or live-validated yet.
