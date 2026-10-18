import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeKnobReport } from '../src/protocol/knob-input.ts';

test('observed knob reports decode without inventing events from neutral release', () => {
  for (const [usage, signal] of [
    [0xe9, 'clockwise'],
    [0xea, 'counterclockwise'],
    [0xe2, 'press'],
    [0, 'neutral'],
  ]) {
    const report = Uint8Array.of(2, usage, 0);
    const snapshot = report.slice();
    assert.equal(decodeKnobReport(report), signal);
    assert.deepEqual(report, snapshot);
  }
});
test('malformed and unrelated media reports are refused', () => {
  for (const report of [[], [2], [2, 0], [2, 0, 0, 0], [1, 0xe9, 0], [2, 0xcd, 0], [2, 0xe9, 1]]) {
    assert.throws(() => decodeKnobReport(Uint8Array.from(report)));
  }
  assert.throws(() => decodeKnobReport([2, 0xe9, 0]));
});
