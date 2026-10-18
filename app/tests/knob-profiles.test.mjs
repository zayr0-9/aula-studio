import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { knobProfiles, validateKnobProfile } from '../src/shared/knob.ts';
import { KnobSession } from '../src/main/knob-session.ts';

test('fixed knob profiles validate exact semantic names only', () => {
  assert.deepEqual(
    knobProfiles.map((p) => p.id),
    ['media', 'scroll', 'zoom', 'tabs', 'history'],
  );
  for (const profile of knobProfiles) validateKnobProfile(profile.id);
  for (const bad of [null, undefined, {}, 'Media', 'shell', 'media -Command whoami', ''])
    assert.throws(() => validateKnobProfile(bad));
});
test('session validates before launching and passes selected profile to owned helper', () => {
  let selected;
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill() {},
  });
  const session = new KnobSession((profile) => {
    selected = profile;
    return child;
  });
  assert.throws(() => session.enable('shell'));
  assert.equal(selected, undefined);
  session.enable('tabs');
  assert.equal(selected, 'tabs');
  child.stdout.write('{"event":"ready"}\n');
  assert.equal(session.snapshot().state, 'active');
  assert.match(session.snapshot().message, /tabs/);
  assert.throws(() => session.enable('zoom'), /owned/);
  session.disable();
  child.emit('close');
  assert.equal(session.snapshot().state, 'off');
});

test('live profile switch waits for ack, keeps helper and counters, and rejects overlapping commands', async () => {
  let launches = 0;
  const commands = [];
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill() {},
  });
  child.stdin.on('data', (data) => commands.push(data.toString()));
  const session = new KnobSession(() => {
    launches++;
    return child;
  });
  assert.throws(() => session.setProfile('tabs'), /not active/);
  session.enable('media');
  assert.throws(() => session.setProfile('tabs'), /not active/);
  child.stdout.write('{"event":"ready"}\n{"event":"clockwise"}\n');
  const changed = session.setProfile('tabs');
  assert.throws(() => session.setProfile('zoom'), /pending/);
  assert.throws(() => session.setProfile('shell'));
  assert.match(session.snapshot().message, /media/);
  assert.equal(commands.at(-1), 'profile:tabs\n');
  child.stdout.write('{"event":"profile:tabs"}\n');
  assert.match((await changed).message, /tabs/);
  assert.equal(session.snapshot().clockwise, 1);
  assert.equal(launches, 1);
  const cancelled = session.setProfile('zoom');
  const rejected = assert.rejects(cancelled, /did not complete/);
  session.disable();
  await rejected;
  child.emit('close');
});

test('unacknowledged live switch times out and stops interception', async () => {
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill() {},
  });
  const session = new KnobSession(() => child);
  session.enable();
  child.stdout.write('{"event":"ready"}\n');
  await assert.rejects(session.setProfile('scroll'), /did not complete/);
  assert.equal(session.snapshot().state, 'error');
  child.emit('close');
});
