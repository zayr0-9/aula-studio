import test from 'node:test';
import assert from 'node:assert/strict';
import { BrightnessService } from '../src/main/brightness-service.ts';
const red = { red: 255, green: 0, blue: 0, colourful: false };
test('color uses shared queue and clones caller values', async () => {
  const calls = [];
  const service = new BrightnessService(
    async () => {
      calls.push('brightness');
      return 9;
    },
    async (color) => {
      calls.push('color');
      return color ?? { ...red };
    },
  );
  const draft = { ...red };
  const first = service.setColor(draft);
  draft.red = 0;
  assert.deepEqual(await first, red);
  assert.deepEqual(await Promise.all([service.read(), service.readColor()]), [9, red]);
  assert.deepEqual(calls, ['color', 'brightness', 'color']);
});
test('invalid colors never reach transport', () => {
  const service = new BrightnessService(
    async () => 9,
    async () => {
      assert.fail('transport');
    },
  );
  for (const value of [
    null,
    {},
    [],
    { ...red, red: 256 },
    { ...red, red: 1.5 },
    { ...red, red: '1' },
    { ...red, colourful: 1 },
    { ...red, extra: 1 },
  ])
    assert.throws(() => service.setColor(value));
});
test('color mismatch latches all operations off', async () => {
  const service = new BrightnessService(
    async () => 9,
    async () => ({ ...red, blue: 1 }),
  );
  await assert.rejects(service.setColor(red), /uncertain/);
  await assert.rejects(service.setEffect(11), /blocked/);
});
