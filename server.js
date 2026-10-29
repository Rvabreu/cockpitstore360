import express from 'express'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** Serve the actual TanStack Start build: static assets plus its streaming fetch handler. */
export async function createProductionApp() {
  const [{ createApiRouter }, { default: start }] = await Promise.all([
    import('./dist/api/index.js'),
    import('./dist/server/server.js'),
  ])
  const app = express()
  app.use('/api', createApiRouter())
  const clientDist = fileURLToPath(new URL('./dist/client/', import.meta.url))
  app.use(express.static(clientDist, { index: false }))

  // app.use works for every route/method and avoids Express 5's invalid '*' route.
  app.use(async (req, res, next) => {
    const abort = new AbortController()
    res.on('close', () => {
      if (!res.writableFinished) abort.abort()
    })
    try {
      const headers = new Headers()
      for (const [name, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) value.forEach((item) => headers.append(name, item))
        else if (value !== undefined) headers.set(name, value)
      }
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
      const request = new Request(new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`), {
        method: req.method,
        headers,
        signal: abort.signal,
        ...(hasBody ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
      })
      const response = await start.fetch(request)
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
    } catch (error) {
      if (!abort.signal.aborted) next(error)
    }
  })

  return app
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = await createProductionApp()
  const PORT = process.env.PORT || 5000
  const server = app.listen(PORT, () => {
    console.log(`COCKPIT STORE 360 Production Server running on http://localhost:${server.address().port}`)
  })
}
