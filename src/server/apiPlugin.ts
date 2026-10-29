import type { Plugin } from 'vite'
import { createApiMiddleware } from './index'

export function storeApiPlugin(): Plugin {
  const handleApiRequest = createApiMiddleware()

  return {
    name: 'vite-plugin-store-api',
    configureServer(server) {
      server.middlewares.use(handleApiRequest)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleApiRequest)
    },
  }
}
