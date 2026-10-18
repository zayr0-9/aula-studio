import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { buildStreamColors, validateStreamProfile } from '../shared/stream.ts';
import type { StreamProfile, StreamStatus } from '../shared/stream.ts';

const FRAME_INTERVAL = 800;
const STARTUP_TIMEOUT = 15000;
const FRAME_TIMEOUT = 15000;
const HEARTBEAT_TIMEOUT = 3500;
const STOP_TIMEOUT = 3000;

export class StreamSession {
  private child: ChildProcessWithoutNullStreams | null = null;
  private profile: StreamProfile | null = null;
  private status: StreamStatus = { state: 'off', message: 'Streaming off', frames: 0 };
  private buffer = '';
  private rendererAlive = 0;
  private inFlight = false;
  private animationIndex = 0;
  private animationAcknowledgedAt: number | null = null;
  private revision = 0;
  private sentRevision = 0;
  private disposed = false;
  private stopping = false;
  private preflightBlocked = false;
  private frameTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private killTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly launch: () => ChildProcessWithoutNullStreams;
  private readonly onRelease: () => void;

  constructor(launch: () => ChildProcessWithoutNullStreams, onRelease: () => void = () => {}) {
    this.launch = launch;
    this.onRelease = onRelease;
  }

  snapshot(): StreamStatus {
    return { ...this.status };
  }

  isOwned(): boolean {
    return this.child !== null;
  }

  heartbeat(): void {
    this.rendererAlive = performance.now();
  }

  start(profile: StreamProfile): StreamStatus {
    validateStreamProfile(profile);
    if (this.disposed) throw new Error('Stream session is shut down');
    if (this.child) throw new Error('Stream session already owned; stop it first');
    if (this.status.state === 'error')
      throw new Error('Streaming failed; restart the app to retry');
    this.profile = structuredClone(profile);
    this.animationIndex = 0;
    this.animationAcknowledgedAt = null;
    this.revision++;
    this.status = { state: 'starting', message: 'Starting streaming…', frames: 0 };
    this.buffer = '';
    this.inFlight = false;
    this.stopping = false;
    this.preflightBlocked = false;
    this.heartbeat();
    let child: ChildProcessWithoutNullStreams;
    try {
      child = this.launch();
    } catch {
      this.status = { ...this.status, state: 'error', message: 'Stream helper could not start' };
      this.onRelease();
      throw new Error('Stream helper could not start');
    }
    this.child = child;
    const fail = () => {
      if (this.child === child) this.fail('Stream helper failed; streaming stopped');
    };
    child.on('error', fail);
    child.stdin.on('error', fail);
    child.stdout.on('error', fail);
    child.stderr.on('error', fail);
    child.stderr.on('data', () => {
      /* Drain diagnostics without exposing arbitrary native contents. */
    });
    child.stdout.on('data', (chunk: Buffer) => {
      if (this.child === child) this.readOutput(chunk);
    });
    child.once('close', (code: number | null) => {
      if (this.child !== child) return;
      const expected = this.stopping && code === 0;
      this.clearTimers();
      if (this.killTimer) clearTimeout(this.killTimer);
      this.killTimer = null;
      this.child = null;
      this.profile = null;
      this.inFlight = false;
      if (this.status.state !== 'error') {
        this.status = {
          ...this.status,
          state: expected ? 'off' : 'error',
          message: expected
            ? this.preflightBlocked
              ? 'Streaming not started: turn onboard lighting off first (Neon_stream is still active if selected), then press Start again. No colors were sent.'
              : 'Streaming off'
            : 'Stream helper exited unexpectedly; restart the app',
        };
      }
      this.onRelease();
    });
    this.watchdog = setTimeout(() => this.fail('Stream helper startup timed out'), STARTUP_TIMEOUT);
    this.heartbeatTimer = setInterval(() => {
      if (performance.now() - this.rendererAlive >= HEARTBEAT_TIMEOUT)
        this.fail('Streaming heartbeat lost; streaming stopped');
    }, 250);
    return this.snapshot();
  }

  update(profile: StreamProfile): StreamStatus {
    validateStreamProfile(profile);
    if (!this.child || this.status.state !== 'active')
      throw new Error('Stream session is not active');
    this.profile = structuredClone(profile);
    this.animationIndex = 0;
    this.animationAcknowledgedAt = null;
    this.revision++;
    return this.snapshot();
  }

  stop(): StreamStatus {
    if (this.child && !this.stopping) {
      if (this.status.state !== 'error') {
        this.status.state = 'stopping';
        this.status.message = 'Stopping streaming…';
      }
      this.stopChild();
    }
    return this.snapshot();
  }

