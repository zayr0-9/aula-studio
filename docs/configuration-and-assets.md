# Installed configuration and UI assets

## Scope and method

Read-only static inspection of `C:/Program Files (x86)/AULA/F75`. No installed executable, installer, updater or DLL was executed; no device enumeration or keyboard commands were performed in this workstream. File enumeration, SHA-256 (`Get-FileHash`), file-version properties, `Get-AuthenticodeSignature`, raw byte reads and text decoding were performed with PowerShell. No AGENTS.md was found at D:/, D:/Projects/, D:/Projects/aula/ or its docs directory (nor recursively under aula at initial inspection).

Paths below are relative to the installation root. Line citations count decoded physical lines starting at 1, including comments and empty lines. Configuration and localization XML have UTF-16LE BOMs. Initial UTF-8 file reads rejected the INIs as binary. Console output also replaced some non-ASCII characters; raw base64 byte capture and explicit UTF-16LE decoding in the shared REPL preserve the original evidence. The legacy effect TXT comments are not UTF-8; ASCII key/group syntax is unambiguous, but their comment text is not relied on here.

Detailed original text bytes and decoded evidence are retained in shared REPL variable **`aulaConfigFindings`** (memory-only). The complete hashed inventory, metadata and structured findings are also persisted in [installed-inventory.json](evidence/installed-inventory.json). Subsequent code-level loader and network findings are documented separately in [application-architecture.md](application-architecture.md).

## Inventory and provenance

145 files, **5,468,915 bytes** total: 127 PNG, 2 INI, 2 XML, 7 TXT, 1 SKN, 1 ICO, 2 EXE, 2 DLL, 1 DAT. There is one observed keyboard configuration subtree, `Dev/kb/fr`; this is an installed layout label, not evidence of the attached keyboard's identity or firmware.

| File | Bytes | SHA-256 |
|---|---:|---|
| OemDrv.exe | 2737088 | `1dfe4803efdbe14f66680f970a6d6f26108342fd49754234fa448dd0ebae44a7` |
| InitSetup.dll | 69000 | `59db7bfd9a92cc9a0998260807f17c536ec71159b727df10d08b998bc94de301` |
| uninstall.dll | 121792 | `a55c54432d63052a76d24541a0aaebc0665c08fe22fe519de66ac0d6df39326b` |
| unins000.exe | 1278413 | `a3865e6e27d72a21c39b595a49f5ae2da1a2528aaa923d9ac224d160f70b580b` |
| Cfg.ini | 1312 | `ba1e6fd304569a62092601952024943d629c2f02b93ddb194dcb220c094390fb` |
| Dev/kb/fr/KB.ini | 12246 | `fe98fec7f3bbb4bbcc329aaa9c31357b46469dd083c1045aafc6da2ff07a961d` |
| Text/en/text.xml | 19504 | `4f7b6c5d5087cf771268cfe918d5e59e3be2ea3b0a4400b4aebf3b1854f189fd` |
| Text/French/text.xml | 23944 | `ff5c1eb1206f8f3ebdf50d3155f029dbd39effd32842532cb3013e141c7b6c79` |
| skins/mak.skn | 520 | `0f2bbba0f04d2712638a624ebbe32ce562c42bab6e7711cdfd6d182c9a681f8b` |

OemDrv.exe file/product version is `1, 0, 0, 0`; InitSetup.dll is `1, 0, 0, 2`. unins000.exe reports file version `51.1048.0.0`, description `Setup/Uninstall`, and no product version. uninstall.dll has no version/description returned. Company and description are empty for OemDrv.exe/InitSetup.dll. These are file-resource values, distinct from INI `Ver` and `Fw`.

