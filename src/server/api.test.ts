// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import express from 'express'
import Database from 'better-sqlite3'
import type { ViteDevServer } from 'vite'
import type { OrderWithEvents } from '../types/store'

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void
type Api = { name: string; url: string }

const apis: Api[] = [
  { name: 'Vite dev plugin', url: '' },
  { name: 'Express production router', url: '' },
]
const servers: Server[] = []
const notFound = { error: 'Pedido não localizado neste ambiente de demonstração.' }
const eventTitles = ['Pedido confirmado', 'Em separação', 'Em transporte', 'Entregue']
let tmpDir: string
let db: typeof import('./db')
let persisted: InstanceType<typeof Database>

async function listen(server: Server): Promise<string> {
  servers.push(server)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected an ephemeral TCP server')
  return `http://127.0.0.1:${address.port}`
}

async function request(api: Api, pathname: string, method = 'GET') {
  const response = await fetch(`${api.url}${pathname}`, { method })
  expect(response.headers.get('content-type')).toMatch(/^application\/json\b/)
  return { status: response.status, body: await response.json() as OrderWithEvents }
}

function expectTimeline(order: OrderWithEvents, step: number) {
  expect(order.id).toBe('CS-2048')
  expect(order.currentStep).toBe(step)
  expect(order.statusLabel).toBe(eventTitles[step])
  expect(order.events).toHaveLength(4)
  expect(order.events.map((event) => event.title)).toEqual(eventTitles)
  expect(order.events.map((event) => event.stepIndex)).toEqual([0, 1, 2, 3])
  expect(order.events.map((event) => event.status)).toEqual(
    [0, 1, 2, 3].map((index) => index < step ? 'done' : index === step ? 'current' : 'pending'),
  )
  for (const event of order.events) {
    expect(event.displayDetail).toBe(event.stepIndex <= step ? event.detail : 'Aguardando atualização')
  }
}

function snapshot() {
  return {
    orders: persisted.prepare('SELECT * FROM orders ORDER BY id').all(),
    events: persisted.prepare('SELECT * FROM order_events ORDER BY id').all(),
    products: persisted.prepare('SELECT * FROM products ORDER BY id').all(),
  }
}

beforeAll(async () => {
  // Match db.test.ts: resolve the singleton's SQLite path in an isolated cwd.
  const originalCwd = process.cwd()
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-store-api-'))
  let storeApiPlugin: typeof import('./apiPlugin')['storeApiPlugin']
  let createApiRouter: typeof import('./index')['createApiRouter']
  try {
    process.chdir(tmpDir)
    db = await import('./db')
    db.getDatabase()
    ;({ storeApiPlugin } = await import('./apiPlugin'))
    ;({ createApiRouter } = await import('./index'))
  } finally {
    process.chdir(originalCwd)
  }

  // A second, read-only connection verifies committed state, not a JS cache.
  persisted = new Database(path.join(tmpDir, 'data', 'store.db'), { readonly: true })
  let middleware: Middleware | undefined
  const configureServer = storeApiPlugin().configureServer
  if (typeof configureServer !== 'function') throw new Error('Missing configureServer hook')
  configureServer.call({} as never, {
    middlewares: { use(handler: Middleware) { middleware = handler } },
  } as unknown as ViteDevServer)
  const handler = middleware
  if (!handler) throw new Error('Plugin did not register its HTTP middleware')
  apis[0].url = await listen(createServer((req, res) => {
    handler(req, res, () => {
      res.statusCode = 404
      res.end('Non-API fallback')
    })
  }))

  const app = express()
  app.use(express.json())
  app.use('/api', createApiRouter())
  apis[1].url = await listen(createServer(app))
})

beforeEach(() => db.seedDatabase())

