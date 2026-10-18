import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const evidence = JSON.parse(
  await readFile(
    new URL('../../docs/evidence/ansi-effect-selection.json', import.meta.url),
    'utf8',
  ),
);

test('captured effect selection changes only selector after initial brightness Save', () => {
  assert.equal(evidence.allControlStatusesSuccess, true);
  assert.deepEqual(
    evidence.cycles.map((cycle) => cycle.effect),
    ['Neon_stream', 'Fixed_on', 'Blossoming', 'Neon_stream'],
  );
  const selectors = [11, 1, 17, 11];
  for (const [index, cycle] of evidence.cycles.entries()) {
    assert.equal(cycle.queryReport.length, 520);
    assert.deepEqual(cycle.queryReport.slice(0, 8), [6, 132, 0, 0, 1, 0, 128, 0]);
    assert.ok(cycle.queryReport.slice(8).every((value) => value === 0));
    assert.equal(cycle.responseReport.length, 136);
    assert.deepEqual(cycle.responseReport.slice(0, 8), cycle.queryReport.slice(0, 8));
    assert.equal(cycle.writeReport.length, 520);
    assert.deepEqual(cycle.writeReport.slice(0, 8), [6, 4, 0, 0, 1, 0, 128, 0]);
    assert.ok(cycle.writeReport.slice(136).every((value) => value === 0));
    assert.equal(cycle.writeReport[18], selectors[index]);
    const expected = cycle.responseReport.slice(8);
    if (index === 0) expected[0x4e] = 9;
    else expected[0x0a] = selectors[index];
    assert.deepEqual(cycle.writeReport.slice(8, 136), expected);
    assert.deepEqual(cycle.paletteReport, evidence.cycles[0].paletteReport);
    if (index > 0) {
      assert.deepEqual(
        cycle.responseReport.slice(8),
        evidence.cycles[index - 1].writeReport.slice(8, 136),
      );
    }
  }
});
