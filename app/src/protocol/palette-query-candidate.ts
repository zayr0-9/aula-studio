/** Offline-only candidate from corrected binary FUN_0048c120. Not live validated.
 * Deliberately not imported by main, preload, renderer or the native transport.
 */
const LENGTH = 520;
const HEADER = [6, 0x8a, 0, 0, 1, 0, 0, 2];

export function encodeCandidatePaletteQuery(): Uint8Array {
  const report = new Uint8Array(LENGTH);
  report.set(HEADER);
  return report;
}

/** A successful API call alone is insufficient: require independently measured length.
 * Strict header echo is a proposed acceptance rule, not observed firmware behavior.
 * This intentionally refuses bool-only HidD_GetFeature buffers without length evidence.
 */
export function parseCandidatePaletteResponse(
  report: Uint8Array,
  actualLength: number,
): Uint8Array {
  if (!(report instanceof Uint8Array) || report.length !== LENGTH || actualLength !== LENGTH) {
    throw new Error('A complete independently measured 520-byte palette response is required');
  }
  if (!HEADER.every((value, index) => report[index] === value)) {
    throw new Error('Unsupported candidate palette response header');
  }
  return report.slice(8);
}
