import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve(import.meta.dirname, '../apps/web/dist');
const required = ['index.html', 'LICENSE.txt', 'THIRD_PARTY_NOTICES.txt'];
const forbiddenText = [
  'APP_ACCESS_TOKEN',
  'BRAVE_SEARCH_API_KEY',
  'replace-with-a-long-random-token',
  'test-owner-token-that-is-longer-than-32-chars',
  'server-side-key-value',
  'C:\\Users\\',
];

const files = await walk(output);
for (const name of required) {
  if (!files.some((file) => file === resolve(output, name)))
    throw new Error(`Release artifact is missing ${name}.`);
}
if (files.some((file) => file.endsWith('.map')))
  throw new Error('Production source maps must not be published.');

for (const file of files) {
  if ((await stat(file)).size > 5 * 1024 * 1024)
    throw new Error(`Unexpectedly large planner artifact: ${file}`);
  if (!/\.(?:html|js|css|txt)$/u.test(file)) continue;
  const contents = await readFile(file, 'utf8');
  for (const marker of forbiddenText) {
    if (contents.includes(marker))
      throw new Error(`Forbidden release marker in ${file}: ${marker}`);
  }
}

const index = await readFile(resolve(output, 'index.html'), 'utf8');
if (!index.includes('/ReconForge-Web/'))
  throw new Error('Pages artifact was not built with the /ReconForge-Web/ base path.');

console.log(`Verified ${files.length} release files: notices present, no maps or secret markers.`);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    }),
  );
  return nested.flat();
}
