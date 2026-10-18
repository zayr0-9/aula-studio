# Simultaneous F75 Raw Input / Windows media-key hook observation

Owner sequence: one clockwise detent, one counterclockwise, one press. Both observers shared one Stopwatch and ran on one UI thread. Completed30second observation, process exited, stderr empty, no overflow. No suppression, injection, setters or normal-key logging. Source log: ../capture-tools/knob-combined.stdout.txt. Script: ../scripts/observe-knob-combined.ps1 (composes existing observer sources).

| Action | Device-specific RAW ms / bytes | Global hook down ms / VK | Delta |
|---|---|---|---|
|Clockwise|4077 /02 E9 00|4079 /AF|+2ms|
|Counterclockwise|6600 /02 EA 00|6601 /AE|+1ms|
|Press|9698 /02 E2 00|9699 /AD|+1ms|

RAW neutral at4096/6620/9718ms; corresponding hook up4096/6622/9718ms. Exactly3nonzero RAW reports and3hook keydowns, each with release. Hook scanCode0, down flags11hex and up91hex (extended+injected; up adds release). Confirms clean1:1correspondence for this slow controlled sequence, not arbitrary rotation rates or other media sources.

Raw Input was observed1–2ms before hook keydown in this run. Same-thread ordering and timestamps are empirical only: Windows provides no documented guarantee that source-tagged Raw Input will always precede low-level hook callbacks. Cannot treat these delays as a reliable source-authentication window or production per-device blocking guarantee. No proof yet that returning nonzero prevents system volume path; current observer always CallNextHookEx.

Next options: (1) bounded global AD/AE/AF suppression test to establish whether Windows volume/mute is actually preventable, explicitly affecting all media-key sources while active; (2) investigate supported per-device filter mechanisms or onboard remap before requiring device-specific interception. Never silently install drivers or globally intercept other media controls. A production choice requires explicit UX/compatibility decision. Pure Studio observation can already identify F75 and execute additional actions, but without suppression original volume/mute would also happen.
