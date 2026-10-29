import { build } from 'vite'

// TanStack Start builds SSR/client entries, not this separate Express API.
await build({
  configFile: false,
  build: {
    ssr: 'src/server/index.ts',
    outDir: 'dist/api',
    rollupOptions: {
      external: ['express', 'better-sqlite3'],
      output: { entryFileNames: 'index.js' },
    },
  },
})
