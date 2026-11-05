import react from '@vitejs/plugin-react';
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const repositoryFile = (name: string) => fileURLToPath(new URL(`../../${name}`, import.meta.url));

const devStyleCsp = () => ({
  name: 'reconforge-dev-style-csp',
  transformIndexHtml(html: string, context: { server?: unknown }) {
    if (!context.server) return html;
    return html.replace("style-src 'self';", "style-src 'self' 'unsafe-inline';");
  },
});

const releaseNotices = () => ({
  name: 'reconforge-release-notices',
  async closeBundle() {
    const output = fileURLToPath(new URL('./dist', import.meta.url));
    await mkdir(output, { recursive: true });
    await Promise.all([
      copyFile(repositoryFile('LICENSE'), `${output}/LICENSE.txt`),
      copyFile(repositoryFile('THIRD_PARTY_NOTICES.md'), `${output}/THIRD_PARTY_NOTICES.txt`),
    ]);
  },
});

export default defineConfig({
  plugins: [devStyleCsp(), react(), releaseNotices()],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          icons: ['lucide-react'],
          engine: ['@reconforge/core', '@reconforge/templates', 'tldts'],
        },
      },
    },
  },
});
