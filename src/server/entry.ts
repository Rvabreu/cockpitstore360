import express from 'express'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream } from 'node:stream/web'
import start from '@tanstack/react-start/server-entry'
import { createApiApp } from './index.ts'

// Keep TanStack's fetch entry for its development server and production SSR.
export default start

export function createProductionApp(clientDist = path.resolve(process.cwd(), 'dist/client')) {
  const app = createApiApp()
  app.use(express.static(clientDist, { index: false }))
  app.use(async (req, res, next) => {
    const controller = new AbortController()
    res.on('close', () => {
      if (!res.writableFinished) controller.abort()
    })

    try {
      const headers = new Headers()
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) {
          for (const item of Array.isArray(value) ? value : [value]) headers.append(key, item)
        }
      }
      const init: RequestInit & { duplex?: 'half' } = {
        method: req.method,
        headers,
        signal: controller.signal,
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        init.body = Readable.toWeb(req) as globalThis.ReadableStream<Uint8Array>
        init.duplex = 'half'
      }
      const request = new Request(new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`), init)
      const response = await start.fetch(request)
      res.status(response.status)
      response.headers.forEach((value, key) => {
        if (key !== 'set-cookie') res.setHeader(key, value)
      })
      const cookies = response.headers.getSetCookie()
      if (cookies.length) res.setHeader('set-cookie', cookies)
      if (req.method === 'HEAD' || !response.body) {
        await response.body?.cancel()
        res.end()
      } else {
        await pipeline(Readable.fromWeb(response.body as ReadableStream<Uint8Array>), res)
      }
    } catch (error) {
      if (!controller.signal.aborted) next(error)
    }
  })
  return app
}
