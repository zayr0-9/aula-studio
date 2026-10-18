import {
  validateMappingSource,
  validateMappingTarget,
  validateMappings,
} from '../shared/mapping.ts';
import type { KeyAssignment } from '../shared/mapping.ts';
export type MappingTransaction = (source?: string, target?: string) => Promise<KeyAssignment[]>;

import { validateFixedColor } from '../shared/color.ts';
import type { FixedColor } from '../shared/color.ts';

export type LightingAction =
  | 'Read'
  | 'Set'
  | 'ReadEffect'
  | 'SetEffect'
  | 'ReadSpeed'
  | 'SetSpeed'
  | 'SetEffectBrightness'
  | 'ReadPgUp'
  | 'SetPgUp';
export type BrightnessTransaction = (
  value?: number,
  action?: LightingAction,
  brightness?: number,
) => Promise<number>;

export function validatePgUp(value: unknown): asserts value is number {
  if (value !== 74 && value !== 75) throw new Error('Only Home or PgUp targets supported');
}

export function validateSpeed(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 4) {
    throw new Error('Speed must be an integer from 0 to 4');
  }
}

export function validateObservedEffect(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 255) {
    throw new Error('Invalid observed effect selector');
  }
}

export function validateEffect(value: unknown): asserts value is number {
  if (value !== 1 && value !== 11 && value !== 17) {
    throw new Error('Only Fixed_on, Neon_stream and Blossoming are supported');
  }
}

export function validateBrightness(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 9) {
    throw new Error('Brightness must be an integer from 0 to 9');
  }
}

/** Queue whole fresh-read/write/readback transactions, never individual reports. */
export class BrightnessService {
  private tail: Promise<unknown> = Promise.resolve();
  private faulted = false;
  private pending = 0;
  private stopping = false;

  stop(): Promise<unknown> {
    this.stopping = true;
    return this.tail;
  }

  private readonly transact: BrightnessTransaction;

  private readonly colorTransact: (color?: FixedColor) => Promise<FixedColor>;

  private readonly mappingTransact: MappingTransaction;

  constructor(
    transact: BrightnessTransaction,
    colorTransact: (color?: FixedColor) => Promise<FixedColor> = async () => {
      throw new Error('Color transport unavailable');
    },
    mappingTransact: MappingTransaction = async () => {
      throw new Error('Mapping transport unavailable');
    },
  ) {
    this.transact = transact;
    this.colorTransact = colorTransact;
    this.mappingTransact = mappingTransact;
  }

  readMappings(): Promise<KeyAssignment[]> {
    return this.queue(async () => {
      const result = await this.mappingTransact();
      validateMappings(result);
      return result;
    });
  }

  setMapping(source: unknown, target: unknown): Promise<KeyAssignment[]> {
    validateMappingSource(source);
    validateMappingTarget(target);
    return this.queue(async () => {
      const result = await this.mappingTransact(source, target);
      validateMappings(result);
      if (result.find((entry) => entry.source === source)?.target !== target)
        throw new Error('Mapping readback mismatch');
      return result;
    });
  }

  readColor(): Promise<FixedColor> {
    return this.queue(async () => {
      const result = await this.colorTransact();
      validateFixedColor(result);
      return result;
    });
  }

  setColor(value: unknown): Promise<FixedColor> {
    validateFixedColor(value);
    const color = { ...value };
    return this.queue(async () => {
      const result = await this.colorTransact(color);
      validateFixedColor(result);
      if (
        result.red !== color.red ||
        result.green !== color.green ||
        result.blue !== color.blue ||
        result.colourful !== color.colourful
      )
        throw new Error('Color readback mismatch');
      return result;
    });
  }

  read(): Promise<number> {
    return this.enqueue();
  }

  set(value: unknown): Promise<number> {
    validateBrightness(value);
    return this.enqueue(value);
  }

  readEffect(): Promise<number> {
    return this.enqueue(undefined, 'ReadEffect');
  }

  setEffect(value: unknown): Promise<number> {
    validateEffect(value);
    return this.enqueue(value, 'SetEffect');
  }

  setEffectBrightness(effect: unknown, brightness: unknown): Promise<number> {
    validateEffect(effect);
    if (effect === 17) throw new Error('Blossoming does not support brightness');
    validateBrightness(brightness);
    return this.enqueue(effect, 'SetEffectBrightness', brightness);
  }

  readPgUp(): Promise<number> {
    return this.enqueue(undefined, 'ReadPgUp');
  }

  setPgUp(value: unknown): Promise<number> {
    validatePgUp(value);
    return this.enqueue(value, 'SetPgUp');
  }

  readSpeed(): Promise<number> {
    return this.enqueue(undefined, 'ReadSpeed');
  }

  setSpeed(value: unknown): Promise<number> {
    validateSpeed(value);
    return this.enqueue(value, 'SetSpeed');
  }

  private enqueue(
    value?: number,
    action: LightingAction = value === undefined ? 'Read' : 'Set',
    brightness?: number,
  ): Promise<number> {
    return this.queue(async () => {
      const result = await this.transact(value, action, brightness);
      if (action === 'ReadEffect') validateObservedEffect(result);
      else if (action === 'SetEffect' || action === 'SetEffectBrightness') validateEffect(result);
      else if (action === 'ReadSpeed' || action === 'SetSpeed') validateSpeed(result);
      else if (action === 'ReadPgUp' || action === 'SetPgUp') validatePgUp(result);
      else validateBrightness(result);
      if (value !== undefined && result !== value) throw new Error('Readback mismatch');
      return result;
    });
  }

  private queue<T>(work: () => Promise<T>): Promise<T> {
    if (this.stopping) return Promise.reject(new Error('Brightness service is shutting down'));
    if (this.pending >= 8) return Promise.reject(new Error('Brightness queue is full'));
    this.pending++;
    const operation = this.tail.then(async () => {
      if (this.stopping) throw new Error('Brightness service is shutting down');
      if (this.faulted) throw new Error('Hardware service blocked after failure; restart required');
      try {
        return await work();
      } catch (cause) {
        this.faulted = true;
        throw new Error(
          `Hardware transaction failed: ${cause instanceof Error ? cause.message : 'Unknown failure'}. Device state may be uncertain; no retry or restoration was performed. Close the official app and restart Studio before reading again.`,
          { cause },
        );
      }
    });
    this.tail = operation.catch(() => undefined);
    return operation.finally(() => {
      this.pending--;
    });
  }
}
