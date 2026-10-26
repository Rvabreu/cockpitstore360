export interface Product {
  id: string
  name: string
  description: string
  category: string
  price: number
  image: string
  createdAt: string
}

export type OrderEventStatus = 'done' | 'current' | 'pending'

export interface OrderEvent {
  stepIndex: number
  title: string
  detail: string
  // Server-computed display value: done/current steps show `detail`, pending
  // steps show the literal 'Aguardando atualização' (mockup renderTimeline branch).
  displayDetail: string
  status: OrderEventStatus
}

export interface OrderWithEvents {
  id: string
  productId: string
  productName: string
  variant: string
  quantity: number
  total: number
  placedAt: string
  currentStep: number
  // events[currentStep].title — the status badge text
  statusLabel: string
  events: OrderEvent[]
}
