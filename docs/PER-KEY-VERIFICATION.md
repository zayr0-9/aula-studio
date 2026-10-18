# Per-key lighting verification — current gate

## Scope and authorization

Owner requested verification of independent physical-key lighting before agent indicators, and authorized keyboard reads/queries and investigation. This session inspected the local Rust Keylux repository and pinned OpenRGB resources. No new direct/static color write, configuration mode change, background refresh, installer, firmware operation, or key-matrix write was performed.

## Current device observation

A single production-guarded query was run on 2026-10-18:

`powershell.exe -NoProfile -NonInteractive -File app/native/brightness.ps1 -Action ReadEffect`

Result: `1` (ordinary Fixed_on). Command succeeded using production unique-device enumeration, native capability/identity checks, official-app exclusion and shared mutex. This is configuration observation, not per-key acceptance. HidD_GetFeature returns success without independent actual-transfer-length attestation.

Process preflight found four Electron processes belonging to `D:/Projects/aula/app/node_modules/electron/dist/electron.exe`: Studio was running. No matching OemDrv, Keylux or OpenRGB process was returned by that check. Process checks are observations, not exclusive ownership guarantees. No processes were stopped. Direct experiments remain gated while Studio can issue lighting operations.

## Reference findings

### Rust Keylux

Local source: `D:/Projects/keylux/crates/aula-protocol/src/f75/`.

- `protocol.rs`: stream command08, 378 interleaved RGB payload bytes, 520-byte feature report, header `06 08 00 00 01 00 7A 01`.
- `mod.rs`: `encode_stream` and `stream` implement that format; matching frames skipped with 2-second keepalive; minimum wired frame gap46ms.
- `keymap.rs`: 90 sparse positions, 80 populated physical keys. Candidate digit slots1–4 are7,13,19,25. These are not physically verified on this owner's board.
- Mode tuple at configuration offsets9,10,59 is `[01,15,47]`. Mode establishment writes an entire embedded `PER_KEY_CONFIG` and waits400ms, rather than preserving all opaque live configuration fields.
- Source reports upstream hardware testing and vendor captures. Those claims do not validate this owner's hardware. Raw source captures were not found in the checkout. Static plane-length and real-key-count documentation have inconsistencies.

Do NOT execute Keylux mode setup or replay its embedded configuration. Do NOT substitute a speculative patch of the three mode bytes: fresh-byte preservation alone does not establish that a mode transition is correct for this keyboard.

### OpenRGB

Pinned local source: `D:/Projects/tools/OpenRGB-source-8e16de2/CalcProgrammer1-OpenRGB-8e16de2/`.

- Same command08 header/interleaved encoding as existing Studio offline encoder and one-frame experiment.
- Unlike Keylux, mode-update implementation is empty: it does not establish the Keylux config tuple.
- Keepalive checks every500ms and requests updates after more than1second in Direct mode. These are implementation timings, not measured firmware guarantees.
- Its detector probes multiple vendor paths and does not satisfy Studio's exact-target admission rules; do not launch it as an unreviewed experiment.
- Upstream source is GPL-2.0-or-later; use the existing provenance/licensing boundary in OPENRGB-DIRECT-RESEARCH.md.

## Why indicators are still gated

Historical direct-frame-once evidence matches both sources' candidate report construction. Owner observed only U dimming briefly and returning. There was no control-transfer capture of that send. No byte-construction defect or independently verified cause has been established.

Potential differences include mode lifecycle, temporary override timing, firmware compatibility and actual wire transfer. None warrants guessing packet fields, static setter commands, repetition frequency or configuration values. Current production color support is global Fixed_on RGB, not independent per-key colors.

## Next verification sequence

1. Owner closes Studio and any competing keyboard controller. Recheck immediately before opening and each operation; retain native mutex and all exact-collection guards.
2. Establish a reviewed capture/observation procedure for the authorized keyboard only. Capture control transfers, not ordinary input contents. Do not install or elevate tools silently.
3. Prefer a vendor-controlled wired per-key/music-reactive operation, if the corrected official application actually exposes it, to obtain this device's mode transition and stream data. Launch and UI interaction must be coordinated; stop custom access while official app runs.
4. Alternatively review a narrowly bounded replay of the already sourced transient direct format with explicit frame/count/time bounds and a visual observation window. This requires consciously resolving the direct-frame readback exception; neither HID success nor unchanged configuration verifies LED contents. It must not be represented as a safe verified path in advance.
5. After a working color path is observed, test isolated digits1–4 with distinct colors, then swap colors to prove slot and channel independence. Record owner observations separately from API success and wire evidence.
6. Establish timeout/exit behavior and effect interference without promising automatic restoration. Do not repeatedly write persistent static tables; Keylux warns of board blanking under repeated static writes.
7. Only after physical acceptance implement an opt-in indicator session with scoped ownership, capped traffic, stop/timeout, existing queue arbitration and explicit uncertainty behavior. No agent integration or automatic startup is enabled by this document.

