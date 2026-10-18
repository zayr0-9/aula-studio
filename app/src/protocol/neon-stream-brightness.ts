/** Pure offline codec for the captured wired F75 Neon_stream transaction.
 * No device access, transport, retries, persistence or renderer integration.
 */
export const REPORT_LENGTH = 520;
export const CONFIG_LENGTH = 128;
export const NEON_STREAM_BRIGHTNESS_OFFSET = 0x4e;
const HEADER_LENGTH = 8;
const RESPONSE_LENGTH = HEADER_LENGTH + CONFIG_LENGTH;

function validateConfig(config: Uint8Array): void {
  if (!(config instanceof Uint8Array) || config.length !== CONFIG_LENGTH) {
    throw new Error('Expected a complete 128-byte configuration');
  }
  if (config[0x7e] !== 0x5a || config[0x7f] !== 0xa5) {
    throw new Error('Unsupported configuration marker');
  }
  // These are the observed effect/custom-mode selectors, not a universal F75 mapping.
  if (config[0x0a] !== 11 || config[0x09] !== 0) {
    throw new Error('Only the captured Neon_stream mode is supported');
  }
  if (config[NEON_STREAM_BRIGHTNESS_OFFSET] > 9) {
    throw new Error('Invalid captured brightness');
  }
}

function makeReport(command: 0x04 | 0x84): Uint8Array {
  const report = new Uint8Array(REPORT_LENGTH);
  report.set([6, command, 0, 0, 1, 0, CONFIG_LENGTH, 0]);
  return report;
}

/** The query request is a SetFeature buffer, followed by GetFeature(report ID 6).
 * This only returns bytes; it does not issue either call.
 */
export function encodeConfigurationQuery(): Uint8Array {
  return makeReport(0x84);
}

/** Decode a successful transport result, including its report ID.
 * The caller must check transport success first and supply the number of valid
 * report bytes, not USB setup/header bytes or a buffer's allocated capacity.
 * Capture has 136 bytes. Zero-padded 520-byte API buffers are also accepted.
 */
export function parseConfigurationResponse(
  report: Uint8Array,
  actualLength: number = report.length,
): Uint8Array {
  if (
    !(report instanceof Uint8Array) ||
    !Number.isInteger(actualLength) ||
    actualLength > report.length ||
    (actualLength !== RESPONSE_LENGTH && actualLength !== REPORT_LENGTH)
  ) {
    throw new Error('Incomplete or unsupported response length');
  }
  const expectedHeader = [6, 0x84, 0, 0, 1, 0, CONFIG_LENGTH, 0];
  if (expectedHeader.some((value, index) => report[index] !== value)) {
    throw new Error('Unexpected response header, command or chunk');
  }
  if (report.subarray(RESPONSE_LENGTH, actualLength).some((value) => value !== 0)) {
    throw new Error('Unexpected response padding');
  }
  const config = report.slice(HEADER_LENGTH, RESPONSE_LENGTH);
  validateConfig(config);
  return config;
}

export function readNeonStreamBrightness(config: Uint8Array): number {
  validateConfig(config);
  return config[NEON_STREAM_BRIGHTNESS_OFFSET];
}

/** Preserve every configuration byte except this effect's brightness slot.
 * 0..9 comes from the installed configuration; only 8 and 9 were live-captured.
 * Does not reproduce the official Save's separate palette resend.
 */
export function encodeNeonStreamBrightness(config: Uint8Array, brightness: number): Uint8Array {
  validateConfig(config);
  if (!Number.isInteger(brightness) || brightness < 0 || brightness > 9) {
    throw new Error('Brightness must be an integer from 0 through 9');
  }
  const report = makeReport(0x04);
  report.set(config, HEADER_LENGTH);
  report[HEADER_LENGTH + NEON_STREAM_BRIGHTNESS_OFFSET] = brightness;
  return report;
}
