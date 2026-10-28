import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Boxes, ChartNoAxesCombined, LayoutDashboard, RefreshCw, ShoppingBag, Tags, Truck } from 'lucide-react'
import OrderTimeline from '../components/OrderTimeline'
import { SEED_ORDER_ID } from '../services/storeService'
import type { OrderWithEvents, Product } from '../types/store'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
  head: () => ({ meta: [{ title: 'Painel da loja | COCKPIT STORE 360' }] }),
})

type DashboardData = { products: Product[]; order: OrderWithEvents }
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: DashboardData }
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const panel = 'rounded-2xl border border-[#232429] bg-[#111316]'
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff633b]'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// Deliberately avoid the store service's offline/seed fallbacks: this panel only
// displays a snapshot confirmed by both read APIs, never invented live metrics.
function validProducts(value: unknown): value is Product[] {
  return Array.isArray(value) && value.every((product) => isRecord(product) &&
    ['id', 'name', 'description', 'category', 'image', 'createdAt'].every((key) => typeof product[key] === 'string') &&
    typeof product.price === 'number' && Number.isFinite(product.price) && product.price >= 0)
}

function validOrder(value: unknown): value is OrderWithEvents {
  if (!isRecord(value) || value.id !== SEED_ORDER_ID ||
    !['productId', 'productName', 'variant', 'placedAt', 'statusLabel'].every((key) => typeof value[key] === 'string') ||
    typeof value.total !== 'number' || !Number.isFinite(value.total) || value.total < 0 ||
    typeof value.quantity !== 'number' || !Number.isInteger(value.quantity) || value.quantity < 1 ||
    typeof value.currentStep !== 'number' || !Number.isInteger(value.currentStep) ||
    !Array.isArray(value.events) || !value.events.length || value.currentStep < 0 || value.currentStep >= value.events.length) return false
  const step = value.currentStep
  return value.events.every((event, index) => isRecord(event) && event.stepIndex === index &&
    typeof event.title === 'string' && typeof event.detail === 'string' &&
    event.status === (index < step ? 'done' : index === step ? 'current' : 'pending') &&
    event.displayDetail === (index <= step ? event.detail : 'Aguardando atualização')) &&
    value.statusLabel === value.events[step].title
}

