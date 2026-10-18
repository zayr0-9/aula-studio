import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { mappingSources, validateMappings } from '../src/shared/mapping.ts';

// Inert child_process replacement: exercise the real adapter without launching any process.
const childUrl = `data:text/javascript,${encodeURIComponent(`
  export const calls = [];
  let output = '';
  export function respond(value) { output = value; }
  export function execFile(executable, args, options, callback) {
    calls.push({ executable, args, options });
    if (new TextEncoder().encode(output).length > options.maxBuffer)
      callback(Object.assign(new Error('maxBuffer'), { killed: true }), '', '');
    else callback(null, output, '');
  }
`)}`;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'node:child_process') return { url: childUrl, shortCircuit: true };
    if (specifier.endsWith('brightness.ps1?asset'))
      return { url: 'data:text/javascript,export default "inert-helper"', shortCircuit: true };
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
      return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});
const { windowsMapping, windowsBrightness, windowsColor } =
  await import('../src/main/windows-brightness.ts');
const { calls, respond } = await import(childUrl);
hooks.deregister();

test('mapping adapter accepts maximum catalog stdout with a mapping-only bounded increase', async () => {
  if (process.platform !== 'win32' || process.arch !== 'x64') return;
  const maximum = mappingSources.map(({ id }) => ({
    source: id,
    target: 'Ctrl+Shift+BracketRight',
  }));
  const stdout = JSON.stringify(maximum) + '\r\n';
  assert.equal(Buffer.byteLength(stdout), 4297);
  validateMappings(maximum);
  respond(stdout);
  assert.deepEqual(await windowsMapping(), maximum);
  assert.deepEqual(await windowsMapping('MetaLeft', 'AltLeft'), maximum);
  assert.equal(calls.at(-1).options.maxBuffer, 8192);
  assert.deepEqual(calls.at(-1).args.slice(-4), ['-Source', 'MetaLeft', '-Target', 'AltLeft']);
  respond('9');
  assert.equal(await windowsBrightness(), 9);
  assert.equal(calls.at(-1).options.maxBuffer, 4096);
  respond('{"red":1,"green":2,"blue":3,"colourful":false}');
  await windowsColor();
  assert.equal(calls.at(-1).options.maxBuffer, 4096);
  respond(' '.repeat(8193));
  await assert.rejects(windowsMapping());
  respond('[]');
  await assert.rejects(windowsMapping(), /Invalid mapping helper response/);
  const before = calls.length;
  for (const target of [
    'Fn',
    'Ctrl+MetaLeft',
    'Shift+AltLeft',
    'Ctrl+ControlRight',
    'Shift+ShiftRight',
    'Alt+KeyC',
  ])
    await assert.rejects(windowsMapping('Digit1', target));
  await assert.rejects(windowsMapping('Fn', 'Home'));
  assert.equal(calls.length, before);
});
