// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createServer, type ViteDevServer } from 'vite'
import type { OrderWithEvents } from '../types/store'

let tmpDir: string
let db: typeof import('./db.ts')
let vite: ViteDevServer
let expressServer: Server
const urls: Record<string, string> = {}
const originalDbPath = process.env.STORE_DB_PATH

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-store-http-'))
  process.env.STORE_DB_PATH = path.join(tmpDir, 'store.db')
  db = await import('./db.ts')
  const { createApiApp } = await import('./index.ts')
  const { storeApiPlugin } = await import('./apiPlugin.ts')
  expressServer = await new Promise<Server>((resolve) => {
    const server = createApiApp().listen(0, '127.0.0.1', () => resolve(server))
  })
  urls.Express = `http://127.0.0.1:${(expressServer.address() as AddressInfo).port}`
  vite = await createServer({
    configFile: false,
    root: tmpDir,
    plugins: [storeApiPlugin()],
    server: { port: 0, host: '127.0.0.1' },
    appType: 'custom',
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  await vite.listen()
  urls.Vite = `http://127.0.0.1:${(vite.httpServer!.address() as AddressInfo).port}`
})

beforeEach(() => db.seedDatabase())

afterAll(async () => {
  await vite?.close()
  if (expressServer) {
    await new Promise<void>((resolve, reject) => {
      expressServer.close((error) => error ? reject(error) : resolve())
      expressServer.closeAllConnections()
    })
  }
  db?.getDatabase().close()
  if (originalDbPath === undefined) delete process.env.STORE_DB_PATH
  else process.env.STORE_DB_PATH = originalDbPath
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe.each(['Vite', 'Express'])('%s HTTP + SQLite', (transport) => {
  async function request(endpoint: string, method = 'GET') {
    const response = await fetch(`${urls[transport]}${endpoint}`, { method })
    expect(response.headers.get('content-type')).toContain('application/json')
    return { status: response.status, body: await response.json() }
  }

  it.each(['CS-2048', 'cs-2048', '%23cs-2048', '%20%23cs-2048%20', '%23%20cs-2048'])('normalizes %s once and returns derived events', async (id) => {
    const result = await request(`/api/orders/${id}?source=test`)
    expect(result.status).toBe(200)
    expect(result.body).toEqual(db.getOrderWithEvents('CS-2048'))
    expect(result.body.events.map((event: OrderWithEvents['events'][number]) => event.status)).toEqual(['done', 'current', 'pending', 'pending'])
    expect(result.body.events[2].displayDetail).toBe('Aguardando atualização')
  })

  it('persists every advance and wraps from delivered to confirmed across transports', async () => {
    const otherTransport = transport === 'Vite' ? 'Express' : 'Vite'
    for (const currentStep of [2, 3, 0, 1]) {
      const advanced = await request('/api/orders/%20%23cs-2048%20/advance', 'POST')
      expect(advanced.status).toBe(200)
      expect(advanced.body.currentStep).toBe(currentStep)
      expect(advanced.body.events.filter((event: OrderWithEvents['events'][number]) => event.status === 'current')).toHaveLength(1)
      const persisted = await fetch(`${urls[otherTransport]}/api/orders/CS-2048`)
      expect(await persisted.json()).toEqual(advanced.body)
      expect(db.getOrderWithEvents('CS-2048')).toEqual(advanced.body)
    }
  })

  it.each(['GET', 'POST'])('returns the pt-BR 404 without mutating data for missing order (%s)', async (method) => {
    const before = db.getOrderWithEvents('CS-2048')
    const result = await request(`/api/orders/NOPE${method === 'POST' ? '/advance' : ''}`, method)
    expect(result).toEqual({ status: 404, body: { error: 'Pedido não localizado neste ambiente de demonstração.' } })
    expect(db.getOrderWithEvents('CS-2048')).toEqual(before)
  })

  it('does not double-decode an encoded percent and rejects malformed encoding consistently', async () => {
    expect((await request('/api/orders/%2523CS-2048')).status).toBe(404)
    expect(await request('/api/orders/%ZZ')).toEqual({ status: 400, body: { error: 'Identificador de pedido inválido.' } })
  })

  it('returns JSON 404 for unknown API endpoints and unsupported methods', async () => {
    for (const [endpoint, method] of [['/api', 'GET'], ['/api/unknown', 'GET'], ['/api/orders/CS-2048', 'POST'], ['/api/orders/CS-2048/advance', 'GET']]) {
      expect(await request(endpoint, method)).toEqual({ status: 404, body: { error: 'Endpoint não encontrado' } })
    }
  })

  it('serves the product order and resets persisted state', async () => {
    const products = await request('/api/products')
    expect(products.status).toBe(200)
    expect(products.body.map((product: { id: string }) => product.id)).toEqual(['prod-orbit', 'prod-pulse', 'prod-wave'])
    await request('/api/orders/CS-2048/advance', 'POST')
    const reset = await request('/api/reset-seed', 'POST')
    expect(reset.status).toBe(200)
    expect(reset.body).toEqual({ success: true, products: products.body, order: db.getOrderWithEvents('CS-2048') })
    expect(reset.body.order.currentStep).toBe(1)
  })
})
