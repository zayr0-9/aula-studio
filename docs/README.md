# AULA F75 official-software investigation

## Current entry point

Start with [Current handoff](CURRENT-HANDOFF.md), [Per-key verification](PER-KEY-VERIFICATION.md), and [Mac continuation](MACOS-DISCOVERY-HANDOFF.md). The status below is historical and superseded by current source/newer reports. Some machine-identifying evidence and proprietary/raw artifacts referenced by older reports are intentionally not included in the public repository.

## Historical status

**Latest: [Phase3 metadata, capture feasibility and offline app status](PHASE3-STATUS.md).** Live metadata identifies COL06 / feature520 / reportID6. No vendor reports or settings changes were sent. Offline Electron scaffold is available.

**Goals 1–5 digital follow-up is now available: [Readiness report and durable handoff](READINESS-GOALS-1-5.md).** It includes stronger backend linkage, packet/feature serializers, cached HID usage mapping and persistence hazards. No keyboard IO or live testing was performed. Some hardware-readiness gates remain explicitly unresolved.

First-pass read-only investigation completed. We now have an installed-file/configuration inventory, resource/feature map, connected-device observations, selected native code map and initial HID transport analysis. This is a foundation for deeper reverse engineering, **not a validated replacement driver or complete protocol specification**.

## Reading order

1. [Application architecture and code landmarks](application-architecture.md): traced configuration loaders, discovery, backend candidates, Apply orchestration and network strings.
2. [Configuration and assets](configuration-and-assets.md): installed IDs/settings, 82-key layout, FN1 actions, lighting tables, skin/localization resources, signatures/hashes.
3. [Device observations](device-observations.md): present USB/HID topology, redacted identifiers and limitations.
4. [HID transport](hid-transport.md): distinct keyboard/mouse transports, inferred byte layouts, retries and decompiler uncertainties.

## Key findings

- Official executable is native 32-bit Windows code, not a web UI. Installed resources strongly support a generic configurable/skinned engine with keyboard-specific INI data.
- Installed profile configures wired `258A:010C` and wireless `3554:FA09`. Present USB/HID enumeration includes `258A:010C` (`Gaming Keyboard`), independently matching the wired profile. Exact physical revision and cable/receiver mode still need confirmation.
- Profile `Fw=24` is a family/config selector lead, **not a measured device firmware version**.
- G5KB-labelled code has a 520-byte feature-report path (8-byte header + up to 512 payload bytes). Its family-0x18 device finder looks for vendor usage page `0xff00`, usage 1 and feature length 520. Actual backend dispatch and live descriptor are not yet verified.
- The executable contains several device families, including mouse code with a different checksum/header. Generic resource strings and other backend commands are not evidence of F75 capabilities.
- Software-level reads can start by sending `HidD_SetFeature`; “read” does not mean passive or safe without understanding the command.
- Apply is a multi-stage matrix/macro/lighting/config workflow, not proven to be a single isolated write.
- Embedded HTTP update/cloud strings exist. No network traffic was generated or observed in this investigation.

## Evidence and reproducibility

- [REA static Evidence](evidence/rea-static-evidence.json): successful tool responses with IDs, target digest, provider profile, limitations, xrefs and selected pseudocode.
- [Installed inventory](evidence/installed-inventory.json): all 145 file hashes/sizes and key metadata/findings.
- [Redacted device observations](evidence/device-observations.json): selected properties, commands and identity limitations.
- Target executable SHA-256: `1dfe4803efdbe14f66680f970a6d6f26108342fd49754234fa448dd0ebae44a7`.
- Analysis: REA 6.5.0, Ghidra 12.1.4, Windows x64 host, x86 target. Ghidra analysis databases are ephemeral; persisted Evidence is the continuation artifact.

Graviton discovered the MCP catalog but tool invocation failed locally with `no schema with key or ref https://json-schema.org/draft/2020-12/schema`. Analysis therefore used the same REA MCP server through its installed SDK using [rea-analysis.mjs](../rea-analysis.mjs), without modifying Graviton or REA. An initial SDK call used an obsolete timeout argument position and timed out at 60 seconds; corrected calls used `{timeout:360000}` and completed. Ambiguous bare import names were replaced with explicit thunk addresses. Failed calls are not used as positive evidence.

The allowlisted SDK runner reads a JSON request file and emits responses to stdout; it does not write evidence files itself. Its supplied requests contain static operations only. Example in PowerShell:

```powershell
& D:\Projects\tools\node-v24.18.0-win-x64\node.exe D:\Projects\aula\rea-analysis.mjs D:\Projects\aula\analysis-profile.json
```

Request files `analysis-initial.json`, `analysis-hid.json`, `analysis-decompile.json`, `analysis-backend.json`, `analysis-linkage.json`, `analysis-profile.json` preserve the discovery steps. The initial file contains ambiguous bare-name caller requests; use the address-specific later files instead. Reopening triggers fresh analysis and may take over a minute. Do not replace the static requests with execution/instrumentation/device-write operations without separate review.

## Safe next investigation sequence

1. **Finish static dispatch recovery:** trace Fw/VID/PID initialization, backend factory and vtables; confirm the F75-specific transport rather than borrowing mouse logic.
2. **Recover semantic operations:** matrix/key conversion, macros, LED settings, identity readback, Apply flags, host file persistence and device nonvolatile-save boundaries. Produce a command table with explicit unknowns; no guessed packets.
3. **Confirm hardware identity:** physical revision and connection mode, then identify the exact vendor collection and descriptor lengths. PnP observations alone do not establish report IDs or report layouts.
4. **Plan controlled observation separately:** user-approved official-app interaction/capture with one reversible action at a time, baseline export and before/after state. Treat launch/readback as potentially command-generating. No reset, updater or firmware operations.
5. **Only after validation:** implement a read/encode/decode layer with recorded-packet tests, then a minimal reversible feature and finally replacement UI design. Avoid full-profile writes until persistence and coupling are understood.

## Safety and validation boundaries

No official EXE/DLL/installer was executed by this work, no HID handle was opened by our device-observation commands, no keyboard command was sent, no firmware/reset/update action was performed, and no installed file or global configuration was changed. Ghidra reads an immutable target copy and executes its analysis runtime, not the target program.

Validation performed: hashes and file metadata; decoded configuration/resource inspection; present PnP/property enumeration; actual REA MCP analysis and selected decompilation; documentation/evidence linkage checks. Not performed: live UI reproduction, packet capture, live report-descriptor inspection, hardware command validation or protocol compatibility testing. Static decompiler output can have wrong signatures, register arguments, stack-array boundaries and control flow. All protocol-shaped results remain analysis leads until confirmed.
