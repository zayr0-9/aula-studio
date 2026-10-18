# Phase3 status — approved metadata and offline scaffold

## Completed

1. **Metadata-only HID access:** used zero-access shared handles and Windows preparsed capability APIs, never report IO. Eight matching interfaces inspected; no failures. **MI_01/COL06** exposes vendor usageFF00/1, feature length520 and reportID6, matching the recovered official primary transport. COL05 instead exposes feature length6/reportID5. This resolves the earlier collection/length ambiguity to a strong metadata-backed candidate, not live protocol acceptance. See [live-hid-metadata.md](live-hid-metadata.md) and [JSON evidence](evidence/live-hid-metadata.json).
2. **Capture feasibility:** official app is already running with window title AULA F75. Running executable path could not be read, so PID-to-installed-file identity is not conclusive. No USBPcap/Wireshark capture tools/drivers found in checked locations. PktMon/USB ETW availability is not proof of HID payload capture. No capture was activated, no driver installed or hook injected, and official UI left alone. See [capture-feasibility.md](capture-feasibility.md).
3. **Further static recovery:** mapped effect descriptors/palettes and distinct game RGB planes. Found selector21 versus420-byte palette-body discrepancy and index/plane bounds concerns; no corrective guessed renumbering. See [phase3-static-followup.md](phase3-static-followup.md).
4. **Query safety assessment:** examined vendor getters send SetFeature before GetFeature; nonmutating semantics are insufficiently established to issue them unattended under the no-guess instruction. **No vendor query or reversible settings write was attempted.** Metadata APIs above are the only new device-handle interaction.
5. **After the investigation gate:** scaffolded [offline F75 Studio](../app/README.md) with Electron, React, Tailwind, TypeScript, Vite HMR, ESLint and Prettier. Renderer has simulated lighting Draft/Apply/Revert and disabled future remap/macro controls; no HID dependency or hardware transport.

## Validation

- Metadata helper native structure sizes/offsets asserted; bounded run succeeded, handles/preparsed data cleaned up.
- Exact pinned scaffold dependencies installed locally with lifecycle scripts disabled. Inspected Electron installer explicitly downloaded runtime with bundled publisher checksums.
- Typecheck, ESLint, three scaffold safety tests, production build and Prettier checks passed during integration.
- Hidden Electron renderer/preload smoke test passed: simulator mode, hardwareEnabled=false, renderer loaded, no exposed Node require. Initial smoke harness deadlocked on top-level await of app.whenReady; moving await inside async startup fixed the test harness. This was not a keyboard failure.
- HMR configured; interactive editing/reload not manually verified. Packaged installer/signing and hardware behavior untested.
- Useful phase3 context/findings exported under evidence; no reliance on memory-only bindings for continuation.

## Requires a later session / decision

- Select/approve a real USB payload-capture method; installation/elevation/restart/driver changes need explicit scope.
- Observe one controlled official-app action with owner able to verify keyboard behavior.
- Validate a specific nonmutating query contract before sending it; do not treat getter names as safety evidence.
- Resolve static RGB discrepancies and firmware limits before encoding real writes.
- Later approve one reversible custom operation; persistence/reconnect/interruption/recovery tests remain deferred.
- App next work: real recovered key geometry, offline protocol fixtures/decoder tests, then separately reviewed device service. Current scaffold does not implement the protocol library or complete feature editors.

## Safety record

No SetFeature/GetFeature, report ReadFile/WriteFile, reset, flash/update, pairing, settings mutation, reconnect or original-app launch/stop/UI interaction was performed by this phase. No USB capture drivers installed. The already-running official application's independent activity is outside our control; no traffic conclusions are asserted. Our metadata handle access is documented separately rather than described as zero device access.

## Final review and persistence update

Independent read-only review found no blocking safety issue. Follow-ups applied: production renderer CSP now denies connections (`connect-src 'none'`), and metadata enumeration safety-bound reporting no longer depends on matching-interface control flow. The metadata helper was not rerun after this reporting-only change; prior captured observations remain unchanged. Final typecheck, lint, three safety tests, build, formatting check and hidden renderer/preload smoke passed again. That smoke uses a test window/handler and does not runtime-test production main-process sender/navigation guards; those were source-reviewed only. REPL state expired during continuation, so metadata/capture/static artifacts were successfully re-imported; the compact phase3 handoff is exported for future continuation.
