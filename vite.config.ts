import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['fs', 'path', 'os', 'crypto'],
            },
          },
        },
      },
      { entry: 'electron/preload.ts' },
    ]),
    renderer(),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})