import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
const root = 'D:/Projects/aula/docs';
const files = await readdir(root);
const errors = [];
let markdown = 0, json = 0;
for (const name of files.filter(x => x.endsWith('.md'))) {
  markdown++;
  const path = resolve(root, name);
  const text = (await readFile(path, 'utf8')).replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const link = match[1];
    if (/^(?:https?:|file:|#)/.test(link)) continue;
    try { await access(resolve(dirname(path), link)); } catch { errors.push(`${name}: ${link}`); }
  }
}
for (const name of (await readdir(resolve(root, 'evidence'))).filter(x => x.endsWith('.json'))) {
  JSON.parse(await readFile(resolve(root, 'evidence', name), 'utf8'));
  json++;
}
console.log(JSON.stringify({ markdown, json, brokenLinks: errors }));
if (errors.length) process.exitCode = 1;
