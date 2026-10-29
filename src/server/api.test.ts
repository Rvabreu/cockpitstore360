// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createServer, type RequestListener, type Server } from 'node:http'
import { once } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import express from 'express'
import type { Plugin, ViteDevServer } from 'vite'

const originalCwd = process.cwd()
let tmpDir: string
let db: typeof import('./db')
const servers: Server[] = []
const urls: Record<string, string> = {}

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-api-'))
  process.chdir(tmpDir)
  db = await import('./db')
  const { createApiRouter } = await import('./index')
  const { storeApiPlugin } = await import('./apiPlugin')
  const plugin = storeApiPlugin()
  for (const mode of ['vite', 'express']) {
    let listener: RequestListener
    if (mode === 'express') {
      const app = express()
      app.use('/api', createApiRouter())
      app.use((_req, res) => res.status(418).end('fallthrough'))
      listener = app
    } else {
      // Register the real plugin middleware, without starting frontend tooling.
      let middleware: ReturnType<typeof import('./index')['createApiMiddleware']>
      const configure = plugin.configureServer as Exclude<Plugin['configureServer'], undefined>
      const hook = typeof configure === 'function' ? configure : configure.handler
      hook.call({} as never, {
        middlewares: { use: (handler: typeof middleware) => { middleware = handler } },
      } as unknown as ViteDevServer)
      listener = (req, res) => middleware(req, res, () => {
        res.statusCode = 418
        res.end('fallthrough')
      })
    }
    const server = createServer(listener).listen(0, '127.0.0.1')
    await once(server, 'listening')
    servers.push(server)
    const address = server.address() as { port: number }
    urls[mode] = `http://127.0.0.1:${address.port}`
  }
})

beforeEach(() => db.seedDatabase())
afterAll(async () => {
  await Promise.all(servers.map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
    server.closeAllConnections()
  })))
  db?.getDatabase().close()
  process.chdir(originalCwd)
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe.each(['vite', 'express'])('%s real HTTP API + SQLite', (mode) => {
  async function request(route: string, method = 'GET') {
    const response = await fetch(`${urls[mode]}${route}`, { method })
    expect(response.headers.get('content-type')).toContain('application/json')
    return { status: response.status, body: await response.json() }
  }

  it('GET returns the seeded order and derived event fields', async () => {
    const { status, body } = await request('/api/orders/CS-2048?source=test')
    expect(status).toBe(200)
    expect(body).toEqual(db.getOrderWithEvents('CS-2048'))
    expect(body.currentStep).toBe(1)
    expect(body.events.map((event: { status: string }) => event.status))
      .toEqual(['done', 'current', 'pending', 'pending'])
    expect(body.events[2].displayDetail).toBe('Aguardando atualização')
  })

  it.each(['cs-2048', '%23cs-2048', '%20%23%20cs-2048%20'])('normalizes %s once', async (id) => {
    expect((await request(`/api/orders/${id}`)).body.id).toBe('CS-2048')
    const advanced = await request(`/api/orders/${id}/advance`, 'POST')
    expect(advanced.status).toBe(200)
    expect(advanced.body.currentStep).toBe(2)
  })

  it.each(['NOPE', '%2523CS-2048', '%E0%A4%A'])('returns pt-BR 404 for %s on GET and POST', async (id) => {
    const expected = { status: 404, body: { error: 'Pedido não localizado neste ambiente de demonstração.' } }
    expect(await request(`/api/orders/${id}`)).toEqual(expected)
    expect(await request(`/api/orders/${id}/advance`, 'POST')).toEqual(expected)
    expect(db.getOrderWithEvents('CS-2048')!.currentStep).toBe(1)
  })

  it('persists every advance to SQLite and GET, including a full cycle and final wrap', async () => {
    const observer = new Database(path.join(tmpDir, 'data/store.db'), { readonly: true })
    try {
      for (const step of [2, 3, 0, 1]) {
        const advanced = await request('/api/orders/CS-2048/advance', 'POST')
        expect(advanced.status).toBe(200)
        expect(advanced.body.currentStep).toBe(step)
        expect(advanced.body.events[step].status).toBe('current')
        expect(advanced.body.statusLabel).toBe(advanced.body.events[step].title)
        expect(advanced.body.events.filter((event: { status: string }) => event.status === 'done')).toHaveLength(step)
        expect(observer.prepare('SELECT current_step FROM orders WHERE id = ?').get('CS-2048'))
          .toEqual({ current_step: step })
        expect((await request('/api/orders/CS-2048')).body).toEqual(advanced.body)
      }
    } finally {
      observer.close()
    }
  })

  it('preserves products/reset endpoints and reports unknown routes/methods identically', async () => {
    expect((await request('/api/products')).body).toEqual(db.getAllProducts())
    await request('/api/orders/CS-2048/advance', 'POST')
    const reset = await request('/api/reset-seed', 'POST')
    expect(reset.body.success).toBe(true)
    expect(reset.body.order.currentStep).toBe(1)
    for (const [route, method] of [['/api/unknown', 'GET'], ['/api/orders/CS-2048', 'POST'], ['/api/orders/CS-2048/advance', 'GET']]) {
      expect(await request(route, method)).toEqual({ status: 404, body: { error: 'Endpoint não encontrado' } })
    }
    expect((await fetch(`${urls[mode]}/apiary`)).status).toBe(418)
  })
})

it('Vite and Express expose the exact same serialized responses', async () => {
  for (const [route, method] of [['/api/products', 'GET'], ['/api/orders/%20%23cs-2048%20', 'GET'], ['/api/orders/CS-2048/advance', 'POST'], ['/api/orders/missing', 'GET']]) {
    const responses = []
    for (const mode of ['vite', 'express']) {
      db.seedDatabase()
      const response = await fetch(`${urls[mode]}${route}`, { method })
      responses.push({ status: response.status, type: response.headers.get('content-type'), body: await response.text() })
    }
    expect(responses[0]).toEqual(responses[1])
  }
})