## Validation performed

- Read current production transport/service and relevant historical research.
- Independent read-only subagent reviewed Keylux implementation and local OpenRGB source.
- Production `ReadEffect`: succeeded, returned1.
- No new native source or application source changed; no application tests/builds were required for this documentation-only checkpoint.

## Isolation/capture preflight after owner closed Studio

Owner confirmed Studio closed. Process check returned no OemDrv, Electron, Keylux or OpenRGB processes. USBPcap metadata discovery still shows target USB Composite Device at address2 on USBPcap3, and exactly one VID258A/PID010C USB parent has the expected `PCIROOT(0)#PCI(0803)#PCI(0000)#USBROOT(0)#USB(1)#USB(2)` location. This metadata check did not start a recording or send keyboard reports.

Current tool process is NOT elevated. Existing capture supervisor deliberately requires an already elevated host and refuses automatic elevation. No capture or additional lighting write was attempted. Next action is owner-started bounded capture in Administrator PowerShell, followed by verification that capture-status.json actually reports recording with a live owned process before giving any official-app action sequence. Capture window is120seconds, so coordinate readiness rather than starting it prematurely.

## First owner-controlled wired per-key capture

Owner explicitly authorized launching elevated capture; UAC-launched existing bounded supervisor. Verified fresh recording status and live USBPcapCMD process before asking owner to use official UI. Capture stopped automatically. `capinfos` parsed98frames, from15:14:24.931233 to15:16:04.855867 local time on2026-10-18. SHA256 `3a555f90971ef9302da255f5a0a6fa518a49216459bc7187b3b63fea884c7acc`. Private raw capture: `capture-tools/brightness-20261018-151404.pcap`. Only target address2 control transfers inspected, not interrupt payloads. Official app remained running after capture; no custom keyboard operation attempted.

Sanitized control-only outgoing reports and candidate decoding: `evidence/per-key-vendor-capture-20261018.json`.

Important NEW owner-device evidence:

- Eight official applies each query84, write config04, then static color06. No direct08 stream captured.
- Configuration transition from frame22 response to frame23 setter changes custom flag/config9 from0to1 and selector/config10 from1to21; config59 stays0x40. Subsequent config read responses preserve that mode. This differs from Keylux's hardcoded `[01,15,47]` tuple, so its whole configuration must not be replayed.
- Static header `06 06 00 00 01 00 80 01`: declared384bytes, not Rust current378. Reports are520bytes. Do not replace the declared length with the Rust constant.
- Sparse changes fit126-byte RGB planes: report offsets15/141/267 correspond to digit1;21/147/273 digit2;27/153/279 digit3. 128-byte plane interpretation does not match this progression. Declared384byte payload does not imply128-byte plane stride; remaining bytes require analysis/preservation.
- Candidate final captured frame95 decodes digit1 green, digit2 magenta, digit3 red, digit4 red, Q black. Owner described Q green,2purple,3red,4blue, with actions not sequential. Do not claim physical mapping verified where this disagrees; editing may have continued after the120second deadline, or UI/key mapping assumptions may be wrong.

Next: ask owner to confirm physical final keys and redo a smaller single-key change capture if needed, including a baseline Apply and exactly one isolated key edit. No new setter/getter inferred solely from command symmetry. Static getter86 still needs review before a custom query; stream08 remains a separate gate. Studio's current production Query rejects custom mode, so keep Studio closed until an intentional supported ordinary mode is restored through the official UI, rather than treating that refusal as a transport regression.

## Focused digits1–4 capture — matching wire result

Owner reported all LEDs off, showed desired digit colors, and replied done after verified recording began. Capture `brightness-20261018-151940.pcap` automatically stopped; capinfos parsed30packets with actual activity15:19:49.383137–15:19:53.086976 local time. SHA256 `f8fb46e61b86abcacd5fbd19e5b2413419130269580080fe1987ee09dbfd882a`. Only address2 control reports inspected. Control-only evidence: `evidence/per-key-digits-capture-20261018.json`.

Frame4 configuration response is136bytes; frame5 config setter520bytes preserves all128configuration bytes except offsets9(0→1) and10(0→21). Offset59 remains0x40. Frame7 static setter520bytes has header `06 06 00 00 01 00 80 01`. Exactly four nonblack slots under126-byte planar RGB decoding:7green(0,255,0),13magenta(255,0,255),19red(255,0,0),25blue(0,0,255). Every other slot0–125 isblack; report386–519iszero. This matches requested digits1–4 against the candidate sparse physical map and removes the earlier mixed-action discrepancy at the wire level. Explicit owner confirmation of physical colors remains pending; done alone is not recorded as measured visual acceptance.

