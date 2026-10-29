// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createContact, createNote, deleteContact, getContact, initializeCrmDatabase, listContacts, listNotes, updateContact } from './crmDb'

let connection: Database.Database
const input = { name: '  Nome Demo  ', email: '  DEMO@EXAMPLE.COM  ', phone: ' 123 ', company: ' Empresa ', stage: 'novo' }
beforeEach(() => {
  connection = new Database(':memory:')
  connection.pragma('foreign_keys = ON')
  initializeCrmDatabase(connection)
})
afterEach(() => { connection.close() })

describe('CRM SQLite', () => {
  it('seeds one fictitious contact per stage only on schema creation, including empty DB restarts', () => {
    const seeded = listContacts(connection)
    expect(seeded.total).toBe(5)
    expect(seeded.summary.byStage).toEqual({ novo: 1, contato: 1, qualificado: 1, cliente: 1, perdido: 1 })
    expect(seeded.contacts.every((contact) => contact.name.includes('Demo'))).toBe(true)
    initializeCrmDatabase(connection)
    expect(listContacts(connection)).toEqual(seeded)
    connection.exec('DELETE FROM crm_contacts')
    initializeCrmDatabase(connection)
    expect(listContacts(connection)).toEqual({ contacts: [], total: 0, summary: { total: 0, byStage: { novo: 0, contato: 0, qualificado: 0, cliente: 0, perdido: 0 } } })
  })

  it('creates and reads UUID contacts, normalizes fields, updates full input and deletes', () => {
    const contact = createContact(connection, input)
    expect(contact).toEqual({ id: expect.stringMatching(/^[\da-f-]{36}$/), name: 'Nome Demo', email: 'demo@example.com', phone: '123', company: 'Empresa', stage: 'novo', createdAt: expect.any(String), updatedAt: expect.any(String) })
    expect(new Date(contact.createdAt).toISOString()).toBe(contact.createdAt)
    expect(contact.createdAt).toBe(contact.updatedAt)
    expect(getContact(connection, contact.id)).toEqual(contact)
    const updated = updateContact(connection, contact.id, { ...input, name: 'Novo nome', stage: 'cliente', phone: '', company: '' })
    expect(updated).toMatchObject({ name: 'Novo nome', stage: 'cliente', phone: '', company: '', createdAt: contact.createdAt })
    expect(updated.updatedAt > contact.updatedAt).toBe(true)
    deleteContact(connection, contact.id)
    expect(getContact(connection, contact.id)).toBeNull()
    for (const operation of [() => deleteContact(connection, contact.id), () => updateContact(connection, contact.id, input), () => listNotes(connection, contact.id), () => createNote(connection, contact.id, { body: 'x' })]) {
      expect(operation).toThrow('Contato não encontrado')
    }
  })

  it('rejects normalized email conflicts atomically for create and update', () => {
    const contact = createContact(connection, input)
    expect(() => createContact(connection, { ...input, email: 'demo@example.com' })).toThrow('E-mail já cadastrado')
    const other = createContact(connection, { ...input, email: 'other@example.com' })
    expect(() => updateContact(connection, other.id, { ...input, name: 'Não persistir' })).toThrow('E-mail já cadastrado')
    expect(getContact(connection, other.id)).toEqual(other)
    expect(updateContact(connection, contact.id, input).email).toBe(contact.email)
    expect(listContacts(connection).total).toBe(7)
  })

  it('rejects invalid complete input and notes without modifying contacts', () => {
    for (const value of [null, [], 'x', {}, { ...input, unknown: 1 }, { ...input, name: '' }, { ...input, name: 'x'.repeat(121) }, { ...input, email: 'bad' }, { ...input, email: `a${'x'.repeat(250)}@a.com` }, { ...input, phone: 1 }, { ...input, phone: 'x'.repeat(41) }, { ...input, company: 'x'.repeat(121) }, { ...input, stage: 'bad' }]) {
      expect(() => createContact(connection, value)).toThrow('Dados do CRM inválidos')
    }
    const contact = createContact(connection, input)
    for (const value of [null, [], {}, { body: 1 }, { body: ' ' }, { body: 'x'.repeat(2001) }, { body: 'x', unknown: 1 }]) {
      expect(() => createNote(connection, contact.id, value)).toThrow('Dados do CRM inválidos')
    }
    expect(getContact(connection, contact.id)).toEqual(contact)
    expect(listNotes(connection, contact.id).total).toBe(0)
  })

  it('enforces unique normalized email, stage and note FK constraints in the schema', () => {
    const contact = createContact(connection, input)
    expect(() => connection.prepare('UPDATE crm_contacts SET stage = ? WHERE id = ?').run('bad', contact.id)).toThrow()
    expect(() => connection.prepare('UPDATE crm_contacts SET email = ? WHERE id = ?').run('UPPER@EXAMPLE.COM', contact.id)).toThrow()
    expect(() => connection.prepare('INSERT INTO crm_notes VALUES (?, ?, ?, ?)').run('id', 'missing', 'body', contact.createdAt)).toThrow()
  })

  it('appends normalized notes, bumps contact timestamp, paginates deterministically and cascades deletion', () => {
    const contact = createContact(connection, input)
    const first = createNote(connection, contact.id, { body: '  Primeira nota  ' })
    const second = createNote(connection, contact.id, { body: 'Outra nota' })
    expect(first).toMatchObject({ contactId: contact.id, body: 'Primeira nota' })
    expect(getContact(connection, contact.id)!.updatedAt > contact.updatedAt).toBe(true)
    connection.prepare('UPDATE crm_notes SET created_at = ? WHERE contact_id = ?').run(contact.createdAt, contact.id)
    const ordered = [first.id, second.id].sort()
    expect(listNotes(connection, contact.id, 1, 0).notes[0].id).toBe(ordered[0])
    expect(listNotes(connection, contact.id, 1, 1).notes[0].id).toBe(ordered[1])
    expect(listNotes(connection, contact.id, 1, 2)).toEqual({ notes: [], total: 2 })
    deleteContact(connection, contact.id)
    expect(connection.prepare('SELECT COUNT(*) AS total FROM crm_notes').get()).toEqual({ total: 0 })
  })

  it('rolls back note insert if the contact timestamp update fails', () => {
    const contact = createContact(connection, input)
    connection.exec("CREATE TRIGGER fail_contact_update BEFORE UPDATE ON crm_contacts BEGIN SELECT RAISE(ABORT, 'fixture failure'); END")
    expect(() => createNote(connection, contact.id, { body: 'Não persistir' })).toThrow('fixture failure')
    expect(listNotes(connection, contact.id).total).toBe(0)
    expect(getContact(connection, contact.id)).toEqual(contact)
  })

  it('searches every contact field literally and combines stage with filtered totals/global summary', () => {
    const contact = createContact(connection, { ...input, name: 'Literal %_\\ Demo', company: 'UniqueCompany', phone: '999001' })
    for (const q of ['%_\\', 'DEMO@EXAMPLE', '999001', 'uniquecompany']) {
      expect(listContacts(connection, { q }).contacts).toEqual([contact])
    }
    expect(listContacts(connection, { q: "' OR 1=1 --" }).total).toBe(0)
    const filtered = listContacts(connection, { q: '%', stage: 'novo', limit: 1, offset: 1 })
    expect(filtered.contacts).toEqual([])
    expect(filtered.total).toBe(1)
    expect(filtered.summary).toEqual({ total: 6, byStage: { novo: 2, contato: 1, qualificado: 1, cliente: 1, perdido: 1 } })
    expect(listContacts(connection, { q: '%', stage: 'cliente' }).total).toBe(0)
  })

  it('orders contacts by latest update and id tie breaker, with bounded pagination', () => {
    connection.prepare('UPDATE crm_contacts SET updated_at = ?').run('2020-01-01T00:00:00.000Z')
    const ids = listContacts(connection).contacts.map((contact) => contact.id)
    expect(ids).toEqual([...ids].sort())
    expect(listContacts(connection, { limit: 2, offset: 2 }).contacts.map((contact) => contact.id)).toEqual(ids.slice(2, 4))
    createNote(connection, ids[4], { body: 'Recent interaction' })
    expect(listContacts(connection).contacts[0].id).toBe(ids[4])
    for (const query of [{ limit: 0 }, { limit: 101 }, { limit: 1.2 }, { offset: -1 }, { offset: 100001 }, { q: 'x'.repeat(101) }, { stage: 'bad' as never }]) {
      expect(() => listContacts(connection, query)).toThrow('Dados do CRM inválidos')
    }
    expect(() => listNotes(connection, ids[0], 101)).toThrow('Dados do CRM inválidos')
  })
})

describe('CRM initialization hook and existing store reset', () => {
  const originalCwd = process.cwd()
  let tmpDir: string
  let db: typeof import('./db')
  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-crm-db-'))
    process.chdir(tmpDir)
    db = await import('./db')
  })
  afterAll(() => {
    db.getDatabase().close()
    process.chdir(originalCwd)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
  it('migrates the store, persists CRUD/notes after reconnect/reset and never repopulates deleted seeds', () => {
    const store = db.getDatabase()
    const contact = createContact(store, input)
    const note = createNote(store, contact.id, { body: 'Preservada' })
    const snapshot = listContacts(store)
    db.seedDatabase(store)
    expect(listContacts(store)).toEqual(snapshot)
    store.close()
    expect(listContacts(db.getDatabase())).toEqual(snapshot)
    expect(listNotes(db.getDatabase(), contact.id).notes).toEqual([note])
    for (const item of snapshot.contacts) deleteContact(db.getDatabase(), item.id)
    db.seedDatabase()
    db.getDatabase().close()
    expect(listContacts(db.getDatabase()).total).toBe(0)
    expect(db.getAllProducts()).toHaveLength(3)
    expect(db.getOrderWithEvents('CS-2048')?.currentStep).toBe(1)
  })
})
