import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { StreamSession } from '../src/main/stream-session.ts';
import { defaultStreamProfile, buildStreamColors } from '../src/shared/stream.ts';

function fixture(t) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  let now = 0;
  t.mock.method(performance, 'now', () => now);
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  const commands = [];
  child.stdin.on('data', (data) => commands.push(JSON.parse(data.toString())));
  let kills = 0;
  let releases = 0;
  child.kill = () => {
    kills++;
    return true;
  };
  const service = new StreamSession(
    () => child,
    () => releases++,
  );
  const emit = (event) => child.stdout.write(`${JSON.stringify({ event })}\n`);
  const tick = (ms) => {
    now += ms;
    t.mock.timers.tick(ms);
  };
  return { child, service, commands, emit, tick, kills: () => kills, releases: () => releases };
}

test('validates before launch, snapshots are isolated, launch failure latches', () => {
  let launches = 0;
  let releases = 0;
  const service = new StreamSession(
    () => {
      launches++;
      throw new Error('private diagnostic');
    },
    () => releases++,
  );
  assert.throws(() => service.start({}));
  assert.equal(launches, 0);
  assert.throws(() => service.start(defaultStreamProfile()), /could not start/);
  assert.equal(releases, 1);
  assert.equal(service.isOwned(), false);
  service.snapshot().state = 'off';
  assert.equal(service.stop().state, 'error');
  assert.throws(() => service.start(defaultStreamProfile()), /restart/);
  assert.equal(launches, 1);
});

test('ready handshake, one in-flight frame, latest cloned update and 800ms pacing', (t) => {
  const f = fixture(t);
  const profile = { ...defaultStreamProfile(), mode: 'solid' };
  const original = structuredClone(profile);
  assert.equal(f.service.start(profile).state, 'starting');
  profile.color = '#ff0000';
  assert.equal(f.commands.length, 0);
  assert.throws(() => f.service.update(profile), /not active/);
  f.emit('ready');
  assert.deepEqual(f.commands[0], { colors: buildStreamColors(original, 0) });
  f.tick(1600);
  assert.equal(f.commands.length, 1);
  const next = { ...defaultStreamProfile(), mode: 'solid', color: '#112233' };
  f.service.update({ ...next, color: '#ffffff' });
  f.service.update(next);
  const expected = structuredClone(next);
  next.color = '#000000';
  f.emit('frame');
  assert.equal(f.service.snapshot().frames, 1);
  f.tick(799);
  assert.equal(f.commands.length, 1);
  f.tick(1);
  assert.deepEqual(f.commands[1], { colors: buildStreamColors(expected, 1) });
  f.service.stop();
  assert.deepEqual(f.commands.at(-1), { stop: true });
  assert.equal(f.service.isOwned(), true);
  f.emit('frame');
  f.emit('stopped');
  assert.equal(f.releases(), 0);
  f.child.emit('close', 0);
  assert.equal(f.service.snapshot().state, 'off');
  assert.equal(f.releases(), 1);
});

test('heartbeat expiration fails closed, kill is bounded, close alone releases', (t) => {
  const f = fixture(t);
  f.service.start(defaultStreamProfile());
  f.tick(3250);
  assert.equal(f.service.snapshot().state, 'starting');
  f.service.heartbeat();
  f.tick(3250);
  assert.equal(f.service.snapshot().state, 'starting');
  f.tick(250);
  assert.equal(f.service.snapshot().state, 'error');
  assert.match(f.service.snapshot().message, /heartbeat/);
  f.tick(2999);
  assert.equal(f.kills(), 0);
  f.service.stop();
  f.tick(1);
  assert.equal(f.kills(), 1);
  assert.equal(f.service.isOwned(), true);
  assert.equal(f.releases(), 0);
  f.child.emit('close', 0);
  assert.equal(f.service.stop().state, 'error');
  assert.throws(() => f.service.start(defaultStreamProfile()), /restart/);
});

test('15 second startup allowance with heartbeats and no early frames', (t) => {
  const f = fixture(t);
  f.service.start(defaultStreamProfile());
  for (let i = 0; i < 14; i++) {
    f.tick(1000);
    f.service.heartbeat();
  }
  assert.equal(f.service.snapshot().state, 'starting');
  assert.equal(f.commands.length, 0);
  f.tick(1000);
  assert.equal(f.service.snapshot().state, 'error');
  assert.match(f.service.snapshot().message, /startup/);
  f.child.emit('close', 1);
});

