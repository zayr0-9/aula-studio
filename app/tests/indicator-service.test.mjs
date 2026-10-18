import test from 'node:test';
import assert from 'node:assert/strict';
import { BrightnessService } from '../src/main/brightness-service.ts';
const colors = () =>
  Object.fromEntries(
    ['Digit1', 'Digit2', 'Digit3', 'Digit4'].map((key) => [key, { red: 0, green: 0, blue: 0 }]),
  );
test('manual indicators use shared queue and validate before transport', async () => {
  const order = [];
  const service = new BrightnessService(
    async (value) => {
      order.push('brightness');
      return value ?? 0;
    },
    undefined,
    undefined,
    async (key, color) => {
      order.push('indicators');
      const result = colors();
      if (key) result[key] = color;
      return result;
    },
  );
  assert.throws(() => service.setIndicator('KeyQ', { red: 0, green: 0, blue: 0 }));
  assert.throws(() => service.setIndicator('Digit1', { red: 256, green: 0, blue: 0 }));
  const [result] = await Promise.all([
    service.setIndicator('Digit1', { red: 1, green: 2, blue: 3 }),
    service.set(2),
  ]);
  assert.deepEqual(result.Digit1, { red: 1, green: 2, blue: 3 });
  assert.deepEqual(order, ['indicators', 'brightness']);
});
test('indicator mismatch latches the shared service without retry', async () => {
  let calls = 0;
  const service = new BrightnessService(
    async () => {
      calls++;
      return 0;
    },
    undefined,
    undefined,
    async () => {
      calls++;
      return colors();
    },
  );
  await assert.rejects(
    service.setIndicator('Digit1', { red: 1, green: 0, blue: 0 }),
    /readback mismatch/,
  );
  await assert.rejects(service.read(), /blocked after failure/);
  assert.equal(calls, 1);
});

test('stream reservation excludes all shared transactions until explicit release', async () => {
  let calls = 0;
  const service = new BrightnessService(async () => {
    calls++;
    return 0;
  });
  service.reserveStream();
  assert.throws(() => service.reserveStream(), /busy/);
  await assert.rejects(service.read(), /Stop temporary lighting/);
  await assert.rejects(service.set(1), /Stop temporary lighting/);
  assert.equal(calls, 0);
  service.releaseStream();
  assert.equal(await service.read(), 0);
  assert.equal(calls, 1);
});
