import express from 'express'
import type { ErrorRequestHandler, Request, Response } from 'express'
import { timingSafeEqual } from 'node:crypto'
import { AuthStore, authConfig, validEmail, validPassword } from './auth.ts'
import type { Session } from './auth.ts'
import { getAllProducts, getOrderWithEvents, advanceOrderStep, seedDatabase } from './db.ts'
import { GoogleOidc, googleCallbackQuery, safeGoogleReturnPath } from './google.ts'
import type { GoogleOptions } from './google.ts'
import { GOOGLE_FLOW_TTL } from './auth.ts'

const NOT_FOUND_MESSAGE = 'Pedido não localizado neste ambiente de demonstração.'
const payload = (body: unknown, keys: string[]) => body !== null && typeof body === 'object' &&
  !Array.isArray(body) && Object.keys(body).length === keys.length && keys.every((key) => Object.hasOwn(body, key))
const normalizeId = (raw: string) => raw.replace(/^#/, '').trim().toUpperCase()
const view = (session: Session) => ({ user: session.user_id === null ? null : { authenticated: true }, csrfToken: session.csrf })

function readCookie(req: Request, name: string) {
  const values = (req.headers.cookie ?? '').split(';').map((part) => part.trim()).filter((part) => part.startsWith(`${name}=`))
  // Ambiguous duplicate cookies are not trusted.
  return values.length === 1 ? values[0].slice(name.length + 1) : undefined
}

export function createApiRouter(options: { store?: AuthStore; config?: ReturnType<typeof authConfig>; google?: GoogleOptions } = {}) {
  const config = options.config ?? authConfig()
  const store = options.store ?? new AuthStore()
  const google = new GoogleOidc(options.google)
  const googleAvailable = !!google.config && google.config.origin === config.origin
  const googleCookie = config.secure ? '__Host-cockpit-google' : 'cockpit-google'
  const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: config.secure, path: '/' }
  const router = express.Router()
  const sessionFor = (req: Request) => store.session(readCookie(req, config.cookieName))
  const setSession = (res: Response, rotated: ReturnType<AuthStore['rotate']>) => {
    res.cookie(config.cookieName, rotated.raw, { ...cookieOptions, maxAge: rotated.session.expires_at - store.now() })
  }
  const sendSession = (res: Response, rotated: ReturnType<AuthStore['rotate']>) => {
    setSession(res, rotated)
    return res.json(view(rotated.session))
  }
  const allowedOrigin = (req: Request, mutation: boolean) => {
    const origin = req.get('origin')
    const site = req.get('sec-fetch-site')
    if (site && !['same-origin', 'none'].includes(site)) return false
    if (origin) return origin === config.origin
    // Browsers omit Origin on same-origin GET; verify authority + Fetch Metadata
    // or exact Referer. Mutations always require the configured Origin.
    if (mutation) return false
    if (req.get('host') !== new URL(config.origin).host) return false
    if (site === 'same-origin' || site === 'none') return true
    try { return new URL(req.get('referer') ?? '').origin === config.origin } catch { return false }
  }

  router.use((_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    next()
  })
  // Every current and future API mutation passes this gate before parsing JSON.
  router.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
    const session = sessionFor(req)
    const token = req.get('x-csrf-token') ?? ''
    if (!allowedOrigin(req, true) || !session || !/^[A-Za-z0-9_-]{43}$/.test(token) ||
        !timingSafeEqual(Buffer.from(token), Buffer.from(session.csrf))) {
      return res.status(403).json({ error: 'Requisição não autorizada.' })
    }
    if (!req.is('application/json')) return res.status(415).json({ error: 'Envie JSON.' })
    next()
  })
  router.use(express.json({ limit: '4kb', strict: true }))

  router.get('/auth/google/status', (req, res) => {
    if (!allowedOrigin(req, false)) return res.status(403).json({ error: 'Requisição não autorizada.' })
    return res.json({ available: googleAvailable })
  })
  router.post('/auth/google/start', (req, res) => {
    if (!payload(req.body, ['returnTo']) || typeof req.body.returnTo !== 'string' || req.body.returnTo.length > 2048) {
      return res.status(400).json({ error: 'Dados inválidos.' })
    }
    if (!googleAvailable) return res.status(503).json({ error: 'Login Google indisponível.' })
    if (!store.consumeGoogleAttempt('start', req.socket.remoteAddress ?? 'unknown')) {
      res.set('Retry-After', '900')
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde e tente novamente.' })
    }
    const flow = store.startGoogle(sessionFor(req)!, safeGoogleReturnPath(req.body.returnTo))
    res.cookie(googleCookie, flow.binding, { ...cookieOptions, maxAge: GOOGLE_FLOW_TTL })
    return res.json({ authorizationUrl: google.authorization(flow) })
  })
  // Cross-site top-level navigation intentionally bypasses the GET Origin gate;
  // one-use state, opaque binding cookie and existing initiating session authorize it.
  router.get('/auth/google/callback', async (req, res) => {
    res.set('Referrer-Policy', 'no-referrer')
    const fail = (reason: 'cancelled' | 'error' | 'unavailable') => res.redirect(303, `/login?google=${reason}`)
    if (!store.consumeGoogleAttempt('callback', req.socket.remoteAddress ?? 'unknown')) return fail('error')
    try {
      const query = googleCallbackQuery(req.originalUrl)
      const flow = store.consumeGoogle(query.state, readCookie(req, googleCookie), sessionFor(req))
      res.clearCookie(googleCookie, cookieOptions)
      if (!googleAvailable) return fail('unavailable')
      if (!flow) return fail('error')
      if (query.error) return fail(query.error === 'access_denied' ? 'cancelled' : 'error')
      const identity = await google.exchange(query.code!, flow, store.now)
      const rotated = store.finishGoogle(flow, identity.subject, identity.email)
      setSession(res, rotated)
      return res.redirect(303, safeGoogleReturnPath(flow.return_to))
    } catch { return fail('error') }
  })

  router.get('/auth/session', (req, res) => {
    if (!allowedOrigin(req, false)) return res.status(403).json({ error: 'Requisição não autorizada.' })
    const session = sessionFor(req)
    if (!session && !store.consumeAnonymous(req.socket.remoteAddress ?? 'unknown')) {
      res.set('Retry-After', '900')
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde e tente novamente.' })
    }
    return session ? res.json(view(session)) : sendSession(res, store.rotate(undefined))
  })
  router.post('/auth/login', async (req, res) => {
    if (!payload(req.body, ['email', 'password']) || !validEmail(req.body.email) || !validPassword(req.body.password)) {
      return res.status(400).json({ error: 'Dados de acesso inválidos.' })
    }
    if (!store.consumeAttempt(req.body.email, req.socket.remoteAddress ?? 'unknown')) {
      res.set('Retry-After', '900')
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde e tente novamente.' })
    }
    const session = sessionFor(req)
    const id = await store.authenticate(req.body.email, req.body.password)
    if (id === undefined) return res.status(429).json({ error: 'Servidor ocupado. Aguarde e tente novamente.' })
    if (id === null) return res.status(401).json({ error: 'E-mail ou senha inválidos.' })
    if (!session || !sessionFor(req)) return res.status(403).json({ error: 'Requisição não autorizada.' })
    return sendSession(res, store.rotate(session, id))
  })
  router.post('/auth/logout', (req, res) => {
    if (!payload(req.body, [])) return res.status(400).json({ error: 'Dados inválidos.' })
    return sendSession(res, store.rotate(sessionFor(req)))
  })
  router.get('/products', (_req, res) => res.json(getAllProducts()))
  router.get('/orders/:id', (req, res) => {
    const order = getOrderWithEvents(normalizeId(req.params.id))
    return order ? res.json(order) : res.status(404).json({ error: NOT_FOUND_MESSAGE })
  })
  router.post('/orders/:id/advance', (req, res) => {
    if (!payload(req.body, [])) return res.status(400).json({ error: 'Dados inválidos.' })
    const order = advanceOrderStep(normalizeId(req.params.id))
    return order ? res.json(order) : res.status(404).json({ error: NOT_FOUND_MESSAGE })
  })
  router.post('/reset-seed', (req, res) => {
    if (!payload(req.body, [])) return res.status(400).json({ error: 'Dados inválidos.' })
    seedDatabase()
    res.json({ success: true, products: getAllProducts(), order: getOrderWithEvents('CS-2048') })
  })
  router.use((_req, res) => res.status(404).json({ error: 'Endpoint não encontrado.' }))
  const errors: ErrorRequestHandler = (err, _req, res, _next) => {
    const status = err.type === 'entity.too.large' ? 413 : err.type === 'entity.parse.failed' || err instanceof URIError ? 400 : 500
    res.status(status).json({ error: status === 500 ? 'Erro interno no servidor.' : 'JSON inválido ou excessivo.' })
  }
  router.use(errors)
  return router
}

export function createApiApp(options: Parameters<typeof createApiRouter>[0] = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', false)
  app.use('/api', createApiRouter(options))
  return app
}
