import type { Plugin } from 'vite'
import { createApiApp } from './index.ts'

/** Use the production router directly, including decoding and error handling. */
export function storeApiPlugin(): Plugin {
  const app = createApiApp()
  return {
    name: 'vite-plugin-store-api',
    configureServer(server) {
      server.middlewares.use(app)
    },
    configurePreviewServer(server) {
      server.middlewares.use(app)
    },
  }
}
