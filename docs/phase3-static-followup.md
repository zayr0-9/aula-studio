# Phase 3 — bounded static query/RGB follow-up

## Scope, evidence and decision

No device calls, HID handles, target execution, application interaction, instrumentation, or scaffold changes. **Zero new REA sessions**: existing complete Apply/loader evidence was sufficient for the additional derivations below. Read REA AGENTS and the lighting/settings and key/macro contracts. Imported phase-2 lighting/backend and inventory evidence; reread only selected installed INI constants with PowerShell plain file APIs. KB.ini SHA-256 still matches `fe98fec7f3bbb4bbcc329aaa9c31357b46469dd083c1045aafc6da2ff07a961d`.

Sources: `evidence/lighting-phase2.json`, principally `ev_31a2ec1c4fd73642f997f64de7bf1ac9eeb334bc616074be43e90b0a2de986ca` (loader `0x411830`, Apply `0x49c020`, sometimes indexed by interior addresses `0x4122ff`/`0x49c0f8`); `ev_863a44ff37853356319607a8dc92df56bd5d072c8bad85fc598697a60385a8b5` (ordinary fill/getters); `evidence/phase2-backend-evidence.json` (matrix/macro/password/power getters). Target SHA-256: `1dfe4803efdbe14f66680f970a6d6f26108342fd49754234fa448dd0ebae44a7`. Complete reused evidence and derived mapping exported to `evidence/phase3-static-evidence.json`; concise findings to `evidence/phase3-static-findings.json`.

**No examined vendor command meets the unattended nonmutating-query gate.** GetMatrix `83`, GetMacro `85`, GetLED `84`, GetGame `86`, GetRealData `88`, GetLedRgbTab `8A`, GetPassword `82/1`, and ReadPower `87/2` all send a SetFeature request before GetFeature in their local paths. This is positive evidence of a stateful request transaction, not proof they change persistent settings; conversely names and high-bit selectors are not firmware nonmutation proof. Delegated backend applicability remains a separate uncertainty. An arbitrary direct GetFeature-only substitution is not supported by these routines. Metadata/descriptor investigation and approved passive observation remain actionable independent work; neither implies approval for vendor requests. No device operation was attempted here.

## LedOpt mapping now recoverable

For zero-based effect index `i`, loaded descriptor base is `model+0x2fd4+40*i`. For seven tuple bytes `t0..t6`, loader assigns:

| Descriptor byte | Value |
|---|---|
|0|1 (enabled)|
|1|t1|
|2|t0 (**hardware selector**)|
|3..6|t2..t5|
|7|t6, except `80` normalizes to zero|

Additional color storage follows; do not identify these descriptor bytes with wire bytes. Friendly labels/capability semantics still need consumer lookup evidence. The installed selector sequence for LedOpt1..20 is **1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,21,0**. Tuple second-field sequence is **1,3,2,19,15,13,20,16,18,5,7,17,12,8,28,30,14,29,0,0**; do not substitute it for hardware selector or assert localization equivalence.

Ordinary fill `0x49bbf0` resolves selected index through descriptor byte2 into configuration payload `0x0a`. Its 19 parameter pairs remain sequential by **host index**, at `0x3a+2*i`, not hardware selector. Thus LedOpt19 (host18) has pair `0x5e/0x5f` and selector21; LedOpt20 (host19) can supply selector0 but is outside this loop. `GaoshouIndex=18` makes host18 the comparison used for custom/game status (`cfg[9]`), independently of friendly naming.

## Effect-color palette serializer in Apply

This is **not per-key RGB**. Apply enters it only inside `(flags & 0x102)!=0`, when selected effect is not the configured game index and `flags & 0x40` is set. It zero-initializes 1024-byte scratch and iterates host indices0..18. `LedMask` suppresses indices whose bit is set; installed `0x22100` masks host8,13,17 (LedOpt9,14,18) in this serializer. This does not prove those rows are absent from every UI or setter.

For each unmasked host effect `i`, seven color DWORDs are read from:

```
profile + 0x2f8c + 0x24*i + 4*j       j=0..6
```

Let `s = model[0x2fd6+40*i]` and `C` be the source DWORD. Relative to scratch body start:

