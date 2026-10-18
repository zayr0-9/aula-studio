import { Client } from '../rea/node_modules/@modelcontextprotocol/client/dist/index.mjs';
import { StdioClientTransport } from '../rea/node_modules/@modelcontextprotocol/client/dist/stdio.mjs';
import { readFile } from 'node:fs/promises';
const transport = new StdioClientTransport({
  command: 'D:/Projects/tools/node-v24.18.0-win-x64/node.exe',
  args: ['D:/Projects/rea/scripts/rea.mjs', 'mcp'],
  env: { ...process.env, JAVA_HOME: 'D:/Projects/tools/jdk-21.0.12.1+1', GHIDRA_INSTALL_DIR: 'D:/Projects/tools/ghidra_12.1.4_PUBLIC', REA_ANALYSIS_PROVIDER: 'ghidra' },
  stderr: 'inherit',
});
const client = new Client({ name: 'aula-readonly-analysis', version: '1.0.0' }, { capabilities: {} });
const allowed = new Set(['open_binary', 'close_binary', 'search_procedures', 'search_strings', 'procedure_callers', 'procedure_callees', 'procedure_pseudo_code', 'batch_decompile', 'xrefs', 'find_xrefs_to_name', 'procedure_info', 'read_bytes']);
try {
  await client.connect(transport);
  for (const request of JSON.parse(await readFile(process.argv[2], 'utf8'))) {
    if (!allowed.has(request.name)) throw new Error(`Tool not allowed: ${request.name}`);
    const result = await client.callTool({ name: request.name, arguments: request.args ?? {} }, { timeout: 360000 });
    console.log(JSON.stringify({ name: request.name, args: request.args ?? {}, result }));
  }
} finally { await client.close(); }
