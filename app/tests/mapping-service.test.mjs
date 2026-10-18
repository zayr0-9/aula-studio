import test from 'node:test';
import assert from 'node:assert/strict';
import { BrightnessService } from '../src/main/brightness-service.ts';

test('restricted mapping rejects other keys and uses shared queue', async () => {
  const calls = [];
  const service = new BrightnessService(async (value, action) => {
    calls.push([value, action]);
    return value ?? 75;
  });
  for (const value of [0, 4, 73, 76, '74', null, undefined, 74.5])
    assert.throws(() => service.setPgUp(value));
  assert.equal(await service.readPgUp(), 75);
  assert.equal(await service.setPgUp(74), 74);
  assert.equal(await service.setPgUp(75), 75);
  assert.deepEqual(calls, [
    [undefined, 'ReadPgUp'],
    [74, 'SetPgUp'],
    [75, 'SetPgUp'],
  ]);
});
test('mapping mismatch faults lighting as well', async () => {
  const service = new BrightnessService(async () => 75);
  await assert.rejects(service.setPgUp(74), /uncertain/);
  await assert.rejects(service.set(9), /blocked/);
});

const {
  ordinaryKeys,
  mappingSources,
  mappingTargets,
  validateMappings,
  shortcutTarget,
  mappingLabel,
  validateMappingTarget,
} = await import('../src/shared/mapping.ts');
const assignments = () => mappingSources.map(({ id }) => ({ source: id, target: id }));
test('ordinary catalog agrees with canonical snapshot and physical layout', async () => {
  const { readFile } = await import('node:fs/promises');
  const snapshot = JSON.parse(
    (
      await readFile(
        new URL('../../docs/evidence/matrix-layer0-20261018-103210.json', import.meta.url),
        'utf8',
      )
    ).replace(/^\uFEFF/, ''),
  ).response;
  const { f75Layout } = await import('../src/renderer/src/components/keyboard-layout.ts');
  assert.equal(ordinaryKeys.length, 73);
  assert.equal(mappingTargets.length, 81);
  assert.equal(mappingSources.length, 79);
  for (const [id, slot, mask] of [
    ['ControlLeft', 5, 1],
    ['ShiftLeft', 4, 2],
    ['MetaLeft', 11, 8],
    ['AltLeft', 17, 4],
    ['ControlRight', 59, 16],
    ['ShiftRight', 70, 32],
  ]) {
    assert.equal(mappingSources.find((key) => key.id === id).matrix, slot);
    assert.deepEqual(snapshot.slice(8 + slot * 4, 12 + slot * 4), [0, mask, 0, 0]);
  }
  assert.equal(new Set(ordinaryKeys.map((k) => k.id)).size, 73);
  assert.equal(new Set(ordinaryKeys.map((k) => k.matrix)).size, 73);
  for (const key of ordinaryKeys) {
    assert.equal(f75Layout.keys.find((k) => k.id === key.id)?.matrix, key.matrix);
    assert.deepEqual(snapshot.slice(8 + key.matrix * 4, 12 + key.matrix * 4), [0, 0, 0, key.usage]);
  }
});
test('complete result validation accepts null but refuses omissions, duplicates and unknown targets', () => {
  validateMappings(assignments());
  const nullable = assignments();
  nullable[0].target = null;
  validateMappings(nullable);
  for (const mutate of [
    (a) => a.pop(),
    (a) => a.push(a[0]),
    (a) => {
      a[1] = a[0];
    },
    (a) => {
      a[0].source = 'Fn';
    },
    (a) => {
      a[0].target = 'AltRight';
    },
    (a) => {
      a[0].target = undefined;
    },
    (a) => {
      a[0].extra = 1;
    },
  ]) {
    const value = assignments();
    mutate(value);
    assert.throws(() => validateMappings(value));
  }
});
test('ordinary methods validate before transport and share queue with lighting and color', async () => {
  const calls = [];
  const service = new BrightnessService(
    async () => {
      calls.push('light');
      return 3;
    },
    async () => {
      calls.push('color');
      return { red: 1, green: 2, blue: 3, colourful: false };
    },
    async (source, target) => {
      calls.push(source ?? 'read');
      await new Promise((resolve) => setTimeout(resolve, 5));
      return assignments().map((entry) => (entry.source === source ? { source, target } : entry));
    },
  );
  for (const [source, target] of [
    ['Fn', 'Home'],
    ['Home', 'KeyA'],
    ['Knob', 'KeyA'],
    ['KeyA', 'Fn'],
    ['KeyA', null],
    ['keya', 'Home'],
  ])
    assert.throws(() => service.setMapping(source, target));
  const operations = [
    service.readMappings(),
    service.set(3),
    service.setMapping('PageUp', 'Insert'),
    service.readColor(),
  ];
  const result = await Promise.all(operations);
  assert.equal(result[2].find((e) => e.source === 'PageUp').target, 'Insert');
  assert.deepEqual(calls, ['read', 'light', 'PageUp', 'color']);
});
test('malformed mapping result and mismatch latch shared hardware failure', async () => {
  for (const result of [[], assignments()]) {
    const service = new BrightnessService(
      async () => 3,
      undefined,
      async () => result,
    );
    await assert.rejects(service.setMapping('KeyA', 'Home'), /uncertain/);
    await assert.rejects(service.read(), /blocked/);
    await assert.rejects(service.readColor(), /blocked/);
  }
  let calls = 0;
  const service = new BrightnessService(
    async () => {
      throw new Error('failed');
    },
    undefined,
    async () => {
      calls++;
      return assignments();
    },
  );
  await assert.rejects(service.read(), /uncertain/);
  await assert.rejects(service.readMappings(), /blocked/);
  assert.equal(calls, 0);
});
test('ordinary mapping honors shared queue bounds and shutdown', async () => {
  let release;
  const wait = new Promise((resolve) => {
    release = resolve;
  });
  const service = new BrightnessService(
    async () => 3,
    undefined,
    async () => {
      await wait;
      return assignments();
    },
  );
  const pending = Array.from({ length: 8 }, () => service.readMappings());
  await assert.rejects(service.readMappings(), /full/);
  release();
  await Promise.all(pending);
  await service.stop();
  await assert.rejects(service.readMappings(), /shutting down/);
});

