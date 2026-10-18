# Wired F75 Neon_stream brightness fixture

`neon-stream-brightness.json` is copied from selected control-transfer bodies in `../../../docs/evidence/brightness-live-capture.json`. Original capture SHA256: `beabe643271dee4fd54d17c34699552a2b2f1a4bb593ff2462b96042e4bb34e4`.

Cycle 1: query frame 3, response 6, configuration write 7 (9 to 8).
Cycle 2: query frame 15, response 18, configuration write 19 (8 to 9).
Outgoing bodies have their 8-byte USB setup packet removed; incoming response bodies already begin with HID report ID. No USBPcap header or interrupt/keystroke payload is included. Palette writes were intentionally excluded: this fixture tests the configuration operation, not the entire official Save sequence.

Owner confirmed physical dimming and restored the baseline through the official app. Captured responses contain 136 bytes despite a 520-byte GetFeature request. The second response reads back brightness 8. There was no post-final-write readback of 9 in this capture.

The pure TypeScript codec in `src/protocol/neon-stream-brightness.ts`:

- Replays query and configuration writes byte-for-byte.
- Validates report ID, command, reserved/header fields, one-chunk contract, declared length, observed mode selectors and fixed 5A A5 marker (not a computed checksum).
- Accepts complete 136-byte responses or zero-padded 520-byte buffers. An explicit actual length excludes unused buffer capacity. Future transport must check success and establish actual valid-byte semantics; this codec cannot detect stale buffers from failed calls.
- Copies the complete 128-byte configuration and changes only offset 0x4E. It is scoped to observed effect selector 11/custom selector 0, not other effects or hardware revisions.
- Supports installed brightness range 0..9 offline; only 8 and 9 are live-captured.

No transport, transaction executor, retries, automatic rollback, palette write encoder or device connection exists. Do not infer that omitting the official palette resend is hardware-validated. This module is not imported into Electron main/preload/renderer. Hardware remains disabled.

Validation: 11 tests (8 protocol + 3 scaffold) passed, including exact capture replay, truncation/header/length/padding rejection, bounds, immutability and preservation. Typecheck, ESLint, production build and Prettier passed. No live keyboard I/O performed for this step.
