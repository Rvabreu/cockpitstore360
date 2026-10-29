import { randomUUID } from 'node:crypto'
import type { CheckoutProduct, CheckoutReceipt, CheckoutRequest } from '../types/checkout.ts'

export const CHECKOUT_TOTAL_LIMIT = 100000000
function exactKeys(value: object, keys: string[]) {
  const actual = Object.keys(value)
  return actual.length === keys.length && keys.every(key => actual.includes(key))
}
export function normalizeCheckoutRequest(value: unknown): CheckoutRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !exactKeys(value, ['items', 'idempotencyKey'])) return null
  const fields = value as Record<string, unknown>
  if (typeof fields.idempotencyKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fields.idempotencyKey)) return null
  if (!Array.isArray(fields.items) || fields.items.length < 1 || fields.items.length > 20) return null
  const seen = new Set<string>()
  const items = []
  for (const item of fields.items) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || !exactKeys(item, ['productId', 'quantity'])) return null
    const { productId, quantity } = item as Record<string, unknown>
    if (typeof productId !== 'string' || !productId || productId.length > 128 || productId.trim() !== productId || /[\x00-\x1f\x7f]/.test(productId) || seen.has(productId)) return null
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) return null
    seen.add(productId); items.push({ productId, quantity })
  }
  items.sort((a, b) => a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0)
  return { items, idempotencyKey: fields.idempotencyKey.toLowerCase() }
}

export function buildCheckoutReceipt(request: CheckoutRequest, products: CheckoutProduct[], { id = randomUUID(), now = Date.now }: {
  id?: string; now?: () => number
} = {}): CheckoutReceipt | null {
  let totalCents = 0
  const items: CheckoutReceipt['items'] = []
  for (const item of request.items) {
    const product = products.find(product => product.id === item.productId)
    if (!product) return null
    if (typeof product.name !== 'string' || !product.name.trim() || typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price < 0) throw new Error('Dados do catálogo inválidos')
    const unitPriceCents = Math.round(product.price * 100)
    const lineTotalCents = unitPriceCents * item.quantity
    if (!Number.isSafeInteger(unitPriceCents) || !Number.isSafeInteger(lineTotalCents)) throw new Error('Dados do catálogo inválidos')
    totalCents += lineTotalCents
    if (!Number.isSafeInteger(totalCents) || totalCents > CHECKOUT_TOTAL_LIMIT) return null
    items.push({ productId: item.productId, name: product.name, quantity: item.quantity, unitPriceCents, lineTotalCents })
  }
  items.sort((a, b) => a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0)
  return { id, items, totalCents, currency: 'BRL', paymentStatus: 'simulated', createdAt: new Date(now()).toISOString() }
}
