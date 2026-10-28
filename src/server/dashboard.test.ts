// @vitest-environment node
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { buildDashboard } from './dashboard'
import { seedDatabase, selectDashboardData } from './db'
import type { DashboardSnapshot } from '../types/dashboard'

const labels = ['Pedido confirmado', 'Em separação', 'Em transporte', 'Entregue']
function order(id: string, date = '19/10/2026', total = 699, step = 1): DashboardSnapshot['orders'][number] {
  return { id, product_id: 'prod-orbit', product_name: 'Orbit Headphones Pro', variant: 'Grafite', quantity: 1, total, placed_at: date, current_step: step }
}

describe('dashboard snapshot read-only', () => {
  it('deriva seed SQL real, centavos e catálogo sem escrever', () => {
    const db = new Database(':memory:')
    try {
      db.exec(`CREATE TABLE products(id TEXT PRIMARY KEY,name TEXT,description TEXT,category TEXT,price REAL,image TEXT,created_at TEXT);
        CREATE TABLE orders(id TEXT PRIMARY KEY,product_id TEXT,product_name TEXT,variant TEXT,quantity INTEGER,total REAL,placed_at TEXT,current_step INTEGER);
        CREATE TABLE order_events(id TEXT,order_id TEXT,step_index INTEGER,title TEXT,detail TEXT,created_at TEXT);`)
      seedDatabase(db)
      const changes = db.prepare('SELECT total_changes() AS count').get()
      const data = buildDashboard(selectDashboardData(db))
      expect(data).toMatchObject({ demo: true, currency: 'BRL', summary: { totalOrders: 1, registeredValueCents: 69900, averageOrderValueCents: 69900, totalProducts: 3 } })
      expect(data.statusDistribution).toEqual(labels.map((label, step) => ({ step, label, count: step === 1 ? 1 : 0 })))
      expect(data.ordersByDate).toEqual([{ date: '2026-10-19', count: 1 }])
      expect(data.orders[0]).toMatchObject({ id: 'CS-2048', totalCents: 69900, placedDate: '2026-10-19', currentStep: 1 })
      expect(data.products.map(({ id, priceCents }) => ({ id, priceCents }))).toEqual([
        { id: 'prod-orbit', priceCents: 69900 }, { id: 'prod-pulse', priceCents: 89900 }, { id: 'prod-wave', priceCents: 34900 },
      ])
      expect(db.prepare('SELECT total_changes() AS count').get()).toEqual(changes)
    } finally { db.close() }
  })

  it('base vazia mantém quatro etapas e KPIs zero sem NaN', () => {
    expect(buildDashboard({ orders: [], products: [] })).toEqual({ demo: true, currency: 'BRL', summary: { totalOrders: 0, registeredValueCents: 0, averageOrderValueCents: 0, totalProducts: 0 }, orders: [], products: [], ordersByDate: [], statusDistribution: labels.map((label, step) => ({ step, label, count: 0 })) })
  })

  it('soma centavos arredondados por pedido sem multiplicar quantidade e arredonda ticket', () => {
    const many = { ...order('A', '19/10/2026', 0.1), quantity: 7 }
    const data = buildDashboard({ orders: [many, order('B', '19/10/2026', 0.11)], products: [] })
    expect(data.summary).toMatchObject({ totalOrders: 2, registeredValueCents: 21, averageOrderValueCents: 11 })
    expect(data.orders.find((item) => item.id === 'A')).toMatchObject({ quantity: 7, totalCents: 10 })
  })

  it('valida calendário bissexto, agrupa dias reais e ordena datas/IDs com inválidos no fim', () => {
    const data = buildDashboard({ orders: [order('Z', '29/02/2025'), order('B', '29/02/2024'), order('A', '29/02/2024'), order('N', '31/04/2026'), order('C', '01/03/2024'), order('M', 'nonsense')], products: [] })
    expect(data.orders.map(({ id, placedDate }) => ({ id, placedDate }))).toEqual([
      { id: 'C', placedDate: '2024-03-01' }, { id: 'A', placedDate: '2024-02-29' }, { id: 'B', placedDate: '2024-02-29' }, { id: 'M', placedDate: null }, { id: 'N', placedDate: null }, { id: 'Z', placedDate: null },
    ])
    expect(data.ordersByDate).toEqual([{ date: '2024-02-29', count: 2 }, { date: '2024-03-01', count: 1 }])
    expect(data.summary.totalOrders).toBe(6)
    expect(data.statusDistribution[1].count).toBe(6)
  })

  it.each([-1, 4, 1.5])('step inválido%s rejeita snapshot em vez de inventar distribuição', (step) => {
    expect(() => buildDashboard({ orders: [order('A', undefined, undefined, step)], products: [] })).toThrow()
  })
})
