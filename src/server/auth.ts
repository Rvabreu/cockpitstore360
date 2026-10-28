import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function validCredentials(email: unknown, password: unknown): email is string {
  return typeof email === 'string' && typeof password === 'string'
    && normalizeEmail(email).length > 0 && email.length <= 254
    && password.length > 0 && password.length <= 1024
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

// Use the same costly verification for an unknown email, without exposing users.
export const DUMMY_PASSWORD_HASH = hashPassword(randomBytes(32).toString('hex'))

export function verifyPassword(password: string, encoded: string): boolean {
  const match = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(encoded)
  if (!match) return false
  const actual = scryptSync(password, match[1], 64)
  return timingSafeEqual(actual, Buffer.from(match[2], 'hex'))
}

export function createToken(): string {
  return randomBytes(32).toString('hex')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function validToken(token: unknown): token is string {
  return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)
}
