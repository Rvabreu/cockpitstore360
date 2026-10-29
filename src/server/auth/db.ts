import Database from 'better-sqlite3'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import fs from 'node:fs'
import pathModule from 'node:path'
import type { CheckoutProduct, CheckoutReceipt, CheckoutRequest } from '../../types/checkout.ts'
import type { PaymentOrder, PaymentStatus } from '../../types/payment.ts'
import { buildCheckoutReceipt, normalizeCheckoutRequest } from '../checkout.ts'
import { AuthCapacityError, hashPassword, isValidPassword, isValidRegistrationPassword, normalizeEmail, verifyPassword } from './password.ts'

export const SESSION_TTL = 8 * 60 * 60 * 1000
export const BOOTSTRAP_TTL = 60 * 60 * 1000
const WINDOW = 10 * 60 * 1000
const CAPACITY = 10000
export const digest = (value: string) => createHash('sha256').update(value).digest('hex')
export const csrfTokenFor = (cookie: string) => digest(`csrf:${cookie}`)
export type AuthUser = { id: string; email: string }
type UserRecord = AuthUser & { salt: string; hash: string }
type Bootstrap = { cookie_hash: string; expires_at: number }
type Session = { token_hash: string; user_id: string; csrf_hash: string; expires_at: number }
export interface PaymentRow { id: string; user_id: string; idempotency_key: string; request_hash: string; snapshot_json: string; gateway_params_json: string; total_cents: number; mode: 'test' | 'live'; status: PaymentStatus; created_at: number; expires_at: number; create_deadline_at: number; stripe_session_id: string | null; checkout_url: string | null }

