import { useState, useEffect, useCallback } from 'react'
import type { OrderWithEvents, Product } from '../types/store'
import {
  SEED_ORDER_ID,
  INITIAL_PRODUCTS,
  INITIAL_ORDER,
  fetchProductsApi,
  loadOrderApi,
  advanceOrderApi,
  getOrder as getOrderService,
} from '../services/storeService'

export function useStore() {
  // R3-1: use deterministic seed constants (never browser cache or []/null) so
  // SSR + first client paint render the full catalog and the populated CS-2048 card
  // with no hydration mismatch. loadOrder()/fetchProductsApi() refresh on mount.
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS)
  const [order, setOrder] = useState<OrderWithEvents>(INITIAL_ORDER)
  const [isLoaded, setIsLoaded] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [isAdvancing, setIsAdvancing] = useState(false)

  const loadOrder = useCallback(async () => {
    setOrderError('')
    try {
      const refreshed = await loadOrderApi(SEED_ORDER_ID)
      setOrder(refreshed)
    } catch (e) {
      setOrderError(e instanceof Error ? e.message : 'Consulta de pedido indisponível no momento.')
    }
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([fetchProductsApi(), loadOrderApi(SEED_ORDER_ID)])
      .then(([prods, ord]) => {
        if (!active) return
        setProducts(prods)
        setOrder(ord)
      })
      .catch((e) => {
        if (active) setOrderError(e instanceof Error ? e.message : 'Consulta de pedido indisponível no momento.')
      })
      .finally(() => {
        if (active) setIsLoaded(true)
      })
    return () => { active = false }
  }, [])

  const advanceOrder = useCallback(async (id: string): Promise<OrderWithEvents | null> => {
    setIsAdvancing(true)
    setOrderError('')
    try {
      const updated = await advanceOrderApi(id)
      setOrder(updated)
      return updated
    } catch (e) {
      setOrderError(e instanceof Error ? e.message : 'Não foi possível atualizar o pedido. Tente novamente.')
      return null
    } finally {
      setIsAdvancing(false)
    }
  }, [])

  // Keep the single demo card, refreshing it only when the API returns CS-2048.
  const getOrder = useCallback(async (id: string) => {
    const result = await getOrderService(id)
    if (result.order?.id === SEED_ORDER_ID) {
      setOrder(result.order)
      setOrderError('')
    }
    return result
  }, [])

  return {
    products,
    order,
    isLoaded,
    orderError,
    isAdvancing,
    loadOrder,
    advanceOrder,
    getOrder,
  }
}
