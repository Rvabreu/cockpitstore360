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
import type { CrmContact, CrmContactsResponse, CrmNotesResponse } from '../types/crm'

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

  async function login(email = 'cliente@cockpitstore360.com.br', password = 'demo123') {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    return await response.json() as { success: boolean; user: { id: string; name: string; email: string; role: string }; token: string }
  }

  async function me(token?: string) {
    return fetch(`${baseUrl}/api/auth/me`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
  }

  async function crmRequest(url: string, token?: string, method = 'GET', body?: unknown) {
    return fetch(`${baseUrl}/api/crm${url}`, {
      method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  }
  async function crmSnapshot() {
    // Read-only fixture connection observes writes without bypassing HTTP authorization.
    const sqlite = new Database(path.join(tmpDir, 'data/store.db'), { readonly: true })
    try {
      return { contacts: sqlite.prepare('SELECT * FROM crm_contacts ORDER BY id').all(), notes: sqlite.prepare('SELECT * FROM crm_notes ORDER BY id').all() }
    } finally { sqlite.close() }
  }

  it('CRM rejects every route/method for absent, invalid, expired, revoked and customer tokens before parsing, without writes', async () => {
    const customer = await login()
    const expired = await login('admin@cockpitstore360.com.br', 'admin123')
    const { hashToken } = await import('./auth')
    const sqlite = new Database(path.join(tmpDir, 'data/store.db'))
    try { sqlite.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(Date.now() - 1, hashToken(expired.token)) } finally { sqlite.close() }
    const revoked = await login('admin@cockpitstore360.com.br', 'admin123')
    await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { authorization: `Bearer ${revoked.token}` } })
    const snapshot = await crmSnapshot()
    for (const [token, status, error] of [
      [undefined, 401, 'Não autenticado'], ['invalid', 401, 'Não autenticado'], ['f'.repeat(64), 401, 'Não autenticado'],
      [expired.token, 401, 'Não autenticado'], [revoked.token, 401, 'Não autenticado'], [customer.token, 403, 'Acesso restrito a administradores'],
    ] as const) {
      for (const [url, method] of [
        ['/contacts', 'GET'], ['/contacts', 'POST'], ['/contacts/missing', 'GET'], ['/contacts/missing', 'PUT'], ['/contacts/missing', 'DELETE'],
        ['/contacts/missing/notes', 'GET'], ['/contacts/missing/notes', 'POST'], ['/unknown', 'PATCH'], ['/contacts/%E0%A4%A', 'GET'],
      ]) {
        const response = await fetch(`${baseUrl}/api/crm${url}`, {
          method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
          ...(['POST', 'PUT', 'PATCH'].includes(method) ? { body: '{invalid' } : {}),
        })
        expect(response.status).toBe(status)
        expect(response.headers.get('cache-control')).toBe('no-store')
        expect(await response.json()).toEqual({ error })
      }
      const oversized = await fetch(`${baseUrl}/api/crm/contacts`, {
        method: 'POST', headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' }, body: 'x'.repeat(20000),
      })
      expect(oversized.status).toBe(status)
    }
    expect(await crmSnapshot()).toEqual(snapshot)
    const admin = await login('admin@cockpitstore360.com.br', 'admin123')
    expect((await crmRequest(`/contacts?token=${admin.token}`)).status).toBe(401)
  })

  it('CRM admin CRUD envelopes, normalized email conflict, notes, summaries and cascade are identical', async () => {
    const { token } = await login('admin@cockpitstore360.com.br', 'admin123')
    const input = { name: '  Teste CRM  ', email: '  TESTE@EXAMPLE.COM  ', phone: ' 5511 ', company: ' Demo empresa ', stage: 'novo' }
    const initialResponse = await crmRequest('/contacts', token)
    expect(initialResponse.status).toBe(200)
    expect(initialResponse.headers.get('cache-control')).toBe('no-store')
    const initial = await initialResponse.json() as CrmContactsResponse
    const response = await crmRequest('/contacts', token, 'POST', input)
    expect(response.status).toBe(201)
    const { contact } = await response.json() as { contact: CrmContact }
    expect(contact).toMatchObject({ name: 'Teste CRM', email: 'teste@example.com', phone: '5511', company: 'Demo empresa', stage: 'novo' })
    expect(await (await crmRequest(`/contacts/${contact.id}`, token)).json()).toEqual({ contact })
    const duplicate = await crmRequest('/contacts', token, 'POST', { ...input, email: 'teste@example.com' })
    expect(duplicate.status).toBe(409)
    expect(await duplicate.json()).toEqual({ error: 'E-mail já cadastrado' })
    const updatedResponse = await crmRequest(`/contacts/${contact.id}`, token, 'PUT', { ...input, name: 'Literal %_\\', stage: 'cliente' })
    expect(updatedResponse.status).toBe(200)
    const updated = (await updatedResponse.json()).contact as CrmContact
    expect(updated.createdAt).toBe(contact.createdAt)
    expect(updated.updatedAt > contact.updatedAt).toBe(true)
    const filtered = await (await crmRequest(`/contacts?q=${encodeURIComponent('%_\\')}&stage=cliente&limit=1`, token)).json() as CrmContactsResponse
    expect(filtered.contacts).toEqual([updated])
    expect(filtered.total).toBe(1)
    expect(filtered.summary.total).toBe(initial.summary.total + 1)
    expect(filtered.summary.byStage.cliente).toBe(initial.summary.byStage.cliente + 1)
    expect(await (await crmRequest(`/contacts/${contact.id}/notes`, token)).json()).toEqual({ notes: [], total: 0 })
    const noteResponse = await crmRequest(`/contacts/${contact.id}/notes`, token, 'POST', { body: '  Ligação demonstrativa  ' })
    expect(noteResponse.status).toBe(201)
    const { note } = await noteResponse.json()
    expect(note).toMatchObject({ contactId: contact.id, body: 'Ligação demonstrativa' })
    expect(await (await crmRequest(`/contacts/${contact.id}/notes?limit=1&offset=0`, token)).json()).toEqual({ notes: [note], total: 1 })
    expect((await (await crmRequest(`/contacts/${contact.id}`, token)).json()).contact.updatedAt > updated.updatedAt).toBe(true)
    const deletion = await crmRequest(`/contacts/${contact.id}`, token, 'DELETE')
    expect(deletion.status).toBe(200)
    expect(await deletion.json()).toEqual({ success: true })
    for (const [url, method, body] of [[`/contacts/${contact.id}`, 'GET'], [`/contacts/${contact.id}`, 'PUT', input], [`/contacts/${contact.id}`, 'DELETE'], [`/contacts/${contact.id}/notes`, 'GET'], [`/contacts/${contact.id}/notes`, 'POST', { body: 'x' }]] as const) {
      const missing = await crmRequest(url, token, method, body)
      expect(missing.status).toBe(404)
      expect(await missing.json()).toEqual({ error: 'Contato não encontrado' })
    }
    const snapshot = await crmSnapshot()
    expect(snapshot.notes.some((item) => (item as { contact_id: string }).contact_id === contact.id)).toBe(false)
  })

  it('CRM rejects invalid/unknown/repeated query params and incomplete/typed/extra input with exact 400, atomically', async () => {
    const { token } = await login('admin@cockpitstore360.com.br', 'admin123')
    const snapshot = await crmSnapshot()
    for (const query of ['unknown=x', 'q=a&q=b', 'stage=novo&stage=cliente', 'q=' + 'x'.repeat(101), 'stage=bad', 'stage=', 'limit=0', 'limit=101', 'limit=1.1', 'limit=-1', 'limit=', 'limit=1&limit=2', 'offset=-1', 'offset=100001', 'offset=1e2', 'offset=']) {
      const response = await crmRequest(`/contacts?${query}`, token)
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'Dados do CRM inválidos' })
    }
    const input = { name: 'Demo', email: 'valid@example.com', phone: '', company: '', stage: 'novo' }
    for (const body of [undefined, null, [], {}, { ...input, extra: true }, { ...input, name: ' ' }, { ...input, name: 'x'.repeat(121) }, { ...input, email: 'bad' }, { ...input, email: 'x'.repeat(255) }, { ...input, phone: false }, { ...input, phone: 'x'.repeat(41) }, { ...input, company: 'x'.repeat(121) }, { ...input, stage: 'BAD' }]) {
      for (const [url, method] of [['/contacts', 'POST'], ['/contacts/missing', 'PUT']]) {
        const response = await crmRequest(url, token, method, body)
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({ error: 'Dados do CRM inválidos' })
      }
    }
    for (const body of [{}, { body: '' }, { body: ' ' }, { body: 123 }, { body: 'x'.repeat(2001) }, { body: 'x', extra: true }]) {
      const response = await crmRequest('/contacts/missing/notes', token, 'POST', body)
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'Dados do CRM inválidos' })
    }
    for (const query of ['q=x', 'limit=0', 'offset=100001', 'limit=1&limit=2']) {
      const response = await crmRequest(`/contacts/missing/notes?${query}`, token)
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'Dados do CRM inválidos' })
    }
    for (const [url, method] of [['/contacts/missing?extra=1', 'GET'], ['/contacts?extra=1', 'POST'], ['/contacts/missing?extra=1', 'DELETE']]) {
      expect((await crmRequest(url, token, method, method === 'POST' ? input : undefined)).status).toBe(400)
    }
    const validBoundary = await crmRequest('/contacts?limit=100&offset=100000&q=' + 'x'.repeat(100), token)
    expect(validBoundary.status).toBe(200)
    expect((await validBoundary.json()).contacts).toEqual([])
    expect(await crmSnapshot()).toEqual(snapshot)
  })

  it('CRM enforces 16kb parsing after authorization and returns safe errors even for unknown endpoints', async () => {
    const { token } = await login('admin@cockpitstore360.com.br', 'admin123')
    for (const [body, contentType, status, error] of [
      ['{invalid', 'application/json', 400, 'Dados do CRM inválidos'], ['123', 'application/json', 400, 'Dados do CRM inválidos'],
      [JSON.stringify({ body: 'x'.repeat(16400) }), 'application/json', 413, 'Corpo da requisição muito grande'],
      ['{}', 'application/json; charset=iso-8859-1', 415, 'Formato da requisição não suportado'],
    ] as const) {
      const response = await fetch(`${baseUrl}/api/crm/contacts`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': contentType }, body })
      expect(response.status).toBe(status)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(await response.json()).toEqual({ error })
    }
    const malformed = await crmRequest('/contacts/%E0%A4%A', token)
    expect(malformed.status).toBe(400)
    expect(await malformed.json()).toEqual({ error: 'Dados do CRM inválidos' })
    for (const [url, method] of [['/unknown', 'GET'], ['/contacts', 'PATCH'], ['/contacts/missing/notes', 'DELETE']]) {
      const response = await crmRequest(url, token, method)
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'Endpoint não encontrado' })
    }
    const sqlite = new Database(path.join(tmpDir, 'data/store.db'))
    try {
      sqlite.exec('ALTER TABLE crm_contacts RENAME TO private_crm_contacts')
      const response = await crmRequest('/contacts', token)
      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Erro interno no servidor' })
    } finally { sqlite.exec('ALTER TABLE private_crm_contacts RENAME TO crm_contacts'); sqlite.close() }
  })

  it('CRM persists notes and edits through product reset/restart and does not reseed after all deletions', async () => {
    const { token } = await login('admin@cockpitstore360.com.br', 'admin123')
    const response = await crmRequest('/contacts', token, 'POST', { name: 'Restart Demo', email: 'restart@example.com', phone: '', company: '', stage: 'qualificado' })
    const { contact } = await response.json() as { contact: CrmContact }
    const updatedResponse = await crmRequest(`/contacts/${contact.id}`, token, 'PUT', { name: 'Mantido Demo', email: 'restart@example.com', phone: '123', company: '', stage: 'cliente' })
    const updated = (await updatedResponse.json()).contact
    const note = (await (await crmRequest(`/contacts/${contact.id}/notes`, token, 'POST', { body: 'Nota persistida' })).json()).note
    const beforeReset = await crmSnapshot()
    await fetch(`${baseUrl}/api/reset-seed`, { method: 'POST' })
    expect(await crmSnapshot()).toEqual(beforeReset)
    async function restart() {
      if (mode === 'Vite plugin') { databaseModule!.getDatabase().close(); await vite!.restart() }
      else { await stopProduction(child!); child = await startProduction(tmpDir, port) }
    }
    await restart()
    expect(await (await crmRequest(`/contacts/${contact.id}`, token)).json()).toEqual({ contact: { ...updated, updatedAt: expect.any(String) } })
    expect(await (await crmRequest(`/contacts/${contact.id}/notes`, token)).json() as CrmNotesResponse).toEqual({ notes: [note], total: 1 })
    const contacts = await (await crmRequest('/contacts', token)).json() as CrmContactsResponse
    for (const item of contacts.contacts) expect((await crmRequest(`/contacts/${item.id}`, token, 'DELETE')).status).toBe(200)
    await fetch(`${baseUrl}/api/reset-seed`, { method: 'POST' })
    await restart()
    const empty = await (await crmRequest('/contacts', token)).json() as CrmContactsResponse
    expect(empty.contacts).toEqual([])
    expect(empty.total).toBe(0)
    expect(empty.summary).toEqual({ total: 0, byStage: { novo: 0, contato: 0, qualificado: 0, cliente: 0, perdido: 0 } })
  })

  it('authenticates both demo roles, normalizes email and exposes no password hash', async () => {
    for (const [email, password, name, role] of [
      ['cliente@cockpitstore360.com.br', 'demo123', 'Cliente Demo', 'customer'],
      ['admin@cockpitstore360.com.br', 'admin123', 'Administrador Demo', 'admin'],
    ]) {
      const result = await login(`  ${email.toUpperCase()}  `, password)
      expect(result).toEqual({
        success: true, token: expect.stringMatching(/^[a-f0-9]{64}$/),
        user: { id: expect.any(String), email, name, role },
      })
      const response = await me(result.token)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ user: result.user })
    }
  })

  it('rejects missing, invalid-type and oversized login fields with exact safe 400 errors', async () => {
    for (const body of [
      {}, { email: 'x' }, { password: 'x' }, { email: null, password: 'x' },
      { email: 123, password: 'x' }, { email: ['x'], password: 'x' },
      { email: 'x', password: {} }, { email: 'x', password: false },
      { email: '   ', password: 'x' }, { email: 'x', password: '' },
      { email: 'x'.repeat(255), password: 'x' }, { email: 'x', password: 'x'.repeat(1025) },
    ]) {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      })
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'E-mail e senha são obrigatórios' })
    }
    const response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST' })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'E-mail e senha são obrigatórios' })
  })

  it('rejects incorrect credentials without disclosing whether an email exists', async () => {
    for (const [email, password] of [
      ['cliente@cockpitstore360.com.br', 'wrong'], ['missing@example.com', 'demo123'],
      ["' OR 1=1 --", 'demo123'],
    ]) {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
      })
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'E-mail ou senha inválidos' })
    }
  })

  it('rejects absent, invalid and expired bearer tokens and ignores tokens in query strings', async () => {
    const { token } = await login()
    const sqlite = new Database(path.join(tmpDir, 'data/store.db'))
    try {
      sqlite.prepare('UPDATE sessions SET expires_at = ?').run(Date.now() - 1)
    } finally {
      sqlite.close()
    }
    for (const invalid of [undefined, 'invalid', 'f'.repeat(64), token]) {
      const response = await me(invalid)
      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Não autenticado' })
    }
    const fresh = await login()
    const response = await fetch(`${baseUrl}/api/auth/me?token=${fresh.token}`)
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Não autenticado' })
  })

  it('revokes only the supplied session, with idempotent logout and no user reset', async () => {
    const first = await login()
    const second = await login()
    await fetch(`${baseUrl}/api/reset-seed`, { method: 'POST' })
    expect((await me(first.token)).status).toBe(200)
    for (const token of [first.token, first.token, 'invalid', undefined]) {
      const response = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {},
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ success: true })
    }
    expect((await me(first.token)).status).toBe(401)
    expect((await me(second.token)).status).toBe(200)
  })

  it('keeps sessions and revocations after restarting the real server and SQLite connection', async () => {
    const active = await login()
    const revoked = await login()
    await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST', headers: { authorization: `Bearer ${revoked.token}` },
    })
    if (mode === 'Vite plugin') {
      databaseModule!.getDatabase().close()
      await vite!.restart()
    } else {
      await stopProduction(child!)
      child = await startProduction(tmpDir, port)
    }
    const response = await me(active.token)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ user: active.user })
    expect((await me(revoked.token)).status).toBe(401)
  })

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
      for (const url of ['/api/orders/2048/advance', '/api/reset-seed', '/api/auth/login']) {
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
    const { token } = await login()
    const sqlite = new Database(path.join(tmpDir, 'data/store.db'))
    try {
      for (const [table, urls] of [
        ['products', [['/api/products', 'GET'], ['/api/reset-seed', 'POST']]],
        ['orders', [['/api/orders/2048', 'GET'], ['/api/orders/2048/advance', 'POST']]],
        ['users', [['/api/auth/login', 'POST'], ['/api/auth/me', 'GET']]],
        ['sessions', [['/api/auth/login', 'POST'], ['/api/auth/me', 'GET'], ['/api/auth/logout', 'POST']]],
      ] as const) {
        sqlite.exec(`ALTER TABLE ${table} RENAME TO private_${table}`)
        try {
          for (const [url, method] of urls) {
            const response = await fetch(`${baseUrl}${url}`, {
              method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
              ...(url === '/api/auth/login' ? { body: JSON.stringify({ email: 'cliente@cockpitstore360.com.br', password: 'demo123' }) } : {}),
            })
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