  async shutdown(): Promise<void> {
    this.disposed = true;
    const child = this.child;
    if (!child) return;
    // Listen before requesting stop: a mock or a failed helper can close synchronously.
    await new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(deadline);
        child.removeListener('close', finish);
        resolve();
      };
      const deadline = setTimeout(() => {
        child.removeListener('close', finish);
        if (this.child === child) {
          this.status.state = 'error';
          this.status.message = 'Stream helper did not close; device ownership retained';
        }
        resolve();
      }, STOP_TIMEOUT + 1000);
      child.once('close', finish);
      this.stop();
    });
  }

  private readOutput(chunk: Buffer): void {
    if (this.status.state === 'error') return;
    this.buffer += chunk.toString('utf8');
    if (Buffer.byteLength(this.buffer, 'utf8') > 8192) {
      this.fail('Invalid stream helper output');
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
        if (data.event === 'requires-off' && this.status.state === 'starting') {
          this.clearTimers();
          this.preflightBlocked = true;
          this.stopping = true;
          this.status.state = 'stopping';
          this.status.message =
            'Streaming not started: turn onboard lighting off first, then press Start again. No colors were sent.';
          this.killTimer = setTimeout(() => {
            if (this.child) {
              this.status.state = 'error';
              this.status.message = 'Stream helper did not close after admission refusal';
              this.child.kill();
            }
          }, STOP_TIMEOUT);
        } else if (data.event === 'ready' && this.status.state === 'starting') {
          if (this.watchdog) clearTimeout(this.watchdog);
          this.watchdog = null;
          this.status.state = 'active';
          this.status.message = 'Streaming active';
          this.sendFrame();
        } else if (data.event === 'frame' && this.status.state === 'active' && this.inFlight) {
          this.inFlight = false;
          if (this.watchdog) clearTimeout(this.watchdog);
          this.watchdog = null;
          this.status.frames = Math.min(Number.MAX_SAFE_INTEGER, this.status.frames + 1);
          if (
            this.profile?.mode === 'animation' &&
            this.sentRevision === this.revision &&
            this.animationAcknowledgedAt === null
          )
            this.animationAcknowledgedAt = performance.now();
          // Schedule from acknowledgement, not a recurring interval: never accumulate work.
          this.frameTimer = setTimeout(() => this.sendFrame(), FRAME_INTERVAL);
        } else if (
          this.status.state === 'stopping' &&
          (data.event === 'stopped' || data.event === 'frame' || data.event === 'ready')
        ) {
          // In-flight replies may race the stop request. Only close releases ownership.
        } else throw new Error();
      } catch {
        this.fail('Invalid stream helper event; streaming stopped');
        return;
      }
      if (this.snapshot().state === 'error') return;
    }
  }

  private sendFrame(): void {
    this.frameTimer = null;
    const child = this.child;
    if (!child || !this.profile || this.status.state !== 'active' || this.inFlight) return;
    try {
      if (this.profile.mode === 'animation') {
        const sequence = this.profile.animation!;
        if (
          this.animationAcknowledgedAt !== null &&
          performance.now() - this.animationAcknowledgedAt >=
            sequence.frames[this.animationIndex].durationMs
        ) {
          if (this.animationIndex + 1 === sequence.frames.length && !sequence.loop) {
            this.stop();
            return;
          }
          this.animationIndex = (this.animationIndex + 1) % sequence.frames.length;
          this.animationAcknowledgedAt = null;
        }
      }
      const colors = buildStreamColors(
        this.profile,
        this.profile.mode === 'animation' ? this.animationIndex : this.status.frames,
      );
      this.sentRevision = this.revision;
      this.inFlight = true;
      this.watchdog = setTimeout(
        () => this.fail('Stream frame acknowledgement timed out'),
        FRAME_TIMEOUT,
      );
      if (!child.stdin.writable || !child.stdin.write(`${JSON.stringify({ colors })}\n`))
        this.fail('Stream frame unavailable; streaming stopped');
    } catch {
      this.fail('Stream frame failed; streaming stopped');
    }
  }

  private fail(message: string): void {
    if (this.status.state !== 'error') {
      this.status.state = 'error';
      this.status.message = message;
    }
    this.stopChild();
  }

  private clearTimers(): void {
    if (this.frameTimer) clearTimeout(this.frameTimer);
    if (this.watchdog) clearTimeout(this.watchdog);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.frameTimer = null;
    this.watchdog = null;
    this.heartbeatTimer = null;
  }

  private stopChild(): void {
    this.clearTimers();
    const child = this.child;
    if (!child || this.stopping) return;
    this.stopping = true;
    this.killTimer = setTimeout(() => {
      if (this.child !== child) return;
      try {
        child.kill();
      } catch {
        this.status.state = 'error';
        this.status.message = 'Stream helper could not be terminated; device ownership retained';
      }
    }, STOP_TIMEOUT);
    try {
      if (child.stdin.writable) child.stdin.end(`${JSON.stringify({ stop: true })}\n`);
    } catch {
      // The bounded kill still runs. Ownership is retained until the close event.
    }
  }
}
