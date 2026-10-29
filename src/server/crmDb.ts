import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { CRM_STAGES } from '../types/crm.ts'
import type { CrmContact, CrmContactInput, CrmContactsResponse, CrmNote, CrmNotesResponse, CrmStage } from '../types/crm.ts'

type Connection = Database.Database
export class CrmError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
export function invalidCrmData(): never {
  throw new CrmError(400, 'Dados do CRM inválidos')
}
export function isCrmStage(value: unknown): value is CrmStage {
  return typeof value === 'string' && CRM_STAGES.includes(value as CrmStage)
}
export function validateContactInput(value: unknown): CrmContactInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalidCrmData()
  const fields = value as Record<string, unknown>
  const keys = ['name', 'email', 'phone', 'company', 'stage']
  if (Object.keys(fields).length !== keys.length || !keys.every((key) => typeof fields[key] === 'string')) return invalidCrmData()
  const name = (fields.name as string).trim()
  const email = (fields.email as string).trim().toLowerCase()
  const phone = (fields.phone as string).trim()
  const company = (fields.company as string).trim()
  if (!name || name.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || phone.length > 40 || company.length > 120 || !isCrmStage(fields.stage)) return invalidCrmData()
  return { name, email, phone, company, stage: fields.stage }
}
export function validateNoteInput(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalidCrmData()
  const fields = value as Record<string, unknown>
  if (Object.keys(fields).length !== 1 || typeof fields.body !== 'string') return invalidCrmData()
  const body = fields.body.trim()
  if (!body || body.length > 2000) return invalidCrmData()
  return body
}

/** Called with the existing connection: no singleton import or product-reset coupling. */
export function initializeCrmDatabase(db: Connection): void {
  db.transaction(() => {
    const existing = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'crm_contacts'").get()
    db.exec(`
      CREATE TABLE IF NOT EXISTS crm_contacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE CHECK (email = lower(trim(email))),
        phone TEXT NOT NULL,
        company TEXT NOT NULL,
        stage TEXT NOT NULL CHECK (stage IN ('novo', 'contato', 'qualificado', 'cliente', 'perdido')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS crm_notes (
        id TEXT PRIMARY KEY,
        contact_id TEXT NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS crm_contacts_updated ON crm_contacts(updated_at DESC, id ASC);
      CREATE INDEX IF NOT EXISTS crm_notes_contact_created ON crm_notes(contact_id, created_at DESC, id ASC);
    `)
    if (existing) return
    for (const [name, email, company, stage] of [
      ['Ana Demo', 'ana@example.com', 'Aurora Demo', 'novo'],
      ['Bruno Demo', 'bruno@example.com', 'Horizonte Demo', 'contato'],
      ['Carla Demo', 'carla@example.com', 'Norte Demo', 'qualificado'],
      ['Diego Demo', 'diego@example.com', 'Órbita Demo', 'cliente'],
      ['Elisa Demo', 'elisa@example.com', 'Vale Demo', 'perdido'],
    ]) {
      createContact(db, { name, email, company, stage, phone: '' })
    }
  })()
}