```
body[21*s + 3*j + model[0x2f98]] = C & 0xff
body[21*s + 3*j + model[0x2f99]] = (C >> 8) & 0xff
body[21*s + 3*j + model[0x2f9a]] = (C >> 16) & 0xff
```

The loader identifies those model bytes as RGBIndex. Installed `RGBIndex=0,1,2` gives low/middle/high byte ordering; conventional COLORREF R/G/B interpretation is consistent but no runtime color was checked. Default without override would instead be2,1,0. **Each hardware record is21 bytes =7 triplets**. The host stride36 leaves other per-effect state outside these seven colors.

Without CRC/signature option, slot `+0x7c` receives420 bytes (`0x1a4`, 20 records). With installed `CRC=1`, Apply copies those420 bytes to a zeroed512-byte buffer, assigns `5A A5` at offsets`0x1fe/0x1ff`, then sends512 bytes. These marker offsets follow stack-local address differences (`uStack_3b04` to `uStack_390a/3909`), not a guessed checksum. Existing decompiler warns type propagation is not settling; no new assembly-level validation was performed.

**Important observed mismatch:** host18 / LedOpt19 selects21. The visible unmasked serializer writes its seven triplets at offsets441..461 (`0x1b9..0x1cd`) in scratch, beyond the420 bytes transmitted/copied. The padded512-byte path consequently does not preserve those scratch writes either. Record0 remains zero because the selector0 row is outside the19-iteration loop. Do not silently renumber21, extend the420-byte copy, or claim custom colors are transmitted here. This is an actionable bounds fixture and a clue that custom/game RGB uses its separate path, not proof of intended firmware semantics.

## Separate game/per-key serializer

Apply's game branch runs for `(flags&0x10)!=0 && selected==GaoshouIndex`, or `flags&0x20` (which also participates in reset handling: never use this flag as a benign lighting shortcut). Group count is model byte`+0x2f8c`. Only groups selected by profile dirty bitmap`+0x2444` are uploaded, through slot`+0x74` with group index and **378 bytes (`0x17a`)** each.

For group `g` and configuration key-record index `k`:

- source DWORD: `profile+0x2448+0x240*g+4*k` (144-color host group stride);
- key record: `model+0x18+16*k`; zero DWORD0 records are skipped;
- destination RGB index is **record byte13**, not matrix-index byte12;
- channel planes have126-byte (`0x7e`) stride: `body[126*GameRGBIndex[channel]+index]` gets source low/middle/high byte respectively;
- installed GameRGBIndex is0,1,2, so this is three planes, not interleaved `82*RGB`;
- visible check is `index < device[0xa6]`, initialized from MatrixLen128.

**Bounds caveat:** a128 threshold with126-byte plane stride allows indices126/127 to cross planes; the last plane can exceed the378-byte group body. Their actual occurrence in the installed loaded byte13 mapping is not yet proved. Do not convert the visible check into a supported128-color capacity. Dirty groups are cleared after the loop; failed transfer handling and nontransactional Apply still matter. Full physical-key mapping and a reliable inverse remain unfinished.

## Actionable next boundary (not a blanket stop)

1. Offline fixtures can now test seven-color hardware records, RGBIndex permutations, signature positions, masked rows and the selector21 truncation case. This report does not authorize scaffold creation before the parent's gate.
2. Targeted future static work: recover KEY loader assignment to record byte13, consumer lookup of descriptor byte1 into effect names, and assembly-confirm the palette/group arithmetic. No repeated broad unknown searching is needed.
3. Before any separately approved live vendor query: confirm exact active collection/backend/report descriptor, justify request side effects independently of wrapper names, serialize away from the official app, and require transport/header/length/validity checks. Existing getters can copy data after GetFeature failure and have suspect exhaustion handling; return success alone is not validity.
4. Persistence/recovery and writes remain deferred. No current evidence proves nonvolatile boundaries, atomicity, complete backup/restore, or safe rollback.

Validation: selected INI digest matched the saved inventory; REPL arithmetic derived20 mapping records and mask indices8,13,17; source formulas checked against complete existing pseudocode. No device tests, new REA runs, or firmware behavior claims. Initial read of the wrong KB.ini path failed; first PowerShell JSON serialization included provider metadata and was truncated, so it was discarded and replaced by plain-string selected constants. Neither failure is protocol evidence.
