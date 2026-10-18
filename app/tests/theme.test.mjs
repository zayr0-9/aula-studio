import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextThemePreference,
  readThemePreference,
  resolveTheme,
  saveThemePreference,
  themeStorageKey,
} from '../src/renderer/src/theme.ts';

test('theme defaults to system, validates storage, and persists explicit choices', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  });
  try {
    assert.equal(readThemePreference(), 'system');
    for (const preference of ['light', 'dark', 'system']) {
      saveThemePreference(preference);
      assert.equal(values.get(themeStorageKey), preference);
      assert.equal(readThemePreference(), preference);
    }
    values.set(themeStorageKey, 'invalid');
    assert.equal(readThemePreference(), 'system');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('Storage unavailable');
      },
    });
    assert.equal(readThemePreference(), 'system');
    assert.doesNotThrow(() => saveThemePreference('light'));
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('theme button cycles all preferences and system resolves the current OS appearance', () => {
  assert.equal(nextThemePreference('system'), 'light');
  assert.equal(nextThemePreference('light'), 'dark');
  assert.equal(nextThemePreference('dark'), 'system');
  assert.equal(resolveTheme('system', false), 'light');
  assert.equal(resolveTheme('system', true), 'dark');
  for (const preference of ['light', 'dark']) {
    assert.equal(resolveTheme(preference, true), preference);
    assert.equal(resolveTheme(preference, false), preference);
  }
});