No new custom HID reports were sent. Per-key static vendor path now has owner-device wire evidence. This does NOT verify static getter86, custom preservation/restore, persistence across reconnect, command08 streaming or automation safety. Keep production feature gated pending physical confirmation and next readback/lifecycle investigation. Studio ordinary-mode helper rejects custom mode; keep it closed for now.

## Owner physical acceptance and static getter candidate

Owner explicitly confirmed physical digits1green,2magenta,3red,4blue, and both Studio and official app closed. Thus vendor static setter's candidate digit mapping and planar decoding are physically corroborated on this board; custom transport not yet verified.

Added `scripts/query-static-colors-once.ps1`, default offline compile-only. Getter86/declared0180 is sourced from Keylux's older TypeScript `readColorTable()` using `CMD.READ_COLORS`, `ADDR_COLORS`, `COLOR_LEN`, not merely inferred from setter06. Rust defines86but does not call it. Retains production enumeration/identity guards, native mutex, controller exclusion, one request/get, no retry or settings setters. Does not call ordinary-mode Query, which intentionally rejects custom mode. Header/padding validation is candidate framing only; there is no independently verified static-table marker, actual transfer length or freshness guarantee. Expected four-color comparison is necessary observation, not general integrity proof. Offline compile/ABI check passed before live execution.

## First custom static getter — successful matching observation

After independent static safety review and offline compile/ABI validation, executed the research script once with `-Execute` under owner authorization. One86request and oneGetFeature succeeded; expected `06 86 00 00 01 00 80 01` header and zero padding validated. Candidate126-plane decoding returned exactly slots7green,13magenta,19red,25blue and no other nonblack slots, matching the owner-confirmed physical pattern. Raw API buffers and result saved in `evidence/static-query-once-20261018.json`. No config/static-color setters, retries or restoration. Actual wire transferred length remains unknown; header and expected pattern are not a general independent length/freshness guarantee.

This establishes a useful first static-table read observation on the owner's keyboard. Next gate: preserve a fresh table and configuration, perform a narrowly scoped single static-color edit with full table readback, then an owner-observed second change to establish freshness. Requires an explicit read/validation path for custom-mode config without weakening production ordinary-mode refusal. No automatic background updates, repeated static writes, API integration or physical indicators enabled yet. Command08 streaming remains unverified.

## Single custom static write — digit1 green to cyan

Added research-only `scripts/test-static-key-once.ps1`, offline by default. Independent read-only safety review found no blocking encoding/guard defect. Synthetic offline compile/ABI and untouched-byte preservation checks passed. First live attempt stopped BEFORE any color setter (`writeAttempted=false`): reflected void/null output from CheckOfficialApp contaminated Read-Block's PowerShell return stream, causing byte-array-to-int conversion failure. Reproduced entirely offline with a mocked null-returning guard, then suppressed that guard output; reran offline compile. This was not a retry after an uncertain color write.

Corrected experiment succeeded: fresh custom config84 and table86 reads, baseline required exactly the four owner-confirmed colors, config reread unchanged, ONE static06 setter changing digit1green→cyan,500mssettle, complete table86readback and config84readback. Only report offset267changed0→255 (digit1blue component); every other table byte including unknown tail preserved, all128configuration bytes unchanged. No configuration/mode setter, automatic retry/restoration, refresh loop or fixture replay. Full results: `evidence/static-digit1-cyan-test-20261018.json`. HID API success still does not independently attest actual wire length.

Physical acceptance pending: owner should observe digit1cyan/turquoise,2magenta,3red,4blue, othersoff. Leave current state for observation; no automatic restore. This tests one static edit, not sustained status updates or stream08. Production service/UI remain unchanged and indicators gated.

## Physical acceptance of custom single-key write

Owner replied confirmed to the explicit physical pattern1cyan,2purple,3red,4blue, allothersoff. The custom static06write therefore produced the intended isolated physical digit1change as well as matching full table/config readback. This establishes independent physical digit color control for the four candidate slots on this wired keyboard and successful readback of a changed blue channel, not only the original vendor snapshot.

Verified scope: vendor custom-mode establishment, digit slots7/13/19/25,126-byte planar RGB, observed384-byte static request declaration, sourced86readback, one fresh-preserving06edit with unchanged128-byte configuration. Unverified: sustained/repeated static updates, persistence/reconnect, direct08streaming, safe ordinary/custom transitions implemented by Studio, overlaying onboard effects, and automated session cleanup. No production per-key API or indicators enabled. Current state intentionally remains the accepted custom pattern; Studio's ordinary-mode transport will refuse custom state until a deliberate ordinary-mode selection through the official app. No new hardware traffic occurred after owner confirmation.

