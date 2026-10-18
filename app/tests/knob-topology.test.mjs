import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('startup arrival for pinned device does not trigger disconnect cleanup', async () => {
  const source = await readFile(new URL('../native/knob-session.ps1', import.meta.url), 'utf8');
  assert.match(source, /message\.WParam\.ToInt64\(\) == 2/);
  assert.match(source, /message\.WParam\.ToInt64\(\) == 1 && message\.LParam != target/);
  assert.match(source, /if \(IsTarget\(message\.LParam\)\) \{ Expire\(\); Close\(\); \}/);
});
