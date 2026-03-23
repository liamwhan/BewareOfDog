import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        },
        output: {
          entryFileNames: '[name].js'
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        },
        output: {
          entryFileNames: '[name].cjs',
          format: 'cjs'
        }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    // Use repo-root `public/` so `public/bod.png` is the single static-asset source (not `src/renderer/public/`).
    publicDir: resolve(__dirname, 'public'),
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html')
      }
    },
    plugins: [react()]
  }
})
