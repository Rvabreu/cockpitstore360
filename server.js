import { createApiRouter } from './src/server/index.ts'
import startServer from './dist/server/server.js'
import express from 'express'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const app = express()
app.use('/api', express.json(), createApiRouter())

const clientDist = path.resolve(process.cwd(), 'dist/client')
app.use(express.static(clientDist))

// TanStack Start's production entry handles SSR and server requests.
app.use(async (req, res) => {
  const headers = new Headers()
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    headers.append(req.rawHeaders[i], req.rawHeaders[i + 1])
  }
  const controller = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) controller.abort()
  })
  const request = new Request(`${req.protocol}://${req.get('host')}${req.originalUrl}`, {
    method: req.method,
    headers,
    signal: controller.signal,
    ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body: req, duplex: 'half' } : {}),
  })
  const response = await startServer.fetch(request)
  res.status(response.status)
  for (const [name, value] of response.headers) {
    if (name !== 'set-cookie') res.setHeader(name, value)
  }
  const cookies = response.headers.getSetCookie()
  if (cookies.length) res.setHeader('set-cookie', cookies)

  if (response.body && req.method !== 'HEAD') {
    await pipeline(Readable.fromWeb(response.body), res)
  } else {
    await response.body?.cancel()
    res.end()
  }
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`COCKPIT STORE 360 Production Server running on http://localhost:${PORT}`)
})
