# Key, layer and macro contracts (static recovery)

## Scope and safety

Target: installed `OemDrv.exe`, x86 PE, SHA-256 `1dfe4803efdbe14f66680f970a6d6f26108342fd49754234fa448dd0ebae44a7`. REA/Ghidra immutable static inspection only. No original executable launch, keyboard I/O, Get/Set reports, reset, or firmware operations occurred. These are observed software contracts, **not validated firmware behavior**. Backend selection for this specific connected F75 is covered separately; do not assume every shared backend branch is active.

Evidence: `evidence/key-and-macro-evidence.json` contains complete Evidence records, IDs, raw pseudocode, exact table bytes, and derived findings. Principal batches: matrix builder `ev_a2e51aea16d3dbbbde6d8eb999f0a681400771db5f2c5c77a468c2d5c2458c24`; macro serializer `ev_dcb4c59247d5ee45de4023f22b292298415b2169231e38dadd11aa89f1d96f3a`; exact vtable bytes `ev_61053bc5c65e5cf8b62d699362f7a9051dd92ad84bf46a7eab06935785c90f5b`; VK table `ev_37fe278087f56262d0da07e51974bc5f7834b35baecc104930f702c9d48a68ff`. Converter batch ID is in the evidence index.

## Representation boundaries

Do not transmit profile records as matrix bytes. `0x49b3d0` converts four profile layers to four packed matrix layers and a separate macro blob. Profile layers begin at profile `+0x38`, stride `0x900`, each with **144 records of 16 bytes**. Record DWORD0 has major tag in bits31:24 and minor in bits23:0; DWORD1 contains modifier byte, VK1 byte, VK2 byte for keyboard combos (or macro identifier for tag5); DWORD2 is parameter/raw action data. Remaining DWORD is not recovered here.

The key configuration table begins at configuration `+0x18`, also stride16; its byte `+12` supplies the matrix index. Thus UI record order is not matrix order. Builder accepts indices below144, although transmitted matrix length comes from `MatrixLen` (default128, stored as byte at config `+0x2f94`). **128 entries ×4 bytes =512 bytes per transmitted layer**, not128 bytes. The mismatch between144 profile slots/index check and configurable128 output entries needs care; do not assume every configured slot is populated or safe at every index.

`LayerMask` at config `+0x2d54` suppresses masked layers. Profile dirty bitmap `+0x30` selects writes; current layer is `+0x34`. Four layer outputs are contiguous with stride `MatrixLen*4`. When configured CRC/signature flag `+0x2f95` is nonzero, builder places DWORD `0xa55a0000` in the final matrix entry (little-endian bytes `00 00 5a a5`). This is a signature, not proof of a polynomial CRC.

## Actual converter / vtable

Constructor `0x498dc0` installs `CDevG5KB::vftable`. Exact table base `0x6247f4` resolves these slots: `+0x3c` Apply=`0x49c020`; `+0x5c` SetMatrix=`0x499600`; `+0x60` GetMatrix=`0x499640`; `+0x64` SetMacro=`0x499850`; `+0x68` GetMacro=`0x4998a0`; **`+0x98` key conversion=`0x49a920`**. Builder invokes that virtual conversion for each nonzero record. Unsupported conversion returns `0xffffffff` and logs invalid key details.

### Action major tags (0x49a920)

Names below are derived from encoding, not a complete UI enumeration.

| Profile major | Observed conversion |
|---|---|
|1|Mouse-like actions: minor11→`00010101`,12→`00010301`,13→`00010201`,14→`00010401`,15→`00010501`; device type1 swaps14/15. 16→`32020101`,17→`32030101`,19→`00000801`,1a→`00000901`,1b→`32ff0701`,1c→`32ff0601`.|
|2|Keyboard combo: packed bytes `[00, modifierMask, HID(VK1), HID(VK2)]`. Special VK1 FA/FB with no modifiers→DWORD D/10D; VK1 40→`2c000000`; VK1 1..5 returns parameter DWORD2 directly. Media aliases88..8f,99..9b use consumer-action constants.|
|3 or4|Consumer/media minor21..39 maps to fixed action DWORDs; e.g22→`cd000002`,26→`e9000002`,27→`ea000002`,28→`e2000002`,34→`23020002`.|
|5|Macro: lookup DWORD1; macro metadata mode byte+0xf 0→wire mode1 and count byte+0xe; mode1→wire2,count1; mode2→wire4,count1. Initial packed bytes `[03,wireMode,count,00]`; builder replaces high byte with zero-based macro-buffer index.|
|6|Built-in shortcut/system constants. Includes minor60→7,61→`01000007`,62→`02000007`,63→`04000007`,64→`02000010`,65→`04000010`; minor a2→zero. Do not assign reset meaning from constants alone.|
|8|Advanced/raw: a2/a7→zero; a6→`((parameter-1)<<24) | 0x505`; a8/a9/aa→105/205/405; ab→E; ad→parameter; ae→8. a4 packs parameter bytes and pseudo-button f0..f4. Exact UI semantics unresolved.|
|9|Minor0 returns DWORD2 verbatim; nonzero delegates `0x468420` (not recovered).|

Numeric constants are hexadecimal except explicitly stated. Tag0/unknown tags are not automatically valid passthrough actions. Complete switch pseudocode is preserved in evidence.

## Windows VK to HID

