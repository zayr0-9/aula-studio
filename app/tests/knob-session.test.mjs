import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { KnobSession } from '../src/main/knob-session.ts';
function fixture() {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => {
    child.emit('close', 0);
    return true;
  };
  const service = new KnobSession(() => child);
  return { child, service };
}
test('explicit opt-in, startup handshake, semantic counters, cleanup', () => {
  const { child, service } = fixture();
  assert.equal(service.snapshot().state, 'off');
  assert.equal(service.enable().state, 'starting');
  assert.throws(() => service.enable());
  child.stdout.write('{"event":"ready"}\n{"event":"clockwise"}\n{"event":"press"}\n');
  assert.equal(service.snapshot().state, 'active');
  assert.equal(service.snapshot().clockwise, 1);
  assert.equal(service.snapshot().press, 1);
  service.disable();
  child.emit('close', 0);
  assert.equal(service.snapshot().state, 'off');
});
test('invalid child output fails closed and retains ownership until exit', () => {
  const { child, service } = fixture();
  service.enable();
  child.stdout.write('{"event":"arbitrary"}\n');
  assert.equal(service.snapshot().state, 'error');
  assert.throws(() => service.enable());
  child.emit('close', 1);
  assert.equal(service.snapshot().state, 'error');
});
test('startup exception is recoverable without active child', () => {
  const service = new KnobSession(() => {
    throw new Error('launch');
  });
  assert.throws(() => service.enable());
  assert.equal(service.disable().state, 'off');
});

test('renderer heartbeat loss stops lease and terminates owned helper', async () => {
  const { child, service } = fixture();
  service.enable();
  child.stdout.write('{"event":"ready"}\n');
  await new Promise((resolve) => setTimeout(resolve, 3100));
  assert.equal(service.snapshot().state, 'error');
  assert.match(service.snapshot().message, /heartbeat/);
  child.emit('close', 0);
});

test('fragmented helper messages parse; excessive output stops session', () => {
  const { child, service } = fixture();
  service.enable();
  child.stdout.write('{"event":"rea');
  child.stdout.write('dy"}\n');
  assert.equal(service.snapshot().state, 'active');
  child.stdout.write('x'.repeat(8193));
  assert.equal(service.snapshot().state, 'error');
  child.emit('close', 1);
});
