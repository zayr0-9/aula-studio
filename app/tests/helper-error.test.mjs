import test from 'node:test';
import assert from 'node:assert/strict';
import { helperFailure } from '../src/main/helper-error.ts';
import { BrightnessService } from '../src/main/brightness-service.ts';
test('helper diagnostics expose known reasons without raw paths or stderr', () => {
  assert.equal(
    helperFailure('C:\\private\\file.ps1: Invalid observed palette tail.', false).message,
    'Invalid observed palette tail.',
  );
  assert.equal(
    helperFailure('Palette response failed, Win32=31', false).message,
    'Palette response failed, Win32=31',
  );
  assert.doesNotMatch(helperFailure('private unknown output', false).message, /private/);
  assert.match(helperFailure('', true).message, /timed out/);
});
test('native color read reason survives service fault latch', async () => {
  const service = new BrightnessService(
    async () => 9,
    async () => {
      throw helperFailure('Unsupported Fixed_on Colourful value.', false);
    },
  );
  await assert.rejects(service.readColor(), /Unsupported Fixed_on Colourful value/);
  await assert.rejects(service.readColor(), /blocked/);
});
