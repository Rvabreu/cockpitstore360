// @vitest-environment node
import { expect, it } from 'vitest'
import { buildCheckoutReceipt, normalizeCheckoutRequest } from './checkout'
import type { CheckoutRequest } from '../types/checkout'

const KEY = '11111111-1111-4111-8111-111111111111'
const ID = '22222222-2222-4222-8222-222222222222'
const request: CheckoutRequest = { items: [{ productId: 'b', quantity: 2 }, { productId: 'a', quantity: 1 }], idempotencyKey: KEY }
const products = [{ id: 'a', name: 'Produto A', price: 12.34 }, { id: 'b', name: 'Produto B', price: 0.29 }]

it('normaliza ordem em cópia sem mutar caller e aceita limites20itens/qty10', () => {
  const before = structuredClone(request)
  expect(normalizeCheckoutRequest(request)).toEqual({ ...request, items: [...request.items].reverse() })
  expect(request).toEqual(before)
  expect(normalizeCheckoutRequest({ ...request, items: Array.from({ length: 20 }, (_, i) => ({ productId: `p${i}`, quantity: 10 })) })).not.toBeNull()
})

it.each([
  null, {}, { ...request, items: [] }, { ...request, items: Array.from({ length: 21 }, (_, i) => ({ productId: `p${i}`, quantity: 1 })) },
  { ...request, items: [{ productId: 'a', quantity: 1 }, { productId: 'a', quantity: 2 }] },
  ...[0, 11, 1.5, '1', Number.MAX_SAFE_INTEGER].map((quantity) => ({ ...request, items: [{ productId: 'a', quantity }] })),
  { ...request, items: [{ productId: '', quantity: 1 }] }, { ...request, items: [{ productId: ' a ', quantity: 1 }] },
  { ...request, idempotencyKey: 'not-uuid' }, { ...request, idempotencyKey: KEY.replace('-4111-', '-1111-') },
  { ...request, totalCents: 1 }, { ...request, address: 'private address' },
  { ...request, items: [{ productId: 'a', quantity: 1, unitPriceCents: 1 }] },
])('request inválido%j rejeitado sem preço/PII cliente', (value) => expect(normalizeCheckoutRequest(value)).toBeNull())

it('recibo usa exclusivamente catálogo/cents seguros e snapshot ordenado imutável', () => {
  const before = structuredClone(products)
  const receipt = buildCheckoutReceipt(normalizeCheckoutRequest(request)!, products, { id: ID, now: () => Date.UTC(2026, 9, 29, 12) })
  expect(receipt).toEqual({ id: ID, items: [
    { productId: 'a', name: 'Produto A', quantity: 1, unitPriceCents: 1234, lineTotalCents: 1234 },
    { productId: 'b', name: 'Produto B', quantity: 2, unitPriceCents: 29, lineTotalCents: 58 },
  ], totalCents: 1292, currency: 'BRL', paymentStatus: 'simulated', createdAt: '2026-10-29T12:00:00.000Z' })
  expect(products).toEqual(before)
  products[0].price = 999
  expect(receipt?.items[0].unitPriceCents).toBe(1234)
  products[0].price = before[0].price
})

it('produto ausente não inventa fallback e total acima teto rejeita', () => {
  expect(buildCheckoutReceipt(request, [])).toBeNull()
  expect(buildCheckoutReceipt(request, products.map((p) => ({ ...p, price: 1000000 })))).toBeNull()
})

it.each([NaN, Infinity, -1, Number.MAX_SAFE_INTEGER])('preço servidor inválido%s propaga erro em vez de recibo falso', (price) => {
  expect(() => buildCheckoutReceipt(request, products.map((p) => ({ ...p, price })))).toThrow()
})
