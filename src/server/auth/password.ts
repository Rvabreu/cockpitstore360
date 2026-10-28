import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

export const SCRYPT_PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
let activeKdfs = 0
export class AuthCapacityError extends Error {
  retryAfter = 60
  constructor() { super('Muitas tentativas. Tente novamente mais tarde.') }
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length <= 254 && /^[\x21-\x7e]+$/.test(email) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

export function isValidPassword(value: unknown, minimum = 1): value is string {
  return typeof value === 'string' && value.length >= minimum && value.length <= 256 && Buffer.byteLength(value, 'utf8') <= 1024
}

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  if (activeKdfs >= 4) throw new AuthCapacityError()
  ++activeKdfs
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, salt, 64, SCRYPT_PARAMS, (error, key) => error ? reject(error) : resolve(key))
    })
  } finally { --activeKdfs }
}

export async function hashPassword(password: string) {
  if (!isValidPassword(password)) throw new Error('Senha inválida.')
  const salt = randomBytes(16)
  return { salt: salt.toString('hex'), hash: (await derive(password, salt)).toString('hex') }
}

export async function verifyPassword(password: string, stored: { salt: string; hash: string }): Promise<boolean> {
  const key = await derive(password, Buffer.from(stored.salt, 'hex'))
  const expected = Buffer.from(stored.hash, 'hex')
  return expected.length === key.length && timingSafeEqual(key, expected)
}
