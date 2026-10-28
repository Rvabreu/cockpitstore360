import type { DashboardData, DashboardSnapshot } from '../types/dashboard.ts'

const LABELS = ['Pedido confirmado', 'Em separação', 'Em transporte', 'Entregue']
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0

function calendarDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  if (!match) return null
  const [, day, month, year] = match.map(Number)
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(0, 0, 0, 0)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date.toISOString().slice(0, 10)
}

function cents(value: number): number {
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100))) {
    throw new Error('Valor inválido na base de demonstração')
  }
  return Math.round(value * 100)
}

export function buildDashboard(snapshot: DashboardSnapshot): DashboardData {
  const statusDistribution = LABELS.map((label, step) => ({ step, label, count: 0 }))
  const dates = new Map<string, number>()
  let registeredValueCents = 0
  const orders = snapshot.orders.map((order) => {
    if (!Number.isInteger(order.current_step) || order.current_step < 0 || order.current_step > 3) {
      throw new Error('Etapa inválida na base de demonstração')
    }
    const totalCents = cents(order.total)
    registeredValueCents += totalCents
    if (!Number.isSafeInteger(registeredValueCents)) throw new Error('Valor inválido na base de demonstração')
    ++statusDistribution[order.current_step].count
    const placedDate = calendarDate(order.placed_at)
    if (placedDate) dates.set(placedDate, (dates.get(placedDate) || 0) + 1)
    return {
      id: order.id, productId: order.product_id, productName: order.product_name,
      variant: order.variant || '', quantity: order.quantity, totalCents, placedDate,
      currentStep: order.current_step, statusLabel: LABELS[order.current_step],
    }
  }).sort((a, b) => {
    if (a.placedDate !== b.placedDate) {
      if (a.placedDate === null) return 1
      if (b.placedDate === null) return -1
      return compare(b.placedDate, a.placedDate)
    }
    return compare(a.id, b.id)
  })
  const products = [...snapshot.products]
    .sort((a, b) => compare(a.created_at, b.created_at) || compare(a.id, b.id))
    .map((product) => ({ id: product.id, name: product.name, category: product.category || '', priceCents: cents(product.price) }))
  return {
    demo: true, currency: 'BRL',
    summary: {
      totalOrders: orders.length, registeredValueCents,
      averageOrderValueCents: orders.length ? Math.round(registeredValueCents / orders.length) : 0,
      totalProducts: products.length,
    },
    statusDistribution,
    ordersByDate: [...dates].sort(([a], [b]) => compare(a, b)).map(([date, count]) => ({ date, count })),
    orders, products,
  }
}
