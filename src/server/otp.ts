import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { normalizeEmail, RATE_WINDOW } from './auth.ts'
import type { AuthStore, Session } from './auth.ts'

export const OTP_TTL = 5 * 60 * 1000
const OTP_PASSWORD = '!otp-demo-only!'
const INVALID = 'Não foi possível validar o código. Solicite outro ou use seu acesso original.'
type Challenge = { email_hash: string; session_hash: string; nonce: string; code_hash: string; expires_at: number; attempts: number }
export type OtpOptions = { env?: NodeJS.ProcessEnv }

export class OtpError extends Error {
  readonly status: number
  readonly retryAfter?: number
  constructor(status: number, message: string, retryAfter?: number) {
    super(message)
    this.status = status
    this.retryAfter = retryAfter
  }
}

// This delivery is intentionally demo-only. No preview may grant access to an
// existing local/Google account or an OTP identity without explicit demo provenance.
export class OtpService {
  readonly demo: boolean
  private readonly key: Buffer

  constructor(privateStore: AuthStore, options: OtpOptions = {}) {
    this.store = privateStore
    const env = options.env ?? process.env
    this.demo = env.NODE_ENV === 'development' || env.AUTH_OTP_DEMO_PREVIEW === 'true'
    this.store.db.exec(`
      CREATE TABLE IF NOT EXISTS auth_otp_settings (name TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_otp_challenges (session_hash TEXT PRIMARY KEY, email_hash TEXT NOT NULL, nonce TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS auth_otp_expiry ON auth_otp_challenges(expires_at);
      CREATE TABLE IF NOT EXISTS auth_otp_provenance (user_id INTEGER PRIMARY KEY REFERENCES auth_users(id), delivery TEXT NOT NULL);
    `)
    this.key = this.store.db.transaction(() => {
      this.store.db.prepare("INSERT OR IGNORE INTO auth_otp_settings VALUES ('hmac-key',?)").run(randomBytes(32).toString('hex'))
      const row = this.store.db.prepare("SELECT value FROM auth_otp_settings WHERE name='hmac-key'").get() as { value: string }
      if (!/^[a-f0-9]{64}$/.test(row.value)) throw new Error('Configuração OTP inválida')
      return Buffer.from(row.value, 'hex')
    })()
  }

  private readonly store: AuthStore
  private hash(...values: string[]) { return createHmac('sha256', this.key).update(JSON.stringify(values)).digest('hex') }
  private available() {
    if (!this.demo) throw new OtpError(503, 'Acesso por código indisponível neste ambiente. Use seu acesso original.')
  }
  private limit(kind: 'request' | 'verify', email: string, ip: string) {
    const retry = this.store.db.transaction(() => {
      const now = this.store.now()
      this.store.db.prepare('DELETE FROM auth_limits WHERE expires_at<=?').run(now)
      const keys = [`otp:${kind}:email:${this.hash(email)}`, `otp:${kind}:ip:${this.hash(ip)}`]
      const rows = keys.map((key) => this.store.db.prepare('SELECT attempts,expires_at FROM auth_limits WHERE key=?').get(key) as { attempts: number; expires_at: number } | undefined)
      const blocked = rows.filter((row, index) => row && row.attempts >= (index === 0 ? 5 : 30))
      if (blocked.length) return Math.max(...blocked.map((row) => Math.ceil((row!.expires_at - now) / 1000)))
      for (const key of keys) this.store.db.prepare('INSERT INTO auth_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1').run(key, now + RATE_WINDOW)
      return 0
    })()
    if (retry) throw new OtpError(429, 'Muitas tentativas. Aguarde e tente novamente.', retry)
  }
  private live(session: Session) {
    return this.store.db.prepare('SELECT * FROM auth_sessions WHERE id_hash=? AND expires_at>?').get(session.id_hash, this.store.now()) as Session | undefined
  }

  request(rawEmail: string, session: Session, ip: string) {
    this.available()
    const email = normalizeEmail(rawEmail)
    this.limit('request', email, ip)
    return this.store.db.transaction(() => {
      if (!this.live(session)) throw new OtpError(403, 'Requisição não autorizada.')
      const emailHash = this.hash(email), nonce = randomBytes(32).toString('hex')
      const previous = this.store.db.prepare('SELECT * FROM auth_otp_challenges WHERE email_hash=?').get(emailHash) as Challenge | undefined
      let code: string
      do { code = randomInt(0, 1000000).toString().padStart(6, '0') } while (previous && this.hash(emailHash, previous.session_hash, previous.nonce, code) === previous.code_hash)
      const expiresAt = this.store.now() + OTP_TTL
      this.store.db.prepare('DELETE FROM auth_otp_challenges WHERE expires_at<=? OR session_hash=? OR email_hash=?').run(this.store.now(), session.id_hash, emailHash)
      this.store.db.prepare('INSERT INTO auth_otp_challenges VALUES (?,?,?,?,?,0)').run(session.id_hash, emailHash, nonce, this.hash(emailHash, session.id_hash, nonce, code), expiresAt)
      // Limits live independently of challenges: resending or rotating the
      // browser session cannot reset the email/IP verification budget.
      return { expiresAt, demo: true as const, demoCode: code }
    })()
  }

  verify(rawEmail: string, code: string, session: Session, ip: string) {
    this.available()
    const email = normalizeEmail(rawEmail)
    this.limit('verify', email, ip)
    const result = this.store.db.transaction(() => {
      const old = this.live(session)
      const challenge = this.store.db.prepare('SELECT * FROM auth_otp_challenges WHERE session_hash=?').get(session.id_hash) as Challenge | undefined
      const actual = this.hash(this.hash(email), session.id_hash, challenge?.nonce ?? '', code)
      const expected = challenge?.code_hash ?? '0'.repeat(64)
      const matches = timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'))
      if (!old || !challenge || challenge.email_hash !== this.hash(email) || challenge.expires_at <= this.store.now() || challenge.attempts >= 5) return undefined
      this.store.db.prepare('UPDATE auth_otp_challenges SET attempts=attempts+1 WHERE session_hash=?').run(session.id_hash)
      if (!matches) return undefined
      this.store.db.prepare('DELETE FROM auth_otp_challenges WHERE session_hash=?').run(session.id_hash)
      const existing = this.store.db.prepare('SELECT id,password_hash FROM auth_users WHERE email=?').get(email) as { id: number; password_hash: string } | undefined
      let userId: number
      if (existing) {
        const identity = this.store.db.prepare("SELECT 1 FROM auth_identities i JOIN auth_otp_provenance p ON p.user_id=i.user_id WHERE i.provider='otp' AND i.subject=? AND i.user_id=? AND p.delivery='demo'").get(this.hash('identity', email), existing.id)
        const other = this.store.db.prepare("SELECT 1 FROM auth_identities WHERE user_id=? AND provider!='otp'").get(existing.id)
        if (!identity || other || existing.password_hash !== OTP_PASSWORD) return undefined
        userId = existing.id
      } else {
        userId = Number(this.store.db.prepare('INSERT INTO auth_users(email,password_hash) VALUES (?,?)').run(email, OTP_PASSWORD).lastInsertRowid)
        this.store.db.prepare("INSERT INTO auth_identities VALUES ('otp',?,?)").run(this.hash('identity', email), userId)
        this.store.db.prepare("INSERT INTO auth_otp_provenance VALUES (?,'demo')").run(userId)
      }
      // Single-use consumption, account creation and session/CSRF rotation
      // commit atomically; no asynchronous gap exists inside this transaction.
      return this.store.rotate(old, userId)
    })()
    if (!result) throw new OtpError(401, INVALID)
    return result
  }
}
