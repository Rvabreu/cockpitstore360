import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  // Cast avoids a type clash between the top-level vite and vitest's nested vite.
  plugins: [viteReact()] as never,
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
})
