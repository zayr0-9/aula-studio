import { contextBridge, ipcRenderer } from 'electron';
import type { KeyAssignment } from '../shared/mapping';
import type { FixedColor } from '../shared/color';
import type { KnobStatus, KnobProfile } from '../shared/knob';
import type { ShellInfo } from '../shared/contracts';

contextBridge.exposeInMainWorld(
  'aula',
  Object.freeze({
    readBrightness: (): Promise<number> => ipcRenderer.invoke('brightness:read') as Promise<number>,
    setBrightness: (value: number): Promise<number> =>
      ipcRenderer.invoke('brightness:set', value) as Promise<number>,
    readEffect: (): Promise<number> => ipcRenderer.invoke('effect:read') as Promise<number>,
    setEffect: (value: number): Promise<number> =>
      ipcRenderer.invoke('effect:set', value) as Promise<number>,
    setEffectBrightness: (effect: number, brightness: number): Promise<number> =>
      ipcRenderer.invoke('effect:set-brightness', effect, brightness) as Promise<number>,
    readSpeed: (): Promise<number> => ipcRenderer.invoke('speed:read') as Promise<number>,
    setSpeed: (value: number): Promise<number> =>
      ipcRenderer.invoke('speed:set', value) as Promise<number>,
    readColor: (): Promise<FixedColor> => ipcRenderer.invoke('color:read') as Promise<FixedColor>,
    setColor: (color: FixedColor): Promise<FixedColor> =>
      ipcRenderer.invoke('color:set', color) as Promise<FixedColor>,
    readMappings: (): Promise<KeyAssignment[]> =>
      ipcRenderer.invoke('mapping:read') as Promise<KeyAssignment[]>,
    setMapping: (source: string, target: string): Promise<KeyAssignment[]> =>
      ipcRenderer.invoke('mapping:set', source, target) as Promise<KeyAssignment[]>,
    readPgUp: (): Promise<number> => ipcRenderer.invoke('mapping:read-pgup') as Promise<number>,
    setPgUp: (value: number): Promise<number> =>
      ipcRenderer.invoke('mapping:set-pgup', value) as Promise<number>,
    getKnobStatus: (): Promise<KnobStatus> =>
      ipcRenderer.invoke('knob:status') as Promise<KnobStatus>,
    enableKnob: (profile: KnobProfile): Promise<KnobStatus> =>
      ipcRenderer.invoke('knob:enable', profile) as Promise<KnobStatus>,
    setKnobProfile: (profile: KnobProfile): Promise<KnobStatus> =>
      ipcRenderer.invoke('knob:profile', profile) as Promise<KnobStatus>,
    disableKnob: (): Promise<KnobStatus> =>
      ipcRenderer.invoke('knob:disable') as Promise<KnobStatus>,
    getShellInfo: (): Promise<ShellInfo> => ipcRenderer.invoke('shell:info') as Promise<ShellInfo>,
  }),
);
