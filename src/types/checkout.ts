export interface CheckoutItem { productId: string; quantity: number }
export interface CheckoutRequest { items: CheckoutItem[]; idempotencyKey: string }
export interface CheckoutProduct { id: string; name: string; price: number }
export interface CheckoutReceipt {
  id: string
  items: { productId: string; name: string; quantity: number; unitPriceCents: number; lineTotalCents: number }[]
  totalCents: number
  currency: 'BRL'
  paymentStatus: 'simulated'
  createdAt: string
}