async function readApi(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(path, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error('Não foi possível consultar os dados da loja. Tente atualizar novamente.')
  return response.json()
}

export function DashboardPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [revision, setRevision] = useState(0)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const requestVersion = useRef(0)

  useEffect(() => {
    const version = ++requestVersion.current
    const controller = new AbortController()
    let active = true
    setState({ status: 'loading' })
    const timer = setTimeout(() => {
      if (!active || version !== requestVersion.current) return
      active = false
      controller.abort()
      setState({ status: 'error', message: 'A consulta demorou mais que o esperado. Tente atualizar novamente.' })
    }, 15000)
    void Promise.all([
      readApi('/api/products', controller.signal),
      readApi(`/api/orders/${SEED_ORDER_ID}`, controller.signal),
    ]).then(([products, order]) => {
      if (!active || version !== requestVersion.current) return
      if (!validProducts(products) || !validOrder(order)) throw new Error('Os dados recebidos são inválidos. Tente atualizar novamente.')
      setState({ status: 'ready', data: { products, order } })
    }).catch((error: unknown) => {
      if (!active || version !== requestVersion.current) return
      controller.abort()
      setState({ status: 'error', message: error instanceof Error && error.message.startsWith('Os dados')
        ? error.message : 'Não foi possível consultar os dados da loja. Tente atualizar novamente.' })
    }).finally(() => clearTimeout(timer))
    return () => { active = false; clearTimeout(timer); controller.abort() }
  }, [revision])

  const data = state.status === 'ready' ? state.data : null
  const distribution = new Map<string, number>()
  data?.products.forEach((product) => distribution.set(product.category, (distribution.get(product.category) ?? 0) + 1))
  const categories = [...distribution.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const query = search.trim().toLocaleLowerCase('pt-BR')
  const filtered = data?.products.filter((product) => (!category || product.category === category) &&
    `${product.name} ${product.category}`.toLocaleLowerCase('pt-BR').includes(query)) ?? []

  return (
    <main className="relative bg-[#08090b]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top_right,#ff633b14,transparent_65%)]" />
      <div className="relative mx-auto max-w-[1240px] px-4 py-8 sm:px-8 sm:py-12">
        <nav aria-label="Navegação do painel" className="mb-8 flex flex-wrap items-center gap-3 border-b border-[#232429] pb-5 text-xs font-semibold sm:gap-6">
          <span className="inline-flex items-center gap-2 text-[#ff956f]"><LayoutDashboard aria-hidden="true" className="size-4" /> Visão geral</span>
          <a href="#catalogo-dashboard" className={`text-[#a6a9b1] hover:text-white ${focus}`}>Catálogo</a>
          <a href="#pedido-dashboard" className={`text-[#a6a9b1] hover:text-white ${focus}`}>Pedido demo</a>
          <Link to="/" className={`ml-auto inline-flex items-center gap-1 text-[#c0c0c5] no-underline hover:text-white ${focus}`}>Visitar loja <ArrowUpRight aria-hidden="true" className="size-4" /></Link>
        </nav>

        <header className="mb-8 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <span className="inline-flex rounded-full border border-[#ff633b44] bg-[#ff633b12] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[1.5px] text-[#ffba9e]">Dados demonstrativos</span>
            <h1 className="mt-4 text-[32px] font-extrabold leading-tight tracking-[-1.5px] sm:text-[44px]">Painel da loja</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#a6a9b1]">Uma visão do catálogo e do pedido de exemplo da COCKPIT STORE 360. Público, fictício e sem indicadores de vendas.</p>
          </div>
          <button type="button" disabled={state.status === 'loading'} onClick={() => { setState({ status: 'loading' }); setRevision((value) => value + 1) }} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[#ff633b55] bg-[#ff633b12] px-4 text-xs font-bold text-[#ff956f] hover:bg-[#ff633b22] disabled:cursor-wait disabled:opacity-60 ${focus}`}>
            <RefreshCw aria-hidden="true" className={`size-4 ${state.status === 'loading' ? 'animate-spin motion-reduce:animate-none' : ''}`} />
            {state.status === 'loading' ? 'Atualizando...' : 'Atualizar dados'}
          </button>
        </header>

        {state.status === 'loading' && <div role="status" className={`${panel} p-8 text-sm text-[#a6a9b1]`}>Carregando catálogo e pedido demonstrativo...</div>}
        {state.status === 'error' && <div role="alert" className="rounded-2xl border border-[#ff633b55] bg-[#ff633b12] p-6"><h2 className="font-bold text-[#ffba9e]">Dados indisponíveis</h2><p className="mt-2 text-sm text-[#c0c0c5]">{state.message}</p><p className="mt-2 text-xs text-[#a6a9b1]">Nenhuma métrica foi estimada. Use Atualizar dados para tentar novamente.</p></div>}

        {data && <>
          <section aria-label="Indicadores demonstrativos" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Produtos no catálogo', value: String(data.products.length), note: 'Itens disponíveis na demonstração', icon: Boxes },
              { label: 'Categorias distintas', value: String(categories.length), note: 'Derivadas do catálogo atual', icon: Tags },
              { label: 'Valor do pedido demo', value: currency.format(data.order.total), note: 'Um único pedido fictício, não vendas', icon: ShoppingBag },
              { label: 'Status do pedido demo', value: data.order.statusLabel, note: `Etapa ${data.order.currentStep + 1} de ${data.order.events.length}`, icon: Truck },
            ].map(({ label, value, note, icon: Icon }) => <article key={label} aria-label={label} className={`${panel} min-w-0 p-5`}>
              <div className="mb-5 flex items-center justify-between gap-2"><h2 className="text-xs font-semibold text-[#a6a9b1]">{label}</h2><Icon aria-hidden="true" className="size-4 shrink-0 text-[#ff875a]" /></div>
              <p className="break-words text-2xl font-bold tracking-tight">{value}</p><p className="mt-2 text-[11px] leading-relaxed text-[#a6a9b1]">{note}</p>
            </article>)}
          </section>

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
            <div className="grid min-w-0 gap-6">
              <section aria-labelledby="distribution-heading" className={`${panel} p-5 sm:p-6`}>
                <div className="flex items-center gap-2"><ChartNoAxesCombined aria-hidden="true" className="size-4 text-[#ff875a]" /><h2 id="distribution-heading" className="text-base font-bold">Distribuição do catálogo</h2></div>
                <p className="mt-2 text-xs text-[#a6a9b1]">Quantidade de produtos por categoria, sem projeções.</p>
                {categories.length ? <ul className="mt-6 grid gap-5">{categories.map((name) => {
                  const count = distribution.get(name)!
                  const percent = Math.round(count / data.products.length * 100)
                  return <li key={name}><div className="mb-2 flex justify-between gap-4 text-xs"><span className="break-words font-semibold">{name}</span><span className="shrink-0 text-[#a6a9b1]">{count} {count === 1 ? 'produto' : 'produtos'} · {percent}%</span></div><div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-[#232429]"><div style={{ width: `${count / data.products.length * 100}%` }} className="h-full rounded-full bg-[linear-gradient(90deg,#ff633b,#ffad87)]" /></div></li>
                })}</ul> : <p className="mt-6 text-sm text-[#a6a9b1]">O catálogo ainda não tem categorias.</p>}
              </section>

              <section id="catalogo-dashboard" aria-labelledby="catalog-heading" className={`${panel} scroll-mt-24 p-5 sm:p-6`}>
                <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="catalog-heading" className="text-base font-bold">Catálogo em resumo</h2><span className="text-xs text-[#a6a9b1]" aria-live="polite">{filtered.length} de {data.products.length} produtos</span></div>
                <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <div><label htmlFor="dashboard-search" className="mb-2 block text-xs text-[#a6a9b1]">Buscar por nome ou categoria</label><input id="dashboard-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Encontre um produto" className={`min-h-11 w-full rounded-xl border border-[#2a2c31] bg-[#08090b] px-3 text-sm ${focus}`} /></div>
                  <div><label htmlFor="dashboard-category" className="mb-2 block text-xs text-[#a6a9b1]">Categoria</label><select id="dashboard-category" value={category} onChange={(event) => setCategory(event.target.value)} className={`min-h-11 w-full rounded-xl border border-[#2a2c31] bg-[#08090b] px-3 text-sm ${focus}`}><option value="">Todas as categorias</option>{category && !categories.includes(category) && <option value={category}>{category}</option>}{categories.map((name) => <option key={name} value={name}>{name}</option>)}</select></div>
                </div>
                {filtered.length ? <ul className="mt-5 divide-y divide-[#232429]">{filtered.map((product) => <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold">{product.name}</h3><p className="mt-1 break-words text-xs text-[#a6a9b1]">{product.category}</p></div><span className="text-sm font-semibold text-[#ffba9e]">{currency.format(product.price)}</span></li>)}</ul> : <div role="status" className="py-8 text-sm text-[#a6a9b1]">{data.products.length ? 'Nenhum produto encontrado para esta busca e categoria.' : 'Nenhum produto disponível no catálogo.'}</div>}
              </section>
            </div>

            <section id="pedido-dashboard" aria-labelledby="order-heading" className={`${panel} min-w-0 scroll-mt-24 overflow-hidden`}>
              <div className="h-1 bg-[linear-gradient(90deg,#ff633b,#ffad87)]" />
              <div className="p-5 sm:p-6"><p className="text-[10px] font-bold uppercase tracking-widest text-[#ff956f]">Acompanhamento demonstrativo</p><h2 id="order-heading" className="mt-3 text-xl font-bold">Pedido #{data.order.id}</h2><p className="mt-2 text-xs text-[#a6a9b1]">Somente o pedido fictício de exemplo. Não representa o histórico de clientes.</p>
                <div className="my-5 rounded-xl border border-[#232429] bg-[#17191d] p-4"><p className="break-words text-sm font-bold">{data.order.productName}</p><p className="mt-1 break-words text-xs text-[#a6a9b1]">{data.order.variant} · Quantidade: {data.order.quantity}</p><dl className="mt-4 grid gap-2 text-xs"><div className="flex flex-wrap justify-between gap-2"><dt className="text-[#a6a9b1]">Data do pedido</dt><dd>{data.order.placedAt}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt className="text-[#a6a9b1]">Valor demonstrativo</dt><dd className="font-bold text-[#ffba9e]">{currency.format(data.order.total)}</dd></div></dl></div>
                <OrderTimeline events={data.order.events} />
                <a href="/#pedidos" className={`inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[#ff956f] ${focus}`}>Ver demonstração na loja <ArrowUpRight aria-hidden="true" className="size-4" /></a>
              </div>
            </section>
          </div>
        </>}
        <p className="mt-8 text-xs leading-relaxed text-[#a6a9b1]">Este painel é público e somente de leitura. Para experimentar a autenticação, <Link to="/login" className={`text-[#ff956f] underline underline-offset-4 ${focus}`}>acesse sua conta</Link>.</p>
      </div>
    </main>
  )
}
