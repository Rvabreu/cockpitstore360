import express from 'express'
import type { ErrorRequestHandler } from 'express'
import path from 'node:path'
import { getAllProducts, getOrderWithEvents, advanceOrderStep, seedDatabase } from './db.ts'
import { loadAuthConfig, type AuthConfig } from './auth/config.ts'
import { createAuthStore, type AuthStore } from './auth/db.ts'
import { createAuthRouter } from './auth/router.ts'

const NOT_FOUND_MESSAGE = 'Pedido não encontrado'

/** Keep parser, URI and internal failures JSON-only and safe for API clients. */
export const handleServerError: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error)

  const status = error?.status
  if (status === 413) {
    return res.status(413).json({ error: 'Corpo da requisição muito grande' })
  }
  if (status === 415) {
    return res.status(415).json({ error: 'Formato da requisição não suportado' })
  }
  if (status === 400) {
    return res.status(400).json({
      error: error?.type === 'entity.parse.failed' ? 'JSON inválido' : 'Requisição inválida',
    })
  }
  res.status(500).json({ error: 'Erro interno no servidor' })
}

/** Express has already decoded the path parameter; normalize it exactly once. */
function normalizeId(raw: string): string {
  const value = raw.trim().replace(/^#/, '').trim().toUpperCase()
  return /^\d+$/.test(value) ? `CS-${value}` : value
}

export function createApiRouter(options: { mode?: AuthConfig['mode']; env?: Record<string, string | undefined>; store?: AuthStore; now?: () => number } = {}) {
  const router = express.Router()
  const config = loadAuthConfig({ mode: options.mode || 'development', env: options.env })
  // Auth has its own parser and limits, and does not share the resettable tracking database.
  let auth: ReturnType<typeof createAuthRouter> | undefined
  router.use('/auth', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    auth ??= createAuthRouter({ config, store: options.store || createAuthStore({ path: options.env?.AUTH_DB_PATH || process.env.AUTH_DB_PATH, now: options.now }), now: options.now })
    auth(req, res, next)
  })
  router.use(express.json())

  // GET /api/products
  router.get('/products', (_req, res) => {
    res.json(getAllProducts())
  })

  // GET /api/orders/:id
  router.get('/orders/:id', (req, res) => {
    const order = getOrderWithEvents(normalizeId(req.params.id))
    if (!order) {
      return res.status(404).json({ error: NOT_FOUND_MESSAGE })
    }
    res.json(order)
  })

  // POST /api/orders/:id/advance
  router.post('/orders/:id/advance', (req, res) => {
    const order = advanceOrderStep(normalizeId(req.params.id))
    if (!order) {
      return res.status(404).json({ error: NOT_FOUND_MESSAGE })
    }
    res.json(order)
  })

  // POST /api/reset-seed
  router.post('/reset-seed', (_req, res) => {
    seedDatabase()
    res.json({
      success: true,
      products: getAllProducts(),
      order: getOrderWithEvents('CS-2048'),
    })
  })

  router.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint não encontrado' })
  })
  router.use(handleServerError)

  return router
}

export function startStandaloneServer(port = 5000) {
  const app = express()
  app.use('/api', createApiRouter())

  const clientDist = path.resolve(process.cwd(), 'dist/client')
  app.use(express.static(clientDist))

  app.listen(port, () => {
    console.log(`Standalone backend API running on http://localhost:${port}`)
  })

  return app
}
