import test from 'node:test';
import assert from 'node:assert/strict';
import { BrightnessService } from '../src/main/brightness-service.ts';

test('allowlisted effect and brightness requests share one serialized queue', async () => {
  const calls = [];
  let active = 0;
  const service = new BrightnessService(async (value, action) => {
    assert.equal(active++, 0);
    calls.push([value, action]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    return value ?? (action === 'ReadEffect' ? 11 : 9);
  });
  assert.deepEqual(
    await Promise.all([
      service.readEffect(),
      service.setEffect(1),
      service.setEffect(17),
      service.setEffect(11),
      service.set(8),
    ]),
    [11, 1, 17, 11, 8],
  );
  assert.deepEqual(calls, [
    [undefined, 'ReadEffect'],
    [1, 'SetEffect'],
    [17, 'SetEffect'],
    [11, 'SetEffect'],
    [8, 'Set'],
  ]);
});

test('unknown effects never reach transport', () => {
  const service = new BrightnessService(async () => {
    assert.fail('Unexpected transport');
  });
  for (const value of [0, 2, 9, 16, 18, '11', null, undefined, {}, 1.5]) {
    assert.throws(() => service.setEffect(value), /supported/);
  }
});

test('effect mismatch blocks brightness operations too', async () => {
  let count = 0;
  const service = new BrightnessService(async () => {
    count++;
    return 11;
  });
  await assert.rejects(service.setEffect(17), /uncertain/);
  await assert.rejects(service.set(8), /blocked/);
  assert.equal(count, 1);
});
