import { defineConfig, type Plugin } from 'vitest/config';
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// GitHub Pages serves a project site under /<repo>/. The workflow sets
// VITE_BASE to that path; local dev keeps "/".
const base = process.env.VITE_BASE ?? '/';

// GitHub Pages has no server-side routing: a deep link like /tracks 404s. Copy
// the built index.html to 404.html so Pages serves the SPA for any path.
function spaFallback(outDir = 'dist'): Plugin {
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    closeBundle() {
      const index = resolve(outDir, 'index.html');
      if (existsSync(index)) copyFileSync(index, resolve(outDir, '404.html'));
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), spaFallback()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
