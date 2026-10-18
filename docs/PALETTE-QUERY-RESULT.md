# Single palette query — result

Owner authorized test. Official OemDrv and Electron processes absent before execution; native helper rechecks OemDrv before opening and each feature operation. Reused production complete unique-collection enumeration, attributes, caps/reportID and mutex guards through reflection without invoking production Run. One candidate query header06 8A 00 00 01 00 00 02, zero payload, SetFeature then25ms/GetFeature succeeded. No palette0A/config04 setters, resets, retries or restoration.

Capture brightness-20261017-110214.pcap stopped automatically, four frames, SHA256d06236c40b5796dcd6dc8d739d6a3a612c2da20cc082c111c3ad2d60048f43f6. Frame1 request520 bytes plus setup8; frame4 response520bytes, all statuses zero. Header echoed correctly, API buffer equals captured response exactly. Fixed_on first RGB255,0,0 (red), plausible relative to prior color test, but not independent freshness proof since no newly changed known color was coordinated immediately before query. Payload has160 nonzero bytes.

**Important:** returned payload ends00 00, not setter marker5A A5. Do not equate setter and getter marker contracts or blindly roundtrip the entire returned512bytes. Full palette read works at transport level once; preserved serializer region/reserved tail and freshness across known color changes need further validation before production writes. No production IPC changes.

Initial helper attempt failed in PowerShell reflection argument conversion before native SetFeature invocation; offline exact-three-argument dummy test verified fix. Complete capture shows only one actual query transaction, confirming no wire retry. Compile-only path also passed. A failed pretty JSON read was replaced with compact evidence; no interpretation relied on truncated output. Unsupported TShark status field replaced by direct USBPcap frame parsing.

Files: [API evidence](evidence/palette-query-once.json), [wire verification](evidence/palette-query-wire-verification.json), helper ../scripts/query-palette-once.ps1. Raw PCAP kept private. No physical color change expected/requested; no firmware side-effect assurance can be established from command naming alone.

Next: correlate getter payload with current known official-app color at two distinct values using separately coordinated reads, identify region/tail normalization, then implement guarded palette read/modify/write/readback alongside config toggle with explicit non-atomic failure handling. Do not treat a successful single read as completed color support.
