import { F75_DIRECT_KEYS } from '../protocol/f75-direct.ts';
import type { F75DirectKey } from '../protocol/f75-direct.ts';

export interface AnimationSequence {
  version: 1;
  frames: Array<{ durationMs: number; colors: Record<F75DirectKey, string> }>;
  loop: boolean;
  overrides: Partial<Record<'Digit1' | 'Digit2' | 'Digit3' | 'Digit4', string>>;
}

const overrideKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
const validColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
function record(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null) &&
    Reflect.ownKeys(value).every(
      (key) =>
        typeof key === 'string' &&
        Object.getOwnPropertyDescriptor(value, key)?.enumerable &&
        'value' in Object.getOwnPropertyDescriptor(value, key)!,
    )
  );
}
function fields(value: Record<string, unknown>, names: string[]): boolean {
  return (
    Object.keys(value).length === names.length && names.every((name) => Object.hasOwn(value, name))
  );
}
function validColors(value: unknown): value is Record<F75DirectKey, string> {
  return (
    record(value) &&
    fields(
      value,
      F75_DIRECT_KEYS.map(({ key }) => key),
    ) &&
    F75_DIRECT_KEYS.every(({ key }) => validColor(value[key]))
  );
}

export function validateAnimation(value: unknown): asserts value is AnimationSequence {
  if (
    !record(value) ||
    !fields(value, ['version', 'frames', 'loop', 'overrides']) ||
    value.version !== 1 ||
    typeof value.loop !== 'boolean' ||
    !Array.isArray(value.frames) ||
    value.frames.length < 1 ||
    value.frames.length > 64 ||
    Reflect.ownKeys(value.frames).length !== value.frames.length + 1 ||
    !Object.keys(value.frames).every(
      (key, index) =>
        key === String(index) && 'value' in Object.getOwnPropertyDescriptor(value.frames, key)!,
    ) ||
    !record(value.overrides) ||
    Object.keys(value.overrides).length > 4 ||
    !Object.entries(value.overrides).every(
      ([key, color]) => overrideKeys.includes(key) && validColor(color),
    )
  )
    throw new Error('Invalid animation sequence');
  for (const frame of value.frames) {
    if (
      !record(frame) ||
      !fields(frame, ['durationMs', 'colors']) ||
      typeof frame.durationMs !== 'number' ||
      !Number.isInteger(frame.durationMs) ||
      frame.durationMs < 800 ||
      frame.durationMs > 60000 ||
      frame.durationMs % 800 !== 0 ||
      !validColors(frame.colors)
    )
      throw new Error('Invalid animation frame');
  }
}

export function defaultAnimation(colors?: Record<F75DirectKey, string>): AnimationSequence {
  const sequence: AnimationSequence = {
    version: 1,
    frames: [
      {
        durationMs: 800,
        colors: colors
          ? { ...colors }
          : (Object.fromEntries(F75_DIRECT_KEYS.map(({ key }) => [key, '#000000'])) as Record<
              F75DirectKey,
              string
            >),
      },
    ],
    loop: true,
    overrides: {},
  };
  validateAnimation(sequence);
  return sequence;
}

/** Pure ideal timeline; hardware playback may stretch holds to avoid skipping frames. */
export function animationFrameAt(sequence: AnimationSequence, elapsedMs: number): number | null {
  validateAnimation(sequence);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0)
    throw new Error('Invalid animation elapsed time');
  const duration = sequence.frames.reduce((total, frame) => total + frame.durationMs, 0);
  if (!sequence.loop && elapsedMs >= duration) return null;
  let remaining = elapsedMs % duration;
  for (const [index, frame] of sequence.frames.entries()) {
    if (remaining < frame.durationMs) return index;
    remaining -= frame.durationMs;
  }
  return null;
}

export function animationColors(
  sequence: AnimationSequence,
  index: number,
): Record<F75DirectKey, string> {
  validateAnimation(sequence);
  if (!Number.isInteger(index) || index < 0 || index >= sequence.frames.length)
    throw new Error('Invalid animation frame index');
  return { ...sequence.frames[index].colors, ...sequence.overrides };
}
