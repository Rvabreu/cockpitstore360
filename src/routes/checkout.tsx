import { createFileRoute, useLocation } from '@tanstack/react-router'
import CheckoutPage from '../components/CheckoutPage'
import { isProductId } from '../services/checkoutService'
import { isPaymentId } from '../services/paymentsService'

export const Route = createFileRoute('/checkout')({
  head: () => ({ meta: [{ title: 'Finalizar compra | COCKPIT STORE 360' }] }),
  validateSearch: (search: Record<string, unknown>): { produto?: unknown; pedido?: unknown; retorno?: unknown } => ({
    ...(Object.hasOwn(search, 'produto') ? { produto: search.produto } : {}),
    ...(Object.hasOwn(search, 'pedido') ? { pedido: search.pedido } : {}),
    ...(Object.hasOwn(search, 'retorno') ? { retorno: search.retorno } : {}),
  }),
  component: () => {
    const search = Route.useSearch()
    const raw = new URLSearchParams(useLocation().searchStr)
    const validProduct = isProductId(search.produto)
    const validOrder = isPaymentId(search.pedido)
    const validReturn = search.retorno === 'sucesso' || search.retorno === 'cancelado'
    return <CheckoutPage key={raw.toString()} initialProductId={isProductId(search.produto) ? search.produto : undefined}
      initialOrderId={validOrder ? search.pedido as string : undefined} returnStatus={validReturn ? search.retorno as 'sucesso' | 'cancelado' : undefined}
      invalidInitialSelection={(Object.hasOwn(search, 'produto') && !validProduct) || (Object.hasOwn(search, 'pedido') && !validOrder)
        || (Object.hasOwn(search, 'retorno') && (!validReturn || !validOrder)) || ['produto', 'pedido', 'retorno'].some((key) => raw.getAll(key).length > 1)} />
  },
})
