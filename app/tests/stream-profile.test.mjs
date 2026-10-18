import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultStreamProfile,
  buildStreamColors,
  validateStreamProfile,
} from '../src/shared/stream.ts';
import { F75_DIRECT_KEYS } from '../src/protocol/f75-direct.ts';
test('stream profiles encode all80verified sparse keys with black gaps and local brightness', () => {
  const p = defaultStreamProfile();
  p.mode = 'solid';
  p.color = '#ff8004';
  p.brightness = 50;
  const colors = buildStreamColors(p, 0);
  assert.equal(colors.length, 90);
  for (const { slot } of F75_DIRECT_KEYS) assert.deepEqual(colors[slot], [128, 64, 2]);
  for (const slot of [6, 23, 29, 41, 47, 65, 71, 75, 76, 84])
    assert.deepEqual(colors[slot], [0, 0, 0]);
  p.mode = 'walk';
  assert.equal(buildStreamColors(p, 1).filter((rgb) => rgb.some(Boolean)).length, 1);
  p.mode = 'paint';
  assert.ok(buildStreamColors(p, 0).every((rgb) => rgb.every((v) => v === 0)));
});
test('all effects respect brightness bounds; malformed profiles refused', () => {
  const p = defaultStreamProfile();
  for (const mode of ['paint', 'solid', 'wave', 'breathe', 'walk']) {
    p.mode = mode;
    for (let tick = 0; tick < 100; tick++)
      assert.ok(
        buildStreamColors(p, tick)
          .flat()
          .every((v) => Number.isInteger(v) && v >= 0 && v <= 255),
      );
  }
  for (const value of [
    null,
    {},
    { ...p, brightness: -1 },
    { ...p, brightness: 101 },
    { ...p, mode: 'raw' },
    { ...p, color: '#fff' },
    { ...p, colors: {} },
    { ...p, extra: 1 },
  ])
    assert.throws(() => validateStreamProfile(value));
});
