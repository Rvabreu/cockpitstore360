import Database from 'better-sqlite3'
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const SCRYPT = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }
export const AUTH_TTL = 8 * 60 * 60 * 1000
export const ANON_TTL = 60 * 60 * 1000
export const RATE_WINDOW = 15 * 60 * 1000
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const secret = () => randomBytes(32).toString('base64url')

export function authConfig(env: NodeJS.ProcessEnv = process.env) {
  const origin = env.AUTH_ORIGIN ?? (env.NODE_ENV === 'production' ? '' : 'http://localhost:5000')
  let url: URL
  try { url = new URL(origin) } catch { throw new Error('AUTH_ORIGIN inválida') }
  if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol) ||
      (env.NODE_ENV === 'production' && url.protocol !== 'https:')) {
    throw new Error('AUTH_ORIGIN deve ser uma origem exata (HTTPS em produção)')
  }
  return { origin, secure: url.protocol === 'https:', cookieName: url.protocol === 'https:' ? '__Host-cockpit-session' : 'cockpit-session' }
}

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, SCRYPT, (err, key) => err ? reject(err) : resolve(key))
  })
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${(await derive(password, salt)).toString('hex')}`
}

// Missing accounts execute the same expensive derivation.
const FAKE_HASH = `${'0'.repeat(32)}:${'0'.repeat(128)}`
// Cannot be a scrypt encoding, including on databases with password_hash NOT NULL.
const SOCIAL_PASSWORD = '!social-only!'
export async function verifyPassword(password: string, encoded = FAKE_HASH) {
  const local = /^[a-f0-9]{32}:[a-f0-9]{128}$/.test(encoded)
  const [salt, expected] = (local ? encoded : FAKE_HASH).split(':')
  const actual = await derive(password, salt)
  const key = Buffer.from(expected, 'hex')
  return local && key.length === actual.length && timingSafeEqual(key, actual)
}

export function normalizeEmail(value: string) { return value.trim().toLowerCase() }
export function validEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}
export function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 12 && Buffer.byteLength(value) <= 1024
}

export type Session = { id_hash: string; user_id: number | null; csrf: string; expires_at: number }
export type GoogleFlow = { state_hash: string; binding_hash: string; session_hash: string; verifier: string; nonce: string; return_to: string; expires_at: number }
export const GOOGLE_FLOW_TTL = 5 * 60 * 1000

export class AuthStore {
  readonly db: InstanceType<typeof Database>
  readonly now: () => number
  private activeHashes = 0

  constructor(filename = process.env.AUTH_DB_PATH ?? path.resolve('data/auth.db'), now = Date.now) {
    this.now = now
    if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 })
    this.db = new Database(filename)
    if (filename !== ':memory:') fs.chmodSync(filename, 0o600)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('busy_timeout = 5000')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS auth_users (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_sessions (id_hash TEXT PRIMARY KEY, user_id INTEGER, csrf TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_at);
      CREATE TABLE IF NOT EXISTS auth_identities (provider TEXT NOT NULL, subject TEXT NOT NULL, user_id INTEGER NOT NULL REFERENCES auth_users(id), PRIMARY KEY(provider,subject), UNIQUE(provider,user_id));
      CREATE TABLE IF NOT EXISTS auth_google_flows (state_hash TEXT PRIMARY KEY, binding_hash TEXT NOT NULL, session_hash TEXT NOT NULL UNIQUE, verifier TEXT NOT NULL, nonce TEXT NOT NULL, return_to TEXT NOT NULL, expires_at INTEGER NOT NULL);
    `)
  }

  close() { this.db.close() }

  async provision(email: string, password: string) {
    if (!validEmail(email) || !validPassword(password)) throw new Error('Credenciais de provisionamento inválidas')
    const encoded = await hashPassword(password)
    this.db.transaction(() => {
      const social = this.db.prepare('SELECT 1 FROM auth_identities WHERE user_id=(SELECT id FROM auth_users WHERE email=?)').get(normalizeEmail(email))
      if (social) throw new Error('Credenciais de provisionamento inválidas')
      this.db.prepare('INSERT INTO auth_users(email,password_hash) VALUES (?,?) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash').run(normalizeEmail(email), encoded)
      this.db.prepare('DELETE FROM auth_sessions WHERE user_id=(SELECT id FROM auth_users WHERE email=?)').run(normalizeEmail(email))
    })()
  }

  session(raw: string | undefined): Session | undefined {
    if (!raw || !/^[A-Za-z0-9_-]{43}$/.test(raw)) return undefined
    return this.db.prepare('SELECT * FROM auth_sessions WHERE id_hash=? AND expires_at>?').get(digest(raw), this.now()) as Session | undefined
  }

  rotate(old: Session | undefined, userId: number | null = null) {
    const raw = secret()
    const session: Session = { id_hash: digest(raw), user_id: userId, csrf: secret(), expires_at: this.now() + (userId === null ? ANON_TTL : AUTH_TTL) }
    this.db.transaction(() => {
      if (old) this.db.prepare('DELETE FROM auth_sessions WHERE id_hash=?').run(old.id_hash)
      this.db.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').run(this.now())
      this.db.prepare('INSERT INTO auth_sessions VALUES (?,?,?,?)').run(session.id_hash, session.user_id, session.csrf, session.expires_at)
    })()
    return { raw, session }
  }

  consumeAttempt(email: string, ip: string): boolean {
    return this.db.transaction(() => {
      const now = this.now()
      this.db.prepare('DELETE FROM auth_limits WHERE expires_at<=?').run(now)
      const keys = [`email:${digest(normalizeEmail(email))}`, `ip:${digest(ip)}`]
      const blocked = keys.some((key, index) => {
        const row = this.db.prepare('SELECT attempts FROM auth_limits WHERE key=?').get(key) as { attempts: number } | undefined
        return (row?.attempts ?? 0) >= (index === 0 ? 5 : 30)
      })
      if (blocked) return false
      for (const key of keys) this.db.prepare('INSERT INTO auth_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1').run(key, now + RATE_WINDOW)
      return true
    })()
  }

  consumeAnonymous(ip: string) {
    const key = `anonymous:${digest(ip)}`
    const now = this.now()
    return this.db.transaction(() => {
      this.db.prepare('DELETE FROM auth_limits WHERE expires_at<=?').run(now)
      const row = this.db.prepare('SELECT attempts FROM auth_limits WHERE key=?').get(key) as { attempts: number } | undefined
      if ((row?.attempts ?? 0) >= 120) return false
      this.db.prepare('INSERT INTO auth_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1').run(key, now + RATE_WINDOW)
      return true
    })()
  }

  consumeGoogleAttempt(kind: 'start' | 'callback', ip: string) {
    const key = `google:${kind}:${digest(ip)}`
    return this.db.transaction(() => {
      const now = this.now()
      this.db.prepare('DELETE FROM auth_limits WHERE expires_at<=?').run(now)
      const row = this.db.prepare('SELECT attempts FROM auth_limits WHERE key=?').get(key) as { attempts: number } | undefined
      if ((row?.attempts ?? 0) >= (kind === 'start' ? 20 : 60)) return false
      this.db.prepare('INSERT INTO auth_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1').run(key, now + RATE_WINDOW)
      return true
    })()
  }

  startGoogle(session: Session, returnTo: string) {
    const state = secret(), binding = secret(), verifier = secret(), nonce = secret()
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM auth_google_flows WHERE expires_at<=? OR session_hash=?').run(this.now(), session.id_hash)
      this.db.prepare('INSERT INTO auth_google_flows VALUES (?,?,?,?,?,?,?)').run(digest(state), digest(binding), session.id_hash, verifier, nonce, returnTo, this.now() + GOOGLE_FLOW_TTL)
    })()
    return { state, binding, verifier, nonce }
  }

  consumeGoogle(state: string, binding: string | undefined, session: Session | undefined): GoogleFlow | undefined {
    if (!/^[A-Za-z0-9_-]{43}$/.test(state)) return undefined
    return this.db.transaction(() => {
      const flow = this.db.prepare('SELECT * FROM auth_google_flows WHERE state_hash=?').get(digest(state)) as GoogleFlow | undefined
      // Consume before any provider request, even when binding/expiry is invalid.
      this.db.prepare('DELETE FROM auth_google_flows WHERE state_hash=?').run(digest(state))
      if (!flow || flow.expires_at <= this.now() || !binding || !/^[A-Za-z0-9_-]{43}$/.test(binding) ||
          flow.binding_hash !== digest(binding) || !session || flow.session_hash !== session.id_hash) return undefined
      return flow
    })()
  }

  finishGoogle(flow: GoogleFlow, subject: string, email: string) {
    return this.db.transaction(() => {
      // This final check and account creation + rotation are one synchronous transaction.
      const old = this.db.prepare('SELECT * FROM auth_sessions WHERE id_hash=? AND expires_at>?').get(flow.session_hash, this.now()) as Session | undefined
      if (!old || flow.expires_at <= this.now()) throw new Error('Fluxo inválido')
      const identity = this.db.prepare("SELECT user_id FROM auth_identities WHERE provider='google' AND subject=?").get(subject) as { user_id: number } | undefined
      let userId = identity?.user_id
      if (userId === undefined) {
        // Deliberately never bind an existing account by email, even another social account.
        const inserted = this.db.prepare('INSERT INTO auth_users(email,password_hash) VALUES (?,?)').run(normalizeEmail(email), SOCIAL_PASSWORD)
        userId = Number(inserted.lastInsertRowid)
        this.db.prepare("INSERT INTO auth_identities(provider,subject,user_id) VALUES ('google',?,?)").run(subject, userId)
      }
      return this.rotate(old, userId)
    })()
  }

  async authenticate(email: string, password: string) {
    if (this.activeHashes >= 4) return undefined
    this.activeHashes++
    try {
      const row = this.db.prepare('SELECT id,password_hash FROM auth_users WHERE email=?').get(normalizeEmail(email)) as { id: number; password_hash: string } | undefined
      const matches = await verifyPassword(password, row?.password_hash)
      const current = row ? this.db.prepare('SELECT password_hash FROM auth_users WHERE id=?').get(row.id) as { password_hash: string } | undefined : undefined
      return matches && row && current?.password_hash === row.password_hash ? row.id : null
    } finally { this.activeHashes-- }
  }
}
