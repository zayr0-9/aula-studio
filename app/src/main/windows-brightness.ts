import { validateMappingSource, validateMappingTarget, validateMappings } from '../shared/mapping';
import type { KeyAssignment } from '../shared/mapping';
import { validateFixedColor } from '../shared/color';
import type { FixedColor } from '../shared/color';
import { helperFailure } from './helper-error';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import {
  validateBrightness,
  validateEffect,
  validateSpeed,
  validateObservedEffect,
  validatePgUp,
} from './brightness-service';
import type { LightingAction } from './brightness-service';
import helperPath from '../../native/brightness.ps1?asset';

/** Fixed executable, fixed script, bounded integer argument. Never invoke a shell. */
export function windowsBrightness(
  value?: number,
  action: LightingAction = value === undefined ? 'Read' : 'Set',
  brightness?: number,
): Promise<number> {
  if (action === 'SetEffectBrightness') {
    validateEffect(value);
    if (value === 17) throw new Error('Unsupported brightness effect');
    validateBrightness(brightness);
  } else if (action === 'SetEffect') validateEffect(value);
  else if (action === 'Set') validateBrightness(value);
  else if (action === 'SetSpeed') validateSpeed(value);
  else if (action === 'SetPgUp') validatePgUp(value);
  else if (
    action !== 'Read' &&
    action !== 'ReadEffect' &&
    action !== 'ReadSpeed' &&
    action !== 'ReadPgUp'
  )
    throw new Error('Unsupported lighting action');
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    return Promise.reject(new Error('Only Windows x64 is supported'));
  }
  const executable = join(
    process.env.SystemRoot ?? 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
  const args = ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', helperPath, '-Action', action];
  if (value !== undefined)
    args.push(
      action === 'SetEffect' || action === 'SetEffectBrightness'
        ? '-Effect'
        : action === 'SetSpeed'
          ? '-Speed'
          : action === 'SetPgUp'
            ? '-PgUp'
            : '-Brightness',
      String(value),
    );
  if (action === 'SetEffectBrightness') args.push('-Brightness', String(brightness));
  return new Promise((resolve, reject) => {
    execFile(
      executable,
      args,
      { windowsHide: true, timeout: 15000, maxBuffer: 4096 },
      (error, stdout, stderr) => {
        if (error) {
          reject(helperFailure(stderr, error.killed ?? false));
          return;
        }
        try {
          const result: unknown = JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
          if (action === 'ReadEffect') validateObservedEffect(result);
          else if (action === 'SetEffect' || action === 'SetEffectBrightness')
            validateEffect(result);
          else if (action === 'ReadSpeed' || action === 'SetSpeed') validateSpeed(result);
          else if (action === 'ReadPgUp' || action === 'SetPgUp') validatePgUp(result);
          else validateBrightness(result);
          resolve(result);
        } catch {
          reject(new Error('Invalid helper response'));
        }
      },
    );
  });
}

export async function windowsColor(color?: FixedColor): Promise<FixedColor> {
  if (color !== undefined) validateFixedColor(color);
  if (process.platform !== 'win32' || process.arch !== 'x64')
    throw new Error('Only Windows x64 supported');
  const executable = join(
    process.env.SystemRoot ?? 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
  const args = [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-File',
    helperPath,
    '-Action',
    color ? 'SetColor' : 'ReadColor',
  ];
  if (color)
    args.push(
      '-Red',
      String(color.red),
      '-Green',
      String(color.green),
      '-Blue',
      String(color.blue),
      '-Colourful',
      color.colourful ? '1' : '0',
    );
  return new Promise((resolve, reject) => {
    execFile(
      executable,
      args,
      { windowsHide: true, timeout: 15000, maxBuffer: 4096 },
      (error, stdout, stderr) => {
        if (error) {
          reject(helperFailure(stderr, error.killed ?? false));
          return;
        }
        try {
          const result: unknown = JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
          validateFixedColor(result);
          resolve(result);
        } catch {
          reject(new Error('Invalid color helper response'));
        }
      },
    );
  });
}

/** Semantic allowlist only; same fixed helper and bounds as lighting. */
export async function windowsMapping(source?: string, target?: string): Promise<KeyAssignment[]> {
  if (source !== undefined || target !== undefined) {
    validateMappingSource(source);
    validateMappingTarget(target);
  }
  if (process.platform !== 'win32' || process.arch !== 'x64')
    throw new Error('Only Windows x64 supported');
  const executable = join(
    process.env.SystemRoot ?? 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
  const args = [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-File',
    helperPath,
    '-Action',
    source === undefined ? 'ReadMappings' : 'SetMapping',
  ];
  if (source !== undefined) args.push('-Source', source, '-Target', target!);
  return new Promise((resolve, reject) => {
    execFile(
      executable,
      args,
      // Maximum: 79 sources all targeting Ctrl+Shift+BracketRight = 4297 UTF-8 bytes incl. CRLF.
      // Mapping only: retain a bounded 8 KiB buffer; scalar/color helpers remain at 4 KiB.
      { windowsHide: true, timeout: 15000, maxBuffer: 8192 },
      (error, stdout, stderr) => {
        if (error) {
          reject(helperFailure(stderr, error.killed ?? false));
          return;
        }
        try {
          const result: unknown = JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
          validateMappings(result);
          resolve(result);
        } catch {
          reject(new Error('Invalid mapping helper response'));
        }
      },
    );
  });
}
