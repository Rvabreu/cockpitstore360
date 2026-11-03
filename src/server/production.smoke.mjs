// Run after npm run build: exercises the actual npm start entry and SSR output.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-production-'))
const socket = net.createServer()
socket.listen(0, '127.0.0.1')
await once(socket, 'listening')
const port = socket.address().port
await new Promise((resolve) => socket.close(resolve))
let child

async function start() {
  // Same command as npm start, without npm's intermediate shell for clean teardown.
  child = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(port), STORE_DB_PATH: path.join(tmpDir, 'store.db'), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let logs = ''
  child.stdout.on('data', (data) => { logs += data })
  child.stderr.on('data', (data) => { logs += data })
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Production entry exited: ${logs}`)
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/products`)
      if (response.status === 200) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Production entry did not become ready: ${logs}`)
}

async function stop() {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  await once(child, 'exit')
}

async function get(endpoint, method = 'GET') {
  return fetch(`http://127.0.0.1:${port}${endpoint}`, { method })
}

try {
  await start()
  const home = await get('/')
  assert.equal(home.status, 200)
  assert.match(home.headers.get('content-type'), /text\/html/)
  const html = await home.text()
  assert.match(html, /COCKPIT STORE 360/)
  assert.match(html, /<html/)
  const script = html.match(/src="([^"]*\/assets\/[^\"]+\.js)"/)
  assert.ok(script, 'SSR HTML must include the built hydration script')
  assert.equal((await get(script[1])).status, 200)
  const head = await get('/', 'HEAD')
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')
  assert.equal((await get('/nonexistent-page')).status, 404)
  const missing = await get('/api/orders/NOPE')
  assert.equal(missing.status, 404)
  assert.deepEqual(await missing.json(), { error: 'Pedido não localizado neste ambiente de demonstração.' })
  const normalized = await get('/api/orders/%20%23cs-2048%20')
  assert.equal(normalized.status, 200)
  assert.equal((await normalized.json()).id, 'CS-2048')
  for (const expected of [2, 3, 0]) {
    const advanced = await get('/api/orders/%20%23cs-2048%20/advance', 'POST')
    assert.equal(advanced.status, 200)
    assert.equal((await advanced.json()).currentStep, expected)
  }
  await stop()
  await start()
  assert.equal((await (await get('/api/orders/CS-2048')).json()).currentStep, 0)
  console.log('Production smoke: 10 checks passed (SSR, hydration asset, HEAD, route/API 404, normalized GET, 3 advances, restart persistence).')
} finally {
  await stop()
  fs.rmSync(tmpDir, { recursive: true, force: true })
}
