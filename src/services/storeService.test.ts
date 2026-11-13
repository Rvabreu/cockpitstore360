import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  INITIAL_ORDER,
  INITIAL_PRODUCTS,
  fetchProductsApi,
  getStoredOrder,
  getStoredProducts,
  saveOrder,
  saveProducts,
} from './storeService'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('product image persistence', () => {
  it('initializes localStorage with the safe SVG seeds', () => {
    expect(getStoredProducts()).toEqual(INITIAL_PRODUCTS)
    expect(getStoredProducts().map((product) => product.image)).toEqual([
      '/assets/hero_produtos.svg#orbit',
      '/assets/hero_produtos.svg#pulse',
      '/assets/hero_produtos.svg#wave',
    ])
    expect(JSON.parse(localStorage.getItem('cockpit_store_products_v1')!)).toEqual(INITIAL_PRODUCTS)
  })

  it('mirrors API product images without changing a persisted order', async () => {
    const order = { ...INITIAL_ORDER, id: 'CS-EXISTING', currentStep: 2 }
    saveOrder(order)
    const savedOrder = localStorage.getItem('cockpit_store_order_v1')
    const products = INITIAL_PRODUCTS.map((product, index) => ({
      ...product,
      image: ['/assets/orbit-headphones.webp', '/assets/pulse-watch.webp', '/assets/wave-speaker.jpg'][index],
    }))
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => products })
    vi.stubGlobal('fetch', fetchMock)

    expect(await fetchProductsApi()).toEqual(products)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/products')
    expect(getStoredProducts()).toEqual(products)
    expect(getStoredOrder()).toEqual(order)
    expect(localStorage.getItem('cockpit_store_order_v1')).toBe(savedOrder)
  })

  it('keeps cached image paths and orders intact when the API fails', async () => {
    const products = [{ ...INITIAL_PRODUCTS[2], image: '/assets/wave-speaker.jpg' }]
    saveProducts(products)
    saveOrder(INITIAL_ORDER)
    const savedOrder = localStorage.getItem('cockpit_store_order_v1')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await fetchProductsApi()).toEqual(products)
    expect(getStoredProducts()).toEqual(products)
    expect(localStorage.getItem('cockpit_store_order_v1')).toBe(savedOrder)
  })

  it('uses safe seeds on an offline first load without deleting an existing order', async () => {
    saveOrder({ ...INITIAL_ORDER, id: 'CS-EXISTING' })
    const savedOrder = localStorage.getItem('cockpit_store_order_v1')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await fetchProductsApi()).toEqual(INITIAL_PRODUCTS)
    expect(localStorage.getItem('cockpit_store_order_v1')).toBe(savedOrder)
  })
})
