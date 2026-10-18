# Persistence, Apply, and hazardous operations

## Scope and evidence

Read-only static analysis of `OemDrv.exe`, SHA-256 `1dfe4803efdbe14f66680f970a6d6f26108342fd49754234fa448dd0ebae44a7`, x86 PE, Ghidra 12.1.4 via REA. **No original application launch, device opening, HID requests, settings writes, reset, pairing, updater execution, or recovery tests occurred.** Host inspection was aggregate directory metadata only, not macro/profile/account contents.

Evidence: `evidence/phase2-persistence-evidence.json` contains complete REA Evidence records, parameters, limitations and pseudocode. Key IDs:

- E-Apply: `ev_31a2ec1c4fd73642f997f64de7bf1ac9eeb334bc616074be43e90b0a2de986ca` (prior profile batch, includes `FUN_0049c020`).
- E-Host: `ev_252e74179ce726378c415c649a04e3cda7f0ac372859f910d32c9e197b82dd2f` (import/export, saves, update UI/thread).
- E-Path: `ev_a07b943b0cff14d09916398aa233d65282be01d34f733b142a99ffd7666061ea` (path builder and save caller).
- E-Dispatch: `ev_df3d80e729c4522e688c559b6b27456d8d0e30dd5573810fcf556c78cf8e1e0b` (Apply wrappers).
- E-Import-helper: `ev_c7b9c2d1292c6a9d83cc7d8c162e3d47314c213f5eed5f5c4b00ca438af94e71`.

Confidence labels below describe static control-flow confidence, not live hardware validation. Decompiler ABI inference and stack arrays have warnings; no byte-exact implementation contract is asserted here.

## 1. Host storage is not a device backup

**High confidence:** `FUN_0040ea80` reads `Cfg.ini` `[OPT] appdir` into `DAT_00659298`; installed value is `BYCOMBO4`. `FUN_00467ad0` calls `SHGetSpecialFolderPathW(NULL, buffer, 0x1c, 0)` then formats the result plus appdir and a trailing separator into `DAT_0065dfa8`, checks existence, and creates the directory if missing (E-Path). `0x1c` is CSIDL_LOCAL_APPDATA: this is **LocalAppData, not roaming AppData**, notwithstanding the diagnostic `Mk AppData=%s`.

