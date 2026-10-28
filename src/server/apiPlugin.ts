import express from 'express'
import type { Plugin } from 'vite'
import { createApiRouter } from './index.ts'

export function storeApiPlugin(): Plugin {
  // Mount the same Express router in Vite's Connect stack as in production.
  const api = express()
  api.use(express.json())
  api.use('/api', createApiRouter())

  return {
    name: 'vite-plugin-store-api',
    configureServer(server) {
      server.middlewares.use(api)
    },
    configurePreviewServer(server) {
      server.middlewares.use(api)
    },
  }
}
