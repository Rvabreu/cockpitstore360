import type { DashboardData } from '../types/dashboard'

const STATUS_LABELS = ['Pedido confirmado', 'Em separação', 'Em transporte', 'Entregue']

export class DashboardError extends Error {
  constructor(readonly status: number) {
    super(status === 401 ? 'Sessão não autenticada' : status === 403
      ? 'Requisição não autorizada' : 'Não foi possível carregar o painel. Tente novamente.')
    this.name = 'DashboardError'
  }
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1) return false
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(0, 0, 0, 0)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isDashboardData(value: unknown): value is DashboardData {
  if (!record(value) || value.demo !== true || value.currency !== 'BRL' || !record(value.summary)
    || !Array.isArray(value.orders) || !Array.isArray(value.products)
    || !Array.isArray(value.statusDistribution) || !Array.isArray(value.ordersByDate)) return false
  const productIds = new Set<string>()
  for (const product of value.products) {
    if (!record(product) || !text(product.id) || productIds.has(product.id) || !text(product.name)
      || typeof product.category !== 'string' || !integer(product.priceCents)) return false
    productIds.add(product.id)
  }
  const orderIds = new Set<string>()
  const counts = [0, 0, 0, 0]
  const dates = new Map<string, number>()
  let total = 0
  for (const order of value.orders) {
    if (!record(order) || !text(order.id) || orderIds.has(order.id) || !text(order.productId)
      || !text(order.productName) || typeof order.variant !== 'string' || !integer(order.quantity)
      || order.quantity === 0 || !integer(order.totalCents) || !integer(order.currentStep) || order.currentStep > 3
      || order.statusLabel !== STATUS_LABELS[order.currentStep]
      || (order.placedDate !== null && (typeof order.placedDate !== 'string' || !isCalendarDate(order.placedDate)))) return false
    orderIds.add(order.id)
    total += order.totalCents
    if (!integer(total)) return false
    counts[order.currentStep]++
    if (typeof order.placedDate === 'string') dates.set(order.placedDate, (dates.get(order.placedDate) ?? 0) + 1)
  }
  if (value.statusDistribution.length !== 4 || !value.statusDistribution.every((item, index) => record(item)
    && item.step === index && item.label === STATUS_LABELS[index] && item.count === counts[index])) return false
  const sortedDates = [...dates].sort(([a], [b]) => a.localeCompare(b))
  if (value.ordersByDate.length !== sortedDates.length || !value.ordersByDate.every((item, index) => record(item)
    && item.date === sortedDates[index][0] && item.count === sortedDates[index][1])) return false
  const summary = value.summary
  return summary.totalOrders === value.orders.length && summary.totalProducts === value.products.length
    && summary.registeredValueCents === total
    && summary.averageOrderValueCents === (value.orders.length ? Math.round(total / value.orders.length) : 0)
}

export async function loadDashboard(signal?: AbortSignal): Promise<DashboardData> {
  try {
    const response = await fetch('/api/auth/dashboard', { method: 'GET', credentials: 'same-origin', cache: 'no-store', signal })
    if (!response.ok) throw new DashboardError(response.status)
    const data: unknown = await response.json()
    if (!isDashboardData(data)) throw new DashboardError(0)
    return data
  } catch (error) {
    if (signal?.aborted || error instanceof DashboardError) throw error
    throw new DashboardError(0)
  }
}