test('fragmented output accepted; oversized or unsolicited events latch errors', (t) => {
  const f = fixture(t);
  f.service.start(defaultStreamProfile());
  f.child.stdout.write('{"event":"rea');
  f.child.stdout.write('dy"}\n');
  assert.equal(f.service.snapshot().state, 'active');
  f.child.stderr.write('private native diagnostics');
  f.child.stdout.write('x'.repeat(8193));
  assert.equal(f.service.snapshot().state, 'error');
  assert.doesNotMatch(f.service.snapshot().message, /private/);
  f.child.emit('close', 1);
});

test('unexpected close and duplicate acknowledgement fail closed', (t) => {
  const f = fixture(t);
  f.service.start(defaultStreamProfile());
  f.emit('ready');
  f.emit('frame');
  f.emit('frame');
  assert.equal(f.service.snapshot().state, 'error');
  f.child.emit('close', 0);
  assert.equal(f.releases(), 1);
  assert.throws(() => f.service.start(defaultStreamProfile()));
});

test('shutdown resolves on close and permanently disposes session', async (t) => {
  const f = fixture(t);
  f.service.start(defaultStreamProfile());
  const shutdown = f.service.shutdown();
  assert.equal(f.service.snapshot().state, 'stopping');
  f.child.emit('close', 0);
  await shutdown;
  assert.equal(f.releases(), 1);
  assert.throws(() => f.service.start(defaultStreamProfile()), /shut down/);
});

test('shutdown has a deadline without pretending an unclosed child was released', async (t) => {
  const f = fixture(t);
  f.service.start(defaultStreamProfile());
  const shutdown = f.service.shutdown();
  f.tick(4000);
  await shutdown;
  assert.equal(f.kills(), 1);
  assert.equal(f.service.isOwned(), true);
  assert.equal(f.releases(), 0);
  assert.equal(f.service.snapshot().state, 'error');
  f.child.emit('close', null);
  assert.equal(f.releases(), 1);
});

test('process errors retain ownership and sanitize diagnostics', (t) => {
  const f = fixture(t);
  f.service.start(defaultStreamProfile());
  f.child.emit('error', new Error('private path'));
  assert.equal(f.service.snapshot().state, 'error');
  assert.doesNotMatch(f.service.snapshot().message, /private/);
  assert.equal(f.service.isOwned(), true);
  f.child.emit('close', 1);
  assert.equal(f.releases(), 1);
});

test('unacknowledged frame times out without accumulating frames', (t) => {
  const f = fixture(t);
  f.service.start(defaultStreamProfile());
  f.emit('ready');
  for (let i = 0; i < 15; i++) {
    f.service.heartbeat();
    f.tick(1000);
  }
  assert.equal(f.service.snapshot().state, 'error');
  assert.match(f.service.snapshot().message, /acknowledgement/);
  assert.equal(f.commands.filter((command) => 'colors' in command).length, 1);
  f.child.emit('close', 1);
});

test('unexpected clean exit is an error and remains latched', (t) => {
  const f = fixture(t);
  f.service.start(defaultStreamProfile());
  f.child.emit('close', 0);
  assert.equal(f.service.snapshot().state, 'error');
  assert.equal(f.service.isOwned(), false);
  assert.equal(f.releases(), 1);
  assert.throws(() => f.service.start(defaultStreamProfile()), /restart/);
});

test('off-mode admission refusal sends no frames and allows explicit restart after close', (t) => {
  const f = fixture(t);
  f.service.start(defaultStreamProfile());
  f.emit('requires-off');
  assert.equal(f.commands.length, 0);
  assert.equal(f.service.isOwned(), true);
  f.child.emit('close', 0);
  assert.equal(f.service.snapshot().state, 'off');
  assert.match(f.service.snapshot().message, /turn onboard lighting off/i);
  assert.equal(f.releases(), 1);
  assert.doesNotThrow(() => f.service.start(defaultStreamProfile()));
  f.service.stop();
  f.child.emit('close', 0);
});
