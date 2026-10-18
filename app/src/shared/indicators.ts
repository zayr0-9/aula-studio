export type IndicatorKey = 'Digit1' | 'Digit2' | 'Digit3' | 'Digit4';
export interface IndicatorRgb {
  red: number;
  green: number;
  blue: number;
}
export type IndicatorColors = Record<IndicatorKey, IndicatorRgb>;
export const indicatorKeys: readonly IndicatorKey[] = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];

export function validateIndicatorKey(value: unknown): asserts value is IndicatorKey {
  if (!indicatorKeys.includes(value as IndicatorKey))
    throw new Error('Expected Digit1 through Digit4');
}
export function validateIndicatorRgb(value: unknown): asserts value is IndicatorRgb {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== 3
  )
    throw new Error('Expected RGB object');
  const rgb = value as IndicatorRgb;
  for (const channel of [rgb.red, rgb.green, rgb.blue]) {
    if (typeof channel !== 'number' || !Number.isInteger(channel) || channel < 0 || channel > 255)
      throw new Error('RGB must be integers from 0 to 255');
  }
}
export function validateIndicatorColors(value: unknown): asserts value is IndicatorColors {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== 4
  )
    throw new Error('Expected four indicator colors');
  for (const key of indicatorKeys) {
    if (!Object.hasOwn(value, key)) throw new Error('Missing indicator key');
    validateIndicatorRgb((value as IndicatorColors)[key]);
  }
}
