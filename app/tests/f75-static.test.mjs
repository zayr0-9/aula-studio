import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  patchIndicatorColors,
  readIndicatorColors,
  staticTableQuery,
  verifyStaticTable,
} from '../src/protocol/f75-static.ts';

const evidence = JSON.parse(
  await readFile(
    new URL('../../docs/evidence/static-digit1-cyan-test-20261018.json', import.meta.url),
    'utf8',
  ),
);
const fresh = () => Uint8Array.from(evidence.beforeTable);
const cyan = { key: 'Digit1', color: { red: 0, green: 255, blue: 255 } };

test('static query matches observed86/384 framing, not stream08/378', () => {
  const query = staticTableQuery();
  assert.deepEqual([...query.slice(0, 8)], [6, 134, 0, 0, 1, 0, 128, 1]);
  assert.ok(query.slice(8).every((value) => value === 0));
  assert.equal(query.length, 520);
  query[8] = 99;
  assert.equal(staticTableQuery()[8], 0);
});

test('owner-accepted digit colors decode with126-byte planar stride', () => {
  assert.deepEqual(readIndicatorColors(fresh()), {
    Digit1: { red: 0, green: 255, blue: 0 },
    Digit2: { red: 255, green: 0, blue: 255 },
    Digit3: { red: 255, green: 0, blue: 0 },
    Digit4: { red: 0, green: 0, blue: 255 },
  });
  const patched = patchIndicatorColors(fresh(), [cyan]);
  assert.deepEqual([...patched.expected], evidence.afterTable);
  verifyStaticTable(Uint8Array.from(evidence.afterTable), patched.expected);
  assert.equal(patched.report[1], 6);
  assert.equal(patched.changed, true);
  assert.equal(patchIndicatorColors(patched.expected, [cyan]).changed, false);
});

test('all other bytes, including unknown tail and other LEDs, are preserved with no aliases', () => {
  const input = fresh();
  for (let i = 8; i < 392; i++) input[i] = (i * 37) % 256;
  const snapshot = new Uint8Array(input);
  const { report, expected } = patchIndicatorColors(input, [cyan]);
  assert.deepEqual(input, snapshot);
  for (let i = 0; i < 520; i++) {
    if (![15, 141, 267].includes(i)) assert.equal(expected[i], snapshot[i], `offset${i}`);
    if (i !== 1) assert.equal(report[i], expected[i]);
  }
  expected[386] ^= 255;
  assert.equal(input[386], snapshot[386]);
  assert.equal(report[386], snapshot[386]);
  for (const offset of [8, 15, 141, 267, 386, 391]) {
    const actual = new Uint8Array(snapshot);
    actual[offset] ^= 1;
    assert.throws(() => verifyStaticTable(actual, snapshot), /mismatch/);
  }
});

test('malformed headers, lengths and padding fail closed', () => {
  for (const value of [null, [], fresh().slice(0, 519), new Uint8Array(521)])
    assert.throws(() => readIndicatorColors(value));
  for (const offset of [0, 1, 2, 3, 4, 5, 6, 7, 392, 519]) {
    const corrupt = fresh();
    corrupt[offset] ^= 1;
    assert.throws(() => patchIndicatorColors(corrupt, [cyan]));
  }
});

test('unknown keys, extra properties, duplicate edits and invalid channels are refused', () => {
  for (const edits of [null, [], [cyan, cyan], new Array(2), Array(5).fill(cyan)])
    assert.throws(() => patchIndicatorColors(fresh(), edits));
  for (const edit of [
    null,
    {},
    { ...cyan, key: 'KeyQ' },
    { ...cyan, key: '__proto__' },
    { ...cyan, extra: true },
  ])
    assert.throws(() => patchIndicatorColors(fresh(), [edit]));
  for (const color of [null, [], {}, { red: 1, green: 2, blue: 3, extra: 1 }])
    assert.throws(() => patchIndicatorColors(fresh(), [{ ...cyan, color }]));
  for (const value of [-1, 256, 0.5, NaN, Infinity, '1', null, undefined])
    assert.throws(() =>
      patchIndicatorColors(fresh(), [{ ...cyan, color: { red: value, green: 2, blue: 3 } }]),
    );
});
