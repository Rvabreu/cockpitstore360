import { beforeEach, expect, it, vi } from 'vitest'
import { createAuthService, AuthError } from './authService'

function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }) }
beforeEach(() => { vi.restoreAllMocks(); vi.stubGlobal('fetch', vi.fn()) })

it('register confirma201 sem autologin e preserva token para ação manual, sem storage/log/senha confirmação', async () => {
  const get = vi.spyOn(Storage.prototype, 'getItem')
  const set = vi.spyOn(Storage.prototype, 'setItem')
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: null, csrfToken: 'bootstrap-token' }))
    .mockResolvedValueOnce(json({ created: true }, 201))
    .mockResolvedValueOnce(json({ created: true }, 201))
  const auth = createAuthService()
  await auth.bootstrap()
  await expect(auth.register('qa@example.com', 'secure password-123')).resolves.toEqual({ created: true })
  expect(fetch).toHaveBeenCalledTimes(2)
  const [url, options] = vi.mocked(fetch).mock.calls[1]
  expect(url).toBe('/api/auth/register')
  expect(options).toMatchObject({ method: 'POST', cache: 'no-store', credentials: 'same-origin' })
  expect(new Headers(options?.headers).get('Content-Type')).toBe('application/json')
  expect(new Headers(options?.headers).get('X-CSRF-Token')).toBe('bootstrap-token')
  expect(JSON.parse(options?.body as string)).toEqual({ email: 'qa@example.com', password: 'secure password-123' })
  await auth.register('another@example.com', 'another secure-password')
  expect(new Headers(vi.mocked(fetch).mock.calls[2][1]?.headers).get('X-CSRF-Token')).toBe('bootstrap-token')
  expect(get).not.toHaveBeenCalled(); expect(set).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled()
})

it.each([null, {}, { created: false }, { user: null, csrfToken: 'fake' }])('payload201%j inválido não anuncia conta criada', async (payload) => {
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: null, csrfToken: 'token' })).mockResolvedValueOnce(json(payload, 201))
  const auth = createAuthService()
  await auth.bootstrap()
  await expect(auth.register('qa@example.com', 'secure password-123')).rejects.toBeInstanceOf(AuthError)
  expect(fetch).toHaveBeenCalledTimes(2)
})

it.each([[400, 'Dados de cadastro inválidos'], [409, 'Não foi possível cadastrar com os dados informados'], [429, 'Muitas tentativas. Tente novamente mais tarde.']] as const)('register%s usa mensagem contextual segura', async (status, message) => {
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: null, csrfToken: 'token' })).mockResolvedValueOnce(json({ error: 'SQL private' }, status))
  const auth = createAuthService()
  await auth.bootstrap()
  await expect(auth.register('qa@example.com', 'secure password-123')).rejects.toMatchObject({ status, message })
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('403 expõe snapshot e só tentativa manual usa token recuperado, sem retry automático senha', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(json({ user: null, csrfToken: 'old' }))
    .mockResolvedValueOnce(json({ error: 'unauthorized' }, 403))
    .mockResolvedValueOnce(json({ user: null, csrfToken: 'recovered' }))
    .mockResolvedValueOnce(json({ created: true }, 201))
  const auth = createAuthService()
  await auth.bootstrap()
  await expect(auth.register('qa@example.com', 'secure password-123')).rejects.toMatchObject({ status: 403, recoveredSession: { user: null, csrfToken: 'recovered' } })
  expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual(['/api/auth/session', '/api/auth/register', '/api/auth/session'])
  await auth.register('qa@example.com', 'manual secure-password')
  expect(new Headers(vi.mocked(fetch).mock.calls[3][1]?.headers).get('X-CSRF-Token')).toBe('recovered')
})
