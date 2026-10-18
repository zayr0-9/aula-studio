/** Decodes only the observed MI01/COL02 consumer format. Caller must filter source first.
 * No interception, suppression, action execution or input registration.
 */
export type KnobSignal = 'clockwise' | 'counterclockwise' | 'press' | 'neutral';
export function decodeKnobReport(report: Uint8Array): KnobSignal {
  if (!(report instanceof Uint8Array) || report.length !== 3 || report[0] !== 2) {
    throw new Error('Unsupported F75 consumer report');
  }
  const usage = report[1] | (report[2] << 8);
  switch (usage) {
    case 0xe9:
      return 'clockwise';
    case 0xea:
      return 'counterclockwise';
    case 0xe2:
      return 'press';
    case 0:
      return 'neutral';
    default:
      throw new Error('Unobserved F75 consumer usage');
  }
}