## Offline application codec and regression coverage

Implemented isolated `app/src/protocol/f75-static.ts` from owner-device evidence (not imported into production). Exposes fresh query construction, validated digit1–4 planar decoding, fresh-response-preserving edit construction, duplicate/no-op detection and complete expected readback comparison. Distinguishes384-byte static payload declaration from126-byte plane stride and preserves opaque payload378–383. No raw packets, hardware access, IPC or timers exposed. Only four physically corroborated digit mappings allowed; direct08codec remains separate and unverified.

Added five capture-backed test groups in `app/tests/f75-static.test.mjs`: accepted colors and exact cyan mutation; header/padding/length rejection; all-byte preservation including nonzero opaque tail; no aliases; invalid/duplicate/unknown key/channel refusal and no-op reporting.86total offline regressions passed. Typecheck initially caught Array.isArray widening losing edit-key type; an assertion validator fixed it. Final typecheck, lint, changed-file Prettier and narrow tests passed. No further keyboard traffic or settings changes occurred. Runtime transport/session integration and repeated static-update endurance remain gated; no claim that a pure codec's fresh parameter attests actual device freshness.

## Bounded direct08 test at owner-requested800ms

Owner reported all lighting off, authorized step1 at800ms and then confirmed official app closed. Added offline-by-default `scripts/test-direct-stream-bounded.ps1`: six fixed520byte interleaved08frames, each lighting only candidate slots7/13/19/25 at channel intensity64, red→blue→green twice, allother slotsblack. No configuration or static06setters, retries, refresh after test or restoration. Production exact-device guards/native mutex/process rechecks retained. Configuration admission uses validated mode-aware IndicatorQuery (ordinary or exact known custom); preflight observed ordinary off tuple[0,0]. No mode switch made.

Offline compile/ABI and frame assertions passed. Live test completed six successful HID API sends, monotonic send times13,856,1698,2555,3400,4239ms (intervals exceed800ms due to guard/API overhead). No reported API error; raw result `evidence/direct-stream-800ms-20261018.json`. No direct-color readback or wire capture performed. API success is not visual acceptance. Await owner observation of digit1–4 colors and post-test reversion before any whole-keyboard traversal. Firmware may ignore or override direct frames in ordinary off mode; no unverified custom transition attempted.

Owner confirmed the800msdirect test worked: physical keys1–4 lit and switched colors. This is first physical acceptance of command08streaming on this board, starting from ordinary off mode without any mode/config write. Scope remains six frames/four keys/intensity64 at observed≥800msgaps. Post-stop reversion behavior, all80physical mappings and faster pacing remain unverified. No additional hardware operation performed on receipt of confirmation.

## Full80-key direct walking test — owner accepted RGB

Owner authorized single bounded red→blue→green walk at800ms. Added offline-by-default `scripts/test-direct-walk.ps1`. Map matches all80entries of existing F75_DIRECT_KEYS in physical row order; one slot lit per frame at intensity64, other slotsblack. No config/static setters, retries or restoration. Require ordinary off state (matching accepted short test), preserve exact-device admission/mutex/controller checks;225second cooperative deadline between frames. Synchronous native call hangs are not bounded by that cooperative deadline.

Offline validation passed. Independent subagent reviewed map/guards and launched once as child PowerShell PID17968 with stdout/stderr logging, rather than imposing the shell tool180second cap on the ~200second test. Launcher tool itself timed out waiting on inherited process handles; no retry/second launch. Completed result confirms240attempts,240API successes,errornull,minimum inter-send gap823ms,maximum851ms,last frame at200215ms. Stderr empty. Raw result plus owner acceptance saved to `evidence/direct-walk-800ms-20261018.json`.

Owner first confirmed red on all keys while blue ongoing, then explicitly confirmed entire RGBtest complete. All80candidate physical LED mappings and red/blue/green streaming are now owner-accepted under this bounded test, not merely inferred from source. No guarantee for other keyboards/firmware, faster updates or long unattended sessions. Prior four-key test owner observed colors expire to dark after stop; full-test exact timeout not measured. No keyboard input was logged. Production streaming/session API still not implemented; manual static indicator UI remains separate.

Owner additionally confirmed all keys unlit after the full walking test stopped. Thus expiry back to the initial off appearance is physically accepted after both short and240frame tests. Exact timeout and configuration byte equality after the walk were not measured; do not equate visual expiry with a complete verified configuration restoration.
