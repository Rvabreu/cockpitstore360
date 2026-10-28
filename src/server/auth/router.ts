import express from 'express'
import type { ErrorRequestHandler, Request, Response } from 'express'
import { timingSafeEqual } from 'node:crypto'
import type { AuthConfig } from './config.ts'
import { csrfTokenFor, type AuthStore } from './db.ts'
import { AuthCapacityError, isValidPassword, normalizeEmail } from './password.ts'

function cookieValue(req: Request, name: string): string | undefined {
  const entries = (req.headers.cookie || '').split(';').map((entry) => entry.trim())
    .filter((entry) => entry.startsWith(`${name}=`))
  // Ambiguous or malformed cookies fail closed rather than selecting attacker-controlled duplicates.
  if (entries.length !== 1) return undefined
  const value = entries[0].slice(name.length + 1)
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined
}

export function createAuthRouter({ config, store, now = Date.now }: {
  config: AuthConfig; store: AuthStore; now?: () => number
}) {
  const router = express.Router()
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next() })
  const options = { httpOnly: true, sameSite: 'strict' as const, secure: config.secure, path: '/' }
  const setCookie = (res: Response, name: string, value: string, expiresAt: number) =>
    res.cookie(name, value, { ...options, maxAge: Math.max(0, expiresAt - now()) })
  const clear = (res: Response, name: string) => res.clearCookie(name, options)
  const unauthorized = (res: Response) => res.status(403).json({ error: 'Requisição não autorizada' })

  router.get('/session', (req, res) => {
    if (req.get('Sec-Fetch-Site') === 'cross-site' ||
      (req.headers.origin !== undefined && req.headers.origin !== config.origin)) return unauthorized(res)
    const token = cookieValue(req, config.sessionCookieName)
    const cookie = cookieValue(req, config.csrfCookieName)
    const result = store.getSession(token, cookie)
    if (!result.user) clear(res, config.sessionCookieName)
    if (result.csrfCookie !== cookie) setCookie(res, config.csrfCookieName, result.csrfCookie, result.expiresAt)
    res.json({ user: result.user, csrfToken: csrfTokenFor(result.csrfCookie) })
  })

  router.use((req, res, next) => {
    if (req.method !== 'POST') return next()
    if (req.headers.origin !== config.origin) return unauthorized(res)
    const cookie = cookieValue(req, config.csrfCookieName)
    const session = cookieValue(req, config.sessionCookieName)
    const header = req.get('X-CSRF-Token')
    if (!cookie || !header || !/^[a-f0-9]{64}$/.test(header)) return unauthorized(res)
    if (!timingSafeEqual(Buffer.from(header, 'hex'), Buffer.from(csrfTokenFor(cookie), 'hex')) ||
      !store.validCsrf(cookie, session)) return unauthorized(res)
    if (!req.is('application/json')) return res.status(415).json({ error: 'Formato da requisição não suportado' })
    next()
  })
  router.use(express.json({ limit: '4kb', strict: false }))

  router.post('/login', async (req, res) => {
    const email = normalizeEmail(req.body?.email)
    const password: unknown = req.body?.password
    if (!email || !isValidPassword(password)) return res.status(400).json({ error: 'Dados de acesso inválidos' })
    // Use the socket only: forwarded headers and Host never select an identity or trusted origin.
    store.consumeAttempt(req.socket.remoteAddress || 'desconhecido', email)
    const user = await store.verifyCredentials(email, password)
    if (!user) return res.status(401).json({ error: 'E-mail ou senha inválidos' })
    const rotated = store.rotate(user, cookieValue(req, config.sessionCookieName), cookieValue(req, config.csrfCookieName)!)
    if (!rotated) return unauthorized(res)
    setCookie(res, config.sessionCookieName, rotated.token, rotated.expiresAt)
    setCookie(res, config.csrfCookieName, rotated.csrfCookie, rotated.expiresAt)
    res.json({ user, csrfToken: csrfTokenFor(rotated.csrfCookie) })
  })
  router.post('/logout', (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Dados de acesso inválidos' })
    }
    store.logout(cookieValue(req, config.sessionCookieName), cookieValue(req, config.csrfCookieName)!)
    clear(res, config.sessionCookieName)
    clear(res, config.csrfCookieName)
    res.json({ user: null })
  })
  router.use((_req, res) => res.status(404).json({ error: 'Endpoint não encontrado' }))
  const onError: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) return next(error)
    if (error instanceof AuthCapacityError) {
      res.setHeader('Retry-After', String(error.retryAfter))
      return res.status(429).json({ error: 'Muitas tentativas. Tente novamente mais tarde.' })
    }
    if (error?.status === 413) return res.status(413).json({ error: 'Corpo da requisição muito grande' })
    if (error?.status === 415) return res.status(415).json({ error: 'Formato da requisição não suportado' })
    if (error?.status === 400) return res.status(400).json({ error: error?.type === 'entity.parse.failed' ? 'JSON inválido' : 'Dados de acesso inválidos' })
    res.status(500).json({ error: 'Erro interno no servidor' })
  }
  router.use(onError)
  return router
}