afterAll(async () => {
  try {
    await Promise.all(servers.map((server) => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
      server.closeAllConnections()
    })))
  } finally {
    persisted?.close()
    db?.getDatabase().close()
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

describe.each(apis)('$name: order HTTP contract', (api) => {
  it('GET returns CS-2048 with the four ordered timeline stages in JSON', async () => {
    const result = await request(api, '/api/orders/CS-2048')
    expect(result.status).toBe(200)
    expectTimeline(result.body, 1)
    expect(result.body.events.map((event) => event.detail)).toEqual([
      '19 out · 10h12', '20 out · 08h35', '21 out · 14h20', 'Entrega confirmada',
    ])
  })

  it.each(['%23cs-2048', '%23cs-2048%20'])('GET normalizes encoded ID %s', async (id) => {
    const canonical = await request(api, '/api/orders/CS-2048')
    expect(await request(api, `/api/orders/${id}`)).toEqual(canonical)
  })

  it('POST normalizes an encoded lowercase #ID and persists its advance', async () => {
    const advanced = await request(api, '/api/orders/%23cs-2048/advance', 'POST')
    expect(advanced.status).toBe(200)
    expectTimeline(advanced.body, 2)
    expect(persisted.prepare('SELECT current_step FROM orders WHERE id = ?').get('CS-2048'))
      .toEqual({ current_step: 2 })
    expect(await request(api, '/api/orders/CS-2048')).toEqual(advanced)
  })

  it('GET an unknown order returns the Portuguese 404 without changing SQLite', async () => {
    const before = snapshot()
    const result = await request(api, '/api/orders/%23missing-order')
    expect(result.status).toBe(404)
    expect(result.body).toEqual(notFound)
    expect(snapshot()).toEqual(before)
  })

  it('POST advance of an unknown order returns Portuguese 404 and changes no rows', async () => {
    const before = snapshot()
    const existing = await request(api, '/api/orders/CS-2048')
    const result = await request(api, '/api/orders/%23missing-order/advance', 'POST')
    expect(result.status).toBe(404)
    expect(result.body).toEqual(notFound)
    expect(snapshot()).toEqual(before)
    expect(await request(api, '/api/orders/CS-2048')).toEqual(existing)
  })

  it('POST advances 1 → 2 → 3 → 0 → 1, persisting every stage and final wrap', async () => {
    for (const step of [2, 3, 0, 1]) {
      const result = await request(api, '/api/orders/CS-2048/advance', 'POST')
      expect(result.status).toBe(200)
      expectTimeline(result.body, step)
      expect(persisted.prepare('SELECT current_step FROM orders WHERE id = ?').get('CS-2048'))
        .toEqual({ current_step: step })
      expect(await request(api, '/api/orders/CS-2048')).toEqual(result)
    }
  })

  it.each([
    ['GET', '/api/not-an-endpoint'],
    ['POST', '/api/orders/CS-2048/unknown'],
    ['PUT', '/api/orders/CS-2048'],
  ])('%s %s returns the JSON API 404 instead of an HTML fallback', async (method, pathname) => {
    const before = snapshot()
    const result = await request(api, pathname, method)
    expect(result.status).toBe(404)
    expect(result.body).toEqual({ error: 'Endpoint não encontrado' })
    expect(snapshot()).toEqual(before)
  })
})

it('dev and prod read each other’s persisted advances with identical JSON throughout the wrap', async () => {
  expect(await request(apis[0], '/api/orders/CS-2048'))
    .toEqual(await request(apis[1], '/api/orders/CS-2048'))
  for (const [index, step] of [2, 3, 0, 1].entries()) {
    const advanced = await request(apis[index % 2], '/api/orders/CS-2048/advance', 'POST')
    expect(advanced.status).toBe(200)
    expectTimeline(advanced.body, step)
    expect(persisted.prepare('SELECT current_step FROM orders WHERE id = ?').get('CS-2048'))
      .toEqual({ current_step: step })
    for (const api of apis) {
      expect(await request(api, '/api/orders/%23cs-2048')).toEqual(advanced)
    }
  }
})
