import test from 'node:test';
import assert from 'node:assert/strict';
import { helperFailure } from '../src/main/helper-error.ts';

test('mapping diagnostics expose known failures without raw stderr', () => {
  for (const message of [
    'Unsupported mapping identity.',
    'Source is not an allowed ordinary entry.',
    'Invalid matrix header.',
    'Invalid matrix signature.',
    'Matrix readback mismatch.',
    'Layer0 matrix response failed, Win32=31',
  ]) {
    assert.equal(helperFailure(`private path\n${message}`, false).message, message);
  }
  assert.doesNotMatch(helperFailure('private path', false).message, /private path/);
});