Authenticode status at inspection: **Valid** for OemDrv.exe, InitSetup.dll and uninstall.dll; **NotSigned** for unins000.exe. The three signed files have signer subject `CN="Shenzhen Beiying Technology Co., Ltd.", O="Shenzhen Beiying Technology Co., Ltd.", S=Guangdong Sheng, C=CN, OID.2.5.4.15=Private Organization, OID.1.3.6.1.4.1.311.60.2.1.3=CN, SERIALNUMBER=914403006718756094`. This reports Windows' observed signature status, not an independent security audit or permanent certificate-validity guarantee. Asset signatures were not checked; their inventory signature fields are null, not “NotSigned.”

## Cfg.ini: application-level options

The sole section is `[OPT]` (line 1).

* Identity/storage-like settings: `Title=AULA F75`, `Ver=0x200`, `Appdir=BYCOMBO4` (4–6). The title is explicit; actual use/location of Appdir and version encoding are not established by reading this file.
* Styling: `clrTxtColor`, button normal/over/down colors, list/menu backgrounds, lines and edit colors (7–20); commented `;clrMask` (21); `clrMasking=190,50,50,50` (22); `ptNavi=120,12` (32). Names and RGB-like tuples strongly suggest a skin/palette and navigation position. The four-component mask ordering is unverified.
* Behavior flags: `Debug=0`, `Suwnd=0` (2–3), `ReactionEffect=0`, `BtnTips=0`, `ApplyNow=0`, `GoWithNoDev=0`, `DrawLine=0` (23–27), `MacLayout=1`, `ShowDevList=0` (31,33). These are observed values; exact parser semantics and effects were not tested. `GoWithNoDev` suggests a device-presence gate, not proof of runtime behavior.
* Update/cloud references: commented `;UpdateDir=BYSTD` (28), `UpdateByLocal=0` (29), `EnableYun=0` (30). `;MacroInsertMask=3` (34) is also a comment, not an active setting.
* Languages: `Lang1=English,en`, `Lang2=Français,French` (36–37), matching installed `Text/en` and `Text/French` directories.

## KB.ini: device/layout profile

### [OPT] (1–68)

* `Fw=24`, `VID=0x258a`, `PID=0x010C`, `VID_Wireless=0x3554`, `PID_Wireless=0xfa09` (2–6). These are **configured candidate IDs**, not observed connected devices. `Fw` is a configuration selector/value, not a measured firmware version.
* `Psd=3,0,0,0,0,cd`, `CRC=1`, `MatrixLen=128` (7–9). These are potentially protocol-relevant constants, but no password/checksum/report format or matrix packing is established here.
* Name/short name (10–11), key hover/down/function colors (12–14), `KbLayout=0`, `KbDrawType=0` (15–16): layout/UI metadata.
* `SleepTime=300`, `ChannelMask=3`, `ShowPower=0` (17–19); `ShowDebounce=0x04000101` (23). Bitfields/units need implementation validation. `;ShowEffect=0`, `;FwVerNeedToUpdate=0x10ff`, `;ForceUpdate=1`, `;CfgVal=0x001b` (20–24) are comments.
* `DefLedIndex=10` (26); `Light`/`LightHW` both enumerate 0–9 (28–29), `Speed`/`SpeedHW` both 0–4 (30–31). `RGBIndex`/`GameRGBIndex` are 0,1,2 (33–34). These paired UI/HW tables suggest parameter translation, not proof of transport encoding.
* A red game/custom-key group is configured by `clrGaoshou=255,0,0`, `GaoshouGroupNum=1`, `GaoshouKey1=1b,57,41,53,44,26,28,25,27` (35–37). The numbers match familiar Windows virtual-key values for Escape/WASD/arrows; interpreting them as such remains a derived reading.
* `SleepUI=60,90,120,180,240,300,600,900,1200` and `SleepHW=2,3,4,6,8,10,20,30,40` (39–40) are pairwise 30:1. UI seconds are suggested by localization (`tc_msg34`, `tc_msg36`, English XML 109–111), but hardware units are not independently established.
* `LedMask=0x22100`, `GaoshouIndex=18` (42–43). Lines 44–45 contain `//K916 RGB` and `//hw effect speed light direct random color`. Treat the stale-looking model marker and comment syntax cautiously; accepted INI parser comment syntax was not analyzed.
* Twenty `LedOptN` seven-field tuples (46–65) provide per-effect selector/capability-looking data. For example `LedOpt1=1,1,0,1,0,1,1`; `LedOpt10=10,5,1,1,0,1,1`; `LedOpt19=21,0,0,0,0,0,0`; `LedOpt20=0,0,0,0,0,0,0`. The preceding column labels suggest hardware selector, effect selector, speed/light/direction/random/color flags. Exact interpretation, indexing and relation to localization strings require code references; do not serialize these tuples directly as HID packets.
* `FnNotToSet=0`, `UnrectKey=81,566,126,566,155,576,155,576,194,611,194,611,126,566,126` (67–68). Names suggest FN restrictions and a nonrectangular-key geometry description, but exact polygon format is unverified.

