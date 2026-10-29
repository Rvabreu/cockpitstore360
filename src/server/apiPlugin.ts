import type { Plugin } from 'vite'
import { createApiApp } from './index.ts'

export function storeApiPlugin(): Plugin {
  // Lazily create connections only when serving, never during the build.
  return {
    name: 'vite-plugin-store-api',
    configureServer(server) { server.middlewares.use(createApiApp()) },
    configurePreviewServer(server) { server.middlewares.use(createApiApp()) },
  }
}
