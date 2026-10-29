import express from 'express'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { getAllProducts, getOrderWithEvents, advanceOrderStep, seedDatabase } from './db'

const NOT_FOUND_MESSAGE = 'Pedido não localizado neste ambiente de demonstração.'

/** Normalize a path order id: decode, strip leading '#', trim, uppercase. */
function normalizeId(raw: string): string {
  let value = raw
  try {
    value = decodeURIComponent(raw)
  } catch {
    value = raw
  }
  return value.trim().replace(/^#/, '').trim().toUpperCase()
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

/** Shared raw-path middleware: decode IDs exactly once in both Vite and Express. */
export function createApiMiddleware(basePath = '/api') {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname
    if (basePath && pathname !== basePath && !pathname.startsWith(`${basePath}/`)) {
      return next()
    }
    const route = pathname.slice(basePath.length)
    const method = req.method?.toUpperCase() || 'GET'

    try {
      if (route === '/products' && method === 'GET') {
        return sendJson(res, 200, getAllProducts())
      }

      const advanceMatch = route.match(/^\/orders\/([^/]+)\/advance$/)
      const orderMatch = route.match(/^\/orders\/([^/]+)$/)
      if ((advanceMatch && method === 'POST') || (orderMatch && method === 'GET')) {
        const order = advanceMatch
          ? advanceOrderStep(normalizeId(advanceMatch[1]))
          : getOrderWithEvents(normalizeId(orderMatch![1]))
        return order
          ? sendJson(res, 200, order)
          : sendJson(res, 404, { error: NOT_FOUND_MESSAGE })
      }

      if (route === '/reset-seed' && method === 'POST') {
        seedDatabase()
        return sendJson(res, 200, {
          success: true,
          products: getAllProducts(),
          order: getOrderWithEvents('CS-2048'),
        })
      }

      return sendJson(res, 404, { error: 'Endpoint não encontrado' })
    } catch (err: unknown) {
      return sendJson(res, 500, {
        error: err instanceof Error ? err.message : 'Erro interno no servidor',
      })
    }
  }
}

export function createApiRouter() {
  const router = express.Router()
  // Express strips the /api mount prefix but leaves encoded path segments intact.
  router.use(createApiMiddleware(''))
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
