import Database from 'better-sqlite3'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import fs from 'node:fs'
import pathModule from 'node:path'
import { AuthCapacityError, hashPassword, isValidPassword, normalizeEmail, verifyPassword } from './password.ts'

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
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
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
