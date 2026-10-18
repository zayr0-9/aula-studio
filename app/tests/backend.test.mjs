import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFile } from 'node:fs/promises';

// Replace only build-time assets and the Windows lighting adapter. No native helper runs.
const lightingUrl = `data:text/javascript,${encodeURIComponent(`
  export const calls = [];
  export async function windowsIndicators() { calls.push(['indicators']); return Object.fromEntries(['Digit1','Digit2','Digit3','Digit4'].map(key => [key, {red:0,green:0,blue:0}])); }
  export async function windowsMapping() { calls.push(['mapping']); return []; }
  export async function windowsBrightness(...args) { calls.push(args); return args[0] ?? 9; }
  export async function windowsColor(color) {
    calls.push(['color', color]);
    return color ?? { red: 1, green: 2, blue: 3, colourful: false };
  }
`)}`;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './windows-brightness') return { url: lightingUrl, shortCircuit: true };
    if (specifier.endsWith('.ps1?asset'))
      return {
        url: 'data:text/javascript,export default "unused-knob-helper";',
        shortCircuit: true,
      };
    return nextResolve(specifier, context);
  },
});
const { createBackend } = await import('../src/main/backend.ts');
const { calls } = await import(lightingUrl);
hooks.deregister();

test('Windows x64 composition is lazy and uses the existing lighting queue', async () => {
  const backend = createBackend('win32', 'x64');
  assert.equal(backend.hardwareEnabled, true);
  assert.equal(backend.knob.snapshot().state, 'off');
  assert.deepEqual(calls, []);
  assert.equal(await backend.brightness.read(), 9);
  assert.equal(await backend.brightness.setEffectBrightness(11, 8), 11);
  assert.deepEqual(await backend.brightness.readColor(), {
    red: 1,
    green: 2,
    blue: 3,
    colourful: false,
  });
  assert.deepEqual(calls, [
    [undefined, 'Read', undefined],
    [11, 'SetEffectBrightness', 8],
    ['color', undefined],
  ]);
  await Promise.all([backend.brightness.stop(), backend.knob.shutdown()]);
});

test('unsupported platforms and architectures fail closed without Windows calls', async () => {
  const before = calls.length;
  for (const [platform, arch] of [
    ['darwin', 'arm64'],
    ['darwin', 'x64'],
    ['linux', 'x64'],
    ['win32', 'arm64'],
    ['win32', 'ia32'],
  ]) {
    const backend = createBackend(platform, arch);
    assert.equal(backend.hardwareEnabled, false);
    assert.equal(backend.knob.snapshot().state, 'off');
    assert.throws(() => backend.knob.enable(), /could not start/);
    assert.equal(backend.knob.snapshot().state, 'error');
    assert.equal(backend.knob.disable().state, 'off');
    await assert.rejects(backend.brightness.read(), /requires Windows x64/);
    await assert.rejects(backend.brightness.set(8), /blocked/);
    const colorBackend = createBackend(platform, arch);
    await assert.rejects(colorBackend.brightness.readColor(), /requires Windows x64/);
    const mappingBackend = createBackend(platform, arch);
    await assert.rejects(mappingBackend.brightness.readMappings(), /requires Windows x64/);
    await mappingBackend.brightness.stop();
    await Promise.all([
      backend.brightness.stop(),
      backend.knob.shutdown(),
      colorBackend.brightness.stop(),
    ]);
  }
  assert.equal(calls.length, before);
});

test('main obtains capability from selected backend and keeps compatibility mode', async () => {
  const main = await readFile(new URL('../src/main/index.ts', import.meta.url), 'utf8');
  assert.match(main, /hardwareEnabled: backend.hardwareEnabled/);
  assert.match(main, /mode: 'simulator'/);
  assert.match(main, /title: 'AULA Studio'/);
  assert.doesNotMatch(main, /windows-brightness|powershell|spawnKnobHelper|process.arch/);
});
