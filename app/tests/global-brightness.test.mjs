import test from 'node:test';
import assert from 'node:assert/strict';
import { BrightnessService } from '../src/main/brightness-service.ts';

test('combined effect and brightness travels as one queued transaction', async () => {
  const calls = [];
  const service = new BrightnessService(async (...args) => {
    calls.push(args);
    return args[0];
  });
  assert.equal(await service.setEffectBrightness(11, 1), 11);
  assert.equal(await service.setEffectBrightness(1, 0), 1);
  assert.deepEqual(calls, [
    [11, 'SetEffectBrightness', 1],
    [1, 'SetEffectBrightness', 0],
  ]);
});
test('combined operation rejects unsupported target and malformed brightness', () => {
  const service = new BrightnessService(async () => {
    assert.fail('Transport called');
  });
  for (const effect of [17, 2, '11', null])
    assert.throws(() => service.setEffectBrightness(effect, 1));
  for (const brightness of [-1, 10, 1.5, NaN, '1', null, undefined])
    assert.throws(() => service.setEffectBrightness(11, brightness));
});
test('combined verification failure blocks subsequent operations', async () => {
  const service = new BrightnessService(async () => 1);
  await assert.rejects(service.setEffectBrightness(11, 1), /uncertain/);
  await assert.rejects(service.set(4), /blocked/);
});
