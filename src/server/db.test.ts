// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// db.ts resolves its data/ dir from process.cwd() at import time and keeps a
// singleton connection, so we point cwd at a fresh temp dir BEFORE importing it.
let tmpDir: string
const originalCwd = process.cwd()

let db: typeof import('./db')

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-store-db-'))
  process.chdir(tmpDir)
  db = await import('./db')
  // Force seeding on the fresh DB.
  db.getDatabase()
})

afterAll(() => {
  db.getDatabase().close()
  process.chdir(originalCwd)
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('getAllProducts', () => {
  it('returns 3 products in Orbit, Pulse, Wave order (R3-4 ASC)', () => {
    const products = db.getAllProducts()
    expect(products).toHaveLength(3)
    expect(products.map((p) => p.name)).toEqual([
      'Orbit Headphones Pro',
      'Pulse Watch S2',
      'Wave Mini Speaker',
    ])
    expect(products[0].image).toBe('/assets/hero_produtos.svg#orbit')
  })
})

describe('getOrderWithEvents', () => {
  it('returns CS-2048 with 4 events and derived status/displayDetail/statusLabel', () => {
    db.seedDatabase()
    const order = db.getOrderWithEvents('CS-2048')
    expect(order).not.toBeNull()
    expect(order!.events).toHaveLength(4)
    expect(order!.currentStep).toBe(1)
    expect(order!.statusLabel).toBe('Em separação')

    const [done, current, pendingA, pendingB] = order!.events
    expect(done.status).toBe('done')
    expect(done.displayDetail).toBe('19 out · 10h12')
    expect(current.status).toBe('current')
    expect(current.displayDetail).toBe('20 out · 08h35')
    expect(pendingA.status).toBe('pending')
    expect(pendingA.displayDetail).toBe('Aguardando atualização')
    expect(pendingB.status).toBe('pending')
    expect(pendingB.displayDetail).toBe('Aguardando atualização')
  })

  it('returns null for an unknown order id', () => {
    expect(db.getOrderWithEvents('NOPE')).toBeNull()
  })
})

describe('advanceOrderStep', () => {
  it('increments the step and wraps 3 -> 0', () => {
    db.seedDatabase() // currentStep = 1
    expect(db.advanceOrderStep('CS-2048')!.currentStep).toBe(2)
    expect(db.advanceOrderStep('CS-2048')!.currentStep).toBe(3)
    // last step wraps back to 0
    expect(db.advanceOrderStep('CS-2048')!.currentStep).toBe(0)
  })

  it('returns null when the order is missing', () => {
    expect(db.advanceOrderStep('NOPE')).toBeNull()
  })
})

describe('seedDatabase', () => {
  it('is idempotent on reset', () => {
    db.advanceOrderStep('CS-2048')
    db.seedDatabase()
    const order = db.getOrderWithEvents('CS-2048')
    expect(order!.currentStep).toBe(1)
    expect(db.getAllProducts()).toHaveLength(3)
  })

  it('directly seeds empty users and preserves existing hashes and sessions on subsequent resets', () => {
    const connection = db.getDatabase()
    connection.exec('DELETE FROM sessions; DELETE FROM users;')
    db.seedDatabase(connection)
    expect(db.authenticateUser('cliente@cockpitstore360.com.br', 'demo123')).toEqual({
      id: 'demo-customer', name: 'Cliente Demo', email: 'cliente@cockpitstore360.com.br', role: 'customer',
    })
    expect(db.authenticateUser('admin@cockpitstore360.com.br', 'admin123')).toEqual({
      id: 'demo-admin', name: 'Administrador Demo', email: 'admin@cockpitstore360.com.br', role: 'admin',
    })
    const users = connection.prepare('SELECT * FROM users ORDER BY id').all()
    const token = db.createSession('demo-customer')
    const sessions = connection.prepare('SELECT * FROM sessions ORDER BY token_hash').all()
    db.seedDatabase(connection)
    expect(connection.prepare('SELECT * FROM users ORDER BY id').all()).toEqual(users)
    expect(connection.prepare('SELECT * FROM sessions ORDER BY token_hash').all()).toEqual(sessions)
    expect(db.getUserBySession(token)).toEqual(db.getUserById('demo-customer'))
  })
})

describe('users and persistent sessions', () => {
  it('seeds both demo users with salted scrypt hashes and returns only public fields', async () => {
    const { hashPassword, verifyPassword } = await import('./auth')
    for (const [email, password, name, role] of [
      ['cliente@cockpitstore360.com.br', 'demo123', 'Cliente Demo', 'customer'],
      ['admin@cockpitstore360.com.br', 'admin123', 'Administrador Demo', 'admin'],
    ]) {
      const user = db.authenticateUser(`  ${email.toUpperCase()}  `, password)!
      expect(user).toEqual({ id: expect.any(String), name, email, role })
      expect(db.getUserById(user.id)).toEqual(user)
      const stored = db.getDatabase().prepare('SELECT password_hash, created_at FROM users WHERE id = ?')
        .get(user.id) as { password_hash: string; created_at: string }
      expect(stored.password_hash).toMatch(/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/)
      expect(stored.password_hash).not.toContain(password)
      expect(verifyPassword(password, stored.password_hash)).toBe(true)
      expect(verifyPassword('wrong', stored.password_hash)).toBe(false)
      expect(Number.isNaN(Date.parse(stored.created_at))).toBe(false)
    }
    const first = hashPassword('same-password')
    expect(hashPassword('same-password')).not.toBe(first)
    expect(verifyPassword('password', 'broken-hash')).toBe(false)
    expect(db.authenticateUser('missing@example.com', 'demo123')).toBeNull()
    expect(db.authenticateUser('cliente@cockpitstore360.com.br', 'wrong')).toBeNull()
    expect(db.authenticateUser('x'.repeat(255), 'demo123')).toBeNull()
    expect(db.authenticateUser('cliente@cockpitstore360.com.br', 'x'.repeat(1025))).toBeNull()
    expect(db.getUserById('unknown')).toBeNull()
  })

  it('stores only token hashes with seven-day expiry and survives reconnect and product reset', async () => {
    const { hashToken, SESSION_LIFETIME_MS } = await import('./auth')
    const user = db.authenticateUser('cliente@cockpitstore360.com.br', 'demo123')!
    const before = Date.now()
    const token = db.createSession(user.id)
    expect(token).toMatch(/^[a-f0-9]{64}$/)
    expect(db.createSession(user.id)).not.toBe(token)
    const row = db.getDatabase().prepare('SELECT * FROM sessions WHERE token_hash = ?').get(hashToken(token)) as {
      token_hash: string; user_id: string; expires_at: number
    }
    expect(row.token_hash).not.toBe(token)
    expect(row.expires_at).toBeGreaterThanOrEqual(before + SESSION_LIFETIME_MS)
    expect(row.expires_at).toBeLessThanOrEqual(Date.now() + SESSION_LIFETIME_MS)
    db.getDatabase().close()
    expect(db.getUserBySession(token)).toEqual(user)
    db.seedDatabase()
    expect(db.getUserBySession(token)).toEqual(user)
    expect(db.authenticateUser(user.email, 'demo123')).toEqual(user)
    db.revokeSession(token)
    db.revokeSession(token)
    db.getDatabase().close()
    expect(db.getUserBySession(token)).toBeNull()
    expect(db.getUserBySession('invalid')).toBeNull()
  })

  it('rejects expired sessions, including the exact expiry boundary', async () => {
    const { hashToken } = await import('./auth')
    const token = db.createSession('demo-admin')
    db.getDatabase().prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?')
      .run(Date.now(), hashToken(token))
    expect(db.getUserBySession(token)).toBeNull()
  })

  it('migrates a preexisting product database and never reseeds nonempty users', () => {
    const products = db.getAllProducts()
    const connection = db.getDatabase()
    connection.exec('DROP TABLE sessions; DROP TABLE users;')
    connection.close()
    expect(db.authenticateUser('cliente@cockpitstore360.com.br', 'demo123')?.role).toBe('customer')
    expect(db.authenticateUser('admin@cockpitstore360.com.br', 'admin123')?.role).toBe('admin')
    expect(db.getAllProducts()).toEqual(products)
    db.getDatabase().prepare('DELETE FROM users WHERE role = ?').run('admin')
    db.getDatabase().prepare('UPDATE users SET name = ? WHERE id = ?').run('Nome mantido', 'demo-customer')
    db.getDatabase().close()
    expect(db.authenticateUser('admin@cockpitstore360.com.br', 'admin123')).toBeNull()
    db.seedDatabase()
    expect(db.getUserById('demo-customer')?.name).toBe('Nome mantido')
    expect(db.getDatabase().prepare('SELECT COUNT(*) AS count FROM users').get()).toEqual({ count: 1 })
  })
})
