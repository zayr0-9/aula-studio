# Capture tool staging

Official Wireshark and USBPcap installers are staged here for signature verification. No captures are started by downloading these files. USBPcap installation/restart and a controlled lighting test require coordination with the owner.

## Setup status

- Wireshark 4.6.9 x64 MSI installed successfully (msiexec exit 0); TShark version verified. No automatic restart requested. No capture activated.
- MSI SHA256: 1975dfc96581a9b674fda3f41ac1585963b4ba52ea9459f3b6d9cedfac3a7217, matched winget official package metadata. Authenticode Valid, Wireshark Foundation.
- USBPcap 1.5.4.0 downloaded from official desowin/usbpcap GitHub release; Authenticode Valid, Tomasz Mon. SHA256: 87a7edf9bbbcf07b5f4373d9a192a6770d2ff3add7aa1e276e82e38582ccb622. NOT installed yet.
- Host is Windows 11 Pro 10.0.26300 x64. USBPcap project documentation lists Windows 7/8/10 and requires a restart after installation. Windows 11 compatibility is not established by that statement; owner confirmation requested before driver installation.
- No USBPcap/Npcap/NPF driver found after Wireshark installation. Npcap is unnecessary for the intended USB-only capture.
- Matching USB device 258A:010C is downstream of a 05E3:0608 generic hub, path PCIROOT(0)#PCI(0803)#PCI(0000)#USBROOT(0)#USB(1)#USB(2). No other peripheral found under that root in this bounded PnP location-path check. Cable versus receiver needs physical confirmation.
- Installation log: wireshark-install.log. Keep captures private; capture has not been authorized/started as an unattended broad recording.

Sources: https://www.wireshark.org/download.html ; https://desowin.org/usbpcap/ ; https://github.com/desowin/usbpcap/releases/tag/1.5.4.0

## Windows 11 cursory compatibility review

Owner confirmed USB cable and approved driver installation subject to compatibility review. Installation paused after finding a material new risk; driver remains uninstalled.

- https://github.com/desowin/usbpcap/issues/144 : user reports USBPcap 1.5.4.0 with TShark 4.6.0 on Windows 11 works without capture filters, but extcap capture-filter option fails. This is anecdotal operation evidence, not compatibility certification. Do not assume a Wireshark display filter limits captured data.
- https://github.com/desowin/usbpcap/issues/146 : open report of BSOD on Windows 11 25H2 build 26200.8037 with USBPcap 1.5.4.0, dump names USBPcap.sys. Root cause not independently verified; this host is build 26300, so applicability unknown.
- https://github.com/desowin/usbpcap/issues/71 : mixed Windows 11 warning/disconnect reports; some hcmon warnings attributed by commenters to VMware merely not recognizing USBPcap. These do not establish that all errors are harmless or a single common cause.

Request explicit informed go/no-go after disclosure of the newly discovered BSOD report. No automatic reboot, security bypass, driver installation or capture performed in this review.

## Driver installation completed

Owner accepted use of existing Windows Update restore point after Windows blocked a new point under its 24-hour policy. No frequency override was made.

USBPcap 1.5.4.0 installed through verified signed installer with elevation, `/S`, exit code 0. Driver file and USBPcapCMD exist; installed driver Authenticode Valid (Tomasz Mon). USB class UpperFilters includes USBPcap. Service registered Manual, currently Stopped before restart. CLI --help verified and supports native `--devices` address filtering. No capture started, no explicit reboot/reconnect, no keyboard report or setting change. Installer's default USB3 detection initialization is part of installation; not a traffic capture. Restart required per official documentation; owner should save work and restart manually, then verify service/hub enumeration before capture.

## Capture deadline hardening

capture-brightness.ps1 now uses monotonic Stopwatch for the foreground bound plus process-deadline.ps1 independent C# watchdog, holding the owned Process handle (not reopening recycled PID). Watchdog kills at120seconds from child launch even if PowerShell foreground loop is delayed; supervisor requests stop around same deadline and confirms exit with bounded wait. Requires already elevated supervisor; no automatic elevation. Rejects existing USBPcap process. test-process-deadline.ps1 passed: watchdog killed harmless20second sleeper with500ms deadline while supervisor slept2seconds, and capture supervisor syntax parsed. No USB recording started in validation. Historical missed-stop root cause not established; hardening addresses reliance on single script loop, not supervisor host termination. If supervisor process itself is forcibly killed, in-process watchdog cannot run; this is not an OS Job Object guarantee. Actual elevated USB capture bound still requires field verification. PCAP integrity must still be checked after forced stop.