### [KEY] (69–233)

82 entries, `K1` through `K82`, each with eight numeric fields. Most have four pixel-coordinate-like values, `0x02`, a Windows virtual-key-like code, `0x00`, and a nonsequential matrix/index-like final value. Examples:

* Escape `K1=27,33,53,61, 0x02,0x1B,0x00,0` (70–71).
* A `K46=98,168,124,196, 0x02,0x41,0x00,9` (160–161).
* FN `K76=477,247,513,275, 0x02,0xFA,0x00,59` (220–221).
* ISO extra key `K77=77,207,103,235, 0x02,0xE2,0x00,76` (222–223).
* Wheel `K82=0,0,0,0, 0x09,0x01,0x0700001D,84` (232–233).

`Dev/kb/fr/keyimg.png` is 305953 bytes and **679×304**, consistent with the coordinate ranges. This strongly supports an image-backed keyboard map with per-key hit regions. The final column is not equivalent to the K-entry number or raw standard HID usage. Derive its semantics from code before building device reports. The wheel is a zero-area special action rather than an ordinary drawn key rectangle.

### [FN1] (235–307)

Sparse alternate-layer bindings reuse K-entry identifiers and have three fields rather than eight. Examples: Escape `K1=0x09,0x01,0x07000004` (236–237), F1 `K2=0x09,0x01,0x02000223` (238–239), U `K37=0x02,0x2C,0x00` (278–279), Left `K78=0x09,0x01,0x08040200` (302–303). There is no `[FN2]` section in this installed file. The values suggest typed action records with packed function codes; they are not validated wire opcodes.

## UI/resource architecture and feature evidence

Observed filesystem separation supports a configurable, image/skinned desktop UI: application-wide styling in Cfg.ini; device/layout metadata, hit boxes and bindings in Dev/kb/fr/KB.ini; a keyboard PNG; reusable control/icon PNGs under skins; and string IDs in language XML. This is a static architecture inference, not a traced resource-loader call graph.

`skins/main_nr.png` and `skins/welcome.png` are both **1200×720**. Skin assets include normal/hover/down variants (`*_nr`, `*_ov`, `*_dn`), buttons, checkboxes, radios, sliders, progress bars, `colorwheel.png`, audio bars, navigation icons, macro editor icons and action/media/mouse-command icons. `skins/mak.skn` is a 520-byte opaque binary (first bytes `71 CF C7 95 58 94 59 79`), not a readable INI/XML skin definition; compression/encryption/structure is unknown.

Feature surfaces evidenced by `Text/en/text.xml`:

