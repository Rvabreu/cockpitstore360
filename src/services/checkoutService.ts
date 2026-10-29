import type { CheckoutProduct, CheckoutReceipt } from '../types/checkout'

const MAX_CENTS = 100000000
export const isProductId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128 && value.trim() === value && !/[\x00-\x1f\x7f]/.test(value)
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const cents = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= MAX_CENTS
const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const keys = (value: Record<string, unknown>, expected: string[]) => Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key))

export class CheckoutError extends Error {
  constructor(readonly status: number) {
    super('Não foi possível carregar o catálogo. Tente novamente.')
    this.name = 'CheckoutError'
  }
}

export function isCheckoutReceipt(value: unknown): value is CheckoutReceipt {
  if (!record(value) || !keys(value, ['id', 'items', 'totalCents', 'currency', 'paymentStatus', 'createdAt'])
    || !uuid(value.id) || value.currency !== 'BRL' || value.paymentStatus !== 'simulated' || !cents(value.totalCents)
    || typeof value.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.createdAt)
    || !Number.isFinite(Date.parse(value.createdAt)) || new Date(value.createdAt).toISOString() !== value.createdAt
    || !Array.isArray(value.items) || value.items.length < 1 || value.items.length > 20) return false
  let total = 0
  let previous = ''
  for (const item of value.items) {
    if (!record(item) || !keys(item, ['productId', 'name', 'quantity', 'unitPriceCents', 'lineTotalCents'])
      || !isProductId(item.productId) || item.productId <= previous || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 500
      || !Number.isInteger(item.quantity) || (item.quantity as number) < 1 || (item.quantity as number) > 10
      || !cents(item.unitPriceCents) || !cents(item.lineTotalCents) || item.lineTotalCents !== item.unitPriceCents * (item.quantity as number)) return false
    previous = item.productId
    total += item.lineTotalCents
  }
  return cents(total) && total === value.totalCents
}

export async function loadCheckoutCatalog(signal?: AbortSignal): Promise<CheckoutProduct[]> {
  try {
    const response = await fetch('/api/products', { credentials: 'same-origin', cache: 'no-store', signal })
    if (!response.ok) throw new CheckoutError(response.status)
    const value: unknown = await response.json()
    if (!Array.isArray(value) || !value.every((item) => record(item) && isProductId(item.id)
      && typeof item.name === 'string' && item.name.trim().length > 0 && item.name.length <= 500
      && typeof item.price === 'number' && Number.isFinite(item.price) && item.price >= 0 && cents(Math.round(item.price * 100)))
      || new Set(value.map((item) => item.id)).size !== value.length) throw new CheckoutError(0)
    return value.map(({ id, name, price }) => ({ id, name, price }))
  } catch (error) {
    if (signal?.aborted) throw error
    throw error instanceof CheckoutError ? error : new CheckoutError(0)
  }
}
