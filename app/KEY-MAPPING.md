# Restricted PgUp/Home onboard mapping

Current scope: physical PgUp matrix86 base layer0 only; target Home74(4Ahex) or PgUp75(4Bhex). No arbitrary indices/reports, Fn/modifiers/knob/macros, other layers or factory reset exposed. Remapping page explicit Read and Apply; app startup never reads/writes mapping.

Restoration verified by one additional guarded layer0 query with official app/Studio absent: evidence/matrix-layer0-20261017-231730.json (in ../docs). Entire520byte response equals pretest snapshot,0differences, PgUp usage75. No mapping write in this verification.

Native MatrixQuery constructs83 layer0 request; checks fresh520byte buffer header, signature report516..519=00 00 5A A5, existing PgUp entry ordinary00 00 00 4A/4B. Refuses unexpected assignments rather than overwriting them. Set reads fresh, clones, changes report355 only, writes03 layer0 once, then queries and compares all512payload bytes. Same exact collection/capabilities, global mutex, official-app checks; same main shared queue/fault latch/timeout/shutdown. No captured-buffer restoration or retry. bool-only GetFeature limitation remains, snapshot not complete backup and no guarantee of recovery/persistence.

Semantic IPC mapping:read-pgup/no args, mapping:set-pgup/one allowlisted usage; renderer cannot provide matrix buffers/index/layer/commands. Existing lighting operations unaffected.

Validation:58 Node tests passed; native pure WithPgUp reflection test passed against fresh canonical layer snapshot with preservation/immutability/invalid header/signature/source/bounds checks. Native compiled, typecheck/lint/format/build/mock Electron smoke passed. No custom matrix setter run during implementation. First offline fixture test failed due hand-copied array and was corrected to load canonical evidence; passing results are subsequent run.

Acceptance pending: close official app, restart dev process, Remapping page Read assignment; choose Home and Apply; verify physical PgUp behaves as Home in a nonsensitive text/navigation test. Choose PgUp original and Apply, verify restored. Both operations must report full-layer verification; stop on failure. Do not infer all remapping safe from this one reversible case. Custom knob software actions remain TODO.
