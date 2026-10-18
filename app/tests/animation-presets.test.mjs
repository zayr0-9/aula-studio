import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultAnimation } from '../src/shared/animation.ts';
import {
  readAnimationPresets,
  writeAnimationPresets,
} from '../src/renderer/src/animation-presets.ts';

test('local preset library roundtrips and rejects malformed data without writing', () => {
  let raw = null;
  let writes = 0;
  const storage = {
    getItem: () => raw,
    setItem: (_key, value) => {
      raw = value;
      writes++;
    },
  };
  assert.deepEqual(readAnimationPresets(storage), []);
  const presets = [{ name: 'Example', animation: defaultAnimation() }];
  writeAnimationPresets(storage, presets);
  const loaded = readAnimationPresets(storage);
  assert.deepEqual(loaded, presets);
  loaded[0].animation.frames[0].durationMs = 1600;
  assert.equal(readAnimationPresets(storage)[0].animation.frames[0].durationMs, 800);
  assert.throws(() =>
    writeAnimationPresets(storage, [{ name: ' ', animation: defaultAnimation() }]),
  );
  assert.throws(() =>
    writeAnimationPresets(
      storage,
      Array.from({ length: 21 }, () => presets[0]),
    ),
  );
  assert.equal(writes, 1);
  for (const bad of ['bad json', '{}', '[{"name":"x","animation":{}}]', ' '.repeat(4000001)]) {
    raw = bad;
    assert.throws(() => readAnimationPresets(storage));
  }
  assert.equal(writes, 1);
});

test('storage failures propagate rather than claiming a successful save', () => {
  assert.throws(
    () =>
      readAnimationPresets({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    /blocked/,
  );
  assert.throws(
    () =>
      writeAnimationPresets(
        {
          setItem: () => {
            throw new Error('quota');
          },
        },
        [{ name: 'Example', animation: defaultAnimation() }],
      ),
    /quota/,
  );
});
