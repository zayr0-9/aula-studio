# Official PgUp → Home → PgUp capture

Owner performed two base-layer assignments. Capture supervisor stopped automatically; capinfos valid56frames, SHA2562aa18c4553fbcaaf88d40d90d8de97485bb9aa9a894dee2bc7d05ab74e538233. Control-only evidence [pgup-home-remap.json](evidence/pgup-home-remap.json). No interrupt payloads inspected.

Only two control writes observed: frame25 Home and27 restored PgUp,520byte HID reports with8byte setup prefix removed. Header06 03 00 00 01 00 00 02: command03, layer0, one chunk/index0, payload512. USB completion statuses zero. No other layer/config/palette/macro writes in captured controls. No configuration query or matrix readback; official app used host state for these writes.

Exactly one differing byte between writes: report355 (payload347 = matrix86 byte3),4A(Home)→4B(PgUp). Both entries form00 00 00 usage. All other511payload bytes identical. Full restored512byte payload equals pre-test live layer0 snapshot byte-for-byte. Last entry127 retains00 00 5A A5. This is outgoing restoration evidence, not final device readback or full backup.

No custom setters executed. Official app must close before a fresh guarded layer0 query can independently verify restored state. Then implement restricted PgUp/Home setter first: exact target index86 only; fresh read, allow current regular entry00 00 00 4A/4B, modify only slot's usage, command03 layer0, one write then fresh query/full512byte compare. Preserve other layers, entries, signature. No Fn/modifier/wheel/macros or whole captured-buffer replay. General remapping requires additional action contracts and source/target allowlists.
