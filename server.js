import { createApiRouter } from './src/server/index.ts'
import start from './dist/server/server.js'
import express from 'express'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const app = express()
app.use('/api', express.json(), createApiRouter())

const clientDist = path.resolve(process.cwd(), 'dist/client')
app.use(express.static(clientDist, { index: false }))

// TanStack Start builds a Fetch handler, not a static SPA index.html.
app.use(async (req, res, next) => {
  try {
    const url = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`)
    const request = new Request(url, {
      method: req.method,
      headers: new Headers(req.headers),
      ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body: req, duplex: 'half' } : {}),
    })
    const response = await start.fetch(request)
    res.status(response.status)
    response.headers.forEach((value, name) => {
      if (name !== 'set-cookie') res.setHeader(name, value)
    })
    const cookies = response.headers.getSetCookie()
    if (cookies.length) res.setHeader('set-cookie', cookies)
    if (req.method === 'HEAD' || !response.body) return res.end()
    await pipeline(Readable.fromWeb(response.body), res)
  } catch (error) {
    next(error)
  }
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`COCKPIT STORE 360 Production Server running on http://localhost:${PORT}`)
})
