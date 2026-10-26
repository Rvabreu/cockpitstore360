import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { getAllProducts, getOrderWithEvents, advanceOrderStep, seedDatabase } from './db'

const NOT_FOUND_MESSAGE = 'Pedido não localizado neste ambiente de demonstração.'

function sendJson(res: ServerResponse, status: number, data: any) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

/** Normalize a path order id: decode, strip leading '#', trim, uppercase. */
function normalizeId(raw: string): string {
  let value = raw
  try {
    value = decodeURIComponent(raw)
  } catch {
    value = raw
  }
  return value.replace(/^#/, '').trim().toUpperCase()
}

export function storeApiPlugin(): Plugin {
  const handleApiRequest = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url ? new URL(req.url, 'http://localhost') : null
    if (!url || !url.pathname.startsWith('/api')) {
      return next()
    }

    const pathname = url.pathname
    const method = req.method?.toUpperCase() || 'GET'

    try {
      // GET /api/products
      if (/^\/api\/products$/.test(pathname) && method === 'GET') {
        return sendJson(res, 200, getAllProducts())
      }

      // POST /api/orders/:id/advance (match before the bare :id route)
      const advanceMatch = pathname.match(/^\/api\/orders\/([^\/]+)\/advance$/)
      if (advanceMatch && method === 'POST') {
        const id = normalizeId(advanceMatch[1])
        const order = advanceOrderStep(id)
        if (!order) {
          return sendJson(res, 404, { error: NOT_FOUND_MESSAGE })
        }
        return sendJson(res, 200, order)
      }

      // GET /api/orders/:id
      const orderMatch = pathname.match(/^\/api\/orders\/([^\/]+)$/)
      if (orderMatch && method === 'GET') {
        const id = normalizeId(orderMatch[1])
        const order = getOrderWithEvents(id)
        if (!order) {
          return sendJson(res, 404, { error: NOT_FOUND_MESSAGE })
        }
        return sendJson(res, 200, order)
      }

      // POST /api/reset-seed
      if (/^\/api\/reset-seed$/.test(pathname) && method === 'POST') {
        seedDatabase()
        return sendJson(res, 200, {
          success: true,
          products: getAllProducts(),
          order: getOrderWithEvents('CS-2048'),
        })
      }

      // If no route matched in /api
      return sendJson(res, 404, { error: 'Endpoint não encontrado' })
    } catch (err: any) {
      console.error('API Error:', err)
      return sendJson(res, 500, { error: err.message || 'Erro interno no servidor' })
    }
  }

  return {
    name: 'vite-plugin-store-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        handleApiRequest(req, res, next)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        handleApiRequest(req, res, next)
      })
    },
  }
}
