# Corrected driver and live layer0 matrix snapshot

Owner authorized investigation/read, confirmed official app and Studio closed. Process check found no OemDrv/electron; helper rechecks OemDrv before opening and each feature operation. Corrected binary hash7c41a8af17b8d1577ac5660b8f0ce1be61da50fd33a5238158c62e6097292783 statically analyzed without vendor execution.

FUN_0048b590 setter invokes AccessData operation1 command03 secondarylayer. FUN_0048b5d0 getter builds command83 secondarycaller-layer, chunked512payloads, backend0x18 reportID6. For layer0 and512bytes request header06 83 00 00 01 00 00 02. Native weak retry/error handling not reused. Evidence: evidence/matrix-corrected-static.json.

One guarded layer0 query succeeded, no retry or mapping/configuration setter. Reused production exact unique MI01/COL06 enumeration/caps/attributes and shared mutex; source new method only invokes command83 query then GetFeature. Header echoed correctly; fresh zeroed520byte buffer; API success, actual transferred byte count unknown (HidD_GetFeature boolean). No new USBPcap recording. Evidence: evidence/matrix-layer0-20261017-230913.json. Snapshot not a complete keyboard backup: other layers/macros/settings not captured, durability/recovery unproven. Do not replay blindly.

Selected matrix entries corroborate ANSI geometry and standard HID mapping:
- matrix0 Escape:00 00 00 29
- matrix53 Fn:0D 00 00 00 (special action, not regular key)
- matrix59 rightCtrl:00 10 00 00
- matrix80 backslash:00 00 00 31
- matrix81 Enter:00 00 00 28
- matrix84 Wheel:07 00 00 1D (matches corrected special K81 profile; not3independent knob inputs)
- matrix85 Delete:00 00 00 4C
- matrix86 PgUp:00 00 00 4B
- matrix87 PgDn:00 00 00 4E
- matrix88 End:00 00 00 4D
- matrix89 RightArrow:00 00 00 4F
- matrix127 signature:00 00 5A A5

Mapping entry is4bytes, not a one-byte HID assignment. Future simple PgUp→Home candidate would replace only matrix86's four-byte slot with standard-key form, but setter shape and full-layer behavior must be validated via a controlled official-app remap/restore capture first. No custom matrix encoder/setter exposed; no remapping write performed. Fn/modifiers/wheel/macros remain excluded.

Next: coordinated official-app PgUp→Home then back PgUp capture, compare all layers written and all other config/palette traffic. Repair/revalidate capture supervisor lifetime before recording; earlier missed deadline remains open. Retain current snapshot as evidence only and fresh-read before any eventual Studio remap. Knob software custom-action mapping remains TODO per owner priority switch.
