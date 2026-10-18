# Keylux comparison — pinned source inspection

Repository https://github.com/SibteProf/keylux at HEAD95e7f5b56f111902b8ccb9ecbc4b3509d547352f. git ls-remote and raw source inspected, no clone/build/execution/device requests. Sources: crates/aula-protocol/src/f75/keymap.rs, protocol.rs, mod.rs; docs/PROTOCOL.md; LICENSE-MIT. Repo has LICENSE-MIT and LICENSE-APACHE; inspected MIT notice copyright2026Sibte Hussain. No upstream implementation copied into app. Local docs store conclusions, not license determination for future reuse.

## Confirmed physical indices

Keylux LED_ORDER explicitly claims derivation from83 matrix getter and lists90slots with80populated keys (despite introductory comment saying90real keys). Actual parsed counts90/80 agree with existing sparse lighting evidence. Selected entries all match our corrected ANSI configuration/live matrix snapshot: Escape0, backtick1, Fn53, rightCtrl59, backslash80, Enter81, Delete85, PgUp86, PgDn87, End88, rightArrow89. Slot84=None is correct for LED scope, while our matrix84 is special Wheel07 00 00 1D. Do not treat None as unassigned remappable matrix slot or include knob as an LED. Their physical rows put Fn then RCtrl on bottom row, consistent with owner hardware. This is useful reusable geometry, not full action-binding serializer.

## Protocol comparison

Matches: wired258A:010C, reportID6 length520,8byte header/512payload, config getter84/setter04 length128, marker5AA5. Solid selector [config9=0,10=1,59=0x40] matches our Fixed_on solid setting (3B lower nibble0), and embedded first effect47 is consistent with our Colourful7 nibble capture. Embedded config3A=9 and4E=9 are compatible with our known brightness fields. These constants do not implement global brightness or all per-effect controls.

Important DIFFERENCE: read_key_matrix builds83 with bytes2..5=[0,0,0,0], whereas corrected driver and our successful layer0 snapshot use[0,0,1,0] (one chunk). Upstream getter simply returns bytes after8 without validating complete header/signature in that function. Retain our captured header/validation; don't replace it with upstream request. Their ADDR naming treats these bytes as address, while corrected chunking code establishes layer/reserved/count/index roles. Their config/color common ADDR[0,0,1,0] matches ours.

No WRITE_MATRIX command or key-binding setter found in inspected F75 protocol/mod implementation. Keymap.rs describes LED/geometry ordering, not remapping UI/actions. It does not replace our captured03PgUp→Home→PgUp transaction or demonstrate ordinary/modifier/macro encodings. General repository absence beyond inspected files not claimed.

Upstream code includes whole known-good PER_KEY_CONFIG and animation/custom-mode paths, whereas Studio must preserve fresh opaque configuration and use existing exact collection/caps/process guards. Do not copy vendor-collection probing, canned config replay, retry policies, animation writes or radio protocol into this remapping task. Their hardware claims refer to their hardware, not new validation of owner's board.

## Decision

Can avoid manual per-key captures: use corrected official geometry/matrix indices as primary source, Keylux LED_ORDER/ROWS as corroboration, compare all ordinary entries against our fresh layer snapshot and standard HID usages. Fn/modifiers/wheel special types remain explicit exceptions. Capture/test representative action categories rather than every ordinary key. No production allowlist broadened in this comparison.

## Local checkout and full-repository search

At owner's request cloned to D:/Projects/keylux; HEAD95e7f5b56f111902b8ccb9ecbc4b3509d547352f, git status clean. No AGENTS/CLAUDE/context instructions found in clone. No builds/dependency installs/runtime execution. Searched entire clone for remap/keybind/SetMatrix/WRITE_MATRIX/write_matrix; no remapping setter surfaced, only read_key_matrix and lighting map references. UI intercepted-key mention concerns GUI key handling, not onboard binding. Local protocol.rs cmd module likewise only defines READ_MATRIX83, not WRITE_MATRIX03.

Compared corrected official model's81full physical records to parsed Keylux90slot table:80ordinary named entries, plus special Wheel84 with no LED name. Confirmed indices above match. This supports geometry reuse/cross-checking, not upstream implementation of remapping. Existing Studio fresh snapshot+captured03setter remains stronger evidence for binding writes.
