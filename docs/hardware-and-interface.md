# Hardware identity and interface — phase 2

## Outcome and confidence

The user identifies this as a **standard AULA F75**, not the HE model and not the display-equipped Pro. The present Windows USB/HID device `258A:010C` exactly matches the installed F75 profile's primary VID/PID. Its cached HID hardware IDs expose **three vendor-defined top-level collections with usage page `0xFF00`, usage `0x0001`**. This is strong digital correlation, not a unique physical-device attestation or proof that the application successfully selects any particular collection.

Windows also reports **`REV_1100`**. This establishes a USB device-release revision token, **not** a retail hardware revision, production batch, or measured keyboard firmware version. USB enumeration is established; cable versus a USB receiver remains unresolved without stronger evidence.

## Scope, provenance and privacy

Evidence: [hardware-phase2.json](evidence/hardware-phase2.json), captured `2026-10-16T00:40:12.3496637+01:00`. This supplements, and does not replace, [device-observations.md](device-observations.md).

Method: `Get-PnpDevice -PresentOnly`, filtered to instance IDs beginning `USB\\VID_258A&PID_010C` or `HID\\VID_258A&PID_010C`, then `Get-PnpDeviceProperty` for HardwareIds, CompatibleIds, BusReportedDeviceDesc, Service, EnumeratorName and DriverVersion. Instance suffixes were replaced with `<redacted>` **before command output**. No serial/container IDs, unrelated device properties, raw report descriptors or report traffic were collected.

These are Windows cached enumeration properties, not fresh raw descriptor reads. No HID handles were opened, no GetFeature/SetFeature or other target requests were issued, and no target application, installer or downloaded code was run. Public web research was not needed; no online model specifications are used as evidence of this unit's revision.

## Profile correlation

Installed source: `C:/Program Files (x86)/AULA/F75/Dev/kb/fr/KB.ini` (UTF-16LE BOM), previously captured static file evidence:

| Lines | Value | Meaning supported here |
| --- | --- | --- |
| 2 | `Fw=24` | Profile/backend selector value, **not a device firmware measurement** |
| 3–4 | `VID=0x258a`, `PID=0x010C` | Exact match to present device |
| 5–6 | `VID_Wireless=0x3554`, `PID_Wireless=0xfa09` | Alternate profile pair; not the identity of the device examined here |
| 10–11 | `Name=AULA F75 Clavier Mécanique`, `ShortName=F75` | Installed profile model label |

The primary pair was labelled “wired” in prior analysis; strictly the primary keys themselves are `VID` and `PID`. Matching them is evidence for the primary profile path, while the alternate pair is explicitly wireless-labelled. That distinction alone does not independently certify a physical cable connection. Shared OEM IDs and generic descriptors also mean the VID/PID is not a globally unique F75 model attestation. The user's model confirmation supplies model context.

## Observed Windows topology and collection map

All **11 matching present PnP nodes** had status `OK`: one USB composite device (`usbccgp`), two USB HID interface nodes (`HidUsb`), and eight HID collection nodes. USB parent/interface bus description: `Gaming Keyboard` (generic, not an AULA model descriptor).

| USB interface / HID collection | Cached usage page | Cached usage | Windows classification |
| --- | --- | --- | --- |
| `MI_00` (no COL suffix) | `0x0001` Generic Desktop | `0x0006` Keyboard | HID Keyboard Device, `kbdhid` |
| `MI_01 COL01` | `0x0001` Generic Desktop | `0x0080` System Control | HID-compliant system controller |
| `MI_01 COL02` | `0x000C` Consumer | `0x0001` Consumer Control | HID-compliant consumer control device |
| `MI_01 COL03` | `0xFF00` Vendor-defined | `0x0001` Vendor-defined | HID-compliant vendor-defined device |
| `MI_01 COL04` | `0x0001` Generic Desktop | `0x0006` Keyboard | HID Keyboard Device, `kbdhid` |
| `MI_01 COL05` | `0xFF00` Vendor-defined | `0x0001` Vendor-defined | HID-compliant vendor-defined device |
| `MI_01 COL06` | `0xFF00` Vendor-defined | `0x0001` Vendor-defined | HID-compliant vendor-defined device |
| `MI_01 COL07` | `0x0001` Generic Desktop | `0x0002` Mouse | HID-compliant mouse, `mouhid` |

Examples preserved in the redacted evidence:

- `HID\\VID_258A&PID_010C&REV_1100&MI_01&Col03`
- `HID\\VID_258A&UP:FF00_U:0001`
- `HID_DEVICE_UP:FF00_U:0001`
- `USB\\Class_03&SubClass_01&Prot_01` for `MI_00`: HID / boot interface / keyboard protocol.
- `USB\\Class_03&SubClass_00&Prot_00` for `MI_01`: HID / no subclass / no interface protocol.

COL numbers identify Windows HID top-level collections, **not report IDs, endpoint numbers, command channels or firmware slots**. The presence of keyboard and mouse collections does not prove any particular macro/action protocol. Empty CompatibleIds arrays or null Service values are faithfully preserved and do not prove absence of a driver or device capability.

## Static application selection versus host proof

The existing static finder `FUN_00498fb0` (branch excerpt labelled `0x49914a`) compares VID/PID. For selector `0x18` (decimal 24), its pseudocode tests vendor usage page `0xFF00`, usage `1`, and a stored report capability length `0x208` (520). See [hid-transport.md](hid-transport.md) and [rea-static-evidence.json](evidence/rea-static-evidence.json), profile decompilation evidence `ev_31a2ec1c4fd73642f997f64de7bf1ac9eeb334bc616074be43e90b0a2de986ca`.

The cached IDs corroborate the **VID/PID and usage pair only**. They cannot identify which of COL03/COL05/COL06 has the required report capability length or passes remaining selection/profile gates. Handle-open success and optional profile-gate behavior were not exercised. The exact configuration-to-backend dispatch and structure layout require the separate static-analysis workstream; this document does not upgrade pseudocode assumptions into live capability proof.

In particular, **do not choose the first FF00/0001 collection**: three present collections share those selectors. Actual feature/input/output report sizes, report IDs, descriptor contents and final selected collection remain unverified.

## What revision and transport claims are justified?

**Established from the host:**

- USB composite/HID enumeration, interfaces and collection usage map above.
- All cached matching HardwareIds carry `REV_1100`, conventionally the Windows USB hardware-ID representation of device-release `bcdDevice = 0x1100`. Preserve the raw token; it is not a statement that PCB revision or application firmware is “11.00”.
- Present identity matches the installed profile primary pair rather than its wireless-labelled alternate.

**Not established:**

- Physical PCB/controller revision, production batch, bootloader or application firmware version.
- Physical selector-switch state, cable versus USB wireless receiver, radio mode, USB link speed or endpoint/report details.
- That any exact online F75 specification or manual describes this particular production unit.

The observed `10.0.26100.*` DriverVersion values are **Microsoft/Windows driver package versions**, not keyboard firmware. `Fw=24`, update thresholds and product labels likewise cannot substitute for an on-device version measurement.

## Validation and safe next work

The captured result parses as JSON; it contains 11 matching nodes, eight HID collections, all status `OK`, and a `REV_1100` HardwareId on every node. Static profile values and the prior finder evidence were compared without launching the application. No physical/live protocol validation was attempted under the current restrictions.

Continue with static enumeration-record layout and selection predicates to determine how report lengths disambiguate the vendor collections. Any future live descriptor/feature verification requires separately authorized scope; do not send exploratory requests or infer safety from function/command names.
