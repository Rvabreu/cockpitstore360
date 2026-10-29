import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { CrmPage } from './crm'
import type { CrmContact } from '../types/crm'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), auth: { user: { id: 'admin', role: 'admin' } as { id: string; role: string } | null, isLoading: false, isAuthenticated: true } }))
vi.mock('../context/useAuth', () => ({ useAuth: () => ({ ...mocks.auth, authenticatedFetch: mocks.fetch }) }))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a>,
}))
const a: CrmContact = { id: '11111111-1111-4111-8111-111111111111', name: 'Ana Fictícia', email: 'ana@example.test', phone: '119999999', company: 'Empresa Demo', stage: 'novo', createdAt: '2026-01-01T12:00:00Z', updatedAt: '2026-01-01T12:00:00Z' }
const b = { ...a, id: '22222222-2222-4222-8222-222222222222', name: 'Bruno Fictício', email: 'bruno@example.test', stage: 'cliente' as const }
const note = { id: '33333333-3333-4333-8333-333333333333', contactId: a.id, body: 'Primeira conversa fictícia', createdAt: '2026-01-02T12:00:00Z' }
function reply(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status }) }
function list(contacts = [a, b], total = contacts.length) { return { contacts, total, summary: { total: 75, byStage: { novo: 15, contato: 15, qualificado: 15, cliente: 15, perdido: 15 } } } }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
let contacts: CrmContact[]
let notes: typeof note[]
beforeEach(() => {
  contacts = [{ ...a }, { ...b }]; notes = [note]
  mocks.auth = { user: { id: 'admin', role: 'admin' }, isLoading: false, isAuthenticated: true }
  mocks.fetch.mockReset().mockImplementation(async (path: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    if (method === 'DELETE') { contacts = contacts.filter(c => !path.endsWith(c.id)); return reply({ success: true }) }
    if (path.includes('/notes')) {
      if (method === 'POST') { const created = { ...note, id: '44444444-4444-4444-8444-444444444444', body: JSON.parse(init.body as string).body }; notes = [created, ...notes]; return reply({ note: created }, 201) }
      const current = path.includes(b.id) ? [] : notes
      return reply({ notes: current, total: current.length })
    }
    if (method === 'POST' || method === 'PUT') {
      const updated = { ...a, ...(method === 'POST' ? { id: '44444444-4444-4444-8444-444444444444' } : {}), ...JSON.parse(init.body as string) }
      contacts = method === 'POST' ? [...contacts, updated] : contacts.map(c => c.id === a.id ? updated : c)
      return reply({ contact: updated }, method === 'POST' ? 201 : 200)
    }
    if (path.includes('?')) return reply(list(contacts))
    return reply({ contact: contacts.find(c => path.endsWith(c.id)) })
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
async function loaded() { await screen.findByRole('button', { name: `Ver contato ${a.name}` }) }
async function details() { fireEvent.click(screen.getByRole('button', { name: `Ver contato ${a.name}` })); await screen.findByRole('button', { name: 'Editar contato' }) }
function fill() {
  const dialog = within(screen.getByRole('dialog'))
  fireEvent.change(dialog.getByLabelText('Nome *'), { target: { value: 'Clara Demo' } })
  fireEvent.change(dialog.getByLabelText('E-mail *'), { target: { value: 'clara@example.test' } })
  fireEvent.change(dialog.getByLabelText('Telefone'), { target: { value: '1198888' } })
  fireEvent.change(dialog.getByLabelText('Empresa'), { target: { value: 'Clara Ltda' } })
  fireEvent.change(dialog.getByLabelText('Etapa'), { target: { value: 'qualificado' } })
}

describe('Gates CRM', () => {
  it.each(['loading', 'anonymous', 'customer'])('não consulta dados para %s', async gate => {
    mocks.auth = gate === 'loading' ? { user: { id: 'admin', role: 'admin' }, isLoading: true, isAuthenticated: true } : gate === 'anonymous' ? { user: null, isLoading: false, isAuthenticated: false } : { user: { id: 'customer', role: 'customer' }, isLoading: false, isAuthenticated: true }
    render(<CrmPage />)
    if (gate === 'loading') expect(screen.getByRole('status')).toHaveTextContent('Verificando acesso')
    if (gate === 'anonymous') expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login')
    if (gate === 'customer') expect(screen.getByRole('heading', { name: /403/ })).toBeInTheDocument()
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
  it('limpa dados e aborta requisições ao sair ou trocar de usuário', async () => {
    const { rerender } = render(<CrmPage />); await loaded(); await details()
    const signals = mocks.fetch.mock.calls.map(call => call[1].signal as AbortSignal)
    mocks.auth.user = { id: 'admin2', role: 'admin' }; rerender(<CrmPage />)
    expect(screen.queryByRole('button', { name: 'Editar contato' })).not.toBeInTheDocument()
    expect(signals.every(signal => signal.aborted)).toBe(true)
    await loaded()
    mocks.auth = { user: null, isLoading: false, isAuthenticated: false }; rerender(<CrmPage />)
    expect(screen.queryByText(a.email)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Entrar' })).toBeInTheDocument()
  })
})
describe('Contatos CRM', () => {
  it('mostra contagens globais das cinco etapas, lista, aviso e detalhe com notas', async () => {
    render(<CrmPage />); await loaded()
    expect(within(screen.getByRole('region', { name: 'Indicadores globais do pipeline' })).getAllByText('15')).toHaveLength(5)
    expect(screen.getByText('Total global: 75')).toBeInTheDocument()
    expect(screen.getByText(/contatos iniciais são fictícios/)).toBeInTheDocument()
    await details(); expect(await screen.findByText(note.body)).toBeInTheDocument()
    expect(screen.getByText(a.phone)).toBeInTheDocument()
    expect(screen.getByText(/não podem ser editadas/)).toBeInTheDocument()
  })
  it('combina busca/etapa, limita q e reseta paginação', async () => {
    mocks.fetch.mockImplementation(async () => reply(list([a], 75)))
    render(<CrmPage />); await loaded()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Paginação de contatos' })).getByRole('button', { name: 'Próxima' }))
    await waitFor(() => expect(mocks.fetch.mock.calls.at(-1)![0]).toContain('offset=50'))
    fireEvent.change(screen.getByLabelText('Buscar contatos'), { target: { value: 'a'.repeat(120) } })
    await loaded()
    let params = new URL(mocks.fetch.mock.calls.at(-1)![0], 'http://local').searchParams
    expect(params.get('q')).toHaveLength(100); expect(params.get('offset')).toBe('0'); expect(params.get('limit')).toBe('50')
    fireEvent.change(screen.getByLabelText('Filtrar por etapa'), { target: { value: 'cliente' } })
    await loaded()
    params = new URL(mocks.fetch.mock.calls.at(-1)![0], 'http://local').searchParams
    expect(params.get('stage')).toBe('cliente'); expect(params.get('q')).toHaveLength(100)
  })
  it('exibe loading, vazio e retry após erro sem fallback', async () => {
    const pending = deferred<Response>(); mocks.fetch.mockReturnValueOnce(pending.promise).mockResolvedValue(reply(list([], 0)))
    render(<CrmPage />)
    expect(screen.getByRole('status')).toHaveTextContent('Carregando contatos')
    await act(async () => pending.resolve(reply({ error: 'Falha no CRM' }, 500)))
    expect(screen.getByRole('alert')).toHaveTextContent('Falha no CRM')
    expect(screen.queryByText('Total global: 75')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText(/Nenhum contato encontrado/)).toBeInTheDocument()
  })
  it('ignora pesquisa antiga mesmo quando fetch ignora abort', async () => {
    const old = deferred<Response>(); mocks.fetch.mockReturnValueOnce(old.promise).mockResolvedValue(reply(list([b])))
    render(<CrmPage />)
    fireEvent.change(screen.getByLabelText('Buscar contatos'), { target: { value: 'Bruno' } })
    await screen.findByRole('button', { name: `Ver contato ${b.name}` })
    await act(async () => old.resolve(reply(list([a]))))
    expect(screen.queryByRole('button', { name: `Ver contato ${a.name}` })).not.toBeInTheDocument()
    expect(mocks.fetch.mock.calls[0][1].signal.aborted).toBe(true)
  })
  it('cria contato com input completo apenas após confirmação server201', async () => {
    render(<CrmPage />); await loaded(); fireEvent.click(screen.getByRole('button', { name: 'Novo contato' })); fill()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar contato' }))
    expect(await screen.findByText('Contato salvo com sucesso.')).toBeInTheDocument()
    expect(mocks.fetch).toHaveBeenCalledWith('/api/crm/contacts', expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Clara Demo', email: 'clara@example.test', phone: '1198888', company: 'Clara Ltda', stage: 'qualificado' }) }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Ver contato Clara Demo' })).toBeInTheDocument()
  })
  it('preserva confirmação da gravação mas avisa refresh falho e recupera somente via GET', async () => {
    render(<CrmPage />); await loaded(); fireEvent.click(screen.getByRole('button', { name: 'Novo contato' })); fill()
    const original = mocks.fetch.getMockImplementation()!
    let failRefresh = true
    mocks.fetch.mockImplementation((path, init) => (init?.method ?? 'GET') === 'GET' && failRefresh
      ? Promise.resolve(reply({ error: 'Falha ao atualizar contatos' }, 500))
      : original(path, init))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar contato' }))
    expect(await screen.findByText('Contato salvo com sucesso.')).toBeInTheDocument()
    const warning = await screen.findByText('Alteração salva, mas não foi possível atualizar os dados. Tente novamente.')
    expect(warning.closest('[role="alert"]')).toBeInTheDocument()
    expect(screen.getByText('Falha ao atualizar contatos')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: `Ver contato ${a.name}` })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver contato Clara Demo' })).not.toBeInTheDocument()
    expect(screen.queryByText('Total global: 75')).not.toBeInTheDocument()
    expect(mocks.fetch.mock.calls.filter(call => call[1]?.method === 'POST')).toHaveLength(1)
    failRefresh = false
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('button', { name: 'Ver contato Clara Demo' })).toBeInTheDocument()
    expect(screen.queryByText('Alteração salva, mas não foi possível atualizar os dados. Tente novamente.')).not.toBeInTheDocument()
    expect(screen.queryByText('Falha ao atualizar contatos')).not.toBeInTheDocument()
    expect(screen.getByText('Contato salvo com sucesso.')).toBeInTheDocument()
    expect(mocks.fetch.mock.calls.filter(call => call[1]?.method === 'POST')).toHaveLength(1)
  })
  it('valida obrigatórios, foca campo inválido e permite Escape/restauração foco', async () => {
    render(<CrmPage />); await loaded()
    const trigger = screen.getByRole('button', { name: 'Novo contato' }); trigger.focus(); fireEvent.click(trigger)
    const calls = mocks.fetch.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Salvar contato' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Dados do CRM inválidos')
    expect(screen.getByLabelText('Nome *')).toHaveFocus(); expect(mocks.fetch).toHaveBeenCalledTimes(calls)
    fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(trigger).toHaveFocus()
  })
  it('edita contato e mantém formulário após409 sem sucesso fictício', async () => {
    render(<CrmPage />); await loaded(); await details(); fireEvent.click(screen.getByRole('button', { name: 'Editar contato' }))
    expect(screen.getByLabelText('Nome *')).toHaveValue(a.name)
    mocks.fetch.mockResolvedValueOnce(reply({ error: 'E-mail já cadastrado' }, 409))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar contato' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail já cadastrado')
    expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(screen.queryByText('Contato salvo com sucesso.')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nome *'), { target: { value: 'Ana Atualizada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar contato' }))
    expect(await screen.findByText('Contato salvo com sucesso.')).toBeInTheDocument()
    expect(mocks.fetch.mock.calls.some(call => call[0].endsWith(a.id) && call[1].method === 'PUT')).toBe(true)
  })
  it('registra nota append-only e pagina histórico', async () => {
    render(<CrmPage />); await loaded(); await details(); await screen.findByText(note.body)
    fireEvent.change(screen.getByLabelText('Nova nota'), { target: { value: '  Segunda interação  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar nota' }))
    expect(await screen.findByText('Nota registrada com sucesso.')).toBeInTheDocument()
    expect(await screen.findByLabelText('Nova nota')).toHaveValue('')
    expect(await screen.findByText('Segunda interação')).toBeInTheDocument()
    mocks.fetch.mockImplementation(async (path: string) => path.includes('/notes') ? reply({ notes: [note], total: 75 }) : path.includes('?') ? reply(list()) : reply({ contact: a }))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar detalhes' })); await details()
    const nav = await screen.findByRole('navigation', { name: 'Paginação de notas' })
    fireEvent.click(within(nav).getByRole('button', { name: 'Próxima' }))
    await waitFor(() => expect(mocks.fetch.mock.calls.at(-1)![0]).toContain('/notes?limit=50&offset=50'))
  })
  it('excluir exige confirmação explícita que inclui notas, sem otimista', async () => {
    render(<CrmPage />); await loaded(); await details(); fireEvent.click(screen.getByRole('button', { name: 'Excluir contato' }))
    expect(screen.getByText(/também remove todas as notas/)).toBeInTheDocument()
    const remove = screen.getByRole('button', { name: 'Confirmar exclusão' }); expect(remove).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox')); const pending = deferred<Response>(); mocks.fetch.mockReturnValueOnce(pending.promise)
    fireEvent.click(remove)
    expect(screen.queryByText('Contato e notas excluídos com sucesso.')).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: `Ver contato ${a.name}` })).toBeInTheDocument()
    await act(async () => pending.resolve(reply({ success: false })))
    expect(screen.getByRole('alert')).toHaveTextContent('não confirmou a exclusão')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))
    expect(await screen.findByText('Contato e notas excluídos com sucesso.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: `Ver contato ${a.name}` })).not.toBeInTheDocument())
  })
  it('ignora detalhe antigo após selecionar outro contato', async () => {
    const old = deferred<Response>(); const original = mocks.fetch.getMockImplementation()!
    mocks.fetch.mockImplementation((path, init) => path === `/api/crm/contacts/${a.id}` ? old.promise : original(path, init))
    render(<CrmPage />); await loaded(); fireEvent.click(screen.getByRole('button', { name: `Ver contato ${a.name}` })); fireEvent.click(screen.getByRole('button', { name: `Ver contato ${b.name}` }))
    await screen.findByRole('heading', { name: b.name })
    await act(async () => old.resolve(reply({ contact: a })))
    expect(screen.queryByRole('heading', { name: a.name })).not.toBeInTheDocument()
  })
  it('aborta e ignora nota/mutação após trocar detalhe e unmount', async () => {
    render(<CrmPage />); await loaded(); await details()
    const old = deferred<Response>(); mocks.fetch.mockReturnValueOnce(old.promise)
    fireEvent.change(screen.getByLabelText('Nova nota'), { target: { value: 'Nota atrasada' } }); fireEvent.click(screen.getByRole('button', { name: 'Registrar nota' }))
    const signal = mocks.fetch.mock.calls.at(-1)![1].signal
    fireEvent.click(screen.getByRole('button', { name: `Ver contato ${b.name}` })); expect(signal.aborted).toBe(true)
    await act(async () => old.resolve(reply({ note: { ...note, body: 'Nota atrasada' } }, 201)))
    expect(screen.queryByText('Nota registrada com sucesso.')).not.toBeInTheDocument()
    cleanup(); expect(mocks.fetch.mock.calls.filter(call => call[1].signal).every(call => call[1].signal.aborted)).toBe(true)
  })
  it('rejeita payload de lista inválido sem revelar dados', async () => {
    mocks.fetch.mockResolvedValue(reply({ contacts: [{ ...a, id: '../secret' }], total: 1, summary: list().summary }))
    render(<CrmPage />); expect(await screen.findByRole('alert')).toHaveTextContent('dados inválidos')
    expect(screen.queryByText(a.email)).not.toBeInTheDocument()
  })
  it('mantém foco dentro do modal com Tab e Shift+Tab', async () => {
    render(<CrmPage />); await loaded(); fireEvent.click(screen.getByRole('button', { name: 'Novo contato' }))
    const first = screen.getByRole('button', { name: 'Fechar diálogo' })
    const last = screen.getByRole('button', { name: 'Salvar contato' })
    first.focus(); fireEvent.keyDown(document, { key: 'Tab', shiftKey: true }); expect(last).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab' }); expect(first).toHaveFocus()
  })
  it('não anuncia criação antes da resposta e descarta sucesso após logout', async () => {
    const { rerender } = render(<CrmPage />); await loaded(); fireEvent.click(screen.getByRole('button', { name: 'Novo contato' })); fill()
    const pending = deferred<Response>(); mocks.fetch.mockReturnValueOnce(pending.promise)
    fireEvent.click(screen.getByRole('button', { name: 'Salvar contato' }))
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled()
    expect(screen.queryByText('Contato salvo com sucesso.')).not.toBeInTheDocument()
    const signal = mocks.fetch.mock.calls.at(-1)![1].signal
    mocks.auth = { user: null, isLoading: false, isAuthenticated: false }; rerender(<CrmPage />)
    expect(signal.aborted).toBe(true)
    await act(async () => pending.resolve(reply({ contact: a }, 201)))
    expect(screen.queryByText('Contato salvo com sucesso.')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Entrar' })).toBeInTheDocument()
  })
  it('ignora resposta de página de notas antiga após trocar contato', async () => {
    const pending = deferred<Response>(); const original = mocks.fetch.getMockImplementation()!
    mocks.fetch.mockImplementation((path, init) => path.includes(`${a.id}/notes`) ? pending.promise : original(path, init))
    render(<CrmPage />); await loaded(); await details()
    fireEvent.click(screen.getByRole('button', { name: `Ver contato ${b.name}` }))
    await screen.findByRole('heading', { name: b.name })
    await act(async () => pending.resolve(reply({ notes: [{ ...note, body: 'Nota antiga exclusiva' }], total: 1 })))
    expect(screen.queryByText('Nota antiga exclusiva')).not.toBeInTheDocument()
  })
})
