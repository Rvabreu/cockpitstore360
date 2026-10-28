import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrderWithEvents } from '../types/store'

const ORDER_KEY = 'cockpit_store_order_v1'
const PRODUCTS_KEY = 'cockpit_store_products_v1'
let service: typeof import('./storeService')

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status })
}

function orderAt(currentStep: number): OrderWithEvents {
  return service.buildOrderWithEvents({ ...service.INITIAL_ORDER, currentStep, events: service.SEED_ORDER_EVENTS })
}

beforeEach(async () => {
  vi.resetModules()
  service = await import('./storeService')
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn())
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('IDs e consulta confirmada pela API', () => {
  it.each(['2048', ' cs-2048 ', ' # cs-2048 ', '%23cs-2048'])('normaliza %s para CS-2048', (input) => {
    expect(service.normalizeOrderId(input)).toBe('CS-2048')
  })

  it('mantém escapes inválidos seguros para compor a URL sem lançar erro', async () => {
    vi.mocked(fetch).mockResolvedValue(json({}, 404))
    await service.getOrder('%ZZ/2048')
    expect(fetch).toHaveBeenCalledWith('/api/orders/%25ZZ%2F2048')
  })

  it('consulta o backend mesmo com cache e não substitui o pedido exibido ao buscar', async () => {
    service.saveOrder(orderAt(1))
    const found = { ...orderAt(3), id: 'CS-9999' }
    vi.mocked(fetch).mockResolvedValue(json(found))
    await expect(service.getOrder('9999')).resolves.toEqual({
      ok: true,
      message: 'Pedido CS-9999 encontrado. Status: Entregue. Os dados exibidos são fictícios.',
    })
    expect(fetch).toHaveBeenCalledWith('/api/orders/CS-9999')
    expect(service.getStoredOrder()).toEqual(orderAt(1))
  })

  it('404 retorna mensagem pt-BR e não confirma pedido a partir do cache', async () => {
    service.saveOrder(orderAt(2))
    vi.mocked(fetch).mockResolvedValue(json({ error: 'Pedido não encontrado' }, 404))
    await expect(service.getOrder('2048')).resolves.toEqual({ ok: false, message: 'Pedido não encontrado' })
  })

  it.each(['500', 'network', 'invalid-json'])('%s não é confundido com pedido inexistente', async (failure) => {
    if (failure === 'network') vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    else vi.mocked(fetch).mockResolvedValue(failure === '500' ? json({}, 500) : new Response('{'))
    await expect(service.getOrder('2048')).resolves.toEqual({
      ok: false, message: 'Não foi possível consultar o pedido. Tente novamente.',
    })
  })

  it.each([null, {}])('HTTP200 com payload inválido %j não confirma pedido encontrado', async (payload) => {
    vi.mocked(fetch).mockResolvedValue(json(payload))
    await expect(service.getOrder('2048')).resolves.toEqual({
      ok: false, message: 'Não foi possível consultar o pedido. Tente novamente.',
    })
  })
})

describe('Leitura e avanço sem progresso fictício', () => {
  it('loadOrderApi normaliza GET e espelha somente a resposta backend no cache', async () => {
    const backend = orderAt(2)
    vi.mocked(fetch).mockResolvedValue(json(backend))
    await expect(service.loadOrderApi(' #2048 ')).resolves.toEqual(backend)
    expect(fetch).toHaveBeenCalledWith('/api/orders/CS-2048')
    expect(JSON.parse(localStorage.getItem(ORDER_KEY)!)).toEqual(backend)
  })

  it('POST retorna o status backend, inclusive wrap, e atualiza cache persistido', async () => {
    service.saveOrder(orderAt(3))
    vi.mocked(fetch).mockResolvedValue(json(orderAt(0)))
    await expect(service.advanceOrderApi(' #2048 ')).resolves.toEqual(orderAt(0))
    expect(fetch).toHaveBeenCalledWith('/api/orders/CS-2048/advance', { method: 'POST' })
    expect(service.getStoredOrder()).toEqual(orderAt(0))
  })

  it.each(['404', '500', 'network', 'invalid-json'])('POST %s rejeita sem alterar status ou cache', async (failure) => {
    service.saveOrder(orderAt(1))
    const before = localStorage.getItem(ORDER_KEY)
    if (failure === 'network') vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    else vi.mocked(fetch).mockResolvedValue(failure === 'invalid-json' ? new Response('{') : json({}, Number(failure)))
    await expect(service.advanceOrderApi('2048')).rejects.toThrow('Não foi possível atualizar o pedido. Tente novamente.')
    expect(localStorage.getItem(ORDER_KEY)).toBe(before)
    expect(service.getStoredOrder()).toEqual(orderAt(1))
  })

  it('catálogo vem de GET real e sucesso atualiza cache', async () => {
    const products = [{ ...service.INITIAL_PRODUCTS[0], price: 799 }]
    vi.mocked(fetch).mockResolvedValue(json(products))
    await expect(service.fetchProductsApi()).resolves.toEqual(products)
    expect(fetch).toHaveBeenCalledWith('/api/products')
    expect(JSON.parse(localStorage.getItem(PRODUCTS_KEY)!)).toEqual(products)
  })

  it('falha de leitura usa último cache válido sem inventar novo status', async () => {
    service.saveOrder(orderAt(2))
    vi.mocked(fetch).mockRejectedValue(new TypeError('offline'))
    await expect(service.loadOrderApi('CS-2048')).resolves.toEqual(orderAt(2))
  })

  it.each([null, {}])('POST HTTP200 com payload inválido %j rejeita e não contamina cache', async (payload) => {
    service.saveOrder(orderAt(1))
    vi.mocked(fetch).mockResolvedValue(json(payload))
    await expect(service.advanceOrderApi('2048')).rejects.toThrow('Não foi possível atualizar o pedido. Tente novamente.')
    expect(service.getStoredOrder()).toEqual(orderAt(1))
  })

  it.each([null, {}])('GET HTTP200 com payload inválido %j preserva pedido e catálogo válidos', async (payload) => {
    service.saveOrder(orderAt(2))
    service.saveProducts(service.INITIAL_PRODUCTS)
    vi.mocked(fetch).mockImplementation(async () => json(payload))
    await expect.soft(service.loadOrderApi('CS-2048')).resolves.toEqual(orderAt(2))
    await expect.soft(service.fetchProductsApi()).resolves.toEqual(service.INITIAL_PRODUCTS)
    expect.soft(service.getStoredOrder()).toEqual(orderAt(2))
    expect.soft(service.getStoredProducts()).toEqual(service.INITIAL_PRODUCTS)
  })

  it('GET iniciado antes do avanço não regride cache após POST confirmado', async () => {
    let finishGet!: (response: Response) => void
    const delayed = new Promise<Response>((resolve) => { finishGet = resolve })
    vi.mocked(fetch).mockReturnValueOnce(delayed).mockResolvedValueOnce(json(orderAt(2)))
    const reading = service.loadOrderApi('CS-2048')
    await service.advanceOrderApi('CS-2048')
    finishGet(json(orderAt(1)))
    await reading
    expect(service.getStoredOrder()).toEqual(orderAt(2))
    expect(JSON.parse(localStorage.getItem(ORDER_KEY)!)).toEqual(orderAt(2))
  })

  it.each(['ID divergente', 'step negativo', 'step após último evento', 'detalhe futuro em pending'])('HTTP200 com %s não confirma consulta/avanço nem contamina cache', async (invalidShape) => {
    const payload = orderAt(1)
    if (invalidShape === 'ID divergente') payload.id = 'CS-9999'
    if (invalidShape === 'step negativo') payload.currentStep = -1
    if (invalidShape === 'step após último evento') payload.currentStep = payload.events.length
    if (invalidShape === 'detalhe futuro em pending') payload.events[2].displayDetail = payload.events[2].detail
    service.saveOrder(orderAt(1))
    const persisted = localStorage.getItem(ORDER_KEY)
    vi.mocked(fetch).mockImplementation(async () => json(payload))

    await expect.soft(service.getOrder('2048')).resolves.toEqual({
      ok: false, message: 'Não foi possível consultar o pedido. Tente novamente.',
    })
    await expect.soft(service.loadOrderApi('2048')).resolves.toEqual(orderAt(1))
    expect.soft(localStorage.getItem(ORDER_KEY)).toBe(persisted)
    await expect.soft(service.advanceOrderApi('2048')).rejects.toThrow('Não foi possível atualizar o pedido. Tente novamente.')
    expect.soft(service.getStoredOrder()).toEqual(orderAt(1))
    expect.soft(localStorage.getItem(ORDER_KEY)).toBe(persisted)
  })

  it.each(['produto sem nome', 'lista com item null'])('HTTP200 com %s mantém catálogo renderizável e cache válido', async (invalidShape) => {
    const payload = invalidShape === 'produto sem nome'
      ? [{ ...service.INITIAL_PRODUCTS[0], name: undefined }]
      : [service.INITIAL_PRODUCTS[0], null]
    service.saveProducts(service.INITIAL_PRODUCTS)
    const persisted = localStorage.getItem(PRODUCTS_KEY)
    vi.mocked(fetch).mockResolvedValue(json(payload))

    await expect.soft(service.fetchProductsApi()).resolves.toEqual(service.INITIAL_PRODUCTS)
    expect.soft(service.getStoredProducts()).toEqual(service.INITIAL_PRODUCTS)
    expect.soft(localStorage.getItem(PRODUCTS_KEY)).toBe(persisted)
  })

  it('GET antigo não sobrescreve cache após GET mais recente confirmado, sem POST', async () => {
    let finishOld!: (response: Response) => void
    const delayed = new Promise<Response>((resolve) => { finishOld = resolve })
    vi.mocked(fetch).mockReturnValueOnce(delayed).mockResolvedValueOnce(json(orderAt(3)))
    const oldReading = service.loadOrderApi('CS-2048')
    await expect(service.loadOrderApi('CS-2048')).resolves.toEqual(orderAt(3))
    finishOld(json(orderAt(1)))
    await oldReading

    expect(service.getStoredOrder()).toEqual(orderAt(3))
    expect(JSON.parse(localStorage.getItem(ORDER_KEY)!)).toEqual(orderAt(3))
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/orders/CS-2048')
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/orders/CS-2048')
  })
})

describe('Armazenamento é opcional, não fonte de verdade', () => {
  it('getter localStorage SecurityError não quebra sucesso GET/POST nem fallback em memória', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Access denied', 'SecurityError')
    })
    vi.mocked(fetch).mockResolvedValue(json(orderAt(2)))
    await expect(service.advanceOrderApi('2048')).resolves.toEqual(orderAt(2))
    expect(service.getStoredOrder()).toEqual(orderAt(2))
    vi.mocked(fetch).mockResolvedValue(json(service.INITIAL_PRODUCTS))
    await expect(service.fetchProductsApi()).resolves.toEqual(service.INITIAL_PRODUCTS)
    vi.mocked(fetch).mockRejectedValue(new TypeError('offline'))
    await expect(service.loadOrderApi('2048')).resolves.toEqual(orderAt(2))
    expect(service.getStoredProducts()).toEqual(service.INITIAL_PRODUCTS)
  })

  it('quota de armazenamento não transforma POST backend bem-sucedido em falha', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError')
    })
    vi.mocked(fetch).mockResolvedValue(json(orderAt(3)))
    await expect(service.advanceOrderApi('2048')).resolves.toEqual(orderAt(3))
  })

  it('cache persistido antigo não regride memória após POST confirmado quando setItem falha', async () => {
    service.saveOrder(orderAt(1))
    const persisted = localStorage.getItem(ORDER_KEY)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError')
    })
    vi.mocked(fetch).mockResolvedValue(json(orderAt(2)))

    await expect(service.advanceOrderApi('2048')).resolves.toEqual(orderAt(2))
    expect(localStorage.getItem(ORDER_KEY)).toBe(persisted)
    expect(service.getStoredOrder()).toEqual(orderAt(2))
    expect(service.getStoredOrder()).toEqual(orderAt(2))
  })

  it('cache persistido antigo não substitui catálogo novo do GET quando setItem falha', async () => {
    service.saveProducts(service.INITIAL_PRODUCTS)
    const persisted = localStorage.getItem(PRODUCTS_KEY)
    const backend = [{ ...service.INITIAL_PRODUCTS[0], price: 799 }]
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError')
    })
    vi.mocked(fetch).mockResolvedValue(json(backend))

    await expect(service.fetchProductsApi()).resolves.toEqual(backend)
    expect(localStorage.getItem(PRODUCTS_KEY)).toBe(persisted)
    expect(service.getStoredProducts()).toEqual(backend)
    expect(service.getStoredProducts()).toEqual(backend)
  })

  it.each(['{', 'null', '{}'])('cache corrompido %s não substitui último pedido/catálogo válidos', (corrupt) => {
    service.saveOrder(orderAt(2))
    service.saveProducts(service.INITIAL_PRODUCTS)
    localStorage.setItem(ORDER_KEY, corrupt)
    localStorage.setItem(PRODUCTS_KEY, corrupt)
    expect.soft(service.getStoredOrder()).toEqual(orderAt(2))
    expect.soft(service.getStoredProducts()).toEqual(service.INITIAL_PRODUCTS)
  })
})
