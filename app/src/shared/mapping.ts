/** Physical ANSI identities and ordinary usages from the canonical Layer0 snapshot.
 * Matrix slots are not HID usages. Fn and knob are deliberately absent.
 */
export interface OrdinaryKey {
  id: string;
  label: string;
  matrix: number;
  usage: number;
}
export interface KeyAssignment {
  source: string;
  target: string | null;
}
export const ordinaryKeys: readonly OrdinaryKey[] = [
  { id: 'Escape', label: 'Esc', matrix: 0, usage: 41 },
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `F${i + 1}`,
    label: `F${i + 1}`,
    matrix: 12 + i * 6,
    usage: 58 + i,
  })),
  ...(
    [
      ['Backquote', '`', 1, 53],
      ['Digit1', '1', 7, 30],
      ['Digit2', '2', 13, 31],
      ['Digit3', '3', 19, 32],
      ['Digit4', '4', 25, 33],
      ['Digit5', '5', 31, 34],
      ['Digit6', '6', 37, 35],
      ['Digit7', '7', 43, 36],
      ['Digit8', '8', 49, 37],
      ['Digit9', '9', 55, 38],
      ['Digit0', '0', 61, 39],
      ['Minus', '-', 67, 45],
      ['Equal', '=', 73, 46],
      ['Backspace', 'Backspace', 79, 42],
      ['Delete', 'Delete', 85, 76],
      ['Tab', 'Tab', 2, 43],
      ['KeyQ', 'Q', 8, 20],
      ['KeyW', 'W', 14, 26],
      ['KeyE', 'E', 20, 8],
      ['KeyR', 'R', 26, 21],
      ['KeyT', 'T', 32, 23],
      ['KeyY', 'Y', 38, 28],
      ['KeyU', 'U', 44, 24],
      ['KeyI', 'I', 50, 12],
      ['KeyO', 'O', 56, 18],
      ['KeyP', 'P', 62, 19],
      ['BracketLeft', '[', 68, 47],
      ['BracketRight', ']', 74, 48],
      ['Backslash', '\\', 80, 49],
      ['PageUp', 'PgUp', 86, 75],
      ['CapsLock', 'Caps Lock', 3, 57],
      ['KeyA', 'A', 9, 4],
      ['KeyS', 'S', 15, 22],
      ['KeyD', 'D', 21, 7],
      ['KeyF', 'F', 27, 9],
      ['KeyG', 'G', 33, 10],
      ['KeyH', 'H', 39, 11],
      ['KeyJ', 'J', 45, 13],
      ['KeyK', 'K', 51, 14],
      ['KeyL', 'L', 57, 15],
      ['Semicolon', ';', 63, 51],
      ['Quote', "'", 69, 52],
      ['Enter', 'Enter', 81, 40],
      ['PageDown', 'PgDn', 87, 78],
      ['KeyZ', 'Z', 10, 29],
      ['KeyX', 'X', 16, 27],
      ['KeyC', 'C', 22, 6],
      ['KeyV', 'V', 28, 25],
      ['KeyB', 'B', 34, 5],
      ['KeyN', 'N', 40, 17],
      ['KeyM', 'M', 46, 16],
      ['Comma', ',', 52, 54],
      ['Period', '.', 58, 55],
      ['Slash', '/', 64, 56],
      ['ArrowUp', '↑', 82, 82],
      ['End', 'End', 88, 77],
      ['Space', 'Space', 35, 44],
      ['ArrowLeft', '←', 77, 80],
      ['ArrowDown', '↓', 83, 81],
      ['ArrowRight', '→', 89, 79],
    ] as const
  ).map(([id, label, matrix, usage]) => ({ id, label, matrix, usage })),
];
/** Verified standalone modifiers only; these do not expand the shortcut masks. */
export const modifierKeys = [
  { id: 'ControlLeft', label: 'Left Ctrl', matrix: 5, usage: 0, mask: 1 },
  { id: 'ShiftLeft', label: 'Left Shift', matrix: 4, usage: 0, mask: 2 },
  { id: 'MetaLeft', label: 'Left Win', matrix: 11, usage: 0, mask: 8 },
  { id: 'AltLeft', label: 'Left Alt', matrix: 17, usage: 0, mask: 4 },
  { id: 'ControlRight', label: 'Right Ctrl', matrix: 59, usage: 0, mask: 16 },
  { id: 'ShiftRight', label: 'Right Shift', matrix: 70, usage: 0, mask: 32 },
] as const;
export const mappingSources = [...ordinaryKeys, ...modifierKeys];
const baseTargets = [
  ...ordinaryKeys,
  { id: 'Home', label: 'Home', usage: 0x4a },
  { id: 'Insert', label: 'Insert', usage: 0x49 },
] as const;
export const mappingTargets = [...baseTargets, ...modifierKeys];

/** Exact semantic identities only; no modifier-only chords. */
export function shortcutTarget(keyId: string, ctrl: boolean, shift: boolean): string {
  if (!baseTargets.some((key) => key.id === keyId)) throw new Error('Unsupported shortcut key');
  return `${ctrl ? 'Ctrl+' : ''}${shift ? 'Shift+' : ''}${keyId}`;
}
export function parseMappingTarget(id: string): { keyId: string; ctrl: boolean; shift: boolean } {
  for (const prefix of ['', 'Ctrl+', 'Shift+', 'Ctrl+Shift+']) {
    const keyId = id.slice(prefix.length);
    if (id.startsWith(prefix) && baseTargets.some((key) => key.id === keyId))
      return { keyId, ctrl: prefix.includes('Ctrl+'), shift: prefix.includes('Shift+') };
  }
  if (modifierKeys.some((key) => key.id === id))
    return { keyId: id, ctrl: id === 'ControlLeft', shift: id === 'ShiftLeft' };
  throw new Error('Unsupported mapping target');
}
export function mappingLabel(id: string | null | undefined): string {
  if (id == null) return 'Unsupported';
  const { keyId, ctrl, shift } = parseMappingTarget(id);
  const label = mappingTargets.find((key) => key.id === keyId)!.label;
  return modifierKeys.some((key) => key.id === keyId)
    ? label
    : `${ctrl ? 'Ctrl+' : ''}${shift ? 'Shift+' : ''}${label}`;
}
export function validateMappingSource(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !mappingSources.some((key) => key.id === value))
    throw new Error('Unsupported mapping source');
}
export function validateMappingTarget(value: unknown): asserts value is string {
  if (typeof value !== 'string') throw new Error('Unsupported mapping target');
  parseMappingTarget(value);
}
export function validateMappings(value: unknown): asserts value is KeyAssignment[] {
  if (!Array.isArray(value) || value.length !== mappingSources.length)
    throw new Error('Invalid mapping result');
  const seen = new Set<string>();
  for (const entry of value) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      Object.keys(entry).length !== 2 ||
      !Object.hasOwn(entry, 'source') ||
      !Object.hasOwn(entry, 'target')
    )
      throw new Error('Invalid mapping entry');
    validateMappingSource(entry.source);
    if (seen.has(entry.source)) throw new Error('Duplicate mapping source');
    seen.add(entry.source);
    if (entry.target !== null) validateMappingTarget(entry.target);
  }
}