Macro serializer `0x49b000` scans115 pairs at `0x61a288`, pair layout `[HID,VK]`; exact bytes and all decoded pairs are exported. Examples: VK41→HID04 (A), VK1b→29 (Escape), VK70→3a (F1), VK0d→28 (Enter). Unknown VK yields0 and event is logged/skipped. Modifiers have explicit macro mappings: generic/left Ctrl→E0, Shift→E1, Alt→E2, left Win→E3; right Ctrl/Shift/Alt/Win→E4/E5/E6/E7. Keyboard combo conversion invokes `0x482180` twice. Its recovered body explicitly takes the VK in ECX and scans the same115 pairs, returning HID or0. Thus pseudocode's missing formal arguments reflect a register calling convention, not an argument-free conversion. Macro lookup helper `0x479f30` similarly consumes an identifier in EAX and returns the resolved node's+0x14 object; a decompiled 64-bit return at its caller is an ABI artifact, not a real two-value API.

## Macro blob and event contracts

`0x49b3d0` walks unmasked layers for major5 records, resolves macro IDs, deduplicates by temporary macro object buffer ID (`+0x50`, assigned starting1), and writes zero-based ID into matrix byte3. Macro IDs in profiles are not firmware offsets. Existing temporary IDs are cleared through `0x479f60` after building. If changed layers contain macros, Apply marks other unmasked macro-bearing layers dirty too, to keep directory references coherent.

Blob begins with N directory entries of four bytes each: **LE16 absolute blob offset, LE16 record size**. No independent N header is visible here; N is returned separately to Apply, and firmware interpretation/termination remains unverified. Payload immediately follows the N×4 directory. Record starts with one byte name byte-count, followed by up to30 UTF-16LE code units (maximum60 bytes), no terminator, then four-byte events. Directory size includes the name prefix and name. Offsets initially relative to payload are adjusted by directory size.

Source macro object: name at+0x14, event count DWORD+0x58, event array+0x5c. Source event stride12: u16 VK at0, u16 state at2, signed32 delay at4, value/magnitude at8. VK0 terminates processing early.

Serialized event (0x49b000):

```
byte0 = (type << 4) | ((delay >> 16) & 0x0f) | optional0x80
byte1 = delay >> 8
byte2 = delay
byte3 = HID / button mask / movement value
```

Delay upper clamp is `0xfffff` (20 bits); negative delays are not visibly lower-clamped. Units are **not proved** by this serializer. State==0 sets bit7 except types3/4/5. Whether that means release versus press requires recorder/decoder validation; avoid guessing.

Types:0 regular keyboard,1 modifier,2 mouse buttons (pseudo-VKs f0..f4→1,2,4,8,10; device type1 swaps last two),3 pseudo-VK f8,4 f9,5 wheel f5/f6 with opposite-signed magnitude. f8/f9 axes are probable but not confirmed. Zero movement falls through regular lookup rather than emitting a movement event. Invalid/zero HID events are skipped.

Repeat/count is **in the matrix macro action**, not the per-macro event payload. The count serialized for mode0 is one byte; semantic labels (finite repeat/while-held/toggle) still need UI or decoder corroboration. No event-count field is inserted into payload.

## Capacity and apply hazards

Configuration loader `0x411830` reads `MacroBufferSize` default4096, `MaxLoopCnt`, `MaxDelay`, `MaxAction` (latter defaults0). These are host configuration values, not independently proved hardware limits. Apply `0x49c020` allocates a macro scratch region0x2800 and warns if configured capacity exceeds it. Builder uses an8192-byte payload temporary and a200-u16 directory temporary (nominal100 directory entries). Per-macro serializer uses4096-byte scratch. **These stack sizes are observations, not safe supported limits**: visible checks do not establish complete bounds before each append; builder checks running size before adding a new macro, not clearly the full post-append size. Do not invent a maximum event count from scratch dimensions.

Apply flag1 builds key/macro output, sends dirty unmasked layers via slot5c with `MatrixLen*4`, clears profile dirty bits, then sends macro buffer via slot64 only if macros exist and dirty layers need them. Therefore failed macro transfer can occur after matrix changes/dirty-bit clearing; this is not an atomic transaction. Sleep/retry and transport details belong to the transport document. GetMatrix/GetMacro routines issue SetFeature requests before GetFeature; their names do not make them safe read-only device operations. **None were executed.**

## Confidence / remaining work

High confidence: table bytes, virtual slot resolution, record strides, packed output fields, macro directory arithmetic, name encoding and event bytes. Derived: friendly action categories, repeat labels, axis labels. Unresolved: actual active backend/revision/transport, firmware acceptance, delay units, state polarity, effective capacity enforcement, complete tag6/8 UI meanings, raw tag9 helper, full inverse macro reconstruction. Decompiler reports unstable type propagation/nonstandard calling conventions; output buffers and sizes were traced across callers, but assembly validation of these routines was not available through the current runner allowlist. No claim of live round-trip correctness is made.

## Base-object glossary for cross-document offsets

- **Device definition:** heap `0x314`-byte model record loaded from KB.ini; VID/PID offsets0/2, family Fw offset0x18; used by backend factory.
- **Loaded model/configuration object:** definition+0x24 points at parsed capability/layout metadata; offsets such as +0x2f94 MatrixLen and +0x2f95 CRC are relative to this object, not a user profile or packet.
- **User profile:** host editable state with layer records beginning+0x38 (four0x900-byte layers), effect state and macro references; not raw device memory.
- **Device configuration payload:**128-byte read-modify-write body; offsets such as+0x0a effect,+0x18 sleep,+0x7e marker are relative to payload start, before the transport's separate8-byte header.

Correct numeric offsets applied to the wrong base object produce incorrect packets. Preserve these distinctions in future types and encoder APIs.