| Surface | Keys / lines | Caveat |
|---|---|---|
| Macro folders/recording/editing/insertion, repeat count/until release/until key press, mouse X/Y and delays | `tc_macro_msg1..24`, 23–46 | UI vocabulary, not a validated macro storage/wire format |
| Media and system actions, mouse buttons, disable-key | 48–74, `tc_cmd1..13` 132–144 | Available resource actions do not prove every device supports them |
| Tray behavior, autorun, language, profile, import/export, assignment, sleep, reset and debounce | 76–130 | Destructive labels were only read; actions were not invoked |
| Default/FN1/FN2/tap labels | `tc_kb1..14`, 182–195 | FN2/tap strings exist although this KB.ini only defines FN1 |
| 20 named keyboard-light labels, including Self-define and OFF | `tc_kb_led1..20`, 197–216 | Mapping to LedOpt rows is unproven; row numbering should not be assumed equivalent |
| Music/system-sound visualization, gain, smoothness, ten mode labels | `tc_music1..10`, 226–235; `tc_music_mode1..10`, 237–246 | Host-audio capability suggested, runtime support not tested |

Generic mouse DPI, sensitivity and polling-rate strings also exist (146–169). They are evidence of shared/generic UI resources, **not** proof of keyboard DPI/polling controls. The English XML is 248 physical content lines; the French file additionally carries Chinese cloud-sharing/account strings, demonstrating the language packs are not simply identical translated key sets.

Device effect resources are readable data rather than executable code:

* `Cartoon/breath_unit.txt`, `fixon_unit.txt`, `wheel_unit.txt`: comma-separated key groups per line; explicit RGB suffixes occur in breath/fixon (e.g. breath line 3 `esc,~,tab,caps,shift,ctrl,win,k45:0,0,255`; fixon line 3 `o:255,0,0`). These suggest spatial animation/group/color definitions.
* `ET/audiobar.txt`: nine data rows with colon-separated groups; line 1 `ctrl,win:shift,k45:caps:tab,q:~,1:esc`.
* `ET/flower.txt`: line 1 `U`, line 2 `7,8,Y,I,H,J`, followed by expanding groups. `ET/happy.txt` has three colon-grouped data rows and includes `k151`; `ET/stream_h.txt` has fourteen spatial rows. Names and topology suggest host-side visualizer/effect templates. Parsers, aliases such as `app`/`k151`, and actual use are unverified.

## Updater/network evidence and boundaries

* Cfg.ini 28–30 contains commented update directory, `UpdateByLocal=0`, `EnableYun=0`.
* KB.ini 21–22 contains only commented firmware threshold/force-update keys; these are not active update instructions.
* English XML `tc_update1..8` (13–21) describes firmware/driver update prompts, download/error/status, and a USB-connection requirement; `tc_msg20` (95) names automatic update checking.
* French XML `tc_yun1..47` (248–294) includes Chinese strings for sharing center, macro sharing/download, login/registration/password/email, server/network failure (275), auto-login (279), uploading configuration to cloud space (280), cloud configuration files (282), and password changes (289–293). These are dormant/generic resource surfaces consistent with `EnableYun=0`; they do not prove traffic occurs.
* No `http://`, `https://`, `ftp://` or `www.` literal was found in the decoded installed INI/XML/TXT resources. This is a bounded negative result only. Executable strings/code, opaque skin content, registry, user-data paths, caches and actual traffic were not examined here. No endpoint, TLS policy, updater signature policy or update package format is established.

## Validation and open questions

All 145 enumerated files were hashed, and the primary executable hash matches the background SHA-256. PNG dimensions were read directly from IHDR header bytes; images were not rendered. Version/signature metadata was read for the four EXE/DLL files only. Configuration and English XML were read with line numbers; original bytes were retained for all INI/XML/TXT plus opaque SKN. No dependency installation or original-target execution was used.

Before replacement UI or protocol implementation, resolve loader/parser semantics, Appdir storage location, action/matrix index meaning, LedOpt indexing/masks, sleep hardware units, CRC/Psd use, and host-versus-device effect execution through separate code analysis. Preserve the distinction between configured IDs and enumerated hardware. Generic localization features and stale model comments are not sufficient evidence of F75 firmware capabilities. This work intentionally excludes REA/disassembly, device enumeration, HID report generation, runtime UI testing and firmware/update operations.