Derived path: `%LOCALAPPDATA%\BYCOMBO4\`. Metadata-only check found it exists, with one `.ini` file totaling 20 bytes. No filename or content was disclosed/read. A preliminary roaming `%APPDATA%\BYCOMBO4` existence probe was false; it is not the proven storage root.

| Host artifact | Static source | Meaning and limitation |
|---|---|---|
| `<root>gSetting.dct` | `FUN_0047b040` / `FUN_0047b140` | Reads/writes `0x5c` bytes from/to `DAT_006709b0`; read failure or short read invokes defaults helper `0x47afb0`. Not keyboard flash. |
| `<root><device-derived name>\profile.dct` | `FUN_00472050` → `FUN_0047aeb0` | Name comes from object pointer `+0xc0`, string at `+0x46`; writes selected profile ID (4 bytes), then host profile records of `0x34d4` bytes. Exact string identity not independently resolved. |
| `<root>mac.dct` | `FUN_0047a290` / `FUN_0047a400` | Host macro collection load/save. Contents deliberately not inspected. |
| selected `.bcf` export | `FUN_00425490`, parallel `FUN_0042c720` | Host profile record plus referenced host macro records; not a firmware/device-memory image. |

Host saves use `CreateFileW(..., CREATE_ALWAYS=2, ...)` in `0x47aeb0`, `0x47b140`, and `0x47a400`. No temporary-file/atomic-rename rollback is visible in these functions. `0x47aeb0` tests WriteFile Boolean but not exact byte counts and returns on write failure; its shown failure path does not close the handle. Consequently even a host save is not demonstrated crash-safe. This is a local observation, not a comprehensive audit of all surrounding cleanup.

## 2. Import/export behavior and coupling

**High confidence, E-Host:** `FUN_00425490` exports a selected in-memory profile to `.bcf`: `CFile::Write(profile, 0x34d4)`, then `FUN_00425700` gathers macro references and writes records sized `0x68 + 12 * actionCount` (count at record `+0x58`). Parallel dialog `0x42c720` shows the same structure.

`FUN_00424eb0` imports `.bcf`, requiring a successful exact `0x34d4` read and first dword `-0x355edbb` (`0xfcaa1245`). It then consumes macro headers of `0x68` bytes with first dword `-0x534665e` (`0xfacb99a2`), reads variable actions, remaps macro IDs, creates a new host profile ID/name, and calls `FUN_0047ac50` to allocate/copy the profile into the host list. Parallel import is `0x42c150`. Import is therefore not a byte-preserving restore of existing identities. It mutates host collections and references.

No direct Apply call is shown in these import/export bodies. Import may refresh macro/UI trees through `0x425cc0`; that helper itself rebuilds UI/tree state (E-Import-helper). **Do not promote this to proof that every downstream selection/event handler is device-write-free.** A transitive UI-event audit remains incomplete. Imported records are untrusted binary input; the visible count-driven allocation/reads do not establish robust validation or firmware compatibility.

## 3. Apply flag orchestration: shared, ordered, non-transactional

`FUN_0049c020`, diagnostic `CDevG5KB::ApplySetting`, is shared orchestration, not proof of the selected backend. `FUN_00494f80` (`CDev3632::ApplySetting`) builds a temporary G5 wrapper and calls it; `FUN_004989a0` (`CDevComboFilm::ApplySetting`) dispatches by descriptor `+0x14` (1 → G5 wrapper/common Apply; 0 → MS path `0x4a0450`). Backend identification is owned by the separate backend analysis (E-Dispatch).

Flag observations from E-Apply, **high confidence as bit tests, medium for semantic labels**:

| Bit/mask | Observed effect in `0x49c020` |
|---|---|
| `0x01` | FillMatrix; write eligible dirty layers via virtual `+0x5c`, then shared macro buffer via `+0x64` when needed. LayerMask excludes layers; macros shared among layers can expand dirty-layer work. |
| `0x10` | Write dirty per-key color groups through `+0x74` only if profile mode equals descriptor default mode. |
| `0x20` | Reset intent: sets object reset-in-progress. If descriptor `CmdReset` byte (`+0x2d90`) is nonzero, calls virtual `+0x34(0)`; on accepted result clears flags, bypassing ordinary payload construction. Otherwise admits color-group path regardless of mode. It does not by itself prove which remaining data are reset. |
| `0x102` | Either `0x02` or `0x100` enters configuration read/modify/write path (`+0x70` read, `+0x6c` write). Meanings must not be conflated. |
| `0x40` | Under configuration path and non-default mode, writes RGB table via `+0x7c`; also changes settling delay from 60 to 100 ms. No such write when used alone without `0x102`. |

No host file WriteFile appears in common Apply. Conversely, host profile saves do not establish device commit. The device-facing code contains writes to matrix, macro, RGB and configuration abstractions; **there is no independently established universal nonvolatile commit/flush command, atomic transaction, power-cycle persistence guarantee, or complete device dump/restore primitive** in this workstream.

Configuration update first reads `0x80` bytes, checks ending bytes `5a a5`, retries wrong data up to five reads with 100 ms spacing, then fills fields (`0x49bbf0` or low-delay alternative `0x49b910`) and writes `0x80` bytes. This suggests preserving fields through read/modify/write, not a full independent backup. The profile flag named `CRC` drives a signature marker in this configuration path; do not confuse it with backend packet checksum (see lighting/backend documents).

## 4. Failure and disconnect behavior

**High confidence, E-Apply:** the common routine sets object applying flag `[7]=1`, posts initial progress `0x14`, waits configurable `WaitTm` (`DAT_00659b04`), and performs multiple writes sequentially. Each ordinary failure usually branches to cleanup when `GoWithNoDev` (`DAT_00659b10`) is zero. Installed `Cfg.ini`: `GoWithNoDev=0`, `ApplyNow=0`, `UpdateByLocal=0`, and `UpdateDir` only as a commented line. These are host configuration observations, not global authorization controls.

After intermediate writes it calls virtual `+0x94`; a nonzero result posts message `0x42d` and joins completion/cleanup handling. This is a disconnect/error-style notification path; precise virtual semantics belong to backend analysis. Some paths reaching that notification also set a local completion variable, so UI progress is not a durable-write guarantee. Cleanup clears `[7]` and `[8]`, posts final progress 100 when a window exists, sleeps 500 ms (30 ms without window), and calls virtual `+0x90` again.

There is **no visible rollback of successful earlier writes**. Matrix dirty bits (`profile +0x30`) are cleared after matrix writes, before the later macro write; per-key color dirty bits (`+0x2444`) are cleared before configuration work. A later failure can leave both partial device changes and already-cleared host dirty state. No automatic replay/reconnect recovery guarantee follows from these routines. `GoWithNoDev` can suppress failure exits, further weakening any interpretation of UI completion as success.

## 5. Reset, updates, pairing: hazardous, not recovery primitives

- **Reset:** common Apply's `0x20`/CmdReset branch calls virtual `+0x34(0)` (E-Apply). Parent lighting analysis separately resolves `FUN_0049a390` (`ResetDevice`) to operation 1 / selector `0x11` through `0x4993c0`; this is evidence of a write/reset hazard, not permission or a tested reset recipe. Payload/firmware-specific behavior must follow its own evidence. Names and inverses do not guarantee factory restoration or recovery.
- **Update:** `FUN_004629f0` can call `ShellExecuteW(..., L"open", updaterPath, ...)` then request application close. Otherwise it starts `FUN_00463d60`, an update worker. The worker compares driver/firmware versions, matches firmware entries against descriptor UID, downloads files via helpers, deletes failed downloads, and posts `0x458` status messages (E-Host). Static strings include `update_version.xml`, an HTTP update URL, and `%s\Update.exe`. No network requests were made. The external updater/flash implementation, signature/authenticity checks and bootloader recovery are not established. Installed missing/commented UpdateDir is not proof updates are impossible in all UI paths.
- **Pairing:** searches for pair/match strings surfaced password/device-matching and response-mismatch diagnostics, not a confidently identified pairing operation. **Pairing command, affected transport, and safe cancellation remain unknown.** Password matching must not be relabeled wireless pairing. No pairing action was attempted.

## 6. Approval boundary and future backup/recovery design

Current permission covers digital static analysis and metadata inspection only. Stop before target/updater launch, network download, reading personal macro/account/profile contents, opening a device handle, any Get/Set report, imports into the original app, or any write/reset/pair/flash/recovery test.

If later explicitly authorized, first design a host-only backup workflow: close all writers without launching this app, preserve the complete proven LocalAppData tree plus immutable installed configuration/version/hash, and keep `.bcf` exports distinct from full host-state copies. This is a recommendation, **not performed**; export could contain personal macros. A host backup does not capture device firmware, pairing state, factory calibration, all device settings, or unknown persistent fields.

Device backup/restore requires a separately reviewed, firmware/transport-specific read contract, completeness tests, power-loss/disconnect behavior and explicit write approval. Do not assume that resetting then reapplying profiles, sending an inverse command, reinstalling the driver, or restoring host files guarantees recovery. Known-good defaults and any manufacturer recovery route remain unverified. New-keyboard safety takes precedence over closing these gaps.

## Validation and limitations

Five uniquely named `phase2-persistence-*.json` batches used the existing runner, source-immutable Ghidra analysis. A first foreground cold call timed out at 180 seconds after open; diagnostic retained. Later sequential asynchronous sessions completed, with cold analysis around 151–188 seconds; completed JSONL was parsed and Evidence exported. Own sessions were not intentionally overlapped. All requested final decompile items succeeded. File inspection disclosed only aggregate LocalAppData/roaming-path metadata. No live hardware claim is made. Full transitive import-event effects, exact profile-load fallback, nonvolatile persistence/commit semantics, pairing, external updater recovery, and assembly-level validation of decompiler ABI details remain gaps.
