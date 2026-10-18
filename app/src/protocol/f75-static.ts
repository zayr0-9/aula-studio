/** Owner-device static per-key protocol; not the command08 streaming format.
 * Evidence: docs/PER-KEY-VERIFICATION.md. No device access or runtime integration.
 * Digit1–4 mapping physically accepted; other keys intentionally not exposed.
 */
export const STATIC_REPORT_LENGTH = 520;
export const STATIC_PAYLOAD_LENGTH = 384;
const PLANE_LENGTH = 126;
const header = [6, 0x86, 0, 0, 1, 0, 0x80, 1] as const;
const slots = { Digit1: 7, Digit2: 13, Digit3: 19, Digit4: 25 } as const;
export type IndicatorKey = keyof typeof slots;
export interface StaticRgb {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}
export interface StaticKeyEdit {
  readonly key: IndicatorKey;
  readonly color: StaticRgb;
}

function validateTable(response: Uint8Array): void {
  if (!(response instanceof Uint8Array) || response.length !== STATIC_REPORT_LENGTH)
    throw new Error('Expected a 520-byte static response');
  for (let i = 0; i < header.length; i++) {
    if (response[i] !== header[i]) throw new Error('Invalid static response header');
  }
  for (let i = 8 + STATIC_PAYLOAD_LENGTH; i < response.length; i++) {
    if (response[i] !== 0) throw new Error('Invalid static response padding');
  }
  // No demonstrated marker/checksum exists for this table. In particular,
  // payload378..383 are opaque data, NOT spare bytes to zero or reinterpret.
}

function validateEdit(value: unknown): asserts value is StaticKeyEdit {
  const edit = value as StaticKeyEdit;
  if (
    !edit ||
    typeof edit !== 'object' ||
    Array.isArray(edit) ||
    Object.keys(edit).length !== 2 ||
    !Object.hasOwn(slots, edit.key)
  )
    throw new Error('Expected an edit for Digit1 through Digit4');
  const rgb = edit.color;
  if (!rgb || typeof rgb !== 'object' || Array.isArray(rgb) || Object.keys(rgb).length !== 3)
    throw new Error('Expected exactly three RGB channels');
  for (const channel of [rgb.red, rgb.green, rgb.blue]) {
    if (typeof channel !== 'number' || !Number.isInteger(channel) || channel < 0 || channel > 255)
      throw new Error('Static RGB must be integer channels from 0 to 255');
  }
}

export function staticTableQuery(): Uint8Array {
  const query = new Uint8Array(STATIC_REPORT_LENGTH);
  query.set(header);
  return query;
}

export function readIndicatorColors(response: Uint8Array): Record<IndicatorKey, StaticRgb> {
  validateTable(response);
  return Object.fromEntries(
    Object.entries(slots).map(([key, slot]) => [
      key,
      {
        red: response[8 + slot],
        green: response[8 + PLANE_LENGTH + slot],
        blue: response[8 + 2 * PLANE_LENGTH + slot],
      },
    ]),
  ) as Record<IndicatorKey, StaticRgb>;
}

/** Fresh response must come from the same guarded transaction, not a saved
 * fixture or previous session. This pure function cannot attest freshness.
 * Returns the setter plus expected getter response for complete verification.
 */
export function patchIndicatorColors(
  fresh: Uint8Array,
  edits: readonly StaticKeyEdit[],
): { report: Uint8Array; expected: Uint8Array; changed: boolean } {
  validateTable(fresh);
  if (!Array.isArray(edits) || edits.length < 1 || edits.length > 4)
    throw new Error('Expected one through four distinct key edits');
  const seen = new Set<IndicatorKey>();
  const expected = new Uint8Array(fresh);
  for (const edit of edits) {
    validateEdit(edit);
    if (seen.has(edit.key)) throw new Error('Duplicate indicator key');
    seen.add(edit.key);
    const slot = slots[edit.key];
    expected[8 + slot] = edit.color.red;
    expected[8 + PLANE_LENGTH + slot] = edit.color.green;
    expected[8 + 2 * PLANE_LENGTH + slot] = edit.color.blue;
  }
  const changed = expected.some((value, index) => value !== fresh[index]);
  const report = new Uint8Array(expected);
  report[1] = 6;
  return { report, expected, changed };
}

export function verifyStaticTable(actual: Uint8Array, expected: Uint8Array): void {
  validateTable(actual);
  validateTable(expected);
  if (actual.some((value, index) => value !== expected[index]))
    throw new Error('Static table readback mismatch; no retry or restoration');
}
