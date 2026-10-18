import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const renderer = new URL('../src/renderer/src/', import.meta.url);
test('Studio uses natural typography without forced casing or letter spacing', async () => {
  for (const file of [
    'index.css',
    'App.tsx',
    'BrightnessPanel.tsx',
    'MappingPanel.tsx',
    'KnobPanel.tsx',
    'DesignPreview.tsx',
  ]) {
    const source = await readFile(new URL(file, renderer), 'utf8');
    assert.doesNotMatch(
      source,
      /tracking-|letter-spacing|text-transform\s*:\s*uppercase|className=["'][^"']*\buppercase\b/,
      file,
    );
  }
});
test('visual sandbox is separate from device controls', async () => {
  const preview = await readFile(new URL('DesignPreview.tsx', renderer), 'utf8');
  assert.doesNotMatch(preview, /window\.aula/);
  assert.doesNotMatch(preview, /useState|Reset preview|<Select|type="range"/);
  assert.match(preview, /Last verified settings/);
  const app = await readFile(new URL('App.tsx', renderer), 'utf8');
  assert.match(app, /hidden=\{page !== 'Lighting'\}/);
  assert.match(app, /hidden=\{page !== 'Remapping'\}/);
  assert.match(app, /page === 'Knob' \? \(\s*<div className="t-page">\s*<KnobPanel/);
});

test('dropdowns use the shared design-system component', async () => {
  for (const file of ['BrightnessPanel.tsx', 'MappingPanel.tsx']) {
    const source = await readFile(new URL(file, renderer), 'utf8');
    assert.doesNotMatch(source, /<select\b|<option\b/, file);
    if (file === 'MappingPanel.tsx') {
      assert.match(source, /className="mapping-targets"/);
      assert.match(source, /className="mapping-tile"/);
    } else {
      assert.match(source, /import \{ Select \} from '.\/components\/Select'/, file);
    }
  }
  const component = await readFile(new URL('components/Select.tsx', renderer), 'utf8');
  assert.doesNotMatch(component, /tracking-|letter-spacing|text-transform|window\.aula/);
});
