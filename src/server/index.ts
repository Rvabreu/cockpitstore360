import express from 'express'
import { getAllProducts, getOrderWithEvents, advanceOrderStep, seedDatabase } from './db.ts'

const NOT_FOUND_MESSAGE = 'Pedido não localizado neste ambiente de demonstração.'

/** Express already decodes the path parameter exactly once. */
function normalizeId(raw: string): string {
  return raw.trim().replace(/^#/, '').trim().toUpperCase()
}

export function createApiRouter() {
  const router = express.Router({ caseSensitive: true, strict: true })

  // GET /api/products
  router.get('/products', (_req, res) => {
    try {
      res.json(getAllProducts())
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // GET /api/orders/:id
  router.get('/orders/:id', (req, res) => {
    try {
      const order = getOrderWithEvents(normalizeId(req.params.id))
      if (!order) {
        return res.status(404).json({ error: NOT_FOUND_MESSAGE })
      }
      res.json(order)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // POST /api/orders/:id/advance
  router.post('/orders/:id/advance', (req, res) => {
    try {
      const order = advanceOrderStep(normalizeId(req.params.id))
      if (!order) {
        return res.status(404).json({ error: NOT_FOUND_MESSAGE })
      }
      res.json(order)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // POST /api/reset-seed
  router.post('/reset-seed', (_req, res) => {
    try {
      seedDatabase()
      res.json({
        success: true,
        products: getAllProducts(),
        order: getOrderWithEvents('CS-2048'),
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint não encontrado' })
  })

  // Invalid URL encodings must also produce JSON in both transports.
  router.use((err: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status === 400 ? 400 : 500).json({
      error: err.status === 400 ? 'Identificador de pedido inválido.' : 'Erro interno no servidor',
    })
  })

  return router
}

export function createApiApp() {
  const app = express()
  app.set('case sensitive routing', true)
  app.use('/api', createApiRouter())
  return app
}
