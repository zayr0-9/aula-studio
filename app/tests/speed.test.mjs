import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BrightnessService } from '../src/main/brightness-service.ts';

const evidence = JSON.parse(
  await readFile(
    new URL('../../docs/evidence/neon-stream-speed-range.json', import.meta.url),
    'utf8',
  ),
);
test('captured complete speed range preserves low nibble and unrelated bytes', () => {
  assert.equal(evidence.allStatusesSuccess, true);
  assert.deepEqual(
    evidence.cycles.map((c) => c.write[87] >> 4),
    [4, 0, 1, 2, 3, 4],
  );
  for (const [i, c] of evidence.cycles.entries()) {
    assert.equal(c.write.length, 520);
    assert.equal(c.response.length, 136);
    assert.deepEqual(c.write.slice(0, 8), [6, 4, 0, 0, 1, 0, 128, 0]);
    assert.ok(c.write.slice(136).every((v) => v === 0));
    const expected = c.response.slice(8);
    if (i === 0) expected[10] = 11;
    else expected[79] = (expected[79] & 15) | ([4, 0, 1, 2, 3, 4][i] << 4);
    assert.deepEqual(c.write.slice(8, 136), expected);
    assert.equal(c.write[87] & 15, 7);
    assert.deepEqual(c.palette, evidence.cycles[0].palette);
    if (i) assert.deepEqual(c.response.slice(8), evidence.cycles[i - 1].write.slice(8, 136));
  }
});
test('speed allowlist rejects invalid IPC values before transport', () => {
  const service = new BrightnessService(async () => {
    assert.fail('Transport called');
  });
  for (const value of [-1, 5, 1.5, NaN, Infinity, '4', null, {}, undefined])
    assert.throws(() => service.setSpeed(value), /integer/);
});
test('speed shares queue and fault latch with effects and brightness', async () => {
  const calls = [];
  let active = 0;
  const service = new BrightnessService(async (value, action) => {
    assert.equal(active++, 0);
    calls.push(action);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active--;
    return value ?? 4;
  });
  assert.deepEqual(
    await Promise.all([
      service.readSpeed(),
      service.setSpeed(0),
      service.setEffect(11),
      service.set(8),
    ]),
    [4, 0, 11, 8],
  );
  assert.deepEqual(calls, ['ReadSpeed', 'SetSpeed', 'SetEffect', 'Set']);
  const faulty = new BrightnessService(async () => 3);
  await assert.rejects(faulty.setSpeed(4), /uncertain/);
  await assert.rejects(faulty.setEffect(11), /blocked/);
});
