import { afterEach, describe, expect, it, vi } from 'vitest'
import { advanceOrderApi, INITIAL_ORDER } from './storeService'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear() })

describe('store CSRF integration', () => {
  it('posts JSON demo payload with shared CSRF and cookies', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ user: null, csrfToken: 'demo-csrf' })))
      .mockResolvedValueOnce(new Response(JSON.stringify(INITIAL_ORDER)))
    vi.stubGlobal('fetch', fetchMock)
    expect(await advanceOrderApi('CS-2048')).toEqual(INITIAL_ORDER)
    const [path, init] = fetchMock.mock.calls[1]
    expect(path).toBe('/api/orders/CS-2048/advance')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('same-origin')
    expect(init.headers.get('X-CSRF-Token')).toBe('demo-csrf')
    expect(init.headers.get('Content-Type')).toBe('application/json')
    expect(init.body).toBe('{}')
  })

  it('preserves the local demo fallback when API is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const next = await advanceOrderApi('CS-2048')
    expect(next.currentStep).toBe(INITIAL_ORDER.currentStep + 1)
    expect(next.id).toBe('CS-2048')
  })
})
