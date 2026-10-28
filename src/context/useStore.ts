import { useState, useEffect, useCallback, useRef } from 'react'
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
  // R3-1: seed synchronously from the in-memory seed constants (never []/null) so
  // SSR + first client paint render the full catalog and the populated CS-2048 card
  // with no hydration mismatch. loadOrder()/fetchProductsApi() refresh on mount.
  const [products, setProducts] = useState<Product[]>(() => INITIAL_PRODUCTS)
  const [order, setOrder] = useState<OrderWithEvents>(() => INITIAL_ORDER)
  const [isLoaded, setIsLoaded] = useState(false)
  const mounted = useRef(false)
  const lifecycle = useRef(0)
  const readVersion = useRef(0)
  const pendingAdvance = useRef<Promise<OrderWithEvents> | null>(null)

  const loadOrder = useCallback(async () => {
    const generation = lifecycle.current
    const version = ++readVersion.current
    const refreshed = await loadOrderApi(SEED_ORDER_ID)
    if (mounted.current && generation === lifecycle.current &&
      version === readVersion.current && !pendingAdvance.current) setOrder(refreshed)
  }, [])

  useEffect(() => {
    mounted.current = true
    const generation = ++lifecycle.current
    const version = ++readVersion.current
    Promise.allSettled([fetchProductsApi(), loadOrderApi(SEED_ORDER_ID)])
      .then(([prods, ord]) => {
        if (!mounted.current || generation !== lifecycle.current) return
        if (prods.status === 'fulfilled') setProducts(prods.value)
        if (ord.status === 'fulfilled' && version === readVersion.current && !pendingAdvance.current) {
          setOrder(ord.value)
        }
        setIsLoaded(true)
      })
    return () => {
      mounted.current = false
      ++lifecycle.current
      ++readVersion.current
    }
  }, [])

  const advanceOrder = useCallback((id: string): Promise<OrderWithEvents> => {
    if (pendingAdvance.current) return pendingAdvance.current
    const generation = lifecycle.current
    ++readVersion.current
    const pending = advanceOrderApi(id).then((updated) => {
      if (mounted.current && generation === lifecycle.current) setOrder(updated)
      return updated
    }).finally(() => {
      ++readVersion.current
      pendingAdvance.current = null
    })
    pendingAdvance.current = pending
    return pending
  }, [])

  // Validation-only: returns { ok, message }, never swaps the displayed order.
  const getOrder = useCallback((id: string) => getOrderService(id), [])

  return {
    products,
    order,
    isLoaded,
    loadOrder,
    advanceOrder,
    getOrder,
  }
}
