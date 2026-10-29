export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired'
export interface PaymentCatalog { currency: 'USD'; mode: 'test' | 'live'; products: { id: string; name: string; unitPriceCents: number }[] }
export interface PaymentOrder {
  id: string
  items: { productId: string; name: string; quantity: number; unitPriceCents: number; lineTotalCents: number }[]
  totalCents: number
  currency: 'USD'
  status: PaymentStatus
  createdAt: string
}
export interface PaymentCheckoutResult { orderId: string; status: PaymentStatus; checkoutUrl: string | null }
