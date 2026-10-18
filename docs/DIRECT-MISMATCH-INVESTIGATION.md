# Direct-frame mismatch: offline follow-up

## Physical observation

Owner reported only U visibly dimmed after the single RGB(0,0,16) frame, then confirmed U returned automatically. No elapsed time measured; no claim that all other keys received/ignored data, or that full prior configuration was verified. API success is not firmware acceptance. No new hardware traffic occurred in this follow-up.

## Byte comparison

Saved frame in direct-frame-once.json has header `06 08 00 00 01 00 7A 01`, interleaved RGB(0,0,16) in all80mapped sparse slots0..89, gaps black and remainder zero. This matches the pinned OpenRGB sender construction for that90-element color vector. Its max-index sizing and F75 mapping were already traced. Baseline Fixed_on brightness was9, so a stored brightness of0 does not explain the observation.

This establishes API input construction, not USB wire contents: no control-transfer capture was made for this experiment. HidD_SetFeature success provides no application-level acknowledgment or independently verified transfer length. Uniform color was only across the mapped80slots, not all126triples declared by the header; incorrect device mapping/firmware assumptions therefore remain possible. Do not identify U with a particular payload slot based solely on this observation.

## Corrected binary static trace

Ghidra12.1.4, immutable native x86 executable SHA256 `7c41a8af17b8d1577ac5660b8f0ce1be61da50fd33a5238158c62e6097292783`. No OemDrv execution. Full evidence: [direct-mismatch-investigation.json](evidence/direct-mismatch-investigation.json).

- Generic G5KB builder `0x48b350`: zeroes520bytes; selects reportID6 for backend0x18; header byte1=command, byte2=secondary, byte3=0, byte4=chunk count, byte5=chunk index, bytes6/7=LE payload length; memcpy caller payload starting byte8; sends520bytes.
- Command08 wrapper `0x48c550`: refuses nonzero object+1C; calls builder in write mode, command08, secondary0, caller-provided length, delay7ms. Assembly confirms data pointer supplied through ECX and length from stack. No payload transform in this wrapper or generic builder. No checksum/extra marker in this path.
- No direct callers recovered for0x48c550. Its data reference at0x60FFD4 is consistent with indirect/vtable dispatch; absence of direct calls does not mean unused. Caller-side payload organization/length on the owner's selected model has NOT been established.
- Other backends have superficially similar real-data routines with different report formats. They are not interchangeable and are not candidates for speculative tests.
- Getter0x48BEF0 builds command88, but it was not called and is not a demonstrated direct-state readback contract. Do not use it merely because the setter is08.

Conclusion: static vendor code corroborates the08transport header family; it does NOT independently corroborate OpenRGB's F75 RGB packing or378-byte caller length. No demonstrated byte-construction defect explains the U-only response. Do not change channel order, length, command, endpoint, map or repetition frequency based on guesses.

## Remaining hypotheses / next evidence

Unresolved: firmware/model compatibility, caller-side layout differences, whether this single very brief frame is visually misleading, and actual on-wire contents. A sparse mapping error alone is not a sufficient diagnosis. The owner's modelCD has not been independently queried/verified. Automatic return of U is evidence of a temporary visible change, not proof of full direct-mode support or exact firmware timeout.

Best next discriminating evidence is an owner-coordinated capture of actual OpenRGB direct lighting on this keyboard, using this controller revision if available. That is a separate live experiment: first verify build/controller availability and review that its broad detector probes more paths than Studio, and that it starts a keepalive thread. Do not install/launch it automatically. Capture only authorized keyboard control transfers; never inspect interrupt keystrokes. If OpenRGB demonstrably controls all keys, compare its wire report with our input; if it shows the same mismatch, investigate firmware/revision compatibility rather than copying packets blindly. If broad probing is unacceptable, continue static tracing of vendor virtual callers instead; that may not yield a real per-key source because official UI support is unknown.

No new send or continuous stream is warranted by the present evidence. Existing production onboard controls are unchanged.
