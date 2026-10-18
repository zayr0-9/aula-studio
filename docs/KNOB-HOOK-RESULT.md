# Windows media-key hook observation result

Non-elevated30second WH_KEYBOARD_LL pass-through observer completed; process exited, stderr empty, overflowFalse. Target-only media-key log: ../capture-tools/knob-hook-observation.stdout.txt. No events suppressed/injected; no hardware writes. Hook was global, not device-specific.

Observed VK_AD(mute)6down/6up; VK_AE(volume down)40down/40up; VK_AF(volume up)24down/24up. All scanCode0; down flags0x11, up0x91; WM_KEYDOWN100 / WM_KEYUP101. Counts do not match requested3/3/2sequence. Do not infer1detent=1hookevent or assign source to F75 solely from this trace.

0x11 includes LLKHF_EXTENDED(1) and LLKHF_INJECTED(0x10); release adds0x80. This proves observed events are flagged injected by Windows; it does NOT establish which software/OS component generated them or that observer generated them (observer never injects). Could be HID-to-key translation or another software layer. Do not drop all injected events in a future hook because this trace would disappear. Conversely do not intercept arbitrary injected events without policy or identify them as hardware-owned.

Combined evidence: F75 Raw Input reports have source identity, separate global Windows media-key hook sees media events. They were not observed simultaneously, so exact correspondence and source attribution remain unproven. Next narrow experiment: one process collecting both streams with timestamps, retaining only exact F75 COL02 raw reports and global AD/AE/AF hook events, always pass-through. One detent per direction then one press. Compare counts/order/flags. This can establish empirical mapping, not guarantee race-free device-specific blocking in production.

Potential opt-in global media interception is feasible to test (hook can return nonzero), but has NOT been run or proven to prevent system volume yet and would affect other media sources. Device-specific suppression still needs a verified mechanism: supported per-device filter/driver or firmware remap; neither implemented. No driver install, blanket blocking or source-timing heuristic integrated.
