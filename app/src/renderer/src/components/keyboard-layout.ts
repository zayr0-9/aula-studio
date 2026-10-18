export interface KeyboardKey {
  /** Stable physical identity, independent of the assigned character. */
  id: string;
  label: string;
  matrix: number;
  x: number;
  y: number;
  width: number;
  kind?: 'knob';
}

export interface KeyboardLayout {
  name: string;
  width: number;
  height: number;
  keys: readonly KeyboardKey[];
}

// ANSI positions cross-checked against corrected model1 KB.ini and Keylux's
// matrix names. Geometry follows the owner's photo; no upstream code copied.
// Matrix identity does not imply support for remapping or per-key lighting.
const keys: KeyboardKey[] = [];
function row(y: number, entries: readonly (readonly [string, string, number, number?])[]) {
  let x = 0;
  for (const [id, label, matrix, width = 1] of entries) {
    keys.push({ id, label, matrix, x, y, width });
    x += width;
  }
}
keys.push({ id: 'Escape', label: 'Esc', matrix: 0, x: 0, y: 0, width: 1 });
for (let index = 0; index < 12; index++) {
  keys.push({
    id: `F${index + 1}`,
    label: `F${index + 1}`,
    matrix: 12 + index * 6,
    x: 1.9 + index + Math.floor(index / 4) * 0.35,
    y: 0,
    width: 1,
  });
}
keys.push({ id: 'Knob', label: 'Knob', matrix: 84, x: 15, y: -0.12, width: 1, kind: 'knob' });
row(1.35, [
  ['Backquote', '`', 1],
  ['Digit1', '1', 7],
  ['Digit2', '2', 13],
  ['Digit3', '3', 19],
  ['Digit4', '4', 25],
  ['Digit5', '5', 31],
  ['Digit6', '6', 37],
  ['Digit7', '7', 43],
  ['Digit8', '8', 49],
  ['Digit9', '9', 55],
  ['Digit0', '0', 61],
  ['Minus', '-', 67],
  ['Equal', '=', 73],
  ['Backspace', 'Backspace', 79, 2],
  ['Delete', 'Delete', 85],
]);
row(2.35, [
  ['Tab', 'Tab', 2, 1.5],
  ['KeyQ', 'Q', 8],
  ['KeyW', 'W', 14],
  ['KeyE', 'E', 20],
  ['KeyR', 'R', 26],
  ['KeyT', 'T', 32],
  ['KeyY', 'Y', 38],
  ['KeyU', 'U', 44],
  ['KeyI', 'I', 50],
  ['KeyO', 'O', 56],
  ['KeyP', 'P', 62],
  ['BracketLeft', '[', 68],
  ['BracketRight', ']', 74],
  ['Backslash', '\\', 80, 1.5],
  ['PageUp', 'PgUp', 86],
]);
row(3.35, [
  ['CapsLock', 'Caps Lock', 3, 1.75],
  ['KeyA', 'A', 9],
  ['KeyS', 'S', 15],
  ['KeyD', 'D', 21],
  ['KeyF', 'F', 27],
  ['KeyG', 'G', 33],
  ['KeyH', 'H', 39],
  ['KeyJ', 'J', 45],
  ['KeyK', 'K', 51],
  ['KeyL', 'L', 57],
  ['Semicolon', ';', 63],
  ['Quote', "'", 69],
  ['Enter', 'Enter', 81, 2.25],
  ['PageDown', 'PgDn', 87],
]);
row(4.35, [
  ['ShiftLeft', 'Shift', 4, 2.25],
  ['KeyZ', 'Z', 10],
  ['KeyX', 'X', 16],
  ['KeyC', 'C', 22],
  ['KeyV', 'V', 28],
  ['KeyB', 'B', 34],
  ['KeyN', 'N', 40],
  ['KeyM', 'M', 46],
  ['Comma', ',', 52],
  ['Period', '.', 58],
  ['Slash', '/', 64],
  ['ShiftRight', 'Shift', 70, 1.75],
  ['ArrowUp', '↑', 82],
  ['End', 'End', 88],
]);
row(5.35, [
  ['ControlLeft', 'Ctrl', 5, 1.25],
  ['MetaLeft', 'Win', 11, 1.25],
  ['AltLeft', 'Alt', 17, 1.25],
  ['Space', '', 35, 6.25],
  ['Fn', 'Fn', 53, 1.25],
  ['ControlRight', 'Ctrl', 59, 1.25],
]);
for (const [id, label, matrix, x] of [
  ['ArrowLeft', '←', 77, 13],
  ['ArrowDown', '↓', 83, 14],
  ['ArrowRight', '→', 89, 15],
] as const)
  keys.push({ id, label, matrix, x, y: 5.35, width: 1 });

export const f75Layout: KeyboardLayout = { name: 'AULA F75 ANSI', width: 16, height: 6.35, keys };