test('semantic shortcuts are exact, labelled and accepted through queued service', async () => {
  for (const target of mappingTargets.filter((key) => key.usage !== 0)) {
    for (const ctrl of [false, true])
      for (const shift of [false, true]) {
        const id = shortcutTarget(target.id, ctrl, shift);
        validateMappingTarget(id);
        assert.equal(
          mappingLabel(id),
          `${ctrl ? 'Ctrl+' : ''}${shift ? 'Shift+' : ''}${target.label}`,
        );
      }
  }
  assert.equal(mappingLabel('ControlLeft'), 'Left Ctrl');
  assert.equal(mappingLabel(null), 'Unsupported');
  for (const id of [
    'Ctrl+',
    'Ctrl+Shift+',
    'Ctrl+ControlLeft',
    'Shift+ShiftLeft',
    'Shift+Ctrl+KeyC',
    'ctrl+KeyC',
    'Alt+KeyC',
    'Ctrl+Ctrl+KeyC',
  ])
    assert.throws(() => validateMappingTarget(id));
  assert.throws(() => shortcutTarget('ControlLeft', true, false));
  const service = new BrightnessService(
    async () => 3,
    undefined,
    async (source, target) =>
      assignments().map((entry) => (entry.source === source ? { source, target } : entry)),
  );
  for (const [source, target] of [
    ['ControlLeft', 'Ctrl+Shift+KeyC'],
    ['ShiftLeft', 'ControlLeft'],
    ['Digit1', 'Shift+Insert'],
    ['MetaLeft', 'AltLeft'],
    ['AltLeft', 'MetaLeft'],
    ['ControlRight', 'ShiftRight'],
    ['ShiftRight', 'ControlRight'],
  ]) {
    const result = await service.setMapping(source, target);
    assert.equal(result.find((entry) => entry.source === source).target, target);
  }
});
