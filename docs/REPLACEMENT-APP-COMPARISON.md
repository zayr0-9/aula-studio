# Replacement installed app: initial static comparison

Running OemDrv PID4928 title AULA F75; executable path inaccessible, so exact process-to-file linkage not conclusively verified. Installed root C:/Program Files (x86)/AULA/F75 now contains model configs Dev/kb/1, F75KR, wired; former fr profile absent from enumerated KB.ini paths. Corrected read encoding: new KB.ini files ASCII-compatible, unlike old UTF16LE files. Oversized initial JSON captures truncated and were not relied upon; focused reads below established facts.

Installed OemDrv.exe SHA256 7c41a8af17b8d1577ac5660b8f0ce1be61da50fd33a5238158c62e6097292783,2633216 bytes, Authenticode NotSigned. Previous installed executable was signed and hash1dfe4803efdbe14f66680f970a6d6f26108342fd49754234fa448dd0ebae44a7. Signature difference is provenance information, not proof of maliciousness.

Dev/kb/1/KB.ini SHA256 bde7c62053f16ff57f01b486074a7106a72e293e359c57183e1c4aa534049fdd. Primary258A:010C, wireless3554:FA09, Fw24, CRC1, MatrixLen128 match former model. All three model configs use primary same IDs; wired folder is a model variant, not automatically selected just because owner's tri-mode keyboard is connected by cable. UI title AULA F75 is consistent with model1, not runtime selection proof.

Critical differences: new Fn K76 VKFA matrix53; new rightCtrl K75 VKA3 matrix59. Old French profile assigned Fn matrix59 and rightAlt matrix53. This directly explains the observed old logical-position mismatch. New backslash K43 VKDC matrix80; new Enter K57 VK0D matrix81. Full matrix/Fn-layer audit remains pending. LedOpt10/11 entries match previously documented values; this is static compatibility evidence, not proof new executable uses identical transport/config interpretation.

Owner performed onboard reset, confirmed correct Fn/Ctrl and backslash key now emits UK-layout #/~; owner installed new app and applied brightness without mapping regression. Original saved configuration and old restoration buffers must not be reused as current baseline. No keyboard commands/capture/settings changes made during this comparison. Fresh official-app brightness capture requires owner to state current effect/brightness/speed and coordinate 9->8->9; do not launch historical custom helper against stale baseline.

## Fresh ANSI-app capture

Owner completed Neon_stream brightness9->8->9 (speed4, Colourful). Capture stopped and parsed successfully:84 packets, SHA2566beea04dedce92067c2ed3bf02c3c74ef3932675f005abc864965f89414fcfbd. Control-only evidence [ansi-brightness-capture.json](evidence/ansi-brightness-capture.json). Each cycle is query84/GetFeature, config04, then palette0A. This differs from old app's palette-before-query order. No matrix03 command observed in the extracted control transfers.

Incoming configuration responses136 bytes, outgoing reports520. Exactly configuration offset0x4E changes9->8 then8->9; palette writes identical. Unchanged offline codec replays both new writes exactly;13 tests, typecheck, lint, formatting passed. Fresh restored frame59 is captured sent baseline, not independently queried final state. Old baselines must not be used for restoration. Historical custom helper BrightnessTest now explicitly blocked to prevent stale baseline use. Electron hardware remains disabled; integration not implemented yet. Owner explicit physical/Fn/Ctrl confirmation for this cycle pending.
