export interface KnobStatus {
  state: 'off' | 'starting' | 'active' | 'stopping' | 'error';
  clockwise: number;
  counterclockwise: number;
  press: number;
  message: string;
}

export const knobProfiles = [
  {
    id: 'media',
    label: 'Media',
    clockwise: 'Volume up',
    counterclockwise: 'Volume down',
    press: 'Play / pause',
  },
  {
    id: 'scroll',
    label: 'Scroll',
    clockwise: 'Scroll down',
    counterclockwise: 'Scroll up',
    press: 'Middle click',
  },
  {
    id: 'zoom',
    label: 'Zoom',
    clockwise: 'Zoom in',
    counterclockwise: 'Zoom out',
    press: 'Reset zoom',
  },
  {
    id: 'tabs',
    label: 'Tabs',
    clockwise: 'Next tab',
    counterclockwise: 'Previous tab',
    press: 'New tab',
  },
  {
    id: 'history',
    label: 'Undo / redo',
    clockwise: 'Redo (Ctrl+Y)',
    counterclockwise: 'Undo (Ctrl+Z)',
    press: 'Alternate redo (Ctrl+Shift+Z)',
  },
] as const;
export type KnobProfile = (typeof knobProfiles)[number]['id'];
export function validateKnobProfile(value: unknown): asserts value is KnobProfile {
  if (typeof value !== 'string' || !knobProfiles.some((profile) => profile.id === value))
    throw new Error('Unsupported knob profile');
}
