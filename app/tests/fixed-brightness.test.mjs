import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const evidence = JSON.parse(
  await readFile(new URL('../../docs/evidence/fixed-on-brightness.json', import.meta.url), 'utf8'),
);
test('Fixed_on brightness capture isolates offset3A, not Neon_stream offset4E', () => {
  const fixed = evidence.cycles.filter((c) => c.write[18] === 1);
  assert.deepEqual(
    fixed.map((c) => c.write[8 + 0x3a]),
    [9, 4, 0, 9],
  );
  for (const [index, c] of fixed.entries()) {
    const expected = c.response.slice(8);
    if (index === 0) expected[0x0a] = 1;
    else expected[0x3a] = c.write[8 + 0x3a];
    assert.deepEqual(c.write.slice(8, 136), expected);
    assert.equal(c.write[8 + 0x4e], c.response[8 + 0x4e]);
    if (index) assert.deepEqual(c.response.slice(8), fixed[index - 1].write.slice(8, 136));
  }
  const blossom = evidence.cycles.filter((c) => c.write[18] === 17);
  for (const c of blossom.slice(1)) assert.deepEqual(c.write.slice(8, 136), c.response.slice(8));
});
