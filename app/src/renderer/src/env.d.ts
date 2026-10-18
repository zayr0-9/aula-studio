/// <reference types="vite/client" />

import type { KeyAssignment } from '../../shared/mapping';
import type { FixedColor } from '../../shared/color';
import type { KnobStatus, KnobProfile } from '../../shared/knob';
import type { ShellInfo } from '../../shared/contracts';

declare global {
  interface Window {
    aula: {
      readColor(): Promise<FixedColor>;
      setColor(color: FixedColor): Promise<FixedColor>;
      readMappings(): Promise<KeyAssignment[]>;
      setMapping(source: string, target: string): Promise<KeyAssignment[]>;
      readPgUp(): Promise<number>;
      setPgUp(value: number): Promise<number>;
      getKnobStatus(): Promise<KnobStatus>;
      enableKnob(profile: KnobProfile): Promise<KnobStatus>;
      setKnobProfile(profile: KnobProfile): Promise<KnobStatus>;
      disableKnob(): Promise<KnobStatus>;
      getShellInfo(): Promise<ShellInfo>;
      setEffectBrightness(effect: number, brightness: number): Promise<number>;
      readSpeed(): Promise<number>;
      setSpeed(value: number): Promise<number>;
      readEffect(): Promise<number>;
      setEffect(value: number): Promise<number>;
      readBrightness(): Promise<number>;
      setBrightness(value: number): Promise<number>;
    };
  }
}

export {};
