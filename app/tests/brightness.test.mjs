import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  encodeConfigurationQuery,
  parseConfigurationResponse,
  readNeonStreamBrightness,
  encodeNeonStreamBrightness,
} from '../src/protocol/neon-stream-brightness.ts';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/ansi-neon-stream-brightness.json', import.meta.url), 'utf8'),
);
const historicalFixture = JSON.parse(
  await readFile(new URL('./fixtures/neon-stream-brightness.json', import.meta.url), 'utf8'),
);
for (const cycle of historicalFixture.cycles) {
  test(`historical French capture codec replay ${cycle.before} -> ${cycle.after}`, () => {
    assert.deepEqual(encodeConfigurationQuery(), bytes(cycle.query));
    assert.deepEqual(
      encodeNeonStreamBrightness(parseConfigurationResponse(bytes(cycle.response)), cycle.after),
      bytes(cycle.write),
    );
  });
}
const bytes = (value) => Uint8Array.from(value);

for (const cycle of fixture.cycles) {
  test(`capture replay: brightness ${cycle.before} -> ${cycle.after}`, () => {
    assert.deepEqual(encodeConfigurationQuery(), bytes(cycle.query));
    const response = bytes(cycle.response);
    const original = response.slice();
    const config = parseConfigurationResponse(response);
    assert.equal(readNeonStreamBrightness(config), cycle.before);
    const snapshot = config.slice();
    const encoded = encodeNeonStreamBrightness(config, cycle.after);
    assert.deepEqual(encoded, bytes(cycle.write));
    assert.deepEqual(config, snapshot);
    assert.deepEqual(response, original);
    const differences = [...config.keys()].filter((index) => config[index] !== encoded[8 + index]);
    assert.deepEqual(differences, [0x4e]);
    assert.ok(encoded.subarray(136).every((value) => value === 0));
  });
}

test('136-byte wire response and explicit valid length in oversized buffer', () => {
  const response = bytes(fixture.cycles[0].response);
  const padded = new Uint8Array(520);
  padded.set(response);
  assert.deepEqual(parseConfigurationResponse(padded), parseConfigurationResponse(response));
  padded.fill(0xcc, 136);
  assert.deepEqual(parseConfigurationResponse(padded, 136), parseConfigurationResponse(response));
  assert.throws(() => parseConfigurationResponse(padded), /padding/);
});

test('reject all truncated responses and invalid lengths', () => {
  const response = bytes(fixture.cycles[0].response);
  for (let length = 0; length < 136; length++) {
    assert.throws(() => parseConfigurationResponse(response.slice(0, length)));
  }
  for (const length of [-1, 135, 137, 519, 521, 1.5, NaN, Infinity]) {
    assert.throws(() => parseConfigurationResponse(new Uint8Array(520), length));
  }
});

test('reject wrong report ID, command, reserved fields, chunks and declared length', () => {
  for (let index = 0; index < 8; index++) {
    const report = bytes(fixture.cycles[0].response);
    report[index] ^= 1;
    assert.throws(() => parseConfigurationResponse(report), /header/);
  }
});

test('reject unsupported mode, marker and brightness state', () => {
  for (const offset of [0x09, 0x0a, 0x7e, 0x7f, 0x4e]) {
    const report = bytes(fixture.cycles[0].response);
    report[8 + offset] = offset === 0x4e ? 10 : report[8 + offset] ^ 1;
    assert.throws(() => parseConfigurationResponse(report));
  }
  assert.throws(() => encodeNeonStreamBrightness(new Uint8Array(127), 8));
});

test('brightness bounds and preservation across every supported offline value', () => {
  const config = parseConfigurationResponse(bytes(fixture.cycles[0].response));
  for (const value of [-1, 10, 256, 1.5, NaN, Infinity, '8', null]) {
    assert.throws(() => encodeNeonStreamBrightness(config, value));
  }
  for (let value = 0; value <= 9; value++) {
    const encoded = encodeNeonStreamBrightness(config, value);
    for (let index = 0; index < 128; index++) {
      assert.equal(encoded[8 + index], index === 0x4e ? value : config[index]);
    }
  }
});

test('decoded state and newly encoded queries do not alias inputs or each other', () => {
  const response = bytes(fixture.cycles[0].response);
  const config = parseConfigurationResponse(response);
  config[0] ^= 1;
  assert.equal(response[8], fixture.cycles[0].response[8]);
  const query = encodeConfigurationQuery();
  query[0] = 0;
  assert.equal(encodeConfigurationQuery()[0], 6);
});
