import test from 'node:test';
import assert from 'node:assert/strict';
import { BrightnessService } from '../src/main/brightness-service.ts';

test('unknown ordinary selector is readable without fault and explicit supported override succeeds', async () => {
  const calls = [];
  const service = new BrightnessService(async (value, action) => {
    calls.push([value, action]);
    return action === 'ReadEffect' ? 4 : value;
  });
  assert.equal(await service.readEffect(), 4);
  assert.throws(() => service.setEffect(4), /supported/);
  assert.equal(await service.setEffect(11), 11);
  assert.deepEqual(calls, [
    [undefined, 'ReadEffect'],
    [11, 'SetEffect'],
  ]);
});
test('malformed observed selector still faults service', async () => {
  for (const invalid of [-1, 256, 1.5, '4', null]) {
    const service = new BrightnessService(async () => invalid);
    await assert.rejects(service.readEffect(), /Invalid observed/);
    await assert.rejects(service.setEffect(11), /blocked/);
  }
});
