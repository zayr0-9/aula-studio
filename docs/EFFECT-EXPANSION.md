# Remaining effect expansion — corrected installed model

Read-only inspection of corrected model1 `C:/Program Files (x86)/AULA/F75/Dev/kb/1/KB.ini` and `Text/en/text.xml`. No hardware requests, official-app actions or changes to production allowlist.

## Static mapping

LedOpt row number matches tc_kb_ledN label. Its first numeric value is hardware selector. Do not use the second numeric value as selector or name index: row11=(11,7,...) is Neon_stream, not Ripples_shining. Existing captures corroborate rows1/11/17. Remaining rows are static candidates, not verified firmware capabilities.

| Hardware ID | Label | Status |
|---|---|---|
|1|Fixed_on|captured/owner accepted|
|2|Respire|candidate|
|3|Rainbow|candidate|
|4|Flash_away|candidate|
|5|Raindrops|candidate|
|6|Rainbow_wheel|masked candidate, excluded|
|7|Ripples_shining|candidate|
|8|Stars_twinkle|candidate|
|9|Shadow_disappear|masked candidate, excluded|
|10|Retro_snake|candidate|
|11|Neon_stream|captured/owner accepted|
|12|Reaction|candidate|
|13|Sine_wave|candidate|
|14|Retinue scanning|masked candidate, excluded|
|15|Rotating windmill|candidate|
|16|Colorful waterfall|candidate|
|17|Blossoming|captured/owner accepted|
|18|Rotating storm|masked candidate, excluded|

LedMask0x22120 set zero-based bits5/8/13/17 correspond exactly to four absent effect labels in owner's screenshot. Visibility interpretation inferred from correspondence, not newly traced loader. Ordinary catalog excludes Self-define (row19 selector21) and OFF (row20 selector0); special paths/custom flag must not be guessed.

INI comment labels tuple columns hw/effect/speed/light/direct/random/color. Capability booleans are not sufficient to expose controls: Blossoming illustrates why generic Light=1 does not establish physical brightness support. Preserve current verified capability maps. Old executable's19-effect pair layout is only a lead until corrected serializer or new captures verify offsets for each effect.

## Offline additions

`app/src/protocol/effect-catalog.ts` records static metadata separately from production write allowlist. Tests require uncaptured IDs to remain rejected by current service. No renderer expansion until safe selector transitions established.

## Next staged capture

First batch: existing Neon_stream baseline → Respire → Rainbow → Flash_away → Raindrops → Neon_stream, Save each. Keep all other controls unchanged; configuration and palette diffs establish whether selector-only switching is sufficient. Then second batch covers Ripples_shining, Stars_twinkle, Retro_snake, Reaction, Sine_wave, Rotating windmill and Colorful waterfall (split to fit recording bound). No masked effects or Self-define. Only after captures add selector allowlist and ask owner to identify visible effect behavior; parameter controls stay unavailable until separately verified.

Capture supervisor missed120second stop in recent recording; investigate/revalidate its process ownership and stop lifecycle before another capture. Do not silently start another recording with a known unreliable bound. Owner authorization permits guarded keyboard queries, but no query alone can establish visual identity of an uncaptured effect.
