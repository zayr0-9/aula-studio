# Ordinary-key base-layer remapping

The Remapping page uses the reusable ANSI F75 keyboard to select a physical source, then a searchable, vertically scrollable grid of target keycaps. Selection is a local draft; only Apply writes. Read assignments explicitly loads device state, never at startup. Refresh discards the draft. Choose original key selects the original assignment but still requires Apply.

Scope: 73 ordinary physical keys plus six verified standalone modifier sources/targets; standard Keyboard/Keypad usage targets plus Home and Insert, and left Ctrl/Shift shortcuts only (masks0..3). Fn, knob, other modifier chords, macros and other layers are excluded. Unsupported current entries display as unsupported and cannot be overwritten. Physical key legends remain original so remapped keys remain identifiable; the selected key's current and proposed assignments appear below.

Semantic IPC accepts allowlisted source/target names, not matrix indices or report buffers. Transactions share the existing lighting service queue/fault latch and native device mutex. Each apply reads fresh Layer0, changes only the selected supported entry's modifier mask/usage, sends one command03 write and compares all512 payload bytes against a fresh command83 read. Unrelated entries are preserved; no saved fixture replay, retry, rollback, reset or recovery guarantee. Header and trailer validation and exact device/capability/OemDrv checks remain required. Boolean GetFeature does not independently attest actual transfer length.

Geometry corroboration: corrected official ANSI model1 and Keylux. Encoding evidence: canonical Layer0 snapshot and official PgUp/Home capture, with owner acceptance of restricted Studio PgUp remapping. General ordinary-key handling extends that verified format; offline tests/readback are not proof of physical output for every switch. No automatic live writes are part of validation.

## Motion skill

At the owner's request, Transitions.dev was downloaded from https://github.com/Jakubantalik/transitions.dev at revision7ec0b0b0b8beb15788a9de68a40ec6be2d5e84b5 into D:/Projects/tools/transitions.dev. The skills/transitions-dev folder is installed via a junction at the local Graviton skills directory. No repository executable or dependency installer was run.

The target chooser adapts the panel-reveal recipe with semantic timing/easing tokens, short12px travel and2px blur, using CSS starting-style for initial reveal. Reduced-motion disables transitions. No animation runtime dependency was added. Local skill license permits use/modification in products, not repackaging as a competing transition library; see the installed LICENSE.txt for terms.

## Verified Ctrl/Shift extension (2026-10-18)

The owner captured LeftCtrl, Ctrl+C and Ctrl+Shift+C on physical1, restoring original1. See ../docs/MODIFIER-SHORTCUT-CAPTURE.md and evidence/modifier-shortcut-capture.json. Fresh final layer exactly matches fresh pretest layer. Byte1 masks1/2/3 encode leftCtrl/leftShift/both; byte3 retains ordinary usage. Default leftShift and leftCtrl slots corroborate standalone encodings. Targets now include leftCtrl/leftShift and Ctrl/Shift/both plus ordinary keys. Physical leftCtrl and leftShift can also be remapped. Other modifier masks remain unsupported; Fn and knob remain outside mapping writes.

UI modifier toggles change the target-grid choices, not the keyboard state. Select the desired shortcut tile then Apply. Original physical legends stay stable. Current unsupported assignments cannot be overwritten. No runtime shortcut injection or macro recorder is involved: this extension is onboard matrix data.

Fn relocation/Fn-layer editing and Studio-only knob actions remain separate pending work; they are not enabled by this capture. New Studio shortcut press/release acceptance has not yet been physically tested.

## Verified standalone modifier extension (2026-10-18)

The corrected official capture brightness-20261018-105439.pcap frames249/251/253/255 assigns Left Win, Left Alt, Right Ctrl and Right Shift to physical1. Each Layer0 payload differs from canonical matrix-layer0-20261018-103210.json only at report offsets37/39. See ../docs/REMAINING-MODIFIERS-FN.md and ../docs/evidence/remaining-modifiers-fn-capture.json. The exact standalone entries are [0,8,0,0], [0,4,0,0], [0,16,0,0] and [0,32,0,0]; canonical source slots are11/17/59/70 respectively. Together with left Ctrl/Shift this yields79 source keys and81 base targets. New modifiers are standalone tiles even when Ctrl/Shift chooser toggles are selected; they never gain chord prefixes.

Ordinary shortcut decoding still accepts masks0..3 only. The six standalone masks require usage0; combined modifier-only masks and all new modifier+ordinary chords remain unsupported. Fn remains rejected as source and target, including the captured type13 entry: the multilayer observation is not a safe fresh-read/preservation contract. No new hardware I/O or automatic writes were used for validation, and Studio physical press/release acceptance remains pending.

Mapping responses now have a maximum4297 UTF-8 bytes including CRLF (all79 sources targeting Ctrl+Shift+BracketRight), exceeding the former4096-byte child stdout limit. Only the mapping adapter uses a bounded8192-byte maxBuffer; scalar lighting/color limits remain4096. Native and adapter offline tests cover the maximum, oversize/malformed refusal, exact captured encodings and byte preservation.
