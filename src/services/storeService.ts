import type { OrderEvent, OrderWithEvents, Product } from '../types/store'

// R3-3: pinned localStorage keys. The API is the source of truth; successful
// responses are mirrored to these keys and read back only when the API fails.
const PRODUCTS_STORAGE_KEY = 'cockpit_store_products_v1'
const ORDER_STORAGE_KEY = 'cockpit_store_order_v1'
const DATA_CHANGE_EVENT = 'cockpit_store_data_change'

const NOT_FOUND_MESSAGE = 'Pedido não encontrado'
const UNAVAILABLE_MESSAGE = 'Não foi possível consultar o pedido. Tente novamente.'
const AWAITING_DETAIL = 'Aguardando atualização'

export const SEED_ORDER_ID = 'CS-2048'

// R3-4: ascending createdAt so the catalog renders Orbit, Pulse, Wave in mockup order.
export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-orbit',
    name: 'Orbit Headphones Pro',
    description: 'Som premium para qualquer jornada.',
    category: 'Áudio imersivo',
    price: 699,
    image: '/assets/hero_produtos.svg#orbit',
    createdAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'prod-pulse',
    name: 'Pulse Watch S2',
    description: 'Seu ritmo, sob controle.',
    category: 'Wearables',
    price: 899,
    image: '/assets/hero_produtos.svg#pulse',
    createdAt: '2026-10-02T10:00:00.000Z',
  },
  {
    id: 'prod-wave',
    name: 'Wave Mini Speaker',
    description: 'Som potente em qualquer lugar.',
    category: 'Áudio conectado',
    price: 349,
    image: '/assets/hero_produtos.svg#wave',
    createdAt: '2026-10-03T10:00:00.000Z',
  },
]

// Raw ordered events for the seed order (titles/details verbatim from the mockup).
export const SEED_ORDER_EVENTS: Array<{ title: string; detail: string }> = [
  { title: 'Pedido confirmado', detail: '19 out · 10h12' },
  { title: 'Em separação', detail: '20 out · 08h35' },
  { title: 'Em transporte', detail: '21 out · 14h20' },
  { title: 'Entregue', detail: 'Entrega confirmada' },
]

/**
 * Build the derived OrderWithEvents shape (status + displayDetail + statusLabel)
 * from the raw order fields for the initial demonstration data.
 */
export function buildOrderWithEvents(params: {
  id: string
  productId: string
  productName: string
  variant: string
  quantity: number
  total: number
  placedAt: string
  currentStep: number
  events: Array<{ title: string; detail: string }>
}): OrderWithEvents {
  const events: OrderEvent[] = params.events.map((e, i) => ({
    stepIndex: i,
    title: e.title,
    detail: e.detail,
    displayDetail: i <= params.currentStep ? e.detail : AWAITING_DETAIL,
    status: i < params.currentStep ? 'done' : i === params.currentStep ? 'current' : 'pending',
  }))

  return {
    id: params.id,
    productId: params.productId,
    productName: params.productName,
    variant: params.variant,
    quantity: params.quantity,
    total: params.total,
    placedAt: params.placedAt,
    currentStep: params.currentStep,
    statusLabel: events[params.currentStep]?.title ?? '',
    events,
  }
}

// The single seed order, fully renderable so R3-1 can seed React state synchronously.
export const INITIAL_ORDER: OrderWithEvents = buildOrderWithEvents({
  id: SEED_ORDER_ID,
  productId: 'prod-orbit',
  productName: 'Orbit Headphones Pro',
  variant: 'Grafite',
  quantity: 1,
  total: 699,
  placedAt: '19/10/2026',
  currentStep: 1,
  events: SEED_ORDER_EVENTS,
})

// In-memory cache for SSR / fallback.
let inMemoryProducts: Product[] = [...INITIAL_PRODUCTS]
let inMemoryOrder: OrderWithEvents = INITIAL_ORDER
let orderRequestVersion = 0
let productsRequestVersion = 0
let productsStorageDirty = false
let orderStorageDirty = false

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isProducts(value: unknown): value is Product[] {
  return Array.isArray(value) && value.every((product) =>
    isRecord(product) &&
    ['id', 'name', 'description', 'category', 'image', 'createdAt'].every((key) => typeof product[key] === 'string') &&
    typeof product.price === 'number' && Number.isFinite(product.price) && product.price >= 0,
  )
}

function isOrder(value: unknown, expectedId: string): value is OrderWithEvents {
  if (!isRecord(value) || value.id !== expectedId ||
    !['productId', 'productName', 'variant', 'placedAt', 'statusLabel'].every((key) => typeof value[key] === 'string') ||
    typeof value.quantity !== 'number' || !Number.isInteger(value.quantity) || value.quantity < 1 ||
    typeof value.total !== 'number' || !Number.isFinite(value.total) || value.total < 0 ||
    typeof value.currentStep !== 'number' || !Number.isInteger(value.currentStep) ||
    !Array.isArray(value.events) || value.events.length === 0 ||
    value.currentStep < 0 || value.currentStep >= value.events.length) return false

  const currentStep = value.currentStep
  return value.events.every((event, index) =>
    isRecord(event) && event.stepIndex === index &&
    typeof event.title === 'string' && typeof event.detail === 'string' &&
    event.status === (index < currentStep ? 'done' : index === currentStep ? 'current' : 'pending') &&
    event.displayDetail === (index <= currentStep ? event.detail : AWAITING_DETAIL),
  ) && value.statusLabel === value.events[currentStep].title
}

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

