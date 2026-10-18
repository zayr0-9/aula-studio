import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { validateKnobProfile } from '../shared/knob.ts';
import type { KnobStatus, KnobProfile } from '../shared/knob.ts';

export class KnobSession {
  private child: ChildProcessWithoutNullStreams | null = null;
  private lease: ReturnType<typeof setInterval> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private lastAlive = 0;
  private rendererAlive = 0;
  private buffer = '';
  private profile: KnobProfile = 'media';
  private switching: {
    profile: KnobProfile;
    resolve: (status: KnobStatus) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  private status: KnobStatus = {
    state: 'off',
    clockwise: 0,
    counterclockwise: 0,
    press: 0,
    message: 'Interception off',
  };

  private readonly launch: (profile: KnobProfile) => ChildProcessWithoutNullStreams;
  constructor(launch: (profile: KnobProfile) => ChildProcessWithoutNullStreams) {
    this.launch = launch;
  }

  snapshot(): KnobStatus {
    return { ...this.status };
  }

  heartbeat(): void {
    this.rendererAlive = performance.now();
  }

  enable(profile: KnobProfile = 'media'): KnobStatus {
    validateKnobProfile(profile);
    if (this.child) throw new Error('Knob session already owned; disable it first');
    this.status = {
      state: 'starting',
      clockwise: 0,
      counterclockwise: 0,
      press: 0,
      message: 'Starting global media suppression…',
    };
    this.buffer = '';
    this.profile = profile;
    this.lastAlive = performance.now();
    this.heartbeat();
    let child: ChildProcessWithoutNullStreams;
    try {
      child = this.launch(profile);
    } catch {
      this.status.state = 'error';
      this.status.message = 'Knob helper could not start';
      throw new Error('Knob helper could not start');
    }
    this.child = child;
    const fail = () => {
      if (this.child === child)
        this.fail(
          'Knob helper failed; interception stopping (lease expires within 2.5 seconds). If keys feel held, press and release Ctrl and Shift.',
        );
    };
    child.on('error', fail);
    child.stdin.on('error', fail);
    child.stderr.on('data', () => {
      /* Do not expose native diagnostics or arbitrary contents. */
    });
    child.stdout.on('data', (chunk: Buffer) => {
      if (this.child !== child || this.status.state === 'stopping' || this.status.state === 'error')
        return;
      this.buffer += chunk.toString('utf8');
      if (this.buffer.length > 8192) {
        this.fail('Invalid helper output');
        return;
      }
      let newline: number;
      while ((newline = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, newline).trim();
        this.buffer = this.buffer.slice(newline + 1);
        try {
          const data: unknown = JSON.parse(line);
          if (
            !data ||
            typeof data !== 'object' ||
            Object.keys(data).length !== 1 ||
            !('event' in data)
          )
            throw new Error();
          if (data.event === 'ready' && this.status.state === 'starting') {
            this.status.state = 'active';
            this.status.message = `Global volume/mute keys blocked; ${this.profile} knob controls active`;
          } else if (
            this.status.state === 'active' &&
            this.switching &&
            data.event === `profile:${this.switching.profile}`
          ) {
            this.profile = this.switching.profile;
            this.status.message = `Global volume/mute keys blocked; ${this.profile} knob controls active`;
            const pending = this.switching;
            clearTimeout(pending.timer);
            this.switching = null;
            pending.resolve(this.snapshot());
          } else if (data.event === 'alive') {
            this.lastAlive = performance.now();
          } else if (
            this.status.state === 'active' &&
            (data.event === 'clockwise' ||
              data.event === 'counterclockwise' ||
              data.event === 'press')
          ) {
            this.status[data.event] = Math.min(1000000, this.status[data.event] + 1);
          } else throw new Error();
        } catch {
          this.fail('Invalid knob helper event; stopped');
          return;
        }
      }
    });
    child.once('close', () => {
      if (this.child !== child) return;
      this.clearTimers();
      this.rejectSwitch();
      this.child = null;
      if (this.status.state !== 'error')
        this.status = {
          ...this.status,
          state: 'off',
          message:
            'Interception stopped. If an action failed and keys feel held, press and release Ctrl, Shift or the middle mouse button.',
        };
    });
    this.lease = setInterval(() => {
      if (this.child !== child) return;
      if (
        performance.now() - this.rendererAlive > 2500 ||
        performance.now() - this.lastAlive > 4000
      ) {
        this.fail(
          'Session heartbeat lost; interception stopping (lease expires within 2.5 seconds)',
        );
        return;
      }
      if (!child.stdin.writable || !child.stdin.write('lease\n'))
        this.fail('Helper lease unavailable');
    }, 500);
    this.watchdog = setTimeout(() => {
      if (this.status.state === 'starting') this.fail('Knob startup timed out');
    }, 10000);
    return this.snapshot();
  }

  setProfile(profile: KnobProfile): Promise<KnobStatus> {
    validateKnobProfile(profile);
    if (!this.child || this.status.state !== 'active')
      throw new Error('Knob session is not active');
    if (this.switching) throw new Error('Profile switch already pending');
    if (profile === this.profile) return Promise.resolve(this.snapshot());
    return new Promise((resolve, reject) => {
      this.switching = {
        profile,
        resolve,
        reject,
        timer: setTimeout(() => this.fail('Profile switch timed out; interception stopping'), 2000),
      };
      try {
        if (!this.child!.stdin.writable || !this.child!.stdin.write(`profile:${profile}\n`))
          this.fail('Profile command unavailable; interception stopping');
      } catch {
        this.fail('Profile command failed; interception stopping');
      }
    });
  }

  private rejectSwitch(): void {
    if (!this.switching) return;
    clearTimeout(this.switching.timer);
    this.switching.reject(new Error('Profile switch did not complete; session stopping'));
    this.switching = null;
  }

  disable(): KnobStatus {
    if (!this.child) {
      this.status.state = 'off';
      this.status.message = 'Interception off';
      return this.snapshot();
    }
    this.status.state = 'stopping';
    this.status.message = 'Stopping interception…';
    this.stopChild();
    return this.snapshot();
  }

  async shutdown(): Promise<void> {
    const child = this.child;
    this.disable();
    if (!child) return;
    await new Promise<void>((resolve) => child.once('close', () => resolve()));
  }

  private fail(message: string): void {
    this.status.state = 'error';
    this.status.message = message;
    this.stopChild();
  }

  private clearTimers(): void {
    if (this.lease) clearInterval(this.lease);
    if (this.watchdog) clearTimeout(this.watchdog);
    this.lease = null;
    this.watchdog = null;
  }

  private stopChild(): void {
    this.rejectSwitch();
    this.clearTimers();
    const child = this.child;
    if (!child) return;
    if (child.stdin.writable) child.stdin.end('stop\n');
    this.watchdog = setTimeout(() => {
      if (this.child === child) child.kill();
    }, 3000);
  }
}

export function spawnKnobHelper(
  executable: string,
  helper: string,
  profile: KnobProfile = 'media',
): ChildProcessWithoutNullStreams {
  validateKnobProfile(profile);
  return spawn(
    executable,
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-STA', '-File', helper, '-Profile', profile],
    {
      windowsHide: true,
      stdio: 'pipe',
    },
  );
}