const CONTACT_COLUMNS = 'id, name, email, phone, company, stage, created_at AS createdAt, updated_at AS updatedAt'
const NOTE_COLUMNS = 'id, contact_id AS contactId, body, created_at AS createdAt'
export function getContact(db: Connection, id: string): CrmContact | null {
  return db.prepare(`SELECT ${CONTACT_COLUMNS} FROM crm_contacts WHERE id = ?`).get(id) as CrmContact | undefined ?? null
}
function requireContact(db: Connection, id: string): CrmContact {
  const contact = getContact(db, id)
  if (!contact) throw new CrmError(404, 'Contato não encontrado')
  return contact
}
function writeContact<T>(operation: () => T): T {
  try { return operation() } catch (error) {
    if ((error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') throw new CrmError(409, 'E-mail já cadastrado')
    throw error
  }
}
export function createContact(db: Connection, value: unknown): CrmContact {
  const input = validateContactInput(value)
  return writeContact(() => db.transaction(() => {
    const id = randomUUID()
    const now = new Date().toISOString()
    db.prepare('INSERT INTO crm_contacts (id, name, email, phone, company, stage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, input.name, input.email, input.phone, input.company, input.stage, now, now)
    return requireContact(db, id)
  })())
}
export function updateContact(db: Connection, id: string, value: unknown): CrmContact {
  const input = validateContactInput(value)
  return writeContact(() => db.transaction(() => {
    const previous = requireContact(db, id)
    const now = nextUpdatedAt(previous.updatedAt)
    db.prepare('UPDATE crm_contacts SET name = ?, email = ?, phone = ?, company = ?, stage = ?, updated_at = ? WHERE id = ?')
      .run(input.name, input.email, input.phone, input.company, input.stage, now, id)
    return requireContact(db, id)
  })())
}
function nextUpdatedAt(previous: string): string {
  return new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString()
}
export function deleteContact(db: Connection, id: string): void {
  db.transaction(() => {
    requireContact(db, id)
    db.prepare('DELETE FROM crm_contacts WHERE id = ?').run(id)
  })()
}
export interface ContactQuery { q?: string; stage?: CrmStage; limit?: number; offset?: number }
function pagination(limit = 50, offset = 0): { limit: number; offset: number } {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || offset > 100000) return invalidCrmData()
  return { limit, offset }
}
export function listContacts(db: Connection, query: ContactQuery = {}): CrmContactsResponse {
  const { limit, offset } = pagination(query.limit, query.offset)
  if (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 100)) return invalidCrmData()
  if (query.stage !== undefined && !isCrmStage(query.stage)) return invalidCrmData()
  return db.transaction(() => {
    const clauses: string[] = []
    const values: string[] = []
    if (query.q) {
      clauses.push("(name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\')")
      const literal = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`
      values.push(literal, literal, literal, literal)
    }
    if (query.stage) { clauses.push('stage = ?'); values.push(query.stage) }
    const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''
    const contacts = db.prepare(`SELECT ${CONTACT_COLUMNS} FROM crm_contacts${where} ORDER BY updated_at DESC, id ASC LIMIT ? OFFSET ?`)
      .all(...values, limit, offset) as CrmContact[]
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM crm_contacts${where}`).get(...values) as { total: number }
    const byStage = Object.fromEntries(CRM_STAGES.map((stage) => [stage, 0])) as Record<CrmStage, number>
    for (const row of db.prepare('SELECT stage, COUNT(*) AS count FROM crm_contacts GROUP BY stage').all() as { stage: CrmStage; count: number }[]) {
      byStage[row.stage] = row.count
    }
    return { contacts, total, summary: { total: Object.values(byStage).reduce((a, b) => a + b, 0), byStage } }
  })()
}
export function listNotes(db: Connection, contactId: string, limit = 50, offset = 0): CrmNotesResponse {
  pagination(limit, offset)
  return db.transaction(() => {
    requireContact(db, contactId)
    const notes = db.prepare(`SELECT ${NOTE_COLUMNS} FROM crm_notes WHERE contact_id = ? ORDER BY created_at DESC, id ASC LIMIT ? OFFSET ?`)
      .all(contactId, limit, offset) as CrmNote[]
    const { total } = db.prepare('SELECT COUNT(*) AS total FROM crm_notes WHERE contact_id = ?').get(contactId) as { total: number }
    return { notes, total }
  })()
}
export function createNote(db: Connection, contactId: string, value: unknown): CrmNote {
  const body = validateNoteInput(value)
  return db.transaction(() => {
    const contact = requireContact(db, contactId)
    const note: CrmNote = { id: randomUUID(), contactId, body, createdAt: new Date().toISOString() }
    db.prepare('INSERT INTO crm_notes (id, contact_id, body, created_at) VALUES (?, ?, ?, ?)').run(note.id, contactId, body, note.createdAt)
    db.prepare('UPDATE crm_contacts SET updated_at = ? WHERE id = ?').run(nextUpdatedAt(contact.updatedAt), contactId)
    return note
  })()
}
