import { spawn } from 'node:child_process';
import { StreamSession } from './stream-session.ts';
import streamHelper from '../../native/stream-session.ps1?asset';
import transportHelper from '../../native/brightness.ps1?asset';
import { join } from 'node:path';
import { BrightnessService } from './brightness-service.ts';
import { KnobSession, spawnKnobHelper } from './knob-session.ts';
import {
  windowsBrightness,
  windowsColor,
  windowsMapping,
  windowsIndicators,
} from './windows-brightness';
import knobHelper from '../../native/knob-session.ps1?asset';

/** Selection is capability only: constructing a backend never starts hardware I/O. */
export function createBackend(platform = process.platform, arch = process.arch) {
  const hardwareEnabled = platform === 'win32' && arch === 'x64';
  const unsupported = (): never => {
    throw new Error('Hardware support requires Windows x64');
  };
  const brightness = new BrightnessService(
    hardwareEnabled ? windowsBrightness : async () => unsupported(),
    hardwareEnabled ? windowsColor : async () => unsupported(),
    hardwareEnabled ? windowsMapping : async () => unsupported(),
    hardwareEnabled ? windowsIndicators : async () => unsupported(),
  );
  const stream = new StreamSession(
    () => {
      if (!hardwareEnabled) unsupported();
      return spawn(
        join(
          process.env.SystemRoot ?? 'C:\\Windows',
          'System32/WindowsPowerShell/v1.0/powershell.exe',
        ),
        [
          '-NoLogo',
          '-NoProfile',
          '-NonInteractive',
          '-File',
          streamHelper,
          '-Execute',
          '-TransportPath',
          transportHelper,
        ],
        { windowsHide: true, stdio: 'pipe' },
      );
    },
    () => brightness.releaseStream(),
  );
  return {
    hardwareEnabled,
    brightness,
    stream,
    knob: new KnobSession(
      hardwareEnabled
        ? (profile) =>
            spawnKnobHelper(
              join(
                process.env.SystemRoot ?? 'C:\\Windows',
                'System32/WindowsPowerShell/v1.0/powershell.exe',
              ),
              knobHelper,
              profile,
            )
        : unsupported,
    ),
  };
}
