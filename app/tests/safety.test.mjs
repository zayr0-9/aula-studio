import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main/index.ts', import.meta.url), 'utf8');
const preload = await readFile(new URL('../src/preload/index.ts', import.meta.url), 'utf8');
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('scaffold has no native hardware dependency', () => {
  const dependencies = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
  assert.ok(!dependencies.some((name) => /hid|usb|serialport/i.test(name)));
});
test('renderer isolation and sandbox remain enabled', () => {
  assert.match(main, /contextIsolation: true/);
  assert.match(main, /nodeIntegration: false/);
  assert.match(main, /sandbox: true/);
  assert.match(main, /authorize\(event\)/);
  assert.match(main, /event.senderFrame !== mainWindow.webContents.mainFrame/);
});
test('only brightness and shell information cross preload bridge', () => {
  assert.deepEqual(
    [...preload.matchAll(/ipcRenderer\.invoke\('([^']+)'/g)].map((match) => match[1]),
    [
      'brightness:read',
      'brightness:set',
      'effect:read',
      'effect:set',
      'effect:set-brightness',
      'speed:read',
      'speed:set',
      'color:read',
      'color:set',
      'mapping:read',
      'mapping:set',
      'mapping:read-pgup',
      'mapping:set-pgup',
      'knob:status',
      'knob:enable',
      'knob:profile',
      'knob:disable',
      'shell:info',
    ],
  );
  assert.doesNotMatch(preload, /sendFeature|writeReport|node-hid|usb/i);
});
