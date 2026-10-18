/** Expose only known native validation messages, never raw PowerShell stderr/paths. */
const safeReasons = [
  'Official application is running; aborting.',
  'Expected exactly one target collection and complete enumeration.',
  'Unexpected device identity.',
  'Unexpected HID capabilities.',
  'Unexpected feature report ID.',
  'Invalid observed palette tail.',
  'Invalid palette header.',
  'Color requires ordinary Fixed_on mode (1).',
  'Unsupported Fixed_on Colourful value.',
  'Unsupported mode/custom/markers.',
  'Invalid configuration markers.',
  'Custom mode is not supported for Studio transitions.',
  'Invalid response header.',
  'Invalid response padding.',
  'Invalid brightness.',
  'Invalid speed.',
  'Configuration readback mismatch.',
  'Palette readback mismatch.',
  'Invalid matrix length.',
  'Invalid matrix header.',
  'Invalid matrix signature.',
  'Unsupported mapping identity.',
  'Source is not an allowed ordinary entry.',
  'Matrix readback mismatch.',
  'Another brightness transaction is active.',
  'Previous transaction was interrupted; state uncertain. No operation performed.',
];

export function helperFailure(stderr: string, killed: boolean): Error {
  if (killed)
    return new Error('Native helper timed out or was terminated; device state is uncertain');
  const reason = safeReasons.find((message) => stderr.includes(message));
  if (reason) return new Error(reason);
  const api = stderr.match(
    /\b(Open filtered collection|Device attributes|Preparsed data|Configuration query|Configuration response|Palette query|Palette response|Color configuration write|Color palette write|Layer0 matrix query|Layer0 matrix response|PgUp matrix write) failed, Win32=(\d+)\b/,
  );
  if (api) return new Error(`${api[1]} failed, Win32=${api[2]}`);
  return new Error('Native helper failed; no recognized diagnostic');
}
