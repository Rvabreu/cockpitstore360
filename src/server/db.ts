import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import { initializeCrmDatabase } from './crmDb.ts'
import type { OrderEvent, OrderWithEvents, Product } from '../types/store.ts'
import { INITIAL_PRODUCTS, INITIAL_ORDER } from '../services/storeService.ts'
import {
  createToken, DUMMY_PASSWORD_HASH, hashPassword, hashToken, normalizeEmail,
  SESSION_LIFETIME_MS, validCredentials, validToken, verifyPassword,
} from './auth.ts'

const AWAITING_DETAIL = 'Aguardando atualização'

const DB_DIR = path.resolve(process.cwd(), 'data')
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}
const DB_PATH = path.join(DB_DIR, 'store.db')

let dbInstance: InstanceType<typeof Database> | null = null

export function getDatabase(): InstanceType<typeof Database> {
  if (dbInstance?.open) {
    return dbInstance
  }

  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Schema creation
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      price REAL NOT NULL,
      image TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      variant TEXT,
      quantity INTEGER NOT NULL,
      total REAL NOT NULL,
      placed_at TEXT NOT NULL,
      current_step INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_events (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('customer', 'admin')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
  `)

  // User migration/seed is independent of the product seed, including old DBs.
  db.transaction(() => seedUsers(db))()
  initializeCrmDatabase(db)

  // Check if seed needed
  const countRow = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number }
  if (countRow.count === 0) {
    seedDatabase(db)
  }

  dbInstance = db
  return dbInstance
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'customer' | 'admin'
}

export function getUserById(id: string): AuthUser | null {
  return getDatabase().prepare('SELECT id, name, email, role FROM users WHERE id = ?')
    .get(id) as AuthUser | undefined ?? null
}

export function authenticateUser(email: string, password: string): AuthUser | null {
  if (!validCredentials(email, password)) return null
  const row = getDatabase().prepare('SELECT id, password_hash FROM users WHERE email = ?')
    .get(normalizeEmail(email)) as { id: string; password_hash: string } | undefined
  const verified = verifyPassword(password, row?.password_hash ?? DUMMY_PASSWORD_HASH)
  return row && verified ? getUserById(row.id) : null
}

export function createSession(userId: string): string {
  const token = createToken()
  const db = getDatabase()
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(hashToken(token), userId, Date.now() + SESSION_LIFETIME_MS)
  return token
}

export function getUserBySession(token: string): AuthUser | null {
  if (!validToken(token)) return null
  const session = getDatabase().prepare('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?')
    .get(hashToken(token), Date.now()) as { user_id: string } | undefined
  return session ? getUserById(session.user_id) : null
}

export function revokeSession(token: string): void {
  if (validToken(token)) {
    getDatabase().prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
  }
}

// Called inside a transaction by initialization and explicit seed/reset alike.
function seedUsers(db: InstanceType<typeof Database>): void {
  const users = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }
  if (users.count !== 0) return
  const insert = db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const createdAt = new Date().toISOString()
  insert.run('demo-customer', 'Cliente Demo', 'cliente@cockpitstore360.com.br', hashPassword('demo123'), 'customer', createdAt)
  insert.run('demo-admin', 'Administrador Demo', 'admin@cockpitstore360.com.br', hashPassword('admin123'), 'admin', createdAt)
}

export function seedDatabase(db: InstanceType<typeof Database> = getDatabase()) {
  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, description, category, price, image, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const insertOrder = db.prepare(`
    INSERT INTO orders (id, product_id, product_name, variant, quantity, total, placed_at, current_step)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertEvent = db.prepare(`
    INSERT INTO order_events (id, order_id, step_index, title, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    seedUsers(db)
    db.prepare('DELETE FROM order_events').run()
    db.prepare('DELETE FROM orders').run()
    db.prepare('DELETE FROM products').run()

    // Products seeded with ascending created_at (matches INITIAL_PRODUCTS order).
    for (const p of INITIAL_PRODUCTS) {
      insertProduct.run(p.id, p.name, p.description || '', p.category || '', p.price, p.image, p.createdAt)
    }

    insertOrder.run(
      INITIAL_ORDER.id,
      INITIAL_ORDER.productId,
      INITIAL_ORDER.productName,
      INITIAL_ORDER.variant,
      INITIAL_ORDER.quantity,
      INITIAL_ORDER.total,
      INITIAL_ORDER.placedAt,
      INITIAL_ORDER.currentStep
    )

    for (const e of INITIAL_ORDER.events) {
      insertEvent.run(
        `evt-cs2048-${e.stepIndex}`,
        INITIAL_ORDER.id,
        e.stepIndex,
        e.title,
        e.detail,
        `2026-10-${19 + e.stepIndex}T00:00:00.000Z`
      )
    }
  })

  transaction()
}

export function getAllProducts(): Product[] {
  const db = getDatabase()
  // R3-4: ASC ordering is an intentional divergence from stockcontrol's DESC so
  // products render in mockup order: Orbit, Pulse, Wave.
  const rows = db.prepare('SELECT * FROM products ORDER BY created_at ASC').all() as Array<{
    id: string
    name: string
    description: string
    category: string
    price: number
    image: string
    created_at: string
  }>

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    price: r.price,
    image: r.image,
    createdAt: r.created_at,
  }))
}

export function getOrderWithEvents(id: string): OrderWithEvents | null {
  const db = getDatabase()
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as
    | {
        id: string
        product_id: string
        product_name: string
        variant: string
        quantity: number
        total: number
        placed_at: string
        current_step: number
      }
    | undefined

  if (!order) return null

  const eventRows = db
    .prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY step_index ASC')
    .all(order.id) as Array<{
    step_index: number
    title: string
    detail: string
  }>

  const events: OrderEvent[] = eventRows.map((e) => ({
    stepIndex: e.step_index,
    title: e.title,
    detail: e.detail,
    displayDetail: e.step_index <= order.current_step ? e.detail : AWAITING_DETAIL,
    status:
      e.step_index < order.current_step
        ? 'done'
        : e.step_index === order.current_step
          ? 'current'
          : 'pending',
  }))

  return {
    id: order.id,
    productId: order.product_id,
    productName: order.product_name,
    variant: order.variant,
    quantity: order.quantity,
    total: order.total,
    placedAt: order.placed_at,
    currentStep: order.current_step,
    statusLabel: events[order.current_step]?.title ?? '',
    events,
  }
}

// Sole writer of current_step. Wraps to 0 after the last event (mockup advance()).
export function advanceOrderStep(id: string): OrderWithEvents | null {
  const db = getDatabase()
  const order = db.prepare('SELECT current_step FROM orders WHERE id = ?').get(id) as
    | { current_step: number }
    | undefined

  if (!order) return null

  const eventCount = (
    db.prepare('SELECT COUNT(*) as count FROM order_events WHERE order_id = ?').get(id) as {
      count: number
    }
  ).count

  const nextStep = order.current_step >= eventCount - 1 ? 0 : order.current_step + 1
  db.prepare('UPDATE orders SET current_step = ? WHERE id = ?').run(nextStep, id)

  return getOrderWithEvents(id)
}
