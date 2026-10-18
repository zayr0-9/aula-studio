import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  encodeCandidatePaletteQuery,
  parseCandidatePaletteResponse,
} from '../src/protocol/palette-query-candidate.ts';

test('offline palette query matches corrected-binary derived single-chunk layout', () => {
  const query = encodeCandidatePaletteQuery();
  assert.equal(query.length, 520);
  assert.deepEqual([...query.slice(0, 8)], [6, 138, 0, 0, 1, 0, 0, 2]);
  assert.ok(query.slice(8).every((value) => value === 0));
  query[0] = 0;
  assert.equal(encodeCandidatePaletteQuery()[0], 6);
});
test('synthetic response demands full independent length and exact proposed header', () => {
  const response = encodeCandidatePaletteQuery();
  for (let i = 8; i < 520; i++) response[i] = i % 256;
  const palette = parseCandidatePaletteResponse(response, 520);
  assert.deepEqual(palette, response.slice(8));
  palette[0] ^= 255;
  assert.notEqual(palette[0], response[8]);
  for (let length = 0; length < 520; length++)
    assert.throws(() => parseCandidatePaletteResponse(response, length));
  for (const length of [undefined, NaN, 521, -1, 519.5])
    assert.throws(() => parseCandidatePaletteResponse(response, length));
  for (let index = 0; index < 8; index++) {
    const bad = response.slice();
    bad[index] ^= 1;
    assert.throws(() => parseCandidatePaletteResponse(bad, 520));
  }
});
test('candidate palette command is not wired into production device actions', async () => {
  for (const path of [
    '../src/main/windows-brightness.ts',
    '../src/preload/index.ts',
    '../native/brightness.ps1',
  ]) {
    const text = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /palette-query-candidate/i);
  }
});
