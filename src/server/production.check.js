import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const repo = fileURLToPath(new URL('../../', import.meta.url))
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-production-'))
const dbPath = path.join(tmpDir, 'store.db')
let child
let origin
let logs = ''

async function start() {
  child = spawn(process.execPath, [path.join(repo, 'server.js')], {
    // Assets/modules must resolve relative to server.js, not the invocation cwd.
    cwd: tmpDir,
    env: { ...process.env, PORT: '0', STORE_DB_PATH: dbPath, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const running = child
  logs = ''
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Production startup timed out: ${logs}`)), 10000)
    const cleanup = () => clearTimeout(timeout)
    running.stdout.on('data', (chunk) => {
      logs += chunk
      const match = logs.match(/http:\/\/localhost:(\d+)/)
      if (match) {
        origin = `http://127.0.0.1:${match[1]}`
        cleanup()
        resolve()
      }
    })
    running.stderr.on('data', (chunk) => { logs += chunk })
    running.once('error', (error) => { cleanup(); reject(error) })
    running.once('exit', (code) => { cleanup(); reject(new Error(`Production exited ${code}: ${logs}`)) })
  })
}

async function stop() {
  if (!child || child.exitCode !== null) return
  const exited = once(child, 'exit')
  child.kill('SIGTERM')
  await exited
}

before(start)
after(async () => {
  await stop()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

test('production streams SSR HTML and serves the referenced client JS/CSS and public asset', async () => {
  const response = await fetch(origin)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /text\/html/)
  const html = await response.text()
  assert.match(html, /COCKPIT STORE/)
  const assets = [...new Set(html.match(/\/assets\/[^"'<>\s]+\.(?:js|css)/g))]
  assert.ok(assets.some((asset) => asset.endsWith('.js')), 'SSR must include client JS')
  assert.ok(assets.some((asset) => asset.endsWith('.css')), 'SSR must include CSS')
  for (const asset of [...assets, '/assets/hero_produtos.svg']) {
    const assetResponse = await fetch(`${origin}${asset}`)
    assert.equal(assetResponse.status, 200, asset)
    assert.doesNotMatch(assetResponse.headers.get('content-type'), /text\/html/, asset)
    await assetResponse.arrayBuffer()
  }
  const head = await fetch(origin, { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
})

test('production GET/POST use normalized IDs and pt-BR API 404, not SSR fallback', async () => {
  const response = await fetch(`${origin}/api/orders/%20%23cs-2048%20`)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).id, 'CS-2048')
  for (const [route, method, message] of [
    ['/api/orders/missing', 'GET', 'Pedido não localizado neste ambiente de demonstração.'],
    ['/api/orders/missing/advance', 'POST', 'Pedido não localizado neste ambiente de demonstração.'],
    ['/api/unknown', 'GET', 'Endpoint não encontrado'],
  ]) {
    const result = await fetch(`${origin}${route}`, { method })
    assert.equal(result.status, 404)
    assert.deepEqual(await result.json(), { error: message })
  }
})

test('production advance persists across process restart and wraps the final step', async () => {
  const advance = () => fetch(`${origin}/api/orders/%23cs-2048/advance`, { method: 'POST' })
  assert.equal((await (await advance()).json()).currentStep, 2)
  await stop()
  await start()
  assert.equal((await (await fetch(`${origin}/api/orders/CS-2048`)).json()).currentStep, 2)
  for (const step of [3, 0, 1]) {
    const response = await advance()
    assert.equal(response.status, 200)
    const order = await response.json()
    assert.equal(order.currentStep, step)
    assert.equal(order.events[step].status, 'current')
    const observer = new Database(dbPath, { readonly: true })
    try {
      assert.deepEqual(observer.prepare('SELECT current_step FROM orders WHERE id = ?').get('CS-2048'), { current_step: step })
    } finally {
      observer.close()
    }
    assert.deepEqual(await (await fetch(`${origin}/api/orders/CS-2048`)).json(), order)
  }
})
