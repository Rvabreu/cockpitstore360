// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import type { ViteDevServer } from 'vite'
import type { OrderWithEvents, Product } from '../types/store'

const originalCwd = process.cwd()
const entrypoint = path.resolve(originalCwd, 'server.js')

async function availablePort() {
  const server = net.createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address() as net.AddressInfo
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return address.port
}

async function startProduction(cwd: string, port: number) {
  const child = spawn(process.execPath, [entrypoint], {
    cwd,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  await new Promise<void>((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`Production server did not start: ${output}`))
    }, 10_000)
    const onError = (error: Error) => { clearTimeout(timer); reject(error) }
    child.once('error', onError)
    child.once('exit', (code) => onError(new Error(`Production exited (${code}): ${output}`)))
    child.stderr.on('data', (data) => { output += data.toString() })
    child.stdout.on('data', (data) => {
      output += data.toString()
      if (output.includes('Production Server running')) {
        clearTimeout(timer)
        resolve()
      }
    })
  })
  return child
}

async function stopProduction(child: ChildProcess) {
  if (child.exitCode !== null) return
  const exited = once(child, 'exit')
  child.kill()
  await exited
}

describe.each(['Vite plugin', 'production Express'] as const)('%s HTTP API', (mode) => {
  let tmpDir: string
  let baseUrl: string
  let vite: ViteDevServer | undefined
  let child: ChildProcess | undefined
  let databaseModule: typeof import('./db') | undefined
  let port: number

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-store-http-'))
    // Both servers use a real, isolated SQLite file. A fetch-handler fixture
    // exercises the production SSR bridge without coupling API tests to a build.
    fs.mkdirSync(path.join(tmpDir, 'dist/client'), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, 'dist/server'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'dist/client/fixture.txt'), 'static fixture')
    fs.writeFileSync(path.join(tmpDir, 'dist/server/server.js'), `
      export default { async fetch(request) {
        if (new URL(request.url).pathname === '/fail') throw new Error('secret SSR failure');
        const headers = new Headers({ 'content-type': 'text/html' });
        headers.append('set-cookie', 'first=1; Path=/');
        headers.append('set-cookie', 'second=2; Path=/');
        return new Response('<html><body>SSR fixture ' + new URL(request.url).pathname +
          ' ' + request.method + ' ' + await request.text() + '</body></html>',
          { status: 200, headers });
      } };
    `)
    if (mode === 'Vite plugin') {
      process.chdir(tmpDir)
      const { createServer } = await import('vite')
      const { storeApiPlugin } = await import('./apiPlugin')
      databaseModule = await import('./db')
      vite = await createServer({
        configFile: false,
        root: tmpDir,
        plugins: [storeApiPlugin(), {
          name: 'non-api-body-probe',
          configureServer(server) {
            server.middlewares.use('/submit', async (req, res) => {
              let body = ''
              for await (const chunk of req) body += chunk.toString()
              res.end(body)
            })
          },
        }],
        server: { host: '127.0.0.1', port: 0, watch: null },
        logLevel: 'silent',
      })
      await vite.listen()
      port = (vite.httpServer!.address() as net.AddressInfo).port
    } else {
      port = await availablePort()
      child = await startProduction(tmpDir, port)
    }
    baseUrl = `http://127.0.0.1:${port}`
  }, 20_000)

  afterAll(async () => {
    if (vite) await vite.close()
    if (child) await stopProduction(child)
    databaseModule?.getDatabase().close()
    process.chdir(originalCwd)
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  beforeEach(async () => {
    const response = await fetch(`${baseUrl}/api/reset-seed`, { method: 'POST' })
    expect(response.status).toBe(200)
  })

  async function getOrder(url = '/api/orders/CS-2048') {
    const response = await fetch(`${baseUrl}${url}`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    return await response.json() as OrderWithEvents
  }

  it('returns the products in Orbit, Pulse, Wave order', async () => {
    const response = await fetch(`${baseUrl}/api/products/?source=test`)
    expect(response.status).toBe(200)
    const products = await response.json() as Product[]
    expect(products.map((product) => product.name)).toEqual([
      'Orbit Headphones Pro', 'Pulse Watch S2', 'Wave Mini Speaker',
    ])
    expect(products.map((product) => product.createdAt)).toEqual(
      products.map((product) => product.createdAt).sort(),
    )
  })

  it('returns ordered events and derived status/detail for the seeded order', async () => {
    const order = await getOrder()
    expect(order.id).toBe('CS-2048')
    expect(order.currentStep).toBe(1)
    expect(order.statusLabel).toBe('Em separação')
    expect(order.events.map((event) => event.stepIndex)).toEqual([0, 1, 2, 3])
    expect(order.events.map((event) => event.status)).toEqual(['done', 'current', 'pending', 'pending'])
    expect(order.events.map((event) => event.displayDetail)).toEqual([
      '19 out · 10h12', '20 out · 08h35', 'Aguardando atualização', 'Aguardando atualização',
    ])
  })

  it('normalizes numeric, lowercase, hash and whitespace IDs with query/trailing slash', async () => {
    for (const id of ['2048', 'cs-2048', '#CS-2048', '  #cs-2048  ', ' #2048 ']) {
      expect((await getOrder(`/api/orders/${encodeURIComponent(id)}/?source=test`)).id).toBe('CS-2048')
    }
    const response = await fetch(`${baseUrl}/api/orders/${encodeURIComponent(' #2048 ')}/advance/?source=test`, {
      method: 'POST',
    })
    expect(response.status).toBe(200)
    expect((await response.json()).currentStep).toBe(2)
    expect((await getOrder()).currentStep).toBe(2)
  })

  it('persists each advance to SQLite and GET, including wrap 3 -> 0', async () => {
    for (const step of [2, 3, 0, 1]) {
      const response = await fetch(`${baseUrl}/api/orders/CS-2048/advance`, { method: 'POST' })
      expect(response.status).toBe(200)
      const advanced = await response.json() as OrderWithEvents
      expect(advanced.currentStep).toBe(step)
      expect(await getOrder()).toEqual(advanced)
      expect(advanced.events.map((event) => event.status)).toEqual(
        [0, 1, 2, 3].map((index) => index < step ? 'done' : index === step ? 'current' : 'pending'),
      )
      const sqlite = new Database(path.join(tmpDir, 'data/store.db'), { readonly: true })
      try {
        expect(sqlite.prepare('SELECT current_step FROM orders WHERE id = ?').get('CS-2048'))
          .toEqual({ current_step: step })
      } finally {
        sqlite.close()
      }
    }
  })

  it('returns the exact pt-BR 404 for missing orders and never double-decodes', async () => {
    for (const id of ['unknown', '%234CS-2048', '%23CS-2048']) {
      for (const method of ['GET', 'POST']) {
        const suffix = method === 'POST' ? '/advance' : ''
        const response = await fetch(`${baseUrl}/api/orders/${encodeURIComponent(id)}${suffix}`, { method })
        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({ error: 'Pedido não encontrado' })
      }
    }
    expect((await getOrder()).currentStep).toBe(1)
  })

  it('resets the seed after an advance and preserves the reset payload', async () => {
    await fetch(`${baseUrl}/api/orders/CS-2048/advance`, { method: 'POST' })
    const response = await fetch(`${baseUrl}/api/reset-seed/?source=test`, { method: 'POST' })
    expect(response.status).toBe(200)
    const reset = await response.json()
    expect(reset.success).toBe(true)
    expect(reset.products).toHaveLength(3)
    expect(reset.order).toEqual(await getOrder())
    expect(reset.order.currentStep).toBe(1)
  })

  it('does not treat unknown API endpoints or wrong methods as SPA pages', async () => {
    for (const [url, method] of [['/api/missing', 'GET'], ['/api/orders/CS-2048/advance', 'GET'], ['/api/products', 'POST']]) {
      const response = await fetch(`${baseUrl}${url}`, { method })
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'Endpoint não encontrado' })
    }
  })

  it('returns safe Portuguese JSON for malformed JSON without mutating the order', async () => {
    for (const body of ['{"secret":', 'not-json', '123']) {
      for (const url of ['/api/orders/2048/advance', '/api/reset-seed']) {
        const response = await fetch(`${baseUrl}${url}`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body,
        })
        expect(response.status).toBe(400)
        expect(response.headers.get('content-type')).toContain('application/json')
        expect(await response.json()).toEqual({ error: 'JSON inválido' })
      }
    }
    expect((await getOrder()).currentStep).toBe(1)
  })

  it('returns safe Portuguese JSON for malformed URI parameters', async () => {
    for (const method of ['GET', 'POST']) {
      const suffix = method === 'POST' ? '/advance' : ''
      const response = await fetch(`${baseUrl}/api/orders/%E0%A4%A${suffix}`, { method })
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'Requisição inválida' })
    }
    expect((await getOrder()).currentStep).toBe(1)
  })

  it('enforces the same JSON size and charset limits with Portuguese errors', async () => {
    for (const [body, contentType, status, error] of [
      [JSON.stringify({ value: 'x'.repeat(102_400) }), 'application/json', 413, 'Corpo da requisição muito grande'],
      ['{}', 'application/json; charset=iso-8859-1', 415, 'Formato da requisição não suportado'],
    ] as const) {
      const response = await fetch(`${baseUrl}/api/orders/2048/advance`, {
        method: 'POST', headers: { 'content-type': contentType }, body,
      })
      expect(response.status).toBe(status)
      expect(await response.json()).toEqual({ error })
    }
    expect((await getOrder()).currentStep).toBe(1)
  })

  it('never parses or consumes JSON bodies outside the API mount', async () => {
    for (const body of ['{"example":true}', '{invalid']) {
      const response = await fetch(`${baseUrl}/submit`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body,
      })
      expect(response.status).toBe(200)
      const text = await response.text()
      if (mode === 'Vite plugin') expect(text).toBe(body)
      else expect(text).toContain(`SSR fixture /submit POST ${body}`)
    }
  })

  it('does not disclose SQLite errors from any API handler', async () => {
    const sqlite = new Database(path.join(tmpDir, 'data/store.db'))
    try {
      for (const [table, urls] of [
        ['products', [['/api/products', 'GET'], ['/api/reset-seed', 'POST']]],
        ['orders', [['/api/orders/2048', 'GET'], ['/api/orders/2048/advance', 'POST']]],
      ] as const) {
        sqlite.exec(`ALTER TABLE ${table} RENAME TO private_${table}`)
        try {
          for (const [url, method] of urls) {
            const response = await fetch(`${baseUrl}${url}`, { method })
            expect(response.status).toBe(500)
            expect(await response.json()).toEqual({ error: 'Erro interno no servidor' })
          }
        } finally {
          sqlite.exec(`ALTER TABLE private_${table} RENAME TO ${table}`)
        }
      }
    } finally {
      sqlite.close()
    }
    expect((await getOrder()).currentStep).toBe(1)
  })

  if (mode === 'production Express') {
    it('returns a safe Portuguese error when the SSR handler fails', async () => {
      const response = await fetch(`${baseUrl}/fail`)
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Erro interno no servidor' })
    })
    it('retains the persisted order after restarting the actual Node entrypoint', async () => {
      await fetch(`${baseUrl}/api/orders/CS-2048/advance`, { method: 'POST' })
      await stopProduction(child!)
      child = await startProduction(tmpDir, port)
      expect((await getOrder()).currentStep).toBe(2)
    })

    it('serves SSR at root and nested paths using Express 5, preserving cookies', async () => {
      for (const url of ['/', '/tracking/demo']) {
        const response = await fetch(`${baseUrl}${url}`)
        expect(response.status).toBe(200)
        expect(response.headers.getSetCookie()).toEqual(['first=1; Path=/', 'second=2; Path=/'])
        expect(await response.text()).toContain(`SSR fixture ${url} GET`)
      }
    })

    it('forwards non-API request bodies to SSR and handles HEAD/static responses', async () => {
      const response = await fetch(`${baseUrl}/submit`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"example":true}',
      })
      expect(response.status).toBe(200)
      expect(await response.text()).toContain('SSR fixture /submit POST {"example":true}')
      const head = await fetch(`${baseUrl}/`, { method: 'HEAD' })
      expect(head.status).toBe(200)
      expect(await head.text()).toBe('')
      const asset = await fetch(`${baseUrl}/fixture.txt`)
      expect(asset.status).toBe(200)
      expect(await asset.text()).toBe('static fixture')
    })
  }
})