/* ==================== LocalStorage Fallbacks ==================== */

export function getStoredProducts(): Product[] {
  if (productsStorageDirty) return inMemoryProducts
  try {
    if (!isBrowser() || !window.localStorage) return inMemoryProducts
    const raw = window.localStorage.getItem(PRODUCTS_STORAGE_KEY)
    if (!raw) {
      window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(inMemoryProducts))
      return inMemoryProducts
    }
    const products: unknown = JSON.parse(raw)
    if (isProducts(products)) inMemoryProducts = products
    return inMemoryProducts
  } catch (e) {
    console.error('Erro ao ler produtos do armazenamento local:', e)
    return inMemoryProducts
  }
}

export function saveProducts(products: Product[]): void {
  if (!isProducts(products)) return
  inMemoryProducts = products
  productsStorageDirty = true
  try {
    if (isBrowser() && window.localStorage) {
      window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products))
      productsStorageDirty = false
      window.dispatchEvent(new Event(DATA_CHANGE_EVENT))
    }
  } catch (e) {
    console.error('Erro ao salvar produtos no armazenamento local:', e)
  }
}

export function getStoredOrder(): OrderWithEvents {
  if (orderStorageDirty) return inMemoryOrder
  try {
    if (!isBrowser() || !window.localStorage) return inMemoryOrder
    const raw = window.localStorage.getItem(ORDER_STORAGE_KEY)
    if (!raw) {
      window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(inMemoryOrder))
      return inMemoryOrder
    }
    const order: unknown = JSON.parse(raw)
    if (isOrder(order, SEED_ORDER_ID)) inMemoryOrder = order
    return inMemoryOrder
  } catch (e) {
    console.error('Erro ao ler pedido do armazenamento local:', e)
    return inMemoryOrder
  }
}

export function saveOrder(order: OrderWithEvents): void {
  if (!isOrder(order, SEED_ORDER_ID)) return
  inMemoryOrder = order
  orderStorageDirty = true
  try {
    if (isBrowser() && window.localStorage) {
      window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order))
      orderStorageDirty = false
      window.dispatchEvent(new Event(DATA_CHANGE_EVENT))
    }
  } catch (e) {
    console.error('Erro ao salvar pedido no armazenamento local:', e)
  }
}

/** Normalize a user/path order id: decode, strip leading '#', trim, uppercase. */
export function normalizeOrderId(raw: string): string {
  let value = raw
  try {
    value = decodeURIComponent(raw)
  } catch {
    value = raw
  }
  value = value.trim().replace(/^#/, '').trim().toUpperCase()
  return /^\d+$/.test(value) ? `CS-${value}` : value
}

/* ==================== Backend REST API Calls (SQLite Persisted) ==================== */

export async function fetchProductsApi(): Promise<Product[]> {
  const version = ++productsRequestVersion
  try {
    const res = await fetch('/api/products')
    if (!res.ok) throw new Error(`Erro HTTP ${res.status}`)
    const data: unknown = await res.json()
    if (!isProducts(data)) throw new Error('Dados de produtos inválidos')
    if (version !== productsRequestVersion) return getStoredProducts()
    saveProducts(data)
    return data
  } catch (e) {
    console.warn('API de produtos indisponível; usando dados locais:', e)
    return getStoredProducts()
  }
}

export async function loadOrderApi(id: string): Promise<OrderWithEvents> {
  const normalized = normalizeOrderId(id)
  const version = ++orderRequestVersion
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(normalized)}`)
    if (!res.ok) throw new Error(`Erro HTTP ${res.status}`)
    const data: unknown = await res.json()
    if (!isOrder(data, normalized)) throw new Error('Dados do pedido inválidos')
    if (version !== orderRequestVersion) return getStoredOrder()
    saveOrder(data)
    return data
  } catch (e) {
    console.warn('API do pedido indisponível; usando dados locais:', e)
    return getStoredOrder()
  }
}

export async function advanceOrderApi(id: string): Promise<OrderWithEvents> {
  const normalized = normalizeOrderId(id)
  ++orderRequestVersion
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(normalized)}/advance`, { method: 'POST' })
    if (!res.ok) throw new Error(`Erro HTTP ${res.status}`)
    const data: unknown = await res.json()
    if (!isOrder(data, normalized)) throw new Error('Dados do pedido inválidos')
    saveOrder(data)
    return data
  } catch {
    throw new Error('Não foi possível atualizar o pedido. Tente novamente.')
  } finally {
    // Reads started during a mutation may also describe the previous step.
    ++orderRequestVersion
  }
}

/**
 * Validation-only lookup (useStore() contract): never swaps the displayed order,
 * only returns an { ok, message } pair for the search box, confirmed by the API.
 */
export async function getOrder(id: string): Promise<{ ok: boolean; message: string }> {
  const normalized = normalizeOrderId(id)
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(normalized)}`)
    if (res.ok) {
      const order: unknown = await res.json()
      if (!isOrder(order, normalized)) throw new Error('Dados do pedido inválidos')
      return { ok: true, message: `Pedido ${order.id} encontrado. Status: ${order.statusLabel}. Os dados exibidos são fictícios.` }
    }
    if (res.status === 404) {
      return { ok: false, message: NOT_FOUND_MESSAGE }
    }
    throw new Error(`Erro HTTP ${res.status}`)
  } catch {
    return { ok: false, message: UNAVAILABLE_MESSAGE }
  }
}
