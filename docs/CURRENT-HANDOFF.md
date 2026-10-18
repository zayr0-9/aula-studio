# Current continuation handoff

## Current state — 2026-10-18

Read `../AGENTS.md`, current source, `MACOS-DISCOVERY-HANDOFF.md`, then task-specific evidence. Older documents describe an offline scaffold; that is historical, not current runtime behavior.

Windows x64 implementation exposes guarded onboard lighting reads/writes (Fixed_on/Neon_stream/Blossoming selectors; mapped brightness, supported speed; Fixed_on RGB/Colourful), validated ordinary/modifier shortcut remapping, and opt-in knob interception. UI supports system-default persistent themes and reduced-motion-aware animations. Native Windows helper access is exact-target guarded, serialized and failure-latched. UI startup may read device state. Mac has no hardware backend; retain that gate.

## Latest task: physical per-key indicator feasibility

Owner's intended eventual feature: independent keys1–4 show generic activity status, green running/purple completed/red error, with application-neutral automation. No MCP service, activity adapter or indicator UI has been implemented.

Completed:

1. Inspected local Rust Keylux and pinned OpenRGB sources. Neither reference alone established compatibility with owner's keyboard. Do not execute Keylux whole captured configuration.
2. Captured official wired per-key edits twice; sanitized outgoing control reports retained under `evidence/`. Raw PCAP intentionally not published.
3. Focused capture proved static setter06, declared384bytes, planar126-slot channel stride. Four sparse indices7/13/19/25 hold digits1–4. Config custom flag9=1, selector10=21; config59 remains0x40 (not Keylux's0x47).
4. Owner physically confirmed1green,2magenta,3red,4blue and all other keys off; closed official app and Studio.
5. Research-only `../scripts/query-static-colors-once.ps1` defaults to offline compile/ABI validation. Explicit `-Execute` sent one sourced86getter and one feature read, returning precisely the four expected colors with validated candidate header/padding. No custom color/config setters were sent.

Evidence:

- `PER-KEY-VERIFICATION.md` — ordered chronology and limits.
- `evidence/per-key-vendor-capture-20261018.json` — first mixed-action control-only capture.
- `evidence/per-key-digits-capture-20261018.json` — focused matching capture and config differences.
- `evidence/static-query-once-20261018.json` — matching guarded custom getter API buffers.
- `DIRECT-MISMATCH-INVESTIGATION.md` — historical direct08one-frame attempt only visibly dimmed U temporarily; not solved by the static result.

## Next gate

Implement/review a custom-mode configuration validator separately from production ordinary-mode Query; do not weaken current refusal globally. Establish static getter freshness and full table preservation before one scoped static color edit/readback and physical confirmation. Never use captured tables as live restoration sources. Static06updates are not an animation loop: Keylux reports repeated writes can blank hardware. Direct08streaming, persistence, timeout and restoration remain separate unverified contracts. The current physical board may still be in custom mode; ordinary Studio helpers reject it intentionally. Do not silently restore or write settings on startup.

Readback caveats: HidD_GetFeature returns success, not actual transferred length. No independently established static marker/freshness guarantee exists. Matching expected colors is one useful observation, not universal integrity attestation.

## Portability and artifacts

Scripts contain historical absolute Windows paths; treat these as evidence, not portable commands. Native transport/helpers are Windows-only. Use relative project paths on Mac and develop mock/offline behavior first. USB capture tooling requires installed Windows drivers and explicit owner coordination; do not run/install on Mac. REA reports preserve target hashes, locations, provider limitations and static excerpts; vendor binaries are not included. Local `../.agents/skills/transitions-dev` collection is excluded from publication, while applied CSS remains part of the app.
