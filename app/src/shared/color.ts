export interface FixedColor {
  red: number;
  green: number;
  blue: number;
  colourful: boolean;
}

export function validateFixedColor(value: unknown): asserts value is FixedColor {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid color');
  const color = value as Record<string, unknown>;
  if (Object.keys(color).length !== 4 || typeof color.colourful !== 'boolean')
    throw new Error('Invalid color fields');
  for (const key of ['red', 'green', 'blue']) {
    const channel = color[key];
    if (typeof channel !== 'number' || !Number.isInteger(channel) || channel < 0 || channel > 255)
      throw new Error('RGB channels must be integers from 0 to 255');
  }
}
