import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { createAuthService, AuthError } from './authService'

const USER = { id: 'u1', email: 'cliente@example.com' }
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}
beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('bootstrap concorrente compartilha GET, cookie credentials e token somente em memória', async () => {
  let resolve!: (value: Response) => void
  const response = new Promise<Response>((done) => { resolve = done })
  vi.mocked(fetch).mockReturnValue(response)
  const service = createAuthService()
  const first = service.bootstrap()
  const second = service.bootstrap()
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  resolve(json({ user: null, csrfToken: 'csrf-one' }))
  expect(await first).toEqual(await second)
  expect(fetch).toHaveBeenCalledWith('/api/auth/session', expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }))
})

it('login e logout usam JSON/token rotacionado e confirmam somente HTTP backend', async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(json({ user: null, csrfToken: 'csrf-one' }))
    .mockResolvedValueOnce(json({ user: USER, csrfToken: 'csrf-two' }))
    .mockResolvedValueOnce(json({ user: null }))
  const service = createAuthService()
  await service.bootstrap()
  await expect(service.login(USER.email, ' senha com espaços ')).resolves.toEqual({ user: USER, csrfToken: 'csrf-two' })
  await expect(service.logout()).resolves.toEqual({ user: null })
  for (const [index, route, token] of [[1, '/api/auth/login', 'csrf-one'], [2, '/api/auth/logout', 'csrf-two']] as const) {
    const [endpoint, options] = vi.mocked(fetch).mock.calls[index]
    expect(endpoint).toBe(route)
    expect(options).toEqual(expect.objectContaining({ method: 'POST', credentials: 'same-origin', cache: 'no-store' }))
    const headers = new Headers(options?.headers)
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('X-CSRF-Token')).toBe(token)
  }
  expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]?.body as string)).toEqual({ email: USER.email, password: ' senha com espaços ' })
})

it('403 refaz bootstrap uma vez sem retry automático do POST e próxima tentativa usa token novo', async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(json({ user: null, csrfToken: 'old' }))
    .mockResolvedValueOnce(json({ error: 'Requisição não autorizada' }, 403))
    .mockResolvedValueOnce(json({ user: null, csrfToken: 'new' }))
    .mockResolvedValueOnce(json({ user: USER, csrfToken: 'confirmed' }))
  const service = createAuthService()
  await service.bootstrap()
  await expect(service.login(USER.email, 'secret')).rejects.toMatchObject({ status: 403 })
  expect(vi.mocked(fetch).mock.calls.map(([endpoint]) => endpoint)).toEqual(['/api/auth/session', '/api/auth/login', '/api/auth/session'])
  await service.login(USER.email, 'manual-retry')
  expect(new Headers(vi.mocked(fetch).mock.calls[3][1]?.headers).get('X-CSRF-Token')).toBe('new')
})

it.each([401, 429, 500])('HTTP%s não confirma usuário e preserva status/erro', async (status) => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(json({ user: null, csrfToken: 'token' }))
    .mockResolvedValueOnce(json({ error: 'Falha segura' }, status))
  const service = createAuthService()
  await service.bootstrap()
  await expect(service.login(USER.email, 'secret')).rejects.toMatchObject({
    status,
    message: status === 401 ? 'E-mail ou senha inválidos' : status === 429
      ? 'Muitas tentativas. Tente novamente mais tarde.' : 'Não foi possível concluir a solicitação. Tente novamente.',
  })
})

it.each([null, {}, { user: { email: USER.email }, csrfToken: 'token' }, { user: null, csrfToken: 12 }])('shape200 inválido não autentica/produz token %j', async (body) => {
  vi.mocked(fetch).mockResolvedValueOnce(json(body))
  await expect(createAuthService().bootstrap()).rejects.toBeInstanceOf(AuthError)
})

it('rede indisponível retorna erro status0 sem senha/log ou storage', async () => {
  vi.mocked(fetch).mockRejectedValue(new TypeError('offline'))
  const local = vi.spyOn(window, 'localStorage', 'get')
  const session = vi.spyOn(window, 'sessionStorage', 'get')
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  await expect(createAuthService().bootstrap()).rejects.toMatchObject({ status: 0 })
  expect(local).not.toHaveBeenCalled()
  expect(session).not.toHaveBeenCalled()
  expect(log).not.toHaveBeenCalled()
})

it.each([null, USER])('403 expõe snapshot confirmado user%j e atualiza token sem retry automático de senha', async (user) => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(json({ user: USER, csrfToken: 'old' }))
    .mockResolvedValueOnce(json({ error: 'Requisição não autorizada' }, 403))
    .mockResolvedValueOnce(json({ user, csrfToken: 'recovered-token' }))
    .mockResolvedValueOnce(json({ user: USER, csrfToken: 'confirmed-token' }))
  const service = createAuthService()
  await service.bootstrap()
  await expect(service.login(USER.email, 'secret-never-autoretried')).rejects.toMatchObject({
    status: 403,
    recoveredSession: { user, csrfToken: 'recovered-token' },
    recoveryFailed: false,
  })
  expect(vi.mocked(fetch).mock.calls.map(([endpoint]) => endpoint)).toEqual([
    '/api/auth/session', '/api/auth/login', '/api/auth/session',
  ])
  await service.login(USER.email, 'manual-attempt')
  const options = vi.mocked(fetch).mock.calls[3][1]
  expect(new Headers(options?.headers).get('X-CSRF-Token')).toBe('recovered-token')
  expect(JSON.parse(options?.body as string).password).toBe('manual-attempt')
})
