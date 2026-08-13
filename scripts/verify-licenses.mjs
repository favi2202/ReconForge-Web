import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const lock = JSON.parse(
  await readFile(resolve(import.meta.dirname, '../package-lock.json'), 'utf8'),
);
const allowed = new Set([
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC-BY-4.0',
  'ISC',
  'MIT',
  'MPL-2.0',
  'Python-2.0',
]);
const counts = new Map();
const failures = [];

for (const [path, metadata] of Object.entries(lock.packages ?? {})) {
  if (!path.includes('node_modules')) continue;
  if (metadata.link === true) continue;
  const license = metadata.license;
  if (typeof license !== 'string') {
    failures.push(`${path}: missing license metadata`);
    continue;
  }
  if (!allowed.has(license)) failures.push(`${path}: unreviewed license ${license}`);
  counts.set(license, (counts.get(license) ?? 0) + 1);
}

if (failures.length) throw new Error(`Dependency license review failed:\n${failures.join('\n')}`);
console.log(
  `Verified dependency licenses: ${[...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([license, count]) => `${license}=${count}`)
    .join(', ')}`,
);
