import { beforeEach, expect, it, vi } from 'vitest'
import { DashboardError, loadDashboard } from './dashboardService'
import type { DashboardData } from '../types/dashboard'

const DATA: DashboardData = {
  demo: true, currency: 'BRL', summary: { totalOrders: 0, registeredValueCents: 0, averageOrderValueCents: 0, totalProducts: 0 },
  orders: [], products: [], ordersByDate: [], statusDistribution: ['Pedido confirmado', 'Em separação', 'Em transporte', 'Entregue'].map((label, step) => ({ step, label, count: 0 })),
}
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }) }
beforeEach(() => { vi.restoreAllMocks(); vi.stubGlobal('fetch', vi.fn()) })

it('GET confirmado usa cookies/no-store/signal sem storage nem query credenciais', async () => {
  const storage = vi.spyOn(Storage.prototype, 'getItem')
  const save = vi.spyOn(Storage.prototype, 'setItem')
  const signal = new AbortController().signal
  vi.mocked(fetch).mockResolvedValueOnce(json(DATA))
  await expect(loadDashboard(signal)).resolves.toEqual(DATA)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith('/api/auth/dashboard', expect.objectContaining({ credentials: 'same-origin', cache: 'no-store', signal }))
  expect(storage).not.toHaveBeenCalled()
  expect(save).not.toHaveBeenCalled()
})

it.each([null, {}, { ...DATA, demo: false }, { ...DATA, summary: { ...DATA.summary, totalOrders: -1 } }, { ...DATA, ordersByDate: [{ date: '2026-02-30', count: 1 }] }, { ...DATA, products: [null] }, { ...DATA, statusDistribution: DATA.statusDistribution.slice(1) }])('200 inválido%j nunca confirma dashboard ou retorna seed', async (payload) => {
  vi.mocked(fetch).mockResolvedValueOnce(json(payload))
  await expect(loadDashboard()).rejects.toBeInstanceOf(DashboardError)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it.each([401, 403, 500])('HTTP%s conserva status e não reflete erro privado nem faz auth bootstrap', async (status) => {
  vi.mocked(fetch).mockResolvedValueOnce(json({ error: 'SQL senha privada' }, status))
  const error = await loadDashboard().catch((failure) => failure)
  expect(error).toBeInstanceOf(DashboardError)
  expect(error.status).toBe(status)
  expect(error.message).not.toContain('SQL senha privada')
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('rede indisponível rejeita status0 sem cache local nem fallback', async () => {
  const storage = vi.spyOn(Storage.prototype, 'getItem')
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError('offline'))
  await expect(loadDashboard()).rejects.toMatchObject({ status: 0 })
  expect(storage).not.toHaveBeenCalled()
})
