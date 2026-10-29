import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
const authorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=public-id&scope=openid+email+profile&state=opaque'

beforeEach(() => { vi.resetModules() })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('googleAuthService', () => {
  it.each([true, false])('reads availability %s using same-origin no-store', async (available) => {
    const fetchMock = vi.fn().mockResolvedValue(json({ available }))
    vi.stubGlobal('fetch', fetchMock)
    const google = await import('./googleAuthService')
    expect(await google.googleAvailable()).toBe(available)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/google/status', { credentials: 'same-origin', cache: 'no-store' })
  })

  it.each([{}, null, [], { available: 'true' }])('rejects malformed status %j', async (data) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(data)))
    const google = await import('./googleAuthService')
    await expect(google.googleAvailable()).rejects.toThrow(google.GOOGLE_UNAVAILABLE)
  })

  it('reports generic status failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private diagnostic')))
    const google = await import('./googleAuthService')
    await expect(google.googleAvailable()).rejects.toThrow(google.GOOGLE_UNAVAILABLE)
  })

  it('sends strict return payload, current rotated CSRF and navigates only after validation, without storage/logs', async () => {
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const storageRead = vi.spyOn(Storage.prototype, 'getItem')
    const log = vi.spyOn(console, 'log')
    const warn = vi.spyOn(console, 'warn')
    const error = vi.spyOn(console, 'error')
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { assign } })
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ user: null, csrfToken: 'initial' }))
      .mockResolvedValueOnce(json({ user: null, csrfToken: 'current' })).mockResolvedValueOnce(json({ authorizationUrl }))
    vi.stubGlobal('fetch', fetchMock)
    const auth = await import('./authService')
    const google = await import('./googleAuthService')
    await auth.restoreSession()
    await auth.restoreSession()
    await google.startGoogleLogin('/#pedidos')
    const [path, request] = fetchMock.mock.calls[2]
    expect(path).toBe('/api/auth/google/start')
    expect(request.method).toBe('POST')
    expect(request.body).toBe(JSON.stringify({ returnTo: '/#pedidos' }))
    expect(request.credentials).toBe('same-origin')
    expect(request.cache).toBe('no-store')
    expect(request.headers.get('Content-Type')).toBe('application/json')
    expect(request.headers.get('X-CSRF-Token')).toBe('current')
    expect(assign).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledWith(authorizationUrl)
    for (const spy of [storageWrite, storageRead, log, warn, error]) expect(spy).not.toHaveBeenCalled()
  })

  it.each([
    'http://accounts.google.com/o/oauth2/v2/auth', 'https://evil.test/o/oauth2/v2/auth',
    'https://accounts.google.com.evil.test/o/oauth2/v2/auth', 'https://accounts.google.com/o/oauth2/v2/auth/extra',
    'https://accounts.google.com:444/o/oauth2/v2/auth', 'https://evil@accounts.google.com/o/oauth2/v2/auth',
    'https://accounts.google.com/o/oauth2/v2/auth#secret', '//accounts.google.com/o/oauth2/v2/auth',
    'javascript:alert(1)', '/login', null, 123,
  ])('rejects unsafe authorization URL %s without navigation', async (url) => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { assign } })
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ user: null, csrfToken: 'csrf' }))
      .mockResolvedValueOnce(json({ authorizationUrl: url }))
    vi.stubGlobal('fetch', fetchMock)
    const google = await import('./googleAuthService')
    await expect(google.startGoogleLogin('//evil.test')).rejects.toThrow(google.GOOGLE_ERROR)
    expect(fetchMock.mock.calls[1][1].body).toBe('{"returnTo":"/"}')
    expect(assign).not.toHaveBeenCalled()
  })

  it.each([403, 429, 500, 503])('does not replay start on HTTP %s or expose server details', async (status) => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { assign } })
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ user: null, csrfToken: 'csrf' }))
      .mockResolvedValueOnce(json({ error: 'private account information' }, status))
    vi.stubGlobal('fetch', fetchMock)
    const google = await import('./googleAuthService')
    await expect(google.startGoogleLogin('/')).rejects.toThrow(google.GOOGLE_ERROR)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(assign).not.toHaveBeenCalled()
  })

  it('does no fetch or navigation during SSR', async () => {
    vi.stubGlobal('window', undefined)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const google = await import('./googleAuthService')
    await expect(google.googleAvailable()).rejects.toThrow(google.GOOGLE_UNAVAILABLE)
    await expect(google.startGoogleLogin('/')).rejects.toThrow(google.GOOGLE_ERROR)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
