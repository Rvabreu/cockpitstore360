import { createApiRouter } from './src/server/index.ts'
import startServer from './dist/server/server.js'
import express from 'express'
import path from 'node:path'
import { Readable } from 'node:stream'

const app = express()
app.use('/api', express.json(), createApiRouter())

const clientDist = path.resolve(process.cwd(), 'dist/client')
app.use(express.static(clientDist))

// TanStack Start emits an SSR handler, not a static index.html.
app.use(async (req, res, next) => {
  try {
    const url = new URL(req.originalUrl, `http://${req.headers.host || 'localhost'}`)
    const headers = new Headers()
    for (const [name, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) value.forEach((item) => headers.append(name, item))
      else if (value !== undefined) headers.set(name, value)
    }
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
    const request = new Request(url, {
      method: req.method,
      headers,
      ...(hasBody ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
    })
    const response = await startServer.fetch(request)
    res.status(response.status)
    response.headers.forEach((value, name) => {
      if (name !== 'set-cookie') res.setHeader(name, value)
    })
    const cookies = response.headers.getSetCookie()
    if (cookies.length) res.setHeader('set-cookie', cookies)
    if (!response.body) return res.end()
    Readable.fromWeb(response.body).on('error', next).pipe(res)
  } catch (error) {
    next(error)
  }
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`COCKPIT STORE 360 Production Server running on http://localhost:${PORT}`)
})
