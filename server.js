import { createApiApp } from './src/server/index.ts'
import express from 'express'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Readable } from 'node:stream'

process.env.NODE_ENV ??= 'production'
const app = createApiApp()
const { default: ssr } = await import(pathToFileURL(path.resolve('dist/server/server.js')).href)

const clientDist = path.resolve(process.cwd(), 'dist/client')
app.use(express.static(clientDist))

// TanStack Start builds an SSR fetch handler, not a SPA index.html.
app.use(async (req, res) => {
  try {
    const origin = process.env.AUTH_ORIGIN
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
    }
    const init = { method: req.method, headers }
    if (!['GET', 'HEAD'].includes(req.method)) {
      init.body = Readable.toWeb(req)
      init.duplex = 'half'
    }
    const response = await ssr.fetch(new Request(new URL(req.originalUrl, origin), init))
    res.status(response.status)
    response.headers.forEach((value, key) => { if (key !== 'set-cookie') res.setHeader(key, value) })
    const cookies = response.headers.getSetCookie()
    if (cookies.length) res.setHeader('set-cookie', cookies)
    if (response.body) Readable.fromWeb(response.body).pipe(res)
    else res.end()
  } catch {
    res.status(500).send('Erro interno no servidor.')
  }
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`COCKPIT STORE 360 Production Server running on http://localhost:${PORT}`)
})
