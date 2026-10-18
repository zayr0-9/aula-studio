# Modifier and shortcut capture — corrected F75

Owner performed physical1 → LeftCtrl → Ctrl+C → Ctrl+Shift+C → original1 in corrected official app. Capture brightness-20261018-102905.pcap:72frames, SHA2563434e1570bc155b15cf1e63ffa1531208eb95e95785285e2024d130d5c9db21b. Supervisor automatically stopped. First attempt refused stale USBPcap1 mapping without recording; current USBPcap3/address2 revalidated against expected collection topology and unchanged PnP physical location. Raw capture private; only control transfers inspected.

Evidence: evidence/modifier-shortcut-capture.json. Four matrix03writes, each520bytes, header06 03 00 00 01 00 00 02. Matrix7/report36..39:

| Frame | Owner assignment | Entry hex |
| --- | --- | --- |
|23|LeftCtrl|00 01 00 00|
|39|Ctrl+C|00 01 00 06|
|41|Ctrl+Shift+C|00 03 00 06|
|43|1 restored|00 00 00 1E|

All differences from fresh pretest response are confined to matrix7 plus query83/setter03 command byte. Other entries unchanged. Control USB statuses zero. Fresh posttest matrix-layer0-20261018-103210.json exactly equals pretest matrix-layer0-20261018-102752.json (all520bytes), not just original1. No other matrix layer/config/palette setter observed in extracted control transfers. Initial short82queries are not matrix readback.

Supported interpretation: byte1 modifier mask1=leftCtrl; adding leftShift contributes2 (mask3), byte3 ordinary usage, byte0/2zero. LeftShift-only mask2 additionally corroborated by default matrix4; standalone Ctrl mask1/default matrix5. Do not infer Alt/Win/right-modifier bits or Fn semantics. Extension to other ordinary usages uses the established ordinary-key contract; only these three assignments captured physically.

No Studio setter executed in this analysis. Fresh snapshot queries use exact production guards and do not provide complete backup or independent actual-transfer-length attestation. Readback equality does not prove shortcut press/release behavior. Physical acceptance of new Studio shortcut writes still required.
