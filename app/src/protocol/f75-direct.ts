/** Offline-only candidate protocol, independently implemented from observed upstream
 * protocol facts. No HID, IPC, timers or application imports. Not hardware-verified.
 * Provenance and licensing boundary: docs/OPENRGB-DIRECT-RESEARCH.md.
 */
export const DIRECT_REPORT_LENGTH = 520;
export const DIRECT_PAYLOAD_LENGTH = 378;
export const F75_DIRECT_SLOT_COUNT = 90;
export const OPENRGB_REFERENCE_COMMIT = '8e16de27858cf2be6af54a33ce003df74cb9fd3e';

export interface DirectRgb {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

// Physical ANSI positions, not OS character output or key-remapping data.
// Rows list physical keys only; indices are sparse hardware RGB slots.
const keyRows = [
  ['Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'],
  [
    'Backquote',
    'Digit1',
    'Digit2',
    'Digit3',
    'Digit4',
    'Digit5',
    'Digit6',
    'Digit7',
    'Digit8',
    'Digit9',
    'Digit0',
    'Minus',
    'Equal',
    'Backspace',
    'Delete',
  ],
  [
    'Tab',
    'KeyQ',
    'KeyW',
    'KeyE',
    'KeyR',
    'KeyT',
    'KeyY',
    'KeyU',
    'KeyI',
    'KeyO',
    'KeyP',
    'BracketLeft',
    'BracketRight',
    'Backslash',
    'PageUp',
  ],
  [
    'CapsLock',
    'KeyA',
    'KeyS',
    'KeyD',
    'KeyF',
    'KeyG',
    'KeyH',
    'KeyJ',
    'KeyK',
    'KeyL',
    'Semicolon',
    'Quote',
    'Enter',
    'PageDown',
  ],
  [
    'ShiftLeft',
    'KeyZ',
    'KeyX',
    'KeyC',
    'KeyV',
    'KeyB',
    'KeyN',
    'KeyM',
    'Comma',
    'Period',
    'Slash',
    'ShiftRight',
    'ArrowUp',
    'End',
  ],
  [
    'ControlLeft',
    'MetaLeft',
    'AltLeft',
    'Space',
    'Fn',
    'ControlRight',
    'ArrowLeft',
    'ArrowDown',
    'ArrowRight',
  ],
] as const;
const slotRows = [
  [0, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78],
  [1, 7, 13, 19, 25, 31, 37, 43, 49, 55, 61, 67, 73, 79, 85],
  [2, 8, 14, 20, 26, 32, 38, 44, 50, 56, 62, 68, 74, 80, 86],
  [3, 9, 15, 21, 27, 33, 39, 45, 51, 57, 63, 69, 81, 87],
  [4, 10, 16, 22, 28, 34, 40, 46, 52, 58, 64, 70, 82, 88],
  [5, 11, 17, 35, 53, 59, 77, 83, 89],
] as const;
export type F75DirectKey = (typeof keyRows)[number][number];
export const F75_DIRECT_KEYS = Object.freeze(
  keyRows.flatMap((row, rowIndex) =>
    row.map((key, column) =>
      Object.freeze({ key, row: rowIndex, column, slot: slotRows[rowIndex][column] }),
    ),
  ),
);

function validateRgb(value: unknown): asserts value is DirectRgb {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid direct RGB');
  const rgb = value as Record<string, unknown>;
  if (Object.keys(rgb).length !== 3) throw new Error('Expected exactly three RGB channels');
  for (const name of ['red', 'green', 'blue']) {
    const channel = rgb[name];
    if (typeof channel !== 'number' || !Number.isInteger(channel) || channel < 0 || channel > 255)
      throw new Error('Direct RGB channels must be integers from 0 to 255');
  }
}

/** Exactly 90 sparse slots; unassigned F75 slots must be black. Brightness is
 * Studio-local percent, rounded to nearest byte, not an onboard setting.
 * The upstream header declares 378 bytes (126 triples), but F75 uses slots0..89;
 * remaining declared payload and report padding stay zero. No palette marker.
 */
export function encodeF75DirectFrame(
  colors: readonly DirectRgb[],
  brightnessPercent = 100,
): Uint8Array {
  if (!Array.isArray(colors) || colors.length !== F75_DIRECT_SLOT_COUNT)
    throw new Error('Expected exactly 90 F75 direct RGB slots');
  if (!Number.isFinite(brightnessPercent) || brightnessPercent < 0 || brightnessPercent > 100)
    throw new Error('Direct brightness must be from 0 to 100 percent');
  const mapped = new Set<number>(F75_DIRECT_KEYS.map((entry) => entry.slot));
  const report = new Uint8Array(DIRECT_REPORT_LENGTH);
  report.set([6, 8, 0, 0, 1, 0, 0x7a, 1]);
  for (let slot = 0; slot < colors.length; slot++) {
    const rgb = colors[slot];
    validateRgb(rgb);
    if (!mapped.has(slot) && (rgb.red !== 0 || rgb.green !== 0 || rgb.blue !== 0))
      throw new Error('Unassigned F75 direct slots must be black');
    report.set(
      [rgb.red, rgb.green, rgb.blue].map((channel) =>
        Math.round((channel * brightnessPercent) / 100),
      ),
      8 + slot * 3,
    );
  }
  return report;
}

/** Build the complete sparse slot array from all 80 physical keys. Missing,
 * unknown or malformed entries are refused rather than silently overwritten.
 */
export function f75DirectSlotsFromKeys(
  colors: Readonly<Record<F75DirectKey, DirectRgb>>,
): DirectRgb[] {
  if (
    !colors ||
    typeof colors !== 'object' ||
    Array.isArray(colors) ||
    Object.keys(colors).length !== F75_DIRECT_KEYS.length
  )
    throw new Error('Expected exactly 80 F75 physical key colors');
  const slots = Array.from({ length: F75_DIRECT_SLOT_COUNT }, () => ({
    red: 0,
    green: 0,
    blue: 0,
  }));
  for (const { key, slot } of F75_DIRECT_KEYS) {
    if (!Object.hasOwn(colors, key)) throw new Error('Missing F75 physical key color');
    const rgb = colors[key];
    validateRgb(rgb);
    slots[slot] = { ...rgb };
  }
  return slots;
}
