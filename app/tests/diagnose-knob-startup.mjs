// Explicit bounded live diagnostic; NOT part of npm test. Blocks media keys at most 6s.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const child = spawn(
  'powershell.exe',
  [
    '-NoProfile',
    '-NonInteractive',
    '-STA',
    '-File',
    fileURLToPath(new URL('../native/knob-session.ps1', import.meta.url)),
  ],
  { stdio: 'pipe' },
);
child.stdout.on('data', (value) => process.stdout.write(`OUT ${value}`));
child.stderr.on('data', (value) => process.stdout.write(`ERR ${value}`));
child.stdin.on('error', () => undefined);
const lease = setInterval(() => {
  if (child.stdin.writable) child.stdin.write('lease\n');
}, 300);
const stop = setTimeout(() => {
  if (child.stdin.writable) child.stdin.end('stop\n');
}, 6000);
const kill = setTimeout(() => child.kill(), 10000);
child.on('close', (code, signal) => {
  clearInterval(lease);
  clearTimeout(stop);
  clearTimeout(kill);
  console.log({ code, signal });
});
