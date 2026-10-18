import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import {
  encodeConfigurationQuery,
  parseConfigurationResponse,
  readNeonStreamBrightness,
} from '../src/protocol/neon-stream-brightness.ts';
const evidence = JSON.parse(
  (
    await readFile(
      new URL('../../docs/evidence/configuration-query-once.json', import.meta.url),
      'utf8',
    )
  ).replace(/^\uFEFF/, ''),
);
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/neon-stream-brightness.json', import.meta.url), 'utf8'),
);
assert.equal(evidence.setFeatureCalls, 1);
assert.equal(evidence.getFeatureCalls, 1);
assert.deepEqual(Uint8Array.from(evidence.query), encodeConfigurationQuery());
const config = parseConfigurationResponse(Uint8Array.from(evidence.response));
const baseline = Uint8Array.from(fixture.cycles[1].write.slice(8, 136));
const differences = [...config.keys()]
  .filter((index) => config[index] !== baseline[index])
  .map((index) => ({ offset: index, baseline: baseline[index], observed: config[index] }));
console.log(
  JSON.stringify({
    queryMatchesCapture: true,
    responseValidated: true,
    brightness: readNeonStreamBrightness(config),
    baselineDifferences: differences,
    actualTransferLengthKnown: evidence.actualTransferLengthKnown,
    configurationWriteSent: false,
  }),
);
assert.deepEqual(differences, [], 'Live configuration differs from restored captured baseline');
