import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultAnimation,
  validateAnimation,
  animationFrameAt,
  animationColors,
} from '../src/shared/animation.ts';
import {
  defaultStreamProfile,
  validateStreamProfile,
  buildStreamColors,
} from '../src/shared/stream.ts';

test('defaults clone colors, timing boundaries and nonloop completion', () => {
  const colors = defaultStreamProfile().colors;
  const a = defaultAnimation(colors);
  colors.Digit1 = '#abcdef';
  assert.equal(a.frames[0].colors.Digit1, '#000000');
  a.frames.push({ durationMs: 1600, colors: { ...colors } });
  assert.equal(animationFrameAt(a, 0), 0);
  assert.equal(animationFrameAt(a, 799.9), 0);
  assert.equal(animationFrameAt(a, 800), 1);
  assert.equal(animationFrameAt(a, 2399), 1);
  assert.equal(animationFrameAt(a, 2400), 0);
  assert.equal(animationFrameAt(a, 5600), 1);
  a.loop = false;
  assert.equal(animationFrameAt(a, 2400), null);
  for (const elapsed of [-1, NaN, Infinity]) assert.throws(() => animationFrameAt(a, elapsed));
});

test('overrides merge without mutation and apply through brightness and slot mapping', () => {
  const a = defaultAnimation();
  a.overrides = { Digit1: '#ffffff', Digit4: '#123456' };
  const colors = animationColors(a, 0);
  assert.equal(colors.Digit1, '#ffffff');
  assert.equal(colors.Digit4, '#123456');
  colors.Digit1 = '#000000';
  assert.equal(a.overrides.Digit1, '#ffffff');
  assert.equal(a.frames[0].colors.Digit1, '#000000');
  for (const index of [-1, 1, 0.5, NaN]) assert.throws(() => animationColors(a, index));
  const p = { ...defaultStreamProfile(), mode: 'animation', animation: a, brightness: 100 };
  assert.doesNotThrow(() => validateStreamProfile(p));
  assert.ok(buildStreamColors(p, 0).some((rgb) => rgb.every((v) => v === 255)));
  assert.throws(() => validateStreamProfile({ ...p, mode: 'paint' }));
  assert.throws(() => validateStreamProfile({ ...p, animation: undefined }));
});

test('strict bounded animation validation rejects malformed structures', () => {
  const invalid = [null, [], {}, { ...defaultAnimation(), extra: true }];
  const mutate = (fn) => {
    const a = defaultAnimation();
    fn(a);
    invalid.push(a);
  };
  mutate((a) => {
    a.version = 2;
  });
  mutate((a) => {
    a.loop = 1;
  });
  mutate((a) => {
    a.frames = [];
  });
  mutate((a) => {
    a.frames = Array(65).fill(a.frames[0]);
  });
  mutate((a) => {
    a.frames = Array(2);
  });
  mutate((a) => {
    a.frames.extra = true;
  });
  mutate((a) => {
    a.frames[0].extra = true;
  });
  for (const duration of [0, 799, 801, 60800, NaN, Infinity, '800'])
    mutate((a) => {
      a.frames[0].durationMs = duration;
    });
  mutate((a) => {
    delete a.frames[0].colors.Digit1;
  });
  mutate((a) => {
    a.frames[0].colors.extra = '#123456';
  });
  mutate((a) => {
    a.frames[0].colors.Digit1 = '#123';
  });
  mutate((a) => {
    a.overrides = { KeyA: '#123456' };
  });
  mutate((a) => {
    a.overrides = { Digit1: 'red' };
  });
  mutate((a) => {
    a.overrides = [];
  });
  mutate((a) => {
    a[Symbol('extra')] = true;
  });
  mutate((a) => {
    Object.defineProperty(a, 'loop', {
      get() {
        throw new Error('getter invoked');
      },
    });
  });
  for (const value of invalid) assert.throws(() => validateAnimation(value));
  const maximum = defaultAnimation();
  maximum.frames = Array.from({ length: 64 }, () => ({
    durationMs: 60000,
    colors: { ...maximum.frames[0].colors },
  }));
  assert.doesNotThrow(() => validateAnimation(maximum));
});
