import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const session = (authenticated = false, token = 'csrf-test') => new Response(JSON.stringify({
  user: authenticated ? { authenticated: true } : null, csrfToken: token,
}), { status: 200 })

beforeEach(() => { vi.resetModules() })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('authService', () => {
  it('bootstraps once, sends cookies/CSRF and rotates token on login/logout, without storage or logs', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    const storageRead = vi.spyOn(Storage.prototype, 'getItem')
    const log = vi.spyOn(console, 'log')
    const warn = vi.spyOn(console, 'warn')
    const error = vi.spyOn(console, 'error')
    const fetchMock = vi.fn().mockResolvedValueOnce(session()).mockResolvedValueOnce(session(true, 'rotated'))
      .mockResolvedValueOnce(session(false, 'anonymous'))
    vi.stubGlobal('fetch', fetchMock)
    const auth = await import('./authService')
    await Promise.all([auth.restoreSession(), auth.restoreSession()])
    await auth.login('person@example.com', 'private-secret')
    await auth.logout()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0]).toEqual(['/api/auth/session', { credentials: 'same-origin', cache: 'no-store' }])
    const loginRequest = fetchMock.mock.calls[1][1]
    expect(loginRequest.credentials).toBe('same-origin')
    expect(loginRequest.headers.get('X-CSRF-Token')).toBe('csrf-test')
    expect(JSON.parse(loginRequest.body)).toEqual({ email: 'person@example.com', password: 'private-secret' })
    expect(fetchMock.mock.calls[2][1].headers.get('X-CSRF-Token')).toBe('rotated')
    expect(fetchMock.mock.calls[2][1].body).toBe('{}')
    for (const spy of [storage, storageRead, log, warn, error]) expect(spy).not.toHaveBeenCalled()
  })

  it('does not perform relative fetch during SSR', async () => {
    vi.stubGlobal('window', undefined)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const auth = await import('./authService')
    await expect(auth.restoreSession()).rejects.toThrow(auth.SESSION_ERROR)
    await expect(auth.login('person@example.com', 'secret')).rejects.toThrow(auth.AUTH_ERROR)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([401, 403, 429, 500])('returns generic error for HTTP %s without exposing payload', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(session()).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'specific account exists', password: 'secret' }), { status }),
    ))
    const auth = await import('./authService')
    await expect(auth.login('person@example.com', 'secret')).rejects.toThrow(auth.AUTH_ERROR)
  })

  it('never replays rejected mutation; obtains fresh CSRF for next action', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(session()).mockResolvedValueOnce(new Response('', { status: 403 }))
      .mockResolvedValueOnce(session(false, 'new-token')).mockResolvedValueOnce(session(true))
    vi.stubGlobal('fetch', fetchMock)
    const auth = await import('./authService')
    await expect(auth.login('person@example.com', 'secret')).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await auth.login('person@example.com', 'secret')
    expect(fetchMock.mock.calls[3][1].headers.get('X-CSRF-Token')).toBe('new-token')
  })

  it('rejects credential-bearing requests to foreign URLs', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const auth = await import('./authService')
    await expect(auth.csrfFetch('https://example.com/api/auth/login', { method: 'POST' })).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['https://evil.test', '//evil.test', '/\\evil.test', '/%2f%2fevil.test', '/%5cevil', '/login', '/?next=evil', '/#unknown', '%2F%23pedidos', undefined])(
    'rejects unsafe return %s', async (value) => {
      const { safeReturnPath } = await import('./authService')
      expect(safeReturnPath(value)).toBe('/')
    },
  )
  it.each(['/', '/#colecao', '/#pedidos', '/#fluxo'])('permits return %s', async (value) => {
    const { safeReturnPath } = await import('./authService')
    expect(safeReturnPath(value)).toBe(value)
  })
})
