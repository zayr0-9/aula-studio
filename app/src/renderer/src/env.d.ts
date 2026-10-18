/// <reference types="vite/client" />

import type { StreamProfile, StreamStatus } from '../../shared/stream';
import type { IndicatorColors, IndicatorKey, IndicatorRgb } from '../../shared/indicators';
import type { KeyAssignment } from '../../shared/mapping';
import type { FixedColor } from '../../shared/color';
import type { KnobStatus, KnobProfile } from '../../shared/knob';
import type { ShellInfo } from '../../shared/contracts';

declare global {
  interface Window {
    aula: {
      getStreamStatus(): Promise<StreamStatus>;
      startStream(profile: StreamProfile): Promise<StreamStatus>;
      updateStream(profile: StreamProfile): Promise<StreamStatus>;
      stopStream(): Promise<StreamStatus>;
      readIndicators(): Promise<IndicatorColors>;
      setIndicator(key: IndicatorKey, color: IndicatorRgb): Promise<IndicatorColors>;
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
