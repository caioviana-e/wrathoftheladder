import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  // O Phaser (carregado sob demanda na tela de combate) é grande por natureza.
  build: { chunkSizeWarningLimit: 1600 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
