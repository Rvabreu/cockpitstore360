import { createFileRoute, useLocation } from '@tanstack/react-router'
import CheckoutPage from '../components/CheckoutPage'
import { isProductId } from '../services/checkoutService'

export const Route = createFileRoute('/checkout')({
  head: () => ({ meta: [{ title: 'Finalizar compra | COCKPIT STORE 360' }] }),
  validateSearch: (search: Record<string, unknown>): { produto?: unknown } =>
    Object.hasOwn(search, 'produto') ? { produto: search.produto } : {},
  component: () => {
    const search = Route.useSearch()
    const raw = new URLSearchParams(useLocation().searchStr).getAll('produto')
    const validProduct = isProductId(search.produto)
    return <CheckoutPage initialProductId={isProductId(search.produto) ? search.produto : undefined}
      invalidInitialSelection={(Object.hasOwn(search, 'produto') && !validProduct) || raw.length > 1} />
  },
})
