import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
const root = 'D:/Projects/tools/OpenRGB-source-8e16de2/CalcProgrammer1-OpenRGB-8e16de2';
const names = new Set();
const unresolved = [];
const dynamic = [];
async function walk(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (/\.(cpp|h)$/.test(entry.name)) {
      const raw = await readFile(full, 'utf8');
      // Tokenize strings and comments together so comment markers in strings survive.
      const text = raw.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, token => token.startsWith('/') ? ' ' : token);
      const pattern = /\b(REGISTER_[A-Z0-9_]*DETECTOR[A-Z0-9_]*)\s*\(\s*("(?:\\.|[^"\\])*"|[^,\n)]+)/g;
      for (const match of text.matchAll(pattern)) {
        if (match[1].includes('DYNAMIC_HID')) { dynamic.push({file:full,macro:match[1],argument:match[2]}); continue; }
        if (!match[2].startsWith('"')) {
          // Macro parameter definitions are not registrations. Wooting calls are
          // separately inventoried as literals by this same scanner.
          if (match[1] === 'REGISTER_WOOTING_DETECTOR' && match[2] === 'name') continue;
          const definition = text.match(new RegExp('^\\s*#define\\s+' + match[2].trim() + '\\s+("(?:\\\\.|[^"\\\\])*")', 'm'));
          if (definition) names.add(JSON.parse(definition[1]));
          else unresolved.push({file:full,macro:match[1],argument:match[2]});
          continue;
        }
        names.add(JSON.parse(match[2]));
      }
    }
  }
}
await walk(join(root, 'Controllers'));
console.log(JSON.stringify({commit:'8e16de27858cf2be6af54a33ce003df74cb9fd3e',names:[...names].sort(),unresolved,dynamic}));
