import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { LoaderCircle, Plus, Search, Users, X } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { CRM_STAGES, CRM_STAGE_LABELS } from '../types/crm'
import type { CrmContact, CrmContactInput, CrmContactsResponse, CrmNotesResponse, CrmStage } from '../types/crm'

export const Route = createFileRoute('/crm')({ component: CrmPage })
const control = 'w-full min-w-0 rounded-xl border border-[#34363d] bg-[#0b0d10] px-3 py-3 text-sm text-white focus-visible:outline-2 focus-visible:outline-[#ff633b] disabled:opacity-50'
const button = 'min-h-11 rounded-xl border border-[#34363d] px-4 py-2 text-sm font-semibold hover:border-[#ff633b] focus-visible:outline-2 focus-visible:outline-[#ff633b] disabled:opacity-50 disabled:cursor-not-allowed'
const panel = 'rounded-2xl border border-[#232429] bg-[#111316] p-4 sm:p-6'
const date = (value: string) => new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const emptyInput: CrmContactInput = { name: '', email: '', phone: '', company: '', stage: 'novo' }

async function readResponse(response: Response): Promise<unknown> {
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'Não foi possível concluir. Tente novamente.')
  if (!body || typeof body !== 'object') throw new Error('O servidor retornou dados inválidos.')
  return body
}
function isContact(value: unknown): value is CrmContact {
  const c = value as CrmContact | null
  return !!c && typeof c.id === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(c.id) &&
    ['name', 'email', 'phone', 'company'].every(key => typeof c[key as keyof CrmContact] === 'string') &&
    CRM_STAGES.includes(c.stage) && Number.isFinite(Date.parse(c.createdAt)) && Number.isFinite(Date.parse(c.updatedAt))
}
function count(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) >= 0 }
function contactsData(body: unknown): CrmContactsResponse {
  const data = body as CrmContactsResponse
  if (!Array.isArray(data.contacts) || !data.contacts.every(isContact) || !count(data.total) || !count(data.summary?.total) ||
    !CRM_STAGES.every(stage => count(data.summary.byStage?.[stage]))) throw new Error('O servidor retornou dados inválidos.')
  return data
}
function contactData(body: unknown): CrmContact {
  if (!isContact((body as { contact?: unknown }).contact)) throw new Error('O servidor retornou dados inválidos.')
  return (body as { contact: CrmContact }).contact
}
function notesData(body: unknown): CrmNotesResponse {
  const data = body as CrmNotesResponse
  if (!count(data.total) || !Array.isArray(data.notes) || !data.notes.every(n => typeof n.id === 'string' && typeof n.contactId === 'string' && typeof n.body === 'string' && Number.isFinite(Date.parse(n.createdAt)))) {
    throw new Error('O servidor retornou dados inválidos.')
  }
  return data
}

function useResource<T>(url: string | null, revision: number, parse: (value: unknown) => T) {
  const { authenticatedFetch } = useAuth()
  const [state, setState] = useState<{ url: string | null; revision: number; data: T | null; error: string | null; loading: boolean }>({ url: null, revision: -1, data: null, error: null, loading: false })
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const abort = new AbortController()
    setState({ url, revision, data: null, error: null, loading: !!url })
    if (url) void (async () => {
      try {
        const body = await readResponse(await authenticatedFetch(url, { signal: abort.signal }))
        const data = parse(body)
        if (!abort.signal.aborted) setState({ url, revision, data, error: null, loading: false })
      } catch (error) {
        if (!abort.signal.aborted) setState({ url, revision, data: null, error: error instanceof Error ? error.message : 'Falha de conexão. Tente novamente.', loading: false })
      }
    })()
    return () => abort.abort()
  }, [url, revision, retry, authenticatedFetch, parse])
  const current = state.url === url && state.revision === revision
  return { data: current ? state.data : null, error: current ? state.error : null, loading: !!url && (!current || state.loading), retry: () => setRetry(n => n + 1) }
}
function Loading({ children }: { children: ReactNode }) {
  return <p role="status" className="flex items-center gap-2 py-6 text-sm text-[#c0c0c5]"><LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />{children}</p>
}
function ErrorMessage({ error, retry }: { error: string; retry?: () => void }) {
  return <div role="alert" className="my-4 rounded-xl border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-200"><p>{error}</p>{retry && <button className={`${button} mt-3`} onClick={retry}>Tentar novamente</button>}</div>
}
function Pagination({ offset, total, change, label, disabled }: { offset: number; total: number; change: (n: number) => void; label: string; disabled?: boolean }) {
  return <nav aria-label={label} className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#c0c0c5]">
    <span>{total === 0 ? 'Nenhum registro' : `${offset + 1}–${Math.min(offset + 50, total)} de ${total}`}</span>
    <div className="flex gap-2"><button className={button} disabled={disabled || offset === 0} onClick={() => change(Math.max(0, offset - 50))}>Anterior</button><button className={button} disabled={disabled || offset + 50 >= total} onClick={() => change(offset + 50)}>Próxima</button></div>
  </nav>
}
function Modal({ title, children, close, busy }: { title: string; children: ReactNode; close: () => void; busy: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(close)
  closeRef.current = close
  const busyRef = useRef(busy)
  busyRef.current = busy
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector<HTMLElement>('input, button')?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) { event.preventDefault(); closeRef.current() }
      if (event.key !== 'Tab') return
      const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? [])
      if (!items.length) { event.preventDefault(); ref.current?.focus(); return }
      const first = items[0], last = items.at(-1)!
      if (event.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !ref.current?.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = oldOverflow; previous?.focus() }
  }, [])
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 sm:p-6">
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="crm-dialog-title" aria-busy={busy} className={`${panel} max-h-[90dvh] w-full max-w-lg overflow-y-auto shadow-2xl`}>
      <div className="mb-5 flex items-center justify-between gap-3"><h2 id="crm-dialog-title" className="text-xl font-bold">{title}</h2><button className={button} aria-label="Fechar diálogo" disabled={busy} onClick={close}><X aria-hidden="true" className="size-4" /></button></div>{children}
    </div>
  </div>
}

