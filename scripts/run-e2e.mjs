import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const preview = spawn(
  process.execPath,
  [
    resolve(root, 'node_modules/vite/bin/vite.js'),
    'preview',
    'apps/web',
    '--host',
    '127.0.0.1',
    '--port',
    '4173',
    '--strictPort',
  ],
  { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true },
);

let stopping = false;

async function stopPreview() {
  if (stopping || preview.exitCode !== null) return;
  stopping = true;
  preview.kill('SIGTERM');
  await Promise.race([
    once(preview, 'exit'),
    new Promise((resolveWait) => setTimeout(resolveWait, 2000)),
  ]);
  if (preview.exitCode === null) preview.kill('SIGKILL');
}

async function waitForPreview() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (preview.exitCode !== null)
      throw new Error(`Vite preview exited with code ${preview.exitCode}.`);
    try {
      const response = await fetch('http://127.0.0.1:4173/');
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 125));
  }
  throw new Error('Vite preview did not become ready within 10 seconds.');
}

try {
  await waitForPreview();
  const playwright = spawn(
    process.execPath,
    [resolve(root, 'node_modules/@playwright/test/cli.js'), 'test'],
    { cwd: root, stdio: 'inherit', windowsHide: true, env: process.env },
  );
  const [code] = await once(playwright, 'exit');
  process.exitCode = typeof code === 'number' ? code : 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'End-to-end runner failed.');
  process.exitCode = 1;
} finally {
  await stopPreview();
}
