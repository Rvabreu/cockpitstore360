// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import express from 'express'
import { createServer, type Server, type RequestListener } from 'node:http'
import { once } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const originalCwd = process.cwd()
let tmpDir: string
let db: typeof import('./db')
const servers: Server[] = []
const urls: string[] = []

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-api-'))
  process.chdir(tmpDir)
  db = await import('./db')
  const { createApiRouter } = await import('./index')
  const { storeApiPlugin } = await import('./apiPlugin')
  const app = express()
  app.use('/api', createApiRouter())
  const handlers: RequestListener[] = [app]
  for (const key of ['configureServer', 'configurePreviewServer'] as const) {
    const hook = storeApiPlugin()[key]
    if (typeof hook !== 'function') throw new Error(`Missing ${key} hook`)
    hook.call({} as never, {
      middlewares: { use: (handler: RequestListener) => handlers.push(handler) },
    } as never)
  }
  for (const handler of handlers) {
    const server = createServer((req, res) => {
      // The Vite middleware receives Connect's next callback.
      ;(handler as Function)(req, res, () => { res.statusCode = 404; res.end() })
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    servers.push(server)
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing server port')
    urls.push(`http://127.0.0.1:${address.port}`)
  }
})

afterAll(async () => {
  await Promise.all(servers.map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })))
  db?.getDatabase().close()
  process.chdir(originalCwd)
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe.each(['Express', 'Vite dev', 'Vite preview'])('%s HTTP API', (_name) => {
  const index = ['Express', 'Vite dev', 'Vite preview'].indexOf(_name)
  const request = async (id: string, method = 'GET') => {
    const response = await fetch(`${urls[index]}/api/orders/${id}${method === 'POST' ? '/advance' : ''}`, { method })
    return { status: response.status, body: await response.json() }
  }

  it.each(['CS-2048', 'cs-2048', '%23cs-2048', '%20%23cs-2048%20', '%43S-2048'])('normalizes %s once for GET and POST', async (id) => {
    const before = db.getOrderWithEvents('CS-2048')!
    expect(await request(id)).toEqual({ status: 200, body: before })
    const advanced = await request(id, 'POST')
    expect(advanced.status).toBe(200)
    expect(advanced.body.currentStep).toBe((before.currentStep + 1) % 4)
    expect(advanced.body).toEqual(db.getOrderWithEvents('CS-2048'))
    expect(await request('CS-2048')).toEqual(advanced)
  })

  it.each(['NOPE', '%2543S-2048', '%2523CS-2048', 'CS-2048%25'])('returns identical pt-BR 404 for literal/unknown %s', async (id) => {
    const before = db.getOrderWithEvents('CS-2048')
    for (const method of ['GET', 'POST']) {
      expect(await request(id, method)).toEqual({
        status: 404, body: { error: 'Pedido não localizado neste ambiente de demonstração.' },
      })
    }
    expect(db.getOrderWithEvents('CS-2048')).toEqual(before)
  })

  it('rejects malformed percent encoding with the same JSON 400', async () => {
    for (const method of ['GET', 'POST']) {
      expect(await request('%ZZ', method)).toEqual({ status: 400, body: { error: 'Número do pedido inválido.' } })
    }
  })

  it('wraps after delivery and persists the derived timeline', async () => {
    db.getDatabase().prepare('UPDATE orders SET current_step = 3 WHERE id = ?').run('CS-2048')
    const result = await request('CS-2048', 'POST')
    expect(result.status).toBe(200)
    expect(result.body.currentStep).toBe(0)
    expect(result.body.statusLabel).toBe('Pedido confirmado')
    expect(result.body.events.map((event: { status: string }) => event.status)).toEqual(['current', 'pending', 'pending', 'pending'])
    expect(await request('CS-2048')).toEqual(result)
  })

  it('returns JSON 404 for unknown endpoints', async () => {
    const response = await fetch(`${urls[index]}/api/missing`)
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Endpoint não encontrado' })
  })
})
