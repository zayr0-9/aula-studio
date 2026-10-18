import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  F75_DIRECT_KEYS,
  encodeF75DirectFrame,
  f75DirectSlotsFromKeys,
  OPENRGB_REFERENCE_COMMIT,
} from '../src/protocol/f75-direct.ts';

const black = () => Array.from({ length: 90 }, () => ({ red: 0, green: 0, blue: 0 }));
const gaps = [6, 23, 29, 41, 47, 65, 71, 75, 76, 84];
const expectedRows = [
  [0, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78],
  [1, 7, 13, 19, 25, 31, 37, 43, 49, 55, 61, 67, 73, 79, 85],
  [2, 8, 14, 20, 26, 32, 38, 44, 50, 56, 62, 68, 74, 80, 86],
  [3, 9, 15, 21, 27, 33, 39, 45, 51, 57, 63, 69, 81, 87],
  [4, 10, 16, 22, 28, 34, 40, 46, 52, 58, 64, 70, 82, 88],
  [5, 11, 17, 35, 53, 59, 77, 83, 89],
];

test('pinned upstream reference retains the F75 model and direct report evidence', async () => {
  const reference = JSON.parse(
    await readFile(
      new URL('../../docs/evidence/openrgb-direct-reference.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(reference.commit, OPENRGB_REFERENCE_COMMIT);
  const source = reference.files.find((file) =>
    file.path.endsWith('/SinowealthKeyboard10cController.cpp'),
  ).text;
  for (const [offset, value] of [
    ['00', '06'],
    ['01', '08'],
    ['04', '01'],
    ['06', '7A'],
    ['07', '01'],
  ])
    assert.ok(source.includes(`buf[0x${offset}] = 0x${value}`));
  assert.match(
    reference.files.find((file) => file.path.endsWith('Devices.cpp')).text,
    /0xCD, \{ "AULA F75", aula_f75_layout \}/,
  );
});

test('F75 sparse mapping covers 80 unique keys, preserves Escape zero and Fn/Ctrl slots', () => {
  assert.equal(F75_DIRECT_KEYS.length, 80);
  assert.equal(new Set(F75_DIRECT_KEYS.map((entry) => entry.key)).size, 80);
  assert.equal(new Set(F75_DIRECT_KEYS.map((entry) => entry.slot)).size, 80);
  for (let row = 0; row < 6; row++)
    assert.deepEqual(
      F75_DIRECT_KEYS.filter((key) => key.row === row).map((key) => key.slot),
      expectedRows[row],
    );
  assert.deepEqual(
    Array.from({ length: 90 }, (_, i) => i).filter(
      (slot) => !F75_DIRECT_KEYS.some((key) => key.slot === slot),
    ),
    gaps,
  );
  for (const [key, slot] of [
    ['Escape', 0],
    ['Fn', 53],
    ['ControlRight', 59],
    ['Backslash', 80],
    ['ArrowRight', 89],
  ])
    assert.equal(F75_DIRECT_KEYS.find((entry) => entry.key === key).slot, slot);
  assert.ok(Object.isFrozen(F75_DIRECT_KEYS));
  assert.ok(F75_DIRECT_KEYS.every(Object.isFrozen));
});

test('every physical LED encodes isolated RGB at its sparse slot, all other bytes stay zero', () => {
  for (const { slot } of F75_DIRECT_KEYS) {
    const colors = black();
    colors[slot] = { red: 17, green: 83, blue: 251 };
    const snapshot = structuredClone(colors);
    const report = encodeF75DirectFrame(colors);
    const expected = new Uint8Array(520);
    expected.set([6, 8, 0, 0, 1, 0, 0x7a, 1]);
    expected.set([17, 83, 251], 8 + 3 * slot);
    assert.deepEqual(report, expected);
    assert.deepEqual(colors, snapshot);
    report[8] = 255;
    assert.deepEqual(encodeF75DirectFrame(colors), expected);
  }
});

test('all 80 key colors map to fresh sparse slots, leaving gaps black', () => {
  const colors = Object.fromEntries(
    F75_DIRECT_KEYS.map(({ key }, i) => [key, { red: i + 1, green: 255 - i, blue: i }]),
  );
  const slots = f75DirectSlotsFromKeys(colors);
  for (const [i, { key, slot }] of F75_DIRECT_KEYS.entries()) {
    assert.deepEqual(slots[slot], { red: i + 1, green: 255 - i, blue: i });
    assert.notEqual(slots[slot], colors[key]);
  }
  for (const gap of gaps) assert.deepEqual(slots[gap], { red: 0, green: 0, blue: 0 });
  assert.ok(
    encodeF75DirectFrame(slots)
      .subarray(278)
      .every((byte) => byte === 0),
  );
});

test('brightness scaling has exact endpoints and documented rounding without mutating RGB', () => {
  const colors = black();
  colors[0] = { red: 255, green: 127, blue: 1 };
  for (const [brightness, expected] of [
    [0, [0, 0, 0]],
    [50, [128, 64, 1]],
    [100, [255, 127, 1]],
    [12.5, [32, 16, 0]],
  ])
    assert.deepEqual([...encodeF75DirectFrame(colors, brightness).slice(8, 11)], expected);
  assert.deepEqual(colors[0], { red: 255, green: 127, blue: 1 });
});

test('malformed slots, channels, brightness and unassigned slots are refused', () => {
  for (const value of [
    null,
    {},
    [],
    black().slice(1),
    [...black(), { red: 0, green: 0, blue: 0 }],
    new Array(90),
  ])
    assert.throws(() => encodeF75DirectFrame(value));
  for (const value of [
    null,
    {},
    [],
    { red: 0, green: 0, blue: 256 },
    { red: -1, green: 0, blue: 0 },
    { red: 0.5, green: 0, blue: 0 },
    { red: '0', green: 0, blue: 0 },
    { red: NaN, green: 0, blue: 0 },
    { red: 0, green: 0, blue: 0, extra: 1 },
  ]) {
    const colors = black();
    colors[0] = value;
    assert.throws(() => encodeF75DirectFrame(colors));
  }
  for (const value of [-1, 101, NaN, Infinity, '50', null])
    assert.throws(() => encodeF75DirectFrame(black(), value));
  for (const gap of gaps) {
    const colors = black();
    colors[gap].red = 1;
    assert.throws(() => encodeF75DirectFrame(colors));
  }
  const keys = Object.fromEntries(
    F75_DIRECT_KEYS.map(({ key }) => [key, { red: 0, green: 0, blue: 0 }]),
  );
  for (const value of [null, [], {}, { ...keys, extra: keys.Escape }])
    assert.throws(() => f75DirectSlotsFromKeys(value));
  const wrong = { ...keys };
  delete wrong.Escape;
  wrong.unknown = { red: 0, green: 0, blue: 0 };
  assert.throws(() => f75DirectSlotsFromKeys(wrong));
});
