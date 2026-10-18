import test from 'node:test';
import assert from 'node:assert/strict';
import { BrightnessService } from '../src/main/brightness-service.ts';

test('serializes whole transactions and does not reuse previous state', async () => {
  const calls = [];
  let active = 0;
  const service = new BrightnessService(async (value) => {
    assert.equal(active++, 0);
    calls.push(value);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    return value ?? 9;
  });
  assert.deepEqual(await Promise.all([service.read(), service.set(8), service.set(9)]), [9, 8, 9]);
  assert.deepEqual(calls, [undefined, 8, 9]);
});

test('rejects untrusted brightness values before transport', async () => {
  let count = 0;
  const service = new BrightnessService(async (value) => {
    count++;
    return value ?? 9;
  });
  for (const value of [-1, 10, 1.5, NaN, Infinity, '8', null, {}, [], undefined]) {
    assert.throws(() => service.set(value), /integer/);
  }
  assert.equal(count, 0);
  assert.equal(await service.set(0), 0);
});

test('verification mismatch latches fault and prevents queued writes and retries', async () => {
  let count = 0;
  const service = new BrightnessService(async () => {
    count++;
    return 7;
  });
  const first = service.set(8);
  const second = service.set(9);
  await assert.rejects(first, /uncertain/);
  await assert.rejects(second, /blocked/);
  await assert.rejects(service.read(), /blocked/);
  assert.equal(count, 1);
});

test('transport failure and invalid responses fail closed', async () => {
  for (const transact of [
    async () => {
      throw new Error('timeout');
    },
    async () => 10,
  ]) {
    const service = new BrightnessService(transact);
    await assert.rejects(service.read(), /uncertain/);
    await assert.rejects(service.set(8), /blocked/);
  }
});

test('queue is bounded', async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const service = new BrightnessService(async () => {
    await gate;
    return 9;
  });
  const pending = Array.from({ length: 8 }, () => service.read());
  await assert.rejects(service.read(), /full/);
  release();
  await Promise.all(pending);
});

test('shutdown waits for active transaction and discards queued work', async () => {
  let release;
  let count = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const service = new BrightnessService(async () => {
    count++;
    await gate;
    return 9;
  });
  const active = service.read();
  await Promise.resolve();
  const queued = service.set(8);
  const rejected = assert.rejects(queued, /shutting down/);
  const stopped = service.stop();
  await assert.rejects(service.read(), /shutting down/);
  release();
  await active;
  await rejected;
  await stopped;
  assert.equal(count, 1);
});
