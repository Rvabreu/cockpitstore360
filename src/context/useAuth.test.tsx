import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { AUTH_STORAGE_KEY, AuthProvider, useAuth } from './useAuth'

const user = { id: 'cliente-demo', name: 'Cliente Demo', email: 'cliente@cockpitstore360.com.br', role: 'customer' }
const fetchMock = vi.fn()
const wrapper = AuthProvider
function reply(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status }) }
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
function save(target: Storage = localStorage) { target.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, token: 'saved-token' })) }

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Restauração e hidratação da sessão', () => {
  it('começa anônimo/carregando no SSR e na hidratação sem ler storage nem mostrar usuário não verificado', async () => {
    const me = deferred<Response>()
    fetchMock.mockReturnValue(me.promise)
    const snapshots: string[] = []
    function Probe() {
      const auth = useAuth()
      const text = `${auth.user?.name ?? 'null'}|${auth.isLoading}`
      snapshots.push(text)
      return <div>{text}</div>
    }
    const getter = vi.spyOn(window, 'localStorage', 'get')
    const html = renderToString(<AuthProvider><Probe /></AuthProvider>)
    expect(getter).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    save()
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.append(container)
    const onRecoverableError = vi.fn()
    let root!: Root
    try {
      await act(async () => { root = hydrateRoot(container, <AuthProvider><Probe /></AuthProvider>, { onRecoverableError }) })
      expect(snapshots.slice(0, 2)).toEqual(['null|true', 'null|true'])
      expect(container.innerHTML).toBe(html)
      expect(onRecoverableError).not.toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ headers: { Authorization: 'Bearer saved-token' } }))
      await act(async () => { me.resolve(reply({ user })) })
      expect(container.textContent).toBe('Cliente Demo|false')
    } finally {
      if (root) await act(async () => root.unmount())
      container.remove()
    }
  })

  it('usa /me como fonte do usuário e mantém sessão não persistente em sessionStorage', async () => {
    save(sessionStorage)
    fetchMock.mockResolvedValue(reply({ user: { ...user, name: 'Nome atualizado' } }))
    const { result } = renderHook(useAuth, { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.user?.name).toBe('Nome atualizado')
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(JSON.parse(sessionStorage.getItem(AUTH_STORAGE_KEY)!)).toMatchObject({ user: { name: 'Nome atualizado' } })
  })

  it('descarta JSON inválido e encerra loading sem chamada à API', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, '{oops')
    const { result } = renderHook(useAuth, { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isAuthenticated).toBe(false)
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('limpa sessão expirada com 401 e não autentica', async () => {
    save()
    fetchMock.mockResolvedValue(reply({ error: 'Não autenticado' }, 401))
    const { result } = renderHook(useAuth, { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.user).toBeNull()
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })

  it('falha de rede não confia no cache nem apaga sessão recuperável, e informa o erro', async () => {
    save()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = renderHook(useAuth, { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.user).toBeNull()
    expect(result.current.sessionError).toContain('Não foi possível verificar')
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull()
  })
})

describe('Entrada, armazenamento e saída', () => {
  it.each([true, false])('persiste só token/user no storage escolhido (lembrar=%s) e limpa o outro', async (rememberMe) => {
    const { result } = renderHook(useAuth, { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    save(localStorage)
    save(sessionStorage)
    fetchMock.mockResolvedValue(reply({ success: true, user, token: 'new-token' }))
    await act(async () => { await result.current.login(` ${user.email} `, 'demo123', rememberMe) })
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ email: user.email, password: 'demo123' }),
    }))
    const selected = rememberMe ? localStorage : sessionStorage
    const other = rememberMe ? sessionStorage : localStorage
    expect(JSON.parse(selected.getItem(AUTH_STORAGE_KEY)!)).toEqual({ user, token: 'new-token' })
    expect(selected.getItem(AUTH_STORAGE_KEY)).not.toContain('demo123')
    expect(other.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('lembrar-me é true por padrão', async () => {
    fetchMock.mockResolvedValue(reply({ success: true, user, token: 'new-token' }))
    const { result } = renderHook(useAuth, { wrapper })
    await act(async () => { await result.current.login(user.email, 'demo123') })
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull()
  })

  it('storage inacessível não impede login e gera aviso sem guardar senha', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('blocked') })
    fetchMock.mockResolvedValue(reply({ success: true, user, token: 'new-token' }))
    const { result } = renderHook(useAuth, { wrapper })
    await act(async () => { await result.current.login(user.email, 'demo123') })
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.sessionError).toContain('não permite salvar')
  })

  it('propaga erro 401 em pt-BR e encerra loading', async () => {
    fetchMock.mockResolvedValue(reply({ error: 'E-mail ou senha inválidos.' }, 401))
    const { result } = renderHook(useAuth, { wrapper })
    await act(async () => { await expect(result.current.login(user.email, 'errada')).rejects.toThrow('E-mail ou senha inválidos.') })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it.each([
    () => Promise.reject(new TypeError('Failed to fetch')),
    () => Promise.resolve(reply({ success: true, token: 'token', user: { email: user.email } })),
    () => Promise.resolve(new Response('not json', { status: 200 })),
  ])('não autentica quando a rede ou a resposta de login é inválida', async (response) => {
    fetchMock.mockImplementation(response)
    const { result } = renderHook(useAuth, { wrapper })
    await act(async () => { await expect(result.current.login(user.email, 'demo123')).rejects.toThrow('Não foi possível') })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.user).toBeNull()
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })

  it('StrictMode ignora a resposta do primeiro efeito descartado', async () => {
    save()
    const discarded = deferred<Response>()
    fetchMock.mockReturnValueOnce(discarded.promise).mockResolvedValueOnce(reply({ user }))
    const { result } = renderHook(useAuth, { wrapper, reactStrictMode: true })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { discarded.resolve(reply({ user: { ...user, name: 'Nome antigo' } })) })
    expect(result.current.user?.name).toBe('Cliente Demo')
  })

  it('logout limpa imediatamente ambos storages, revoga token e reporta falha de rede', async () => {
    fetchMock.mockResolvedValueOnce(reply({ success: true, user, token: 'new-token' }))
    const { result } = renderHook(useAuth, { wrapper })
    await act(async () => { await result.current.login(user.email, 'demo123') })
    save(sessionStorage)
    const logout = deferred<Response>()
    fetchMock.mockReturnValueOnce(logout.promise)
    let pending!: Promise<void>
    act(() => { pending = result.current.logout() })
    expect(result.current.user).toBeNull()
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer new-token' } }))
    await act(async () => { logout.resolve(reply({}, 500)); await pending })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.sessionError).toContain('não foi possível encerrar')
  })

  it('GET /me atrasado não reautentica depois do logout', async () => {
    save()
    const me = deferred<Response>()
    fetchMock.mockReturnValueOnce(me.promise).mockResolvedValueOnce(reply({ success: true }))
    const { result } = renderHook(useAuth, { wrapper })
    await act(async () => { await result.current.logout() })
    await act(async () => { me.resolve(reply({ user })) })
    expect(result.current.user).toBeNull()
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })

  it('login atrasado após logout é ignorado e seu novo token é revogado', async () => {
    const login = deferred<Response>()
    fetchMock.mockReturnValueOnce(login.promise).mockResolvedValue(reply({ success: true }))
    const { result } = renderHook(useAuth, { wrapper })
    let pending!: Promise<void>
    act(() => { pending = result.current.login(user.email, 'demo123') })
    await act(async () => { await result.current.logout() })
    await act(async () => {
      login.resolve(reply({ success: true, user, token: 'late-token' }))
      await expect(pending).rejects.toThrow('cancelada')
    })
    expect(result.current.user).toBeNull()
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/auth/logout', expect.objectContaining({ headers: { Authorization: 'Bearer late-token' } }))
  })
})
