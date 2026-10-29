import express from 'express'
import type { RequestHandler } from 'express'
import { getDatabase } from './db.ts'
import { createContact, createNote, CrmError, deleteContact, getContact, invalidCrmData, isCrmStage, listContacts, listNotes, updateContact } from './crmDb.ts'

function queryParams(url: string, allowed: string[]): URLSearchParams {
  const params = new URL(url, 'http://localhost').searchParams
  for (const key of params.keys()) {
    if (!allowed.includes(key) || params.getAll(key).length !== 1) return invalidCrmData()
  }
  return params
}
function integerParam(params: URLSearchParams, key: string, fallback: number, min: number, max: number): number {
  const raw = params.get(key)
  if (raw === null) return fallback
  if (!/^\d+$/.test(raw)) return invalidCrmData()
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < min || value > max) return invalidCrmData()
  return value
}
export function createCrmRouter(requireAdmin: RequestHandler) {
  const router = express.Router()
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next() })
  // Protect every path/method (even unknown ones), before reading any request body.
  router.use(requireAdmin)
  router.use(express.json({ limit: '16kb' }))
  router.get('/contacts', (req, res) => {
    const params = queryParams(req.originalUrl, ['q', 'stage', 'limit', 'offset'])
    const q = params.get('q') ?? undefined
    const stage = params.get('stage') ?? undefined
    if ((q !== undefined && q.length > 100) || (stage !== undefined && !isCrmStage(stage))) return invalidCrmData()
    res.json(listContacts(getDatabase(), {
      q, stage: stage as import('../types/crm.ts').CrmStage | undefined,
      limit: integerParam(params, 'limit', 50, 1, 100), offset: integerParam(params, 'offset', 0, 0, 100000),
    }))
  })
  router.get('/contacts/:id', (req, res) => {
    queryParams(req.originalUrl, [])
    const contact = getContact(getDatabase(), req.params.id)
    if (!contact) throw new CrmError(404, 'Contato não encontrado')
    res.json({ contact })
  })
  router.post('/contacts', (req, res) => {
    queryParams(req.originalUrl, [])
    res.status(201).json({ contact: createContact(getDatabase(), req.body) })
  })
  router.put('/contacts/:id', (req, res) => {
    queryParams(req.originalUrl, [])
    res.json({ contact: updateContact(getDatabase(), req.params.id, req.body) })
  })
  router.delete('/contacts/:id', (req, res) => {
    queryParams(req.originalUrl, [])
    deleteContact(getDatabase(), req.params.id)
    res.json({ success: true })
  })
  router.get('/contacts/:id/notes', (req, res) => {
    const params = queryParams(req.originalUrl, ['limit', 'offset'])
    res.json(listNotes(getDatabase(), req.params.id,
      integerParam(params, 'limit', 50, 1, 100), integerParam(params, 'offset', 0, 0, 100000)))
  })
  router.post('/contacts/:id/notes', (req, res) => {
    queryParams(req.originalUrl, [])
    res.status(201).json({ note: createNote(getDatabase(), req.params.id, req.body) })
  })
  router.use((_req, res) => { res.status(404).json({ error: 'Endpoint não encontrado' }) })
  router.use(((error, _req, res, next) => {
    if (error instanceof CrmError) return res.status(error.status).json({ error: error.message })
    if (error?.status === 400) return res.status(400).json({ error: 'Dados do CRM inválidos' })
    next(error)
  }) as express.ErrorRequestHandler)
  return router
}
