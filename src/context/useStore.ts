import { useState, useEffect, useCallback, useRef } from 'react'
import type { OrderWithEvents, Product } from '../types/store'
import {
  SEED_ORDER_ID,
  INITIAL_PRODUCTS,
  INITIAL_ORDER,
  getStoredProducts,
  getStoredOrder,
  fetchProductsApi,
  loadOrderApi,
  advanceOrderApi,
  getOrder as getOrderService,
} from '../services/storeService'

export function useStore() {
  // SSR and the first client render must use the same immutable demo seed.
  // Browser cache and API refreshes are applied only after hydration.
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS)
  const [order, setOrder] = useState<OrderWithEvents>(INITIAL_ORDER)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const advancing = useRef(false)
  const orderVersion = useRef(0)

  const loadOrder = useCallback(async () => {
    if (advancing.current) return
    const version = ++orderVersion.current
    const isCurrent = () => version === orderVersion.current
    const refreshed = await loadOrderApi(SEED_ORDER_ID, isCurrent)
    if (isCurrent()) setOrder(refreshed)
  }, [])

  useEffect(() => {
    let active = true
    const version = orderVersion.current
    const isCurrent = () => active && version === orderVersion.current
    setProducts(getStoredProducts())
    setOrder(getStoredOrder())
    Promise.all([fetchProductsApi(), loadOrderApi(SEED_ORDER_ID, isCurrent)])
      .then(([prods, ord]) => {
        if (!active) return
        setProducts(prods)
        // A delayed initial read must not overwrite a simulator update.
        if (isCurrent()) setOrder(ord)
      })
      .finally(() => {
        if (active) setIsLoaded(true)
      })
    return () => { active = false }
  }, [])

  const advanceOrder = useCallback(async (id: string): Promise<OrderWithEvents | null> => {
    if (advancing.current) return null
    advancing.current = true
    orderVersion.current += 1
    setIsAdvancing(true)
    try {
      const updated = await advanceOrderApi(id)
      setOrder(updated)
      return updated
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
    loadOrder,
    advanceOrder,
    getOrder,
  }
}
