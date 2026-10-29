import Stripe from 'stripe'
import type { PaymentConfig } from './config.ts'
export interface GatewayCreateParams {
  orderId: string; items: { name: string; quantity: number; unitPriceCents: number }[]
  successUrl: string; cancelUrl: string; expiresAt: number; idempotencyKey: string
}
export interface GatewaySession {
  id: string; url: string | null; mode: string | null; livemode: boolean; currency: string | null; amountTotal: number | null
  paymentStatus: string; status: string | null; orderId: string | null; metadataOrderId: string | null
  items: { name: string; quantity: number; unitPriceCents: number }[]
  createdAt: number; expiresAt: number
}
export interface GatewayEvent { id: string; type: string; livemode: boolean; sessionId: string }
export interface PaymentGateway {
  createCheckout(params: GatewayCreateParams): Promise<GatewaySession>
  retrieveCheckout(id: string): Promise<GatewaySession>
  verifyWebhook(raw: Buffer, signature: string): GatewayEvent
}
export function createStripeGateway(config: PaymentConfig, client = new Stripe(config.secretKey, { maxNetworkRetries: 1, timeout: 15000 })): PaymentGateway {
  function summary(s: Stripe.Checkout.Session, items: GatewaySession['items']): GatewaySession {
    return { id: s.id, url: s.url, mode: s.mode, livemode: s.livemode, currency: s.currency, amountTotal: s.amount_total,
      paymentStatus: s.payment_status, status: s.status, orderId: s.client_reference_id, metadataOrderId: s.metadata?.orderId || null, items, createdAt:s.created, expiresAt:s.expires_at }
  }
  return {
    async createCheckout(p) {
      const session = await client.checkout.sessions.create({ mode: 'payment', client_reference_id: p.orderId, metadata: { orderId: p.orderId },
        line_items: p.items.map(item => ({ quantity: item.quantity, price_data: { currency: 'usd', unit_amount: item.unitPriceCents, product_data: { name: item.name } } })),
        success_url: p.successUrl, cancel_url: p.cancelUrl, expires_at: p.expiresAt }, { idempotencyKey: p.idempotencyKey })
      return summary(session, p.items)
    },
    async retrieveCheckout(id) {
      const session = await client.checkout.sessions.retrieve(id)
      const lines = await client.checkout.sessions.listLineItems(id, { limit: 100, expand: ['data.price.product'] })
      if (lines.has_more) throw new Error('Sessão de pagamento inválida')
      if (lines.data.some(line => line.price?.currency !== 'usd')) throw new Error('Sessão de pagamento inválida')
      return summary(session, lines.data.map(line => ({ name: line.description || '', quantity: line.quantity || 0, unitPriceCents: line.price?.unit_amount ?? -1 })))
    },
    verifyWebhook(raw, signature) {
      const event = client.webhooks.constructEvent(raw, signature, config.webhookSecret, 300)
      const object = event.data.object as Stripe.Checkout.Session
      return { id: event.id, type: event.type, livemode: event.livemode, sessionId: object.id }
    },
  }
}
