import { createApiRouter, handleServerError } from './src/server/index.ts'
import express from 'express'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { pathToFileURL } from 'node:url'

const app = express()
app.use('/api', createApiRouter({ mode: 'production' }))

const clientDist = path.resolve(process.cwd(), 'dist/client')
app.use(express.static(clientDist))

// TanStack Start builds an SSR fetch handler, not a static index.html.
let startHandler
app.use(async (req, res) => {
  startHandler ??= import(pathToFileURL(path.resolve(process.cwd(), 'dist/server/server.js')).href)
  const { default: handler } = await startHandler
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((entry) => headers.append(name, entry))
    else if (value !== undefined) headers.set(name, value)
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  const request = new Request(new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`), {
    method: req.method,
    headers,
    ...(hasBody ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
  })
  const response = await handler.fetch(request)
  res.status(response.status)
  response.headers.forEach((value, name) => {
    if (name !== 'set-cookie') res.setHeader(name, value)
  })
  const cookies = response.headers.getSetCookie()
  if (cookies.length) res.setHeader('set-cookie', cookies)
  if (req.method === 'HEAD' || !response.body) {
    await response.body?.cancel()
    res.end()
  } else {
    await pipeline(Readable.fromWeb(response.body), res)
  }
})
app.use(handleServerError)

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`COCKPIT STORE 360 Production Server running on http://localhost:${PORT}`)
})
