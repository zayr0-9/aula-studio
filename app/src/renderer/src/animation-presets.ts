import { validateAnimation } from '../../shared/animation.ts';
import type { AnimationSequence } from '../../shared/animation.ts';

const key = 'aula.animation-presets.v1';
export interface AnimationPreset {
  name: string;
  animation: AnimationSequence;
}
export function readAnimationPresets(storage: Pick<Storage, 'getItem'>): AnimationPreset[] {
  const raw = storage.getItem(key);
  if (!raw) return [];
  if (raw.length > 4000000) throw new Error('Saved animation library is too large');
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || data.length > 20) throw new Error('Invalid saved animation library');
  for (const preset of data) {
    if (
      !preset ||
      typeof preset !== 'object' ||
      Object.keys(preset).sort().join(',') !== 'animation,name' ||
      typeof preset.name !== 'string' ||
      !preset.name.trim() ||
      preset.name.length > 60
    )
      throw new Error('Invalid saved preset');
    validateAnimation(preset.animation);
  }
  return data as AnimationPreset[];
}
export function writeAnimationPresets(
  storage: Pick<Storage, 'setItem'>,
  presets: AnimationPreset[],
): void {
  if (presets.length > 20) throw new Error('Maximum 20 presets; delete one first');
  for (const preset of presets) {
    if (!preset.name.trim() || preset.name.length > 60)
      throw new Error('Use a preset name of 1–60 characters');
    validateAnimation(preset.animation);
  }
  const raw = JSON.stringify(presets);
  if (raw.length > 4000000) throw new Error('Animation library is too large');
  storage.setItem(key, raw);
}
