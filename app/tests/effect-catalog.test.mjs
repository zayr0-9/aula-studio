import test from 'node:test';
import assert from 'node:assert/strict';
import { EFFECT_CATALOG } from '../src/protocol/effect-catalog.ts';
import { validateEffect } from '../src/main/brightness-service.ts';

test('static effect catalog preserves IDs, hidden rows and live-evidence distinction', () => {
  assert.equal(new Set(EFFECT_CATALOG.map((effect) => effect.id)).size, 18);
  assert.deepEqual(
    EFFECT_CATALOG.filter((effect) => effect.captured).map((effect) => effect.id),
    [1, 11, 17],
  );
  assert.deepEqual(
    EFFECT_CATALOG.filter((effect) => effect.hidden).map((effect) => effect.id),
    [6, 9, 14, 18],
  );
  assert.deepEqual(
    EFFECT_CATALOG.filter((effect) => !effect.hidden).map((effect) => effect.name),
    [
      'Fixed_on',
      'Respire',
      'Rainbow',
      'Flash_away',
      'Raindrops',
      'Ripples_shining',
      'Stars_twinkle',
      'Retro_snake',
      'Neon_stream',
      'Reaction',
      'Sine_wave',
      'Rotating windmill',
      'Colorful waterfall',
      'Blossoming',
    ],
  );
});
test('metadata catalog does not silently broaden hardware write allowlist', () => {
  for (const effect of EFFECT_CATALOG) {
    if (effect.captured) assert.doesNotThrow(() => validateEffect(effect.id));
    else assert.throws(() => validateEffect(effect.id));
  }
  assert.doesNotThrow(() => validateEffect(0)); // Explicit Studio turn-off action.
  assert.throws(() => validateEffect(21));
});
