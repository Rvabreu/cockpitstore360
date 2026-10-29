import type { PaymentCatalog, PaymentCheckoutResult, PaymentOrder } from '../types/payment'
import { isProductId } from './checkoutService'

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const cents = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 100000000
export const isPaymentId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const status = (value: unknown) => ['pending', 'paid', 'failed', 'expired'].includes(value as string)
const name = (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim()) && value.length <= 500
const exactKeys = (value: Record<string, unknown>, expected: string[]) => Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key))
export function isStripeCheckoutUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'checkout.stripe.com' && !url.port && !url.username && !url.password
  } catch { return false }
}
export function redirectToStripe(url: string): void {
  if (!isStripeCheckoutUrl(url)) throw new PaymentError(0)
  window.location.assign(url)
}
export function isPaymentCheckoutResult(value: unknown): value is PaymentCheckoutResult {
  return record(value) && exactKeys(value, ['orderId', 'status', 'checkoutUrl']) && isPaymentId(value.orderId) && status(value.status)
    && (value.checkoutUrl === null || (value.status === 'pending' && isStripeCheckoutUrl(value.checkoutUrl)))
}
export function isPaymentOrder(value: unknown): value is PaymentOrder {
  if (!record(value) || !exactKeys(value, ['id', 'items', 'totalCents', 'currency', 'status', 'createdAt']) || !isPaymentId(value.id) || !status(value.status) || value.currency !== 'USD' || !cents(value.totalCents)
    || typeof value.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.createdAt)
    || !Number.isFinite(Date.parse(value.createdAt)) || new Date(value.createdAt).toISOString() !== value.createdAt
    || !Array.isArray(value.items) || !value.items.length || value.items.length > 20) return false
  let total = 0
  const ids = new Set<string>()
  for (const item of value.items) {
    if (!record(item) || !exactKeys(item, ['productId', 'name', 'quantity', 'unitPriceCents', 'lineTotalCents']) || !isProductId(item.productId) || ids.has(item.productId) || !name(item.name)
      || !Number.isInteger(item.quantity) || (item.quantity as number) < 1 || (item.quantity as number) > 10
      || !cents(item.unitPriceCents) || item.unitPriceCents < 50 || !cents(item.lineTotalCents)
      || item.lineTotalCents !== item.unitPriceCents * (item.quantity as number)) return false
    ids.add(item.productId); total += item.lineTotalCents
  }
  return cents(total) && total === value.totalCents
}
function isCatalog(value: unknown): value is PaymentCatalog {
  return record(value) && value.currency === 'USD' && ['test', 'live'].includes(value.mode as string) && Array.isArray(value.products)
    && value.products.every((product) => record(product) && isProductId(product.id) && name(product.name) && cents(product.unitPriceCents) && product.unitPriceCents >= 50)
    && new Set(value.products.map((product) => product.id)).size === value.products.length
}
export class PaymentError extends Error {
  constructor(readonly status: number) {
    super(status === 401 ? 'Sessão não autenticada' : status === 403 ? 'Requisição não autorizada'
      : status === 404 ? 'Pedido não encontrado' : status === 503 ? 'Pagamentos indisponíveis. Configure o Stripe para continuar.'
        : 'Não foi possível consultar o pagamento. Tente novamente.')
    this.name = 'PaymentError'
  }
}
async function get(path: string, signal?: AbortSignal): Promise<unknown> {
  try {
    const response = await fetch(`/api/auth/payments/${path}`, { credentials: 'same-origin', cache: 'no-store', signal })
    if (!response.ok) throw new PaymentError(response.status)
    return await response.json()
  } catch (error) {
    if (signal?.aborted) throw error
    throw error instanceof PaymentError ? error : new PaymentError(0)
  }
}
export async function loadPaymentCatalog(signal?: AbortSignal): Promise<PaymentCatalog> {
  const value = await get('catalog', signal)
  if (!isCatalog(value)) throw new PaymentError(0)
  return value
}
export async function loadPaymentOrder(id: string, signal?: AbortSignal): Promise<PaymentOrder> {
  if (!isPaymentId(id)) throw new PaymentError(404)
  const value = await get(`orders/${encodeURIComponent(id)}`, signal)
  if (!record(value) || !isPaymentOrder(value.order) || value.order.id !== id) throw new PaymentError(0)
  return value.order
}
