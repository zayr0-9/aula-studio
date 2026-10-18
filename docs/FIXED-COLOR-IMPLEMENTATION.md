# Fixed_on color implementation

Fresh red query returned255,0,0 after owner applied red and closed official app. Together with controlled green/blue queries, all RGB channels confirmed. Only one authorized red query; no custom color setters executed during implementation.

## Correction to earlier palette reports

Earlier reports called the trailing0000 a missing setter marker. Full inspection of getter AND captured official setter shows marker at **payload506/507 = report514/515**, both5AA5. Last four bytes are zero. Reserved payload420..511 zero except marker506/507. This is an observed current-device contract, not old static assumption of510/511. Native validates exact header and reserved tail, refuses incompatible responses, preserves all512payload bytes except Fixed_on RGB21..23. No normalization or synthesized palette baseline.

## Operation

Fixed_on-only ReadColor and SetColor added. Fresh configuration query, fresh palette query, configuration query again to reject intervening config changes. Set clones config, updates only config3B low nibble0(solid)/7(rainbow), preserving upper nibble; clones palette, updates only RGB21..23. Sends04 config, verifies all128bytes, sends0A palette, verifies all512payload bytes, verifies config again. Each feature operation rechecks official app. Same exact interface/caps/ABI, global mutex, service queue/bounds/shutdown and shared fault latch. No raw reports through IPC. Config/palette setters are non-atomic: failures may leave partial changes and stop subsequent operations; no automatic retry/restoration.

One UI color picker plus Colourful checkbox, Fixed_on only; RGB retained while rainbow enabled; no commands on draft changes. Read refreshes actual palette rather than local profiles. Existing effects, global/individual brightness and speed remain supported. All new I/O occurs on explicit read/apply/effect actions, no startup/background polling.

Validation:33 Node tests pass, native color encoder reflection tests pass for controlled RGB fixtures/other-byte preservation/packed toggle/marker rejection, native brightness50 and combined effect-brightness60 offline cases pass. Typecheck, lint, format, production build, Electron hardware-disabled smoke pass. Initial smoke inherited ELECTRON_RUN_AS_NODE, fixed command-local environment and reran successfully. Tests do not establish live color writes.

Manual acceptance: restart dev process; official app closed; Read Fixed_on; Apply red/green/blue and verify physical colors and success; Colourful on Apply should rainbow, off Apply restores chosen solid. Stop on failure, no repeat. Validate native full-palette preservation through readback. Other modes' color controls disabled. HID boolean return still not actual byte count; strict marker near tail improves rejection but not independent transfer-length attestation.
