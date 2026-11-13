// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { INITIAL_PRODUCTS } from '../services/storeService'

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
    expect(products).toEqual(INITIAL_PRODUCTS)
    expect(products.map((p) => p.image)).toEqual([
      '/assets/hero_produtos.svg#orbit',
      '/assets/hero_produtos.svg#pulse',
      '/assets/hero_produtos.svg#wave',
    ])
    for (const product of products) {
      expect(fs.existsSync(path.join(originalCwd, 'public', product.image.split('#')[0]))).toBe(true)
    }
  })

  it('preserves existing product images and orders when reopening SQLite', async () => {
    const connection = db.getDatabase()
    connection.prepare('UPDATE products SET image = ? WHERE id = ?')
      .run('/assets/hero_produtos.svg#wave', 'prod-orbit')
    connection.prepare(`
      INSERT INTO orders
      SELECT ?, product_id, product_name, variant, quantity, total, placed_at, current_step
      FROM orders WHERE id = ?
    `).run('CS-EXISTING', 'CS-2048')
    const order = db.advanceOrderStep('CS-2048')
    connection.close()
    vi.resetModules()
    db = await import('./db')
    expect(db.getAllProducts()[0].image).toBe('/assets/hero_produtos.svg#wave')
    expect(db.getOrderWithEvents('CS-2048')).toEqual(order)
    expect(db.getOrderWithEvents('CS-EXISTING')).not.toBeNull()
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
    expect(db.getAllProducts()).toEqual(INITIAL_PRODUCTS)
    for (const product of db.getAllProducts()) {
      expect(fs.existsSync(path.join(originalCwd, 'public', product.image.split('#')[0]))).toBe(true)
    }
  })
})
