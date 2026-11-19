import { useState, useEffect, useCallback, useRef } from 'react'
import type { OrderWithEvents, Product } from '../types/store'
import {
  SEED_ORDER_ID,
  getStoredProducts,
  getStoredOrder,
  fetchProductsApi,
  loadOrderApi,
  advanceOrderApi,
  getOrder as getOrderService,
} from '../services/storeService'

export function useStore() {
  // R3-1: seed synchronously from the in-memory seed constants (never []/null) so
  // SSR + first client paint render the full catalog and the populated CS-2048 card
  // with no hydration mismatch. loadOrder()/fetchProductsApi() refresh on mount.
  const [products, setProducts] = useState<Product[]>(() => getStoredProducts())
  const [order, setOrder] = useState<OrderWithEvents>(() => getStoredOrder())
  const [isLoaded, setIsLoaded] = useState(false)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [advanceError, setAdvanceError] = useState('')
  const advancing = useRef(false)

  const loadOrder = useCallback(async () => {
    const refreshed = await loadOrderApi(SEED_ORDER_ID)
    setOrder(refreshed)
  }, [])

  useEffect(() => {
    Promise.all([fetchProductsApi(), loadOrderApi(SEED_ORDER_ID)])
      .then(([prods, ord]) => {
        setProducts(prods)
        setOrder(ord)
      })
      .finally(() => setIsLoaded(true))
  }, [])

  const advanceOrder = useCallback(async (id: string): Promise<OrderWithEvents | null> => {
    if (advancing.current) return null
    advancing.current = true
    setIsAdvancing(true)
    setAdvanceError('')
    try {
      const updated = await advanceOrderApi(id)
      setOrder(updated)
      return updated
    } catch {
      setAdvanceError('Não foi possível atualizar o pedido. Tente novamente.')
      return null
    } finally {
      advancing.current = false
      setIsAdvancing(false)
    }
  }, [])

  // Validation-only: returns { ok, message }, never swaps the displayed order.
  const getOrder = useCallback((id: string) => getOrderService(id), [])

  return {
    products,
    order,
    isLoaded,
    isAdvancing,
    advanceError,
    loadOrder,
    advanceOrder,
    getOrder,
  }
}
