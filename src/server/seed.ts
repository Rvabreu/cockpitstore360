// Server-owned demo fixtures: no runtime dependency on browser services.
export const INITIAL_PRODUCTS = [
  { id: 'prod-orbit', name: 'Orbit Headphones Pro', description: 'Som premium para qualquer jornada.', category: 'Áudio imersivo', price: 699, image: '/assets/hero_produtos.svg#orbit', createdAt: '2026-10-01T10:00:00.000Z' },
  { id: 'prod-pulse', name: 'Pulse Watch S2', description: 'Seu ritmo, sob controle.', category: 'Wearables', price: 899, image: '/assets/hero_produtos.svg#pulse', createdAt: '2026-10-02T10:00:00.000Z' },
  { id: 'prod-wave', name: 'Wave Mini Speaker', description: 'Som potente em qualquer lugar.', category: 'Áudio conectado', price: 349, image: '/assets/hero_produtos.svg#wave', createdAt: '2026-10-03T10:00:00.000Z' },
]
export const INITIAL_ORDER = {
  id: 'CS-2048', productId: 'prod-orbit', productName: 'Orbit Headphones Pro', variant: 'Grafite', quantity: 1, total: 699, placedAt: '19/10/2026', currentStep: 1,
  events: [
    { stepIndex: 0, title: 'Pedido confirmado', detail: '19 out · 10h12' },
    { stepIndex: 1, title: 'Em separação', detail: '20 out · 08h35' },
    { stepIndex: 2, title: 'Em transporte', detail: '21 out · 14h20' },
    { stepIndex: 3, title: 'Entregue', detail: 'Entrega confirmada' },
  ],
}
