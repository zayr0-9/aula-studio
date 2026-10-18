import { F75_DIRECT_KEYS } from '../protocol/f75-direct.ts';
import type { F75DirectKey } from '../protocol/f75-direct.ts';
export type { F75DirectKey } from '../protocol/f75-direct.ts';
import { animationColors, validateAnimation } from './animation.ts';
import type { AnimationSequence } from './animation.ts';
export interface StreamProfile {
  mode: 'paint' | 'solid' | 'wave' | 'breathe' | 'walk' | 'animation';
  animation?: AnimationSequence;
  color: string;
  brightness: number;
  colors: Record<F75DirectKey, string>;
}
export interface StreamStatus {
  state: 'off' | 'starting' | 'active' | 'stopping' | 'error';
  message: string;
  frames: number;
}
export function validateStreamProfile(value: unknown): asserts value is StreamProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid stream profile');
  const p = value as StreamProfile;
  if (
    Object.keys(p).sort().join(',') !==
      (p.mode === 'animation'
        ? 'animation,brightness,color,colors,mode'
        : 'brightness,color,colors,mode') ||
    !['paint', 'solid', 'wave', 'breathe', 'walk', 'animation'].includes(p.mode)
  )
    throw new Error('Invalid stream profile fields');
  if (p.mode === 'animation') validateAnimation(p.animation);
  if (
    typeof p.brightness !== 'number' ||
    !Number.isFinite(p.brightness) ||
    p.brightness < 0 ||
    p.brightness > 100
  )
    throw new Error('Brightness must be 0–100 percent');
  const validHex = (color: unknown) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color);
  if (
    !validHex(p.color) ||
    !p.colors ||
    typeof p.colors !== 'object' ||
    Array.isArray(p.colors) ||
    Object.keys(p.colors).length !== 80
  )
    throw new Error('Expected all80key colors');
  for (const { key } of F75_DIRECT_KEYS)
    if (!Object.hasOwn(p.colors, key) || !validHex(p.colors[key]))
      throw new Error('Missing or invalid physical key color');
}
export function defaultStreamProfile(): StreamProfile {
  return {
    mode: 'paint',
    color: '#00ff80',
    brightness: 25,
    colors: Object.fromEntries(F75_DIRECT_KEYS.map(({ key }) => [key, '#000000'])) as Record<
      F75DirectKey,
      string
    >,
  };
}
/** Coarse effects at verified800ms pacing, not high-frame-rate animations. */
export function buildStreamColors(profile: StreamProfile, tick: number): number[][] {
  validateStreamProfile(profile);
  if (!Number.isInteger(tick) || tick < 0) throw new Error('Invalid frame index');
  const result = Array.from({ length: 90 }, () => [0, 0, 0]);
  const animated = profile.mode === 'animation' ? animationColors(profile.animation!, tick) : null;
  for (const [index, { key, slot, column }] of F75_DIRECT_KEYS.entries()) {
    const hex = animated
      ? animated[key]
      : profile.mode === 'paint'
        ? profile.colors[key]
        : profile.color;
    let rgb = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
    let gain = profile.brightness / 100;
    if (profile.mode === 'walk' && index !== tick % 80) gain = 0;
    if (profile.mode === 'breathe')
      gain *= 0.15 + (0.85 * (1 + Math.sin((tick * Math.PI) / 4))) / 2;
    if (profile.mode === 'wave') {
      const phase = (column + tick) % 6;
      const wheel = [
        [255, 0, 0],
        [255, 128, 0],
        [0, 255, 0],
        [0, 255, 255],
        [0, 0, 255],
        [255, 0, 255],
      ];
      rgb = wheel[phase];
    }
    result[slot] = rgb.map((channel) => Math.round(channel * gain));
  }
  return result;
}