export function CrmPage() {
  const { user, isLoading, isAuthenticated } = useAuth()
  if (isLoading) return <main className="mx-auto max-w-[1240px] px-4 py-12"><Loading>Verificando acesso ao CRM...</Loading></main>
  if (!isAuthenticated || !user) return <main className="mx-auto max-w-[1240px] px-4 py-12"><section className={panel}><h1 className="text-2xl font-bold">CRM · Acesso restrito</h1><p className="my-4 text-[#c0c0c5]">Entre com uma conta de administrador para acessar os contatos.</p><Link to="/login" className={`${button} inline-block text-[#ff956f]`}>Entrar</Link></section></main>
  if (user.role !== 'admin') return <main className="mx-auto max-w-[1240px] px-4 py-12"><section className={panel}><h1 className="text-2xl font-bold">403 · Acesso restrito a administradores</h1><p className="my-4 text-[#c0c0c5]">Sua conta não tem permissão para acessar o CRM.</p><Link to="/" className={`${button} inline-block`}>Voltar à loja</Link></section></main>
  return <AdminCrm key={user.id} />
}

function AdminCrm() {
  const { authenticatedFetch } = useAuth()
  const [q, setQ] = useState('')
  const [stage, setStage] = useState<CrmStage | ''>('')
  const [offset, setOffset] = useState(0)
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [noteOffset, setNoteOffset] = useState(0)
  const [noteBody, setNoteBody] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | 'delete' | null>(null)
  const [input, setInput] = useState<CrmContactInput>(emptyInput)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const mutation = useRef<AbortController | null>(null)
  const detailRef = useRef<HTMLElement>(null)
  const query = new URLSearchParams({ q, limit: '50', offset: String(offset), ...(stage ? { stage } : {}) })
  const parseDetail = useCallback((body: unknown) => {
    const result = contactData(body)
    if (result.id !== selected) throw new Error('O servidor retornou dados inválidos.')
    return result
  }, [selected])
  const parseNotes = useCallback((body: unknown) => {
    const result = notesData(body)
    if (result.notes.some(note => note.contactId !== selected)) throw new Error('O servidor retornou dados inválidos.')
    return result
  }, [selected])
  const contacts = useResource(`/api/crm/contacts?${query}`, revision, contactsData)
  const contact = useResource(selected ? `/api/crm/contacts/${selected}` : null, revision, parseDetail)
  const notes = useResource(selected ? `/api/crm/contacts/${selected}/notes?limit=50&offset=${noteOffset}` : null, revision, parseNotes)
  const refreshFailed = !!success && !!(contacts.error || (selected && (contact.error || notes.error)))
  useEffect(() => () => { mutation.current?.abort() }, [])
  useEffect(() => {
    if (selected) { detailRef.current?.focus(); detailRef.current?.scrollIntoView?.({ block: 'start' }) }
  }, [selected])
  function cancelMutation() { mutation.current?.abort(); mutation.current = null; setBusy(false); setError(null) }
  function select(id: string | null) { cancelMutation(); setSelected(id); setNoteOffset(0); setNoteBody(''); setModal(null); setSuccess(null) }
  function closeModal() { cancelMutation(); setModal(null) }
  function open(kind: 'create' | 'edit' | 'delete') {
    cancelMutation(); setSuccess(null); setConfirmed(false)
    if (kind === 'edit' && contact.data) {
      const { name, email, phone, company, stage } = contact.data
      setInput({ name, email, phone, company, stage })
    } else setInput({ ...emptyInput })
    setModal(kind)
  }
  async function mutate(path: string, method: string, body: unknown, validate: (data: unknown) => void, done: () => void) {
    if (mutation.current) return
    const abort = new AbortController()
    mutation.current = abort
    setBusy(true); setError(null); setSuccess(null)
    try {
      const response = await authenticatedFetch(path, { method, signal: abort.signal, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) })
      const data = await readResponse(response)
      if (response.status !== (method === 'POST' ? 201 : 200)) throw new Error('O servidor não confirmou a operação.')
      validate(data)
      if (!abort.signal.aborted) { done(); setRevision(n => n + 1) }
    } catch (err) {
      if (!abort.signal.aborted) setError(err instanceof Error ? err.message : 'Falha de conexão. Tente novamente.')
    } finally {
      if (!abort.signal.aborted) { setBusy(false); mutation.current = null }
    }
  }
  function save(event: FormEvent) {
    event.preventDefault()
    const normalized = { ...input, name: input.name.trim(), email: input.email.trim(), phone: input.phone.trim(), company: input.company.trim() }
    if (!normalized.name || normalized.name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email) || normalized.email.length > 254 || normalized.phone.length > 40 || normalized.company.length > 120) {
      setError('Dados do CRM inválidos. Verifique nome e e-mail.')
      const form = event.currentTarget as HTMLFormElement
      form.querySelector<HTMLInputElement>(!normalized.name ? 'input[type="text"]' : 'input[type="email"]')?.focus()
      return
    }
    void mutate(modal === 'edit' ? `/api/crm/contacts/${selected}` : '/api/crm/contacts', modal === 'edit' ? 'PUT' : 'POST', normalized, modal === 'edit' ? parseDetail : contactData, () => { setModal(null); setSuccess('Contato salvo com sucesso.'); setOffset(0) })
  }
  function addNote(event: FormEvent) {
    event.preventDefault()
    const body = noteBody.trim()
    if (!body || body.length > 2000) { setError('A nota deve conter de 1 a 2000 caracteres.'); return }
    void mutate(`/api/crm/contacts/${selected}/notes`, 'POST', { body }, data => {
      const note = (data as { note?: CrmNotesResponse['notes'][number] }).note
      if (!note || note.contactId !== selected || typeof note.body !== 'string' || typeof note.id !== 'string' || !Number.isFinite(Date.parse(note.createdAt))) throw new Error('O servidor retornou dados inválidos.')
    }, () => { setNoteBody(''); setNoteOffset(0); setSuccess('Nota registrada com sucesso.') })
  }
  return <main className="mx-auto max-w-[1240px] px-4 py-8 sm:px-8 sm:py-12">
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-bold uppercase tracking-[2px] text-[#ff956f]">Relacionamento · Área administrativa</p><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">CRM de contatos</h1><p className="mt-3 max-w-xl text-sm text-[#c0c0c5]">Organize seus contatos, acompanhe as etapas e registre cada interação.</p></div><button onClick={() => open('create')} className={`${button} inline-flex items-center gap-2 bg-[#ff633b] text-[#17100d]`}><Plus aria-hidden="true" className="size-4" />Novo contato</button></div>
    <p className="mb-6 rounded-xl border border-[#ff633b33] bg-[#ff633b0c] p-3 text-xs text-[#ffba9e]">Ambiente demonstrativo. Os contatos iniciais são fictícios. Sem envio de e-mails ou integrações externas.</p>
    {success && <p role="status" className="mb-5 rounded-xl border border-green-400/40 bg-green-400/10 p-4 text-sm text-green-200">{success}</p>}
    {refreshFailed && <ErrorMessage error="Alteração salva, mas não foi possível atualizar os dados. Tente novamente." />}
    {error && !modal && <ErrorMessage error={error} />}
    <section aria-label="Indicadores globais do pipeline" className="mb-8 grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 lg:grid-cols-5">
      {CRM_STAGES.map(s => <div key={s} className={`${panel} !p-4`}><p className="text-xs text-[#c0c0c5]">{CRM_STAGE_LABELS[s]}</p><p className="mt-3 text-3xl font-bold text-[#ff956f]">{contacts.data ? contacts.data.summary.byStage[s] : '—'}</p></div>)}
    </section>
    <div className={`grid min-w-0 gap-6 ${selected ? 'lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]' : ''}`}>
      <section className={`${panel} min-w-0`} aria-labelledby="contacts-title">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 id="contacts-title" className="flex items-center gap-2 text-xl font-bold"><Users aria-hidden="true" className="size-5 text-[#ff956f]" />Contatos</h2><span className="text-xs text-[#c0c0c5]">Total global: {contacts.data?.summary.total ?? '—'}</span></div>
        <div className="mb-5 grid gap-3 sm:grid-cols-2"><label className="min-w-0 text-xs text-[#c0c0c5]">Buscar contatos<span className="relative mt-2 block"><Search aria-hidden="true" className="absolute left-3 top-3.5 size-4" /><input className={`${control} pl-9`} type="search" maxLength={100} value={q} placeholder="Nome, e-mail ou empresa" onChange={e => { setQ(e.target.value.slice(0, 100)); setOffset(0) }} /></span></label><label className="text-xs text-[#c0c0c5]">Filtrar por etapa<select className={`${control} mt-2`} value={stage} onChange={e => { setStage(e.target.value as CrmStage | ''); setOffset(0) }}><option value="">Todas as etapas</option>{CRM_STAGES.map(s => <option key={s} value={s}>{CRM_STAGE_LABELS[s]}</option>)}</select></label></div>
        {contacts.loading && <Loading>Carregando contatos...</Loading>}
        {contacts.error && <ErrorMessage error={contacts.error} retry={contacts.retry} />}
        {contacts.data && <><p className="mb-3 text-xs text-[#c0c0c5]">{contacts.data.total} contatos encontrados</p>{contacts.data.contacts.length === 0 ? <p className="py-8 text-sm text-[#c0c0c5]">Nenhum contato encontrado. Ajuste os filtros ou crie um novo contato.</p> : <ul className="space-y-3">{contacts.data.contacts.map(c => <li key={c.id}><button aria-label={`Ver contato ${c.name}`} aria-pressed={selected === c.id} onClick={() => select(c.id)} className={`w-full min-w-0 rounded-xl border p-4 text-left hover:border-[#ff633b] focus-visible:outline-2 focus-visible:outline-[#ff633b] ${selected === c.id ? 'border-[#ff633b] bg-[#ff633b0c]' : 'border-[#232429] bg-[#0b0d10]'}`}><span className="flex flex-wrap justify-between gap-2"><strong className="break-words">{c.name}</strong><span className="rounded-full bg-[#ff633b12] px-2 py-1 text-xs text-[#ffba9e]">{CRM_STAGE_LABELS[c.stage]}</span></span><span className="mt-2 block break-all text-sm text-[#c0c0c5]">{c.email}</span><span className="mt-1 block break-words text-xs text-[#888b94]">{c.company || 'Empresa não informada'}</span></button></li>)}</ul>}<Pagination label="Paginação de contatos" offset={offset} total={contacts.data.total} change={setOffset} /></>}
      </section>
      {selected && <section ref={detailRef} tabIndex={-1} className={`${panel} min-w-0 scroll-mt-40 focus-visible:outline-2 focus-visible:outline-[#ff633b]`} aria-labelledby="detail-title"><div className="flex flex-wrap items-center justify-between gap-2"><h2 id="detail-title" className="text-xl font-bold">Detalhes do contato</h2><button className={button} onClick={() => select(null)}>Fechar detalhes</button></div>
        {contact.loading && <Loading>Carregando detalhes...</Loading>}{contact.error && <ErrorMessage error={contact.error} retry={contact.retry} />}
        {contact.data && <><h3 className="mt-6 break-words text-2xl font-bold">{contact.data.name}</h3><p className="mt-2 text-sm text-[#ff956f]">{CRM_STAGE_LABELS[contact.data.stage]}</p><dl className="my-5 space-y-3 break-words text-sm">{[['E-mail', contact.data.email], ['Telefone', contact.data.phone || 'Não informado'], ['Empresa', contact.data.company || 'Não informada'], ['Criado em', date(contact.data.createdAt)], ['Atualizado em', date(contact.data.updatedAt)]].map(([label, value]) => <div key={label}><dt className="text-xs text-[#888b94]">{label}</dt><dd className="mt-1 break-all">{value}</dd></div>)}</dl><div className="flex flex-wrap gap-3"><button className={button} disabled={busy} onClick={() => open('edit')}>Editar contato</button><button className={`${button} text-red-300`} disabled={busy} onClick={() => open('delete')}>Excluir contato</button></div>
          <h3 className="mt-8 text-lg font-bold">Histórico de notas</h3><p className="mt-2 text-xs text-[#c0c0c5]">Notas registradas não podem ser editadas ou removidas individualmente.</p>
          <form onSubmit={addNote} className="mt-4"><label className="text-xs text-[#c0c0c5]">Nova nota<textarea className={`${control} mt-2 min-h-28 resize-y`} maxLength={2000} required value={noteBody} disabled={busy} onChange={e => setNoteBody(e.target.value)} /></label><p className="my-2 text-xs text-[#888b94]">{noteBody.length}/2000 caracteres</p><button className={button} disabled={busy || !noteBody.trim()}>{busy ? 'Registrando...' : 'Registrar nota'}</button></form>
          {notes.loading && <Loading>Carregando histórico...</Loading>}{notes.error && <ErrorMessage error={notes.error} retry={notes.retry} />}{notes.data && <>{notes.data.notes.length === 0 ? <p className="mt-5 text-sm text-[#c0c0c5]">Nenhuma nota registrada.</p> : <ol className="mt-5 space-y-3">{notes.data.notes.map(n => <li key={n.id} className="rounded-xl border border-[#232429] p-3"><time dateTime={n.createdAt} className="text-xs text-[#888b94]">{date(n.createdAt)}</time><p className="mt-2 whitespace-pre-wrap break-words text-sm">{n.body}</p></li>)}</ol>}<Pagination label="Paginação de notas" offset={noteOffset} total={notes.data.total} change={setNoteOffset} disabled={busy} /></>}
        </>}
      </section>}
    </div>
    {modal && <Modal title={modal === 'create' ? 'Novo contato' : modal === 'edit' ? 'Editar contato' : 'Excluir contato'} busy={busy} close={closeModal}>{error && <ErrorMessage error={error} />}
      {modal === 'delete' ? <><p className="break-words text-sm text-[#c0c0c5]">Excluir {contact.data?.name}? Esta ação é permanente e também remove todas as notas deste contato.</p><label className="my-5 flex items-start gap-3 text-sm"><input className="mt-1 size-4 shrink-0 accent-[#ff633b]" type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />Confirmo a exclusão permanente do contato e de todas as suas notas.</label><div className="flex flex-wrap gap-3"><button className={button} disabled={busy} onClick={closeModal}>Cancelar</button><button className={`${button} border-red-400/50 text-red-300`} disabled={busy || !confirmed} onClick={() => { if (confirmed) void mutate(`/api/crm/contacts/${selected}`, 'DELETE', undefined, data => { if ((data as { success?: boolean }).success !== true) throw new Error('O servidor não confirmou a exclusão.') }, () => { setSelected(null); setModal(null); setOffset(0); setSuccess('Contato e notas excluídos com sucesso.') }) }}>{busy ? 'Excluindo...' : 'Confirmar exclusão'}</button></div></> : <form onSubmit={save} noValidate className="space-y-4">
        {([{ key: 'name', label: 'Nome', max: 120, type: 'text' }, { key: 'email', label: 'E-mail', max: 254, type: 'email' }, { key: 'phone', label: 'Telefone', max: 40, type: 'tel' }, { key: 'company', label: 'Empresa', max: 120, type: 'text' }] as const).map(field => <label key={field.key} className="block text-sm text-[#c0c0c5]">{field.label}{(field.key === 'name' || field.key === 'email') && ' *'}<input className={`${control} mt-2`} type={field.type} maxLength={field.max} required={field.key === 'name' || field.key === 'email'} disabled={busy} value={input[field.key]} onChange={e => setInput({ ...input, [field.key]: e.target.value })} /></label>)}
        <label className="block text-sm text-[#c0c0c5]">Etapa<select className={`${control} mt-2`} disabled={busy} value={input.stage} onChange={e => setInput({ ...input, stage: e.target.value as CrmStage })}>{CRM_STAGES.map(s => <option key={s} value={s}>{CRM_STAGE_LABELS[s]}</option>)}</select></label><p className="text-xs text-[#888b94]">* Campos obrigatórios</p><div className="flex flex-wrap gap-3"><button type="button" className={button} disabled={busy} onClick={closeModal}>Cancelar</button><button className={`${button} bg-[#ff633b] text-[#17100d]`} disabled={busy}>{busy ? 'Salvando...' : 'Salvar contato'}</button></div>
      </form>}
    </Modal>}
  </main>
}
