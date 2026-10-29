export interface DashboardOrder {
  id: string
  productId: string
  productName: string
  variant: string
  quantity: number
  totalCents: number
  placedDate: string | null
  currentStep: number
  statusLabel: string
}

export interface DashboardProduct {
  id: string
  name: string
  category: string
  priceCents: number
}

export interface DashboardData {
  demo: true
  currency: 'BRL'
  summary: {
    totalOrders: number
    registeredValueCents: number
    averageOrderValueCents: number
    totalProducts: number
  }
  statusDistribution: Array<{ step: number; label: string; count: number }>
  ordersByDate: Array<{ date: string; count: number }>
  orders: DashboardOrder[]
  products: DashboardProduct[]
}

export interface DashboardSnapshot {
  orders: Array<{
    id: string; product_id: string; product_name: string; variant: string | null
    quantity: number; total: number; placed_at: string; current_step: number
  }>
  products: Array<{
    id: string; name: string; category: string | null; price: number; created_at: string
  }>
}
