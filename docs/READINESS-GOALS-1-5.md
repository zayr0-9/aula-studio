# Electron preparation: goals 1–5 digital investigation

## Safety and outcome

Owner confirms **standard AULA F75, not HE and not display Pro**. Keyboard is new; safety overrides convenience. All work here was static executable/configuration analysis, Windows cached device metadata, or documentation. **Zero keyboard IO/commands, no official-app/updater launch, no settings/reset/firmware changes, no unplug/reconnect, no personal macro/profile/account content inspection.** No live testing was performed while the owner slept.

Goals1–5 have been investigated substantially, with durable code-level evidence. They are **not all fully validated/completed hardware-readiness gates**: live descriptor/transaction checks, revision/transport ambiguity, firmware limits and recovery guarantees remain. Offline facts must not be promoted to working-hardware claims.

## Results by goal

| Goal | Digitally established | Remaining gate |
|---|---|---|
| **1 Hardware/interface** | User model confirmation; present258A:010C matches installed profile; cachedUSB composite/HID nodes and vendor usages; REV_1100 release token | Exact PCB revision/cable versus receiver not proven; three FF00/1 vendor collections need length/descriptor disambiguation |
| **2 Official F75 backend** | Loader reads Fw24 into definition+0x18; heap definition enters factory list; factory explicitly installs CDevG5KB vtable; local/delegated split recovered | Active live object/delegate state and wireless lifecycle not confirmed |
| **3 Packet/transaction spec** | Local fw24 reportID6,520-byte API buffer,8-byte header,512-byte chunks, selectors, send-before-read; assembly confirms bad retry exhaustion path | Device response checks, descriptor acceptance, transaction limits/timing requirements need validation; do not duplicate official failure bugs |
| **4 Feature contracts** | Matrix builder/action converter,115VK/HID pairs; macro name/event/directory serialization; lighting/config selected layout, brightness/speed packing, sleep table; getters/setters | Delay units/state polarity, advanced tags, full RGB mapping, firmware capacities and exact effect mapping remain incomplete |
| **5 Persistence/recovery** | LocalAppData host root and profile/macro formats; .bcf host export/import; Apply flags/write ordering; dirty-state clearing before later failure; reset/updater hazards | No proven universal nonvolatile commit/complete device dump/restore or manufacturer recovery contract |

## Read the detailed references

1. [Hardware and HID interface](hardware-and-interface.md).
2. [Backend factory and packet contracts](backend-and-packets.md), including parent loader-assembly follow-up.
3. [Key/layer and macro contracts](key-and-macro-contracts.md).
4. [Lighting and device settings](lighting-and-settings-contracts.md).
5. [Persistence, Apply and safety](persistence-and-safety.md).

The earlier [architecture](application-architecture.md), [HID notes](hid-transport.md) and [configuration inventory](configuration-and-assets.md) remain useful historical first-pass documents. Newer goal-specific documents resolve some earlier gaps; where they conflict on a resolved gap, follow the newer evidence and explicit follow-up, not the older uncertainty list.

## Important implementation consequences

- **Select a known profile/backend, not just VID/PID.** Three vendor collections share the desired usage; do not open the first match blindly.
- **Keep report framing separate from payload schemas.** Fixed `5A A5` config trailer is not the generic mouse checksum.
- **Keep host profiles separate from device snapshots.** `.bcf` export does not establish device backup, and host restore does not undo partial hardware writes.
- **Model Apply as a coupled operation, not an atomic transaction.** Matrix/macro/config writes can leave partial state; observed dirty bits may clear before later failure.
- **Fail closed on read errors.** Official code can proceed after failed send and copy stale/zero payload after failed receive; a new client must reject this rather than imitating it.
- **Do not expose reset/update/pairing/raw packets in the initial UI.** Screen/GIF/generic mouse code is not a standard-F75 feature contract.
- **UI prototyping can be offline.** Protocol fixtures, simulator and typed models can precede hardware IO; live acceptance/recovery work remains separately approved.

## Persistence / restoring analysis context

[phase2-handoff.json](evidence/phase2-handoff.json) is the compact durable handoff and artifact map. [task-context-phase2.json](evidence/task-context-phase2.json) preserves user scope, safety and investigation background. These are selected JSON exports, not an entire VM snapshot.

Other durable artifacts:

- [Hardware findings](evidence/hardware-phase2.json).
- [Backend Evidence](evidence/phase2-backend-evidence.json) and [structured findings](evidence/phase2-backend-findings.json).
- [Final INI/list/factory linkage Evidence](evidence/final-linkage-phase2.json).
- [Keys/macros Evidence](evidence/key-and-macro-evidence.json) and [structured findings](evidence/key-and-macro-findings.json).
- [Lighting Evidence](evidence/lighting-phase2.json) and [structured findings](evidence/lighting-findings-phase2.json).
- [Persistence Evidence](evidence/phase2-persistence-evidence.json).

To rehydrate after expiry/restart, use `repl import` on a selected artifact into a fresh binding. Evidence objects preserve targetSHA256, provider/profile, tool arguments, results, limitations and IDs. Do not infer that memory-only variable names still exist. Ambient environment, secrets and full user data were not exported.

## Validation and limits

Multiple successful REA MCP sessions through the installed SDK recovered selected pseudocode, assembly and exact table/vtable bytes. All successful sessions contributing claims preserved results and close responses. Initial concurrent cold imports sometimes exceeded shell180-second limits; timeouts are recorded, and unreturned operations are not positive evidence. Later bounded sessions completed after contention subsided. No installation/dependency changes were needed.

Independent final review and documentation/evidence/link checks are recorded in the task completion report. Static evidence can prove code paths and encodings, not actual firmware acceptance, durability, full recovery, or product security. No packet fixture should be sent to the keyboard without the later testing/approval phase.
