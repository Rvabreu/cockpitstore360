import type { createAuthStore, PaymentRow } from '../auth/db.ts'
import type { PaymentConfig } from './config.ts'
import type { PaymentGateway, GatewaySession } from './gateway.ts'
import type { CheckoutRequest, CheckoutProduct } from '../../types/checkout.ts'
import type { PaymentOrder } from '../../types/payment.ts'
export class PaymentError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
export const paymentOrder = (row: PaymentRow): PaymentOrder => ({ ...JSON.parse(row.snapshot_json), status: row.status })
export function validSession(session: GatewaySession, row: PaymentRow) {
  const order = paymentOrder(row)
  const sorted = (items: GatewaySession['items']) => [...items].sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  return session.id && session.mode === 'payment' && session.livemode === (row.mode === 'live') && session.currency === 'usd' &&
    session.amountTotal === row.total_cents && session.orderId === row.id && session.metadataOrderId === row.id &&
    session.expiresAt === row.expires_at && session.createdAt >= Math.floor(row.created_at / 1000) && session.createdAt <= Math.floor(row.create_deadline_at / 1000) &&
    (!row.stripe_session_id || row.stripe_session_id === session.id) &&
    JSON.stringify(sorted(session.items)) === JSON.stringify(sorted(order.items.map(i => ({ name: i.name, quantity: i.quantity, unitPriceCents: i.unitPriceCents }))))
}
export function safeCheckoutUrl(value: string | null) {
  if (!value) return null
  try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'checkout.stripe.com' && !u.username && !u.password && !u.port ? value : null } catch { return null }
}
export function createPaymentService({ config, store, gateway, loadProducts, now = Date.now }: {
  config: PaymentConfig | null; store: ReturnType<typeof createAuthStore>; gateway: PaymentGateway | null;
  loadProducts: (ids: string[]) => CheckoutProduct[]; now?: () => number
}) {
  function configured() { if (!config || !gateway) throw new PaymentError(503, 'Pagamentos indisponíveis'); return { config, gateway } }
  function catalog() {
    const { config } = configured(), ids = Object.keys(config.prices), products = loadProducts(ids)
    if (products.length !== ids.length || ids.some(id => !products.some(p => p.id === id && typeof p.name === 'string' && p.name.trim()))) throw new PaymentError(503, 'Pagamentos indisponíveis')
    return { currency: 'USD' as const, mode: config.mode, products: products.map(p => ({ id: p.id, name: p.name, unitPriceCents: config.prices[p.id] })) }
  }
  return {
    catalog,
    async checkout(sessionToken: string, csrfCookie: string, request: CheckoutRequest) {
      const { config, gateway } = configured()
      const prepared = store.preparePayment({ sessionToken, csrfCookie, request, mode: config.mode, origin:config.origin, loadItems: () => {
        const products = catalog().products
        let total = 0
        const items: PaymentOrder['items'] = []
        for (const i of request.items) {
          const p = products.find(p => p.id === i.productId)
          if (!p) return null
          const lineTotalCents = p.unitPriceCents * i.quantity; total += lineTotalCents
          if (!Number.isSafeInteger(total) || total > 100000000) return null
          items.push({ ...i, name: p.name, unitPriceCents: p.unitPriceCents, lineTotalCents })
        }
        return items
      } })
      if (prepared.status === 'unauthorized') throw new PaymentError(401, 'Sessão não autenticada')
      if (prepared.status === 'conflict') throw new PaymentError(409, 'Não foi possível concluir com os dados informados')
      let row = prepared.row
      if (row.mode !== config.mode) throw new PaymentError(409, 'Não foi possível concluir com os dados informados')
      if (!row.stripe_session_id && row.status === 'pending') {
        if (now() >= row.create_deadline_at) throw new PaymentError(409, 'Não foi possível concluir com os dados informados')
        let session: GatewaySession
        try {
          session = await gateway.createCheckout(JSON.parse(row.gateway_params_json))
          if (!validSession(session, row) || !safeCheckoutUrl(session.url)) throw new Error('Sessão inválida')
          store.attachStripeSession(row.id, session.id, safeCheckoutUrl(session.url))
        } catch { throw new PaymentError(503, 'Não foi possível iniciar o pagamento. Tente novamente.') }
        row = store.findPayment(row.id)!
      }
      // An unpaid webhook can durably attach the session before the create request
      // persists its URL. Recover that SAME session, never create another charge.
      if (row.status === 'pending' && row.stripe_session_id && !safeCheckoutUrl(row.checkout_url)) {
        try {
          const session = await gateway.retrieveCheckout(row.stripe_session_id)
          if (!validSession(session,row) ||
            (session.status !== 'complete' && !safeCheckoutUrl(session.url))) throw new Error('Sessão inválida')
          store.attachStripeSession(row.id,session.id,safeCheckoutUrl(session.url))
          row = store.findPayment(row.id)!
        } catch { throw new PaymentError(503,'Não foi possível iniciar o pagamento. Tente novamente.') }
      }
      const user = store.findUserSession(sessionToken, csrfCookie)
      if (!user || user.id !== row.user_id) throw new PaymentError(401, 'Sessão não autenticada')
      return { created: prepared.created, result: { orderId: row.id, status: row.status, checkoutUrl: row.status === 'pending' ? safeCheckoutUrl(row.checkout_url) : null } }
    },
    owned(id: string, userId: string) { configured(); const row = store.findOwnedPayment(id,userId); if (!row) throw new PaymentError(404,'Pedido não encontrado'); return paymentOrder(row) },
  }
}
