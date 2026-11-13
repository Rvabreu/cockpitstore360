import express from 'express'
import path from 'node:path'
import { getAllProducts, getOrderWithEvents, advanceOrderStep, seedDatabase } from './db.ts'
import { normalizeOrderId } from '../services/storeService.ts'

const NOT_FOUND_MESSAGE = 'Pedido não localizado neste ambiente de demonstração.'

export function createApiRouter() {
  const router = express.Router()

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
      const order = getOrderWithEvents(normalizeOrderId(req.params.id))
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
      const order = advanceOrderStep(normalizeOrderId(req.params.id))
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
  router.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof URIError) {
      res.status(400).json({ error: 'Número do pedido inválido.' })
      return
    }
    next(err)
  })

  return router
}

export function startStandaloneServer(port = 5000) {
  const app = express()
  app.use(express.json())
  app.use('/api', createApiRouter())

  const clientDist = path.resolve(process.cwd(), 'dist/client')
  app.use(express.static(clientDist))

  app.listen(port, () => {
    console.log(`Standalone backend API running on http://localhost:${port}`)
  })

  return app
}
