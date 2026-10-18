import test from 'node:test';
import assert from 'node:assert/strict';
import { f75Layout } from '../src/renderer/src/components/keyboard-layout.ts';

test('F75 includes 80 physical keys and a separate knob with unique identities', () => {
  assert.equal(f75Layout.keys.length, 81);
  assert.equal(new Set(f75Layout.keys.map((key) => key.id)).size, 81);
  assert.equal(new Set(f75Layout.keys.map((key) => key.matrix)).size, 81);
  assert.equal(f75Layout.keys.filter((key) => key.kind === 'knob').length, 1);
  for (const key of f75Layout.keys) {
    assert.ok(key.x >= 0 && key.x + key.width <= f75Layout.width, key.id);
    assert.ok(key.y + 1 <= f75Layout.height, key.id);
  }
});

test('ANSI geometry preserves stagger, special widths and bottom-right arrangement', () => {
  const get = (id) => f75Layout.keys.find((key) => key.id === id);
  assert.equal(get('Enter').width, 2.25);
  assert.equal(get('Space').width, 6.25);
  assert.equal(get('Backspace').width, 2);
  assert.equal(get('KeyQ').x, 1.5);
  assert.equal(get('KeyA').x, 1.75);
  assert.equal(get('KeyZ').x, 2.25);
  assert.equal(get('Fn').x, 10);
  assert.equal(get('ControlRight').x, 11.25);
  assert.equal(get('ArrowUp').x, get('ArrowDown').x);
  assert.equal(get('ArrowLeft').x, 13);
  assert.equal(get('ArrowRight').x, 15);
  assert.equal(get('PageUp').x, 15);
  assert.equal(get('End').y, get('ArrowUp').y);
  for (const [id, matrix] of Object.entries({
    Fn: 53,
    ControlRight: 59,
    PageUp: 86,
    Enter: 81,
    Knob: 84,
  })) {
    assert.equal(get(id).matrix, matrix);
  }
});

test('keys do not overlap within each physical row', () => {
  const rows = new Map();
  for (const key of f75Layout.keys) {
    if (key.kind === 'knob') continue;
    const row = rows.get(key.y) ?? [];
    row.push(key);
    rows.set(key.y, row);
  }
  assert.equal(rows.size, 6);
  for (const row of rows.values()) {
    row.sort((a, b) => a.x - b.x);
    for (let index = 1; index < row.length; index++) {
      assert.ok(row[index - 1].x + row[index - 1].width <= row[index].x + 1e-9);
    }
  }
});
