# Passive capture feasibility — AULA F75

## Outcome

**No approved nonintrusive capture of HID feature-report payloads was established. Stop at this limitation; do not substitute a risky workaround.** This investigation only read process, installation, driver/service, ETW-provider/session and app-scoped filename metadata. No capture was started and no keyboard I/O was performed.

Structured evidence: [`evidence/capture-feasibility.json`](evidence/capture-feasibility.json). Observations were collected on 2026-10-16, approximately 01:55–01:57 local time (+01:00).

## Already-running application

- `OemDrv.exe` was digitally observed as **PID 35408**, with start time **2026-10-15T22:35:04.3902968+01:00**.
- Its main window title was **AULA F75**, with a nonzero window handle. This verifies an existing matching process/window, not that it is communicating with the keyboard.
- `Win32_Process.ExecutablePath`, `Get-Process.Path`, and ordinary `MainModule.FileName` all returned null. **The running executable's full path could not be verified in the current context.** No elevation or alternate intrusive inspection was attempted.
- The expected installed file `C:\Program Files (x86)\AULA\F75\OemDrv.exe` exists (2,737,088 bytes; file version `1, 0, 0, 0`). File existence alone does not conclusively link that image to the running PID.

## Capture availability metadata

| Component | Read-only result | Meaning |
| --- | --- | --- |
| USBPcap / Wireshark / dumpcap / tshark | No executables found on PATH or in checked standard USBPcap/Wireshark installation roots; no matching uninstall records | Not available through the checked installation locations; not a whole-disk absence proof |
| USBPcap / NPF / Npcap driver or service | No exact matching capture drivers; no matching services | No discovered installed USB capture filter; no changes attempted |
| PktMon | `C:\WINDOWS\system32\PktMon.exe` present | Network packet-monitor tool availability only |
| USB host drivers | `Ucx01000`, `USBHUB3`, `USBXHCI` running; Manual start mode | Normal host-stack metadata, not a USB payload recording facility demonstrated here |
| ETW | `logman query providers` succeeded; USB-UCX, USB-USBHUB, USB-USBHUB3, USB-USBPORT, USB-USBXHCI and Input-HIDCLASS registered, among others | Provider registration only; payload coverage and usable permission/session configuration were not established |
| Existing ETW sessions | `logman query -ets` succeeded; no session names matched USB/HID/pcap/Wireshark/PktMon/AULA/OemDrv | Does not rule out a differently named session; no existing relevant recording established |

An initial broad driver-name filter also matched **Npfs**. It is not NPF/Npcap or USBPcap; the subsequent exact capture-driver filter returned no matches. Do not count Npfs as capture availability.

## Existing application artifacts

Only filename, size and timestamp metadata was considered. The installed `AULA\F75` tree was checked recursively for `.log`, `.etl`, `.pcap`, `.pcapng`, `.cap`, `.dmp`, `.trace` and capture/trace/log-style names. **No candidate artifacts were found.** The named `AULA` directories under current-user Roaming AppData, Local AppData and ProgramData did not exist.

This is a bounded app-scoped search, not a claim that no artifacts exist anywhere. No unrelated user directories, macro/account contents, application settings contents, or candidate-file contents were read. Nonstandard artifact locations remain unknown.

## Why available metadata is not command evidence

HID feature reports travel as USB control transfers (or through the relevant HID transport), not ordinary IP/Ethernet packets. PktMon and a normal Wireshark/Npcap network-interface capture therefore do not reveal the wired keyboard's feature-report bytes. Wireshark is an analyzer; USB traffic requires a USB-capable capture source such as USBPcap. The presence of a packet tool alone is insufficient.

USB controller/hub ETW providers and running host drivers can establish host-stack availability and may expose lifecycle, diagnostics, timing or transfer context. Their mere presence does **not** establish the vendor report ID, request bytes, response bytes, direction, or safety semantics. No ETW payload schema/capture was established here. No command-response transaction was observed. An already-running idle app may produce no relevant traffic; even a lack of traffic would not prove a guessed query safe.

## Safety boundary and next step

No process was launched, stopped or restarted. No application UI action, hooks, injection, memory dump, keyboard request, driver install, service change, elevation or capture activation occurred. The existing app was left untouched.

If payload evidence remains necessary, seek separate approval for a specific narrowly filtered USB capture approach, including privacy controls and any driver installation, elevation or device disruption it requires. Do not start broad HID/USB tracing, expose macro/account data, guess device queries, or instrument the application to bypass the current boundary. Static query-safety work is a separate workstream; this report supplies no authorization or proof that any feature request is nonmutating.