export function createAuthStore({ path = pathModule.resolve('data/auth.db'), now = Date.now }: {
  path?: string; now?: () => number
} = {}) {
  if (path !== ':memory:') {
    const directory = pathModule.dirname(path)
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
    fs.chmodSync(directory, 0o700)
    // Create with restrictive permissions BEFORE opening, including preexisting files.
    const fd = fs.openSync(path, 'a', 0o600)
    fs.closeSync(fd)
    fs.chmodSync(path, 0o600)
  }
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, hash TEXT NOT NULL,
      scrypt_n INTEGER NOT NULL DEFAULT 32768, scrypt_r INTEGER NOT NULL DEFAULT 8, scrypt_p INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS csrf_bootstraps (cookie_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      csrf_hash TEXT NOT NULL REFERENCES csrf_bootstraps(cookie_hash), expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS login_limits (key_hash TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS checkout_receipts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), idempotency_key TEXT NOT NULL,
      request_hash TEXT NOT NULL, receipt_json TEXT NOT NULL, created_at TEXT NOT NULL,
      UNIQUE(user_id, idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS payment_orders (
      id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),idempotency_key TEXT NOT NULL,request_hash TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,gateway_params_json TEXT NOT NULL,total_cents INTEGER NOT NULL,mode TEXT NOT NULL,status TEXT NOT NULL,
      created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,create_deadline_at INTEGER NOT NULL,
      stripe_session_id TEXT UNIQUE,checkout_url TEXT,UNIQUE(user_id,idempotency_key)
    );
    CREATE TABLE IF NOT EXISTS payment_events (event_id TEXT PRIMARY KEY,order_id TEXT NOT NULL REFERENCES payment_orders(id),type TEXT NOT NULL,processed_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS csrf_expiry ON csrf_bootstraps(expires_at);
    CREATE INDEX IF NOT EXISTS limits_expiry ON login_limits(expires_at);
  `)
  let dummy: Promise<{ salt: string; hash: string }> | undefined
  const cleanup = () => {
    const time = now()
    db.prepare('DELETE FROM sessions WHERE expires_at <= ? OR csrf_hash IN (SELECT cookie_hash FROM csrf_bootstraps WHERE expires_at <= ?)').run(time, time)
    db.prepare('DELETE FROM csrf_bootstraps WHERE expires_at <= ?').run(time)
    db.prepare('DELETE FROM login_limits WHERE expires_at <= ?').run(time)
  }
  const bootstrap = (cookie: string | undefined) => cookie ? db.prepare('SELECT * FROM csrf_bootstraps WHERE cookie_hash = ? AND expires_at > ?').get(digest(cookie), now()) as Bootstrap | undefined : undefined
  const session = (token: string | undefined) => token ? db.prepare('SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?').get(digest(token), now()) as Session | undefined : undefined
  const revoke = (token?: string, cookie?: string) => {
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token))
    if (cookie) {
      db.prepare('DELETE FROM sessions WHERE csrf_hash = ?').run(digest(cookie))
      db.prepare('DELETE FROM csrf_bootstraps WHERE cookie_hash = ?').run(digest(cookie))
    }
  }
  const assertCapacity = (table: 'sessions' | 'csrf_bootstraps' | 'login_limits', extra = 1) => {
    const row = db.prepare(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }
    if (row.count + extra > CAPACITY) throw new AuthCapacityError()
  }
  const userFor = (record: Session | undefined): AuthUser | null => {
    if (!record) return null
    return db.prepare('SELECT id, email FROM users WHERE id = ?').get(record.user_id) as AuthUser || null
  }
  return {
    db,
    close() { db.close() },
    preparePayment({ sessionToken, csrfCookie, request, mode, origin, loadItems }: {
      sessionToken: string; csrfCookie: string; request: CheckoutRequest; mode: 'test' | 'live'; origin: string; loadItems: () => PaymentOrder['items'] | null
    }) {
      return db.transaction(() => {
        const user = this.findUserSession(sessionToken, csrfCookie)
        if (!user) return { status: 'unauthorized' as const }
        const hash = digest(JSON.stringify(request.items))
        const previous = db.prepare('SELECT * FROM payment_orders WHERE user_id=? AND idempotency_key=?').get(user.id, request.idempotencyKey) as PaymentRow | undefined
        if (previous) return previous.request_hash === hash ? { status: 'ready' as const, row: previous, created: false } : { status: 'conflict' as const }
        if ((db.prepare('SELECT COUNT(*) AS n FROM payment_orders').get() as { n: number }).n >= 10000) throw new AuthCapacityError()
        const items = loadItems()
        if (!items) return { status: 'conflict' as const }
        const timestamp = now(), id = randomUUID()
        const order: PaymentOrder = { id, items, totalCents: items.reduce((s, i) => s + i.lineTotalCents, 0), currency: 'USD', status: 'pending', createdAt: new Date(timestamp).toISOString() }
        const expiresAt = Math.floor(timestamp / 1000) + 3600
        const params = {orderId:id,items:items.map(i=>({name:i.name,quantity:i.quantity,unitPriceCents:i.unitPriceCents})),idempotencyKey:`checkout:${id}`,expiresAt,
          successUrl:`${origin}/checkout?pedido=${id}&retorno=sucesso`,cancelUrl:`${origin}/checkout?pedido=${id}&retorno=cancelado`}
        db.prepare('INSERT INTO payment_orders(id,user_id,idempotency_key,request_hash,snapshot_json,gateway_params_json,total_cents,mode,status,created_at,expires_at,create_deadline_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(id, user.id, request.idempotencyKey, hash, JSON.stringify(order), JSON.stringify(params), order.totalCents, mode, 'pending', timestamp, expiresAt, timestamp + 25 * 60000)
        return { status: 'ready' as const, row: db.prepare('SELECT * FROM payment_orders WHERE id=?').get(id) as PaymentRow, created: true }
      }).immediate()
    },
    findPayment(id: string) { return db.prepare('SELECT * FROM payment_orders WHERE id=?').get(id) as PaymentRow | undefined },
    findOwnedPayment(id: string, userId: string) { return db.prepare('SELECT * FROM payment_orders WHERE id=? AND user_id=?').get(id, userId) as PaymentRow | undefined },
    attachStripeSession(id: string, sessionId: string, url: string | null) {
      db.transaction(() => {
        const row = this.findPayment(id)
        if (!row || (row.stripe_session_id && row.stripe_session_id !== sessionId)) throw new Error('Sessão de pagamento inválida')
        db.prepare('UPDATE payment_orders SET stripe_session_id=?,checkout_url=? WHERE id=?').run(sessionId, url, id)
      }).immediate()
    },
    applyPaymentEvent({ eventId, orderId, type, status, sessionId }: { eventId: string; orderId: string; type: string; status: PaymentStatus; sessionId: string }) {
      db.transaction(() => {
        if (db.prepare('SELECT 1 FROM payment_events WHERE event_id=?').get(eventId)) return
        const row = this.findPayment(orderId)
        if (!row || (row.stripe_session_id && row.stripe_session_id !== sessionId)) throw new Error('Sessão de pagamento inválida')
        const next = row.status === 'paid' ? 'paid' : status === 'pending' ? row.status : status
        db.prepare('UPDATE payment_orders SET stripe_session_id=?,status=? WHERE id=?').run(sessionId, next, orderId)
        db.prepare('INSERT INTO payment_events VALUES(?,?,?,?)').run(eventId, orderId, type, now())
      }).immediate()
    },
    createCheckout({ token, csrfCookie, request, loadProducts }: {
      token: string; csrfCookie: string; request: CheckoutRequest; loadProducts: (ids: string[]) => CheckoutProduct[]
    }): { created: boolean; receipt: CheckoutReceipt } | 'unauthorized' | 'conflict' {
      const canonical = normalizeCheckoutRequest(request)
      if (!canonical) throw new Error('Dados de checkout inválidos')
      return db.transaction(() => {
        const timestamp = now()
        const user = db.prepare(`SELECT u.id FROM users u JOIN sessions s ON s.user_id=u.id
          JOIN csrf_bootstraps c ON c.cookie_hash=s.csrf_hash
          WHERE s.token_hash=? AND c.cookie_hash=? AND s.expires_at>? AND c.expires_at>?`)
          .get(digest(token), digest(csrfCookie), timestamp, timestamp) as { id: string } | undefined
        if (!user) return 'unauthorized' as const
        const requestHash = digest(JSON.stringify(canonical.items))
        const existing = db.prepare('SELECT request_hash,receipt_json FROM checkout_receipts WHERE user_id=? AND idempotency_key=?')
          .get(user.id, canonical.idempotencyKey) as { request_hash: string; receipt_json: string } | undefined
        if (existing) return existing.request_hash === requestHash
          ? { created: false, receipt: JSON.parse(existing.receipt_json) as CheckoutReceipt }
          : 'conflict' as const
        const total = db.prepare('SELECT count(*) AS count FROM checkout_receipts').get() as { count: number }
        if (total.count >= CAPACITY) throw new AuthCapacityError()
        const receipt = buildCheckoutReceipt(canonical, loadProducts(canonical.items.map(item => item.productId)), { now })
        if (!receipt) return 'conflict' as const
        db.prepare('INSERT INTO checkout_receipts(id,user_id,idempotency_key,request_hash,receipt_json,created_at) VALUES(?,?,?,?,?,?)')
          .run(receipt.id, user.id, canonical.idempotencyKey, requestHash, JSON.stringify(receipt), receipt.createdAt)
        return { created: true, receipt }
      }).immediate()
    },
    async provisionUser({ email, password }: { email: string; password: string }): Promise<AuthUser> {
      const normalized = normalizeEmail(email)
      if (!normalized || !isValidPassword(password, 12)) throw new Error('Informe e-mail válido e senha entre 12 e 256 caracteres.')
      const hashed = await hashPassword(password)
      const user = { id: randomUUID(), email: normalized }
      db.prepare('INSERT INTO users(id,email,salt,hash) VALUES(?,?,?,?)').run(user.id, user.email, hashed.salt, hashed.hash)
      return user
    },
    async verifyCredentials(email: string, password: string): Promise<AuthUser | null> {
      // A dummy is initialized once, asynchronously, per store and used at the same KDF cost.
      dummy ??= hashPassword(randomBytes(32).toString('hex')).catch((error) => { dummy = undefined; throw error })
      const placeholder = await dummy
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRecord | undefined
      const valid = await verifyPassword(password, user || placeholder)
      return valid && user ? { id: user.id, email: user.email } : null
    },
    async registerUser({ email, password, csrfCookie, sessionToken }: {
      email: string; password: string; csrfCookie: string; sessionToken?: string
    }): Promise<'created' | 'conflict' | 'unauthorized'> {
      const normalized = normalizeEmail(email)
      if (!normalized || !isValidRegistrationPassword(password)) throw new Error('Dados de cadastro inválidos')
      const cookieHash = digest(csrfCookie)
      const anonymousBootstrap = () => {
        const validBootstrap = db.prepare('SELECT cookie_hash FROM csrf_bootstraps WHERE cookie_hash=? AND expires_at>?').get(cookieHash, now())
        const linkedSession = db.prepare('SELECT token_hash FROM sessions WHERE csrf_hash=? LIMIT 1').get(cookieHash)
        return sessionToken === undefined && Boolean(validBootstrap) && !linkedSession
      }
      if (!anonymousBootstrap()) return 'unauthorized'
      // KDF is bounded and asynchronous, never holding a SQLite transaction across await.
      const hashed = await hashPassword(password)
      return db.transaction(() => {
        // Revalidate anonymity/TTL after KDF; login or logout during await must never create an account.
        if (!anonymousBootstrap()) return 'unauthorized' as const
        const row = db.prepare('SELECT count(*) AS count FROM users').get() as { count: number }
        if (row.count >= CAPACITY) throw new AuthCapacityError()
        const result = db.prepare('INSERT INTO users(id,email,salt,hash) VALUES(?,?,?,?) ON CONFLICT(email) DO NOTHING')
          .run(randomUUID(), normalized, hashed.salt, hashed.hash)
        return result.changes ? 'created' as const : 'conflict' as const
      }).immediate()
    },
    consumeAttempt(ip: string, email: string) {
      db.transaction(() => {
        cleanup()
        const keys = [digest(`ip:${ip}`), digest(`pair:${ip}:${email}`)]
        const rows = keys.map((key) => db.prepare('SELECT count, expires_at FROM login_limits WHERE key_hash=?').get(key) as { count: number; expires_at: number } | undefined)
        const blocked = rows.find((row, index) => row && row.count >= (index === 0 ? 30 : 5))
        if (blocked) {
          const error = new AuthCapacityError()
          error.retryAfter = Math.max(1, Math.ceil((blocked.expires_at - now()) / 1000))
          throw error
        }
        assertCapacity('login_limits', rows.filter((row) => !row).length)
        keys.forEach((key, index) => {
          if (rows[index]) db.prepare('UPDATE login_limits SET count=count+1 WHERE key_hash=?').run(key)
          else db.prepare('INSERT INTO login_limits VALUES(?,1,?)').run(key, now() + WINDOW)
        })
      })()
    },
    findUserSession(token?: string, cookie?: string): AuthUser | null {
      if (!token || !cookie || !/^[A-Za-z0-9_-]{43}$/.test(token) || !/^[A-Za-z0-9_-]{43}$/.test(cookie)) return null
      const timestamp = now()
      const row = db.prepare(`
        SELECT u.id, u.email FROM sessions s
        JOIN csrf_bootstraps c ON c.cookie_hash = s.csrf_hash
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND c.cookie_hash = ? AND s.expires_at > ? AND c.expires_at > ?
      `).get(digest(token), digest(cookie), timestamp, timestamp) as AuthUser | undefined
      return row || null
    },
    getSession(token?: string, cookie?: string) {
      return db.transaction(() => {
        cleanup()
        const record = session(token)
        const validBootstrap = bootstrap(cookie)
        if (record && validBootstrap && record.csrf_hash === validBootstrap.cookie_hash) {
          return { user: userFor(record), csrfCookie: cookie!, sessionToken: token!, expiresAt: record.expires_at }
        }
        if (token) revoke(token)
        if (validBootstrap) return { user: null, csrfCookie: cookie!, expiresAt: validBootstrap.expires_at }
        assertCapacity('csrf_bootstraps')
        const csrfCookie = randomBytes(32).toString('base64url')
        const expiresAt = now() + BOOTSTRAP_TTL
        db.prepare('INSERT INTO csrf_bootstraps VALUES(?,?)').run(digest(csrfCookie), expiresAt)
        return { user: null, csrfCookie, expiresAt }
      })()
    },
    validCsrf(cookie?: string, token?: string) {
      cleanup()
      const validBootstrap = bootstrap(cookie)
      if (!validBootstrap) return false
      // Session cookie, when present, must be linked to this bootstrap.
      const record = session(token)
      return !token || Boolean(record && record.csrf_hash === validBootstrap.cookie_hash)
    },
    rotate(user: AuthUser, oldToken: string | undefined, oldCookie: string) {
      return db.transaction(() => {
        cleanup()
        // Revalidate after the asynchronous KDF. A concurrent logout/rotation revokes this bootstrap.
        const previous = bootstrap(oldCookie)
        const oldSession = session(oldToken)
        if (!previous || (oldToken && (!oldSession || oldSession.csrf_hash !== previous.cookie_hash))) return null
        revoke(oldToken, oldCookie)
        assertCapacity('sessions')
        assertCapacity('csrf_bootstraps')
        const token = randomBytes(32).toString('base64url')
        const csrfCookie = randomBytes(32).toString('base64url')
        const expiresAt = now() + SESSION_TTL
        db.prepare('INSERT INTO csrf_bootstraps VALUES(?,?)').run(digest(csrfCookie), expiresAt)
        db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(token), user.id, digest(csrfCookie), expiresAt)
        return { token, csrfCookie, expiresAt }
      })()
    },
    logout(token: string | undefined, cookie: string) {
      db.transaction(() => { cleanup(); revoke(token, cookie) })()
    },
  }
}

export type AuthStore = ReturnType<typeof createAuthStore>
