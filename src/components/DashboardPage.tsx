import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUpRight, BarChart3, Package, RefreshCw, ShoppingBag, Wallet } from 'lucide-react'
import { AuthError, createAuthService, type AuthUser } from '../services/authService'
import { DashboardError, isCalendarDate, loadDashboard } from '../services/dashboardService'
import type { DashboardData } from '../types/dashboard'

const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateLabel = (date: string | null) => date ? date.split('-').reverse().join('/') : 'Data indisponível'
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff956f]'
const panel = 'min-w-0 rounded-2xl border border-[#303239] bg-[#131519]'
const field = `min-h-11 w-full min-w-0 rounded-xl border border-[#3b3e46] bg-[#0c0e11] px-3 text-sm text-[#f7f7f8] ${focus}`

export default function DashboardPage() {
  const [auth] = useState(createAuthService)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [pending, setPending] = useState(true)
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Verificando sessão…')
  const [search, setSearch] = useState('')
  const [step, setStep] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const generation = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const busy = useRef(false)
  const mounted = useRef(false)

  async function refresh(checkSession = false) {
    if (busy.current) return
    busy.current = true
    const current = ++generation.current
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    const active = () => mounted.current && current === generation.current && !abort.signal.aborted
    setPending(true)
    setData(null)
    setError('')
    setStatus(checkSession ? 'Verificando sessão…' : 'Atualizando dados…')
    try {
      let confirmedUser = user
      if (checkSession) {
        const session = await auth.bootstrap()
        if (!active()) return
        confirmedUser = session.user
        setUser(session.user)
        setChecked(true)
      }
      if (!confirmedUser) {
        if (active()) setStatus('Entre na sua conta para acessar o painel.')
        return
      }
      const dashboard = await loadDashboard(abort.signal)
      if (!active()) return
      setData(dashboard)
      setStatus('Dados atualizados.')
    } catch (failure) {
      if (!active()) return
      if (failure instanceof DashboardError && failure.status === 401) {
        setUser(null)
        setChecked(true)
        setStatus('Sua sessão expirou. Entre novamente para acessar o painel.')
      } else {
        setError(failure instanceof DashboardError || failure instanceof AuthError
          ? failure.message : 'Não foi possível carregar o painel. Tente novamente.')
        setStatus('Dados indisponíveis. Tente novamente.')
      }
    } finally {
      if (active()) {
        busy.current = false
        setPending(false)
      }
    }
  }

  useEffect(() => {
    mounted.current = true
    void refresh(true)
    return () => {
      mounted.current = false
      generation.current++
      controller.current?.abort()
      busy.current = false
    }
  }, [])

  const dateError = (from && !isCalendarDate(from)) || (to && !isCalendarDate(to))
    ? 'Informe datas válidas.' : from && to && from > to ? 'A data inicial deve ser anterior ou igual à data final.' : ''
  const query = search.trim().toLocaleLowerCase('pt-BR')
  const orders = data?.orders.filter((order) => !dateError
    && (!query || `${order.id} ${order.productName}`.toLocaleLowerCase('pt-BR').includes(query))
    && (!step || order.currentStep === Number(step))
    && (!from || (order.placedDate !== null && order.placedDate >= from))
    && (!to || (order.placedDate !== null && order.placedDate <= to))) ?? []
  const kpis = data ? [
    { label: 'Pedidos', value: String(data.summary.totalOrders), detail: 'Pedidos registrados na base', Icon: ShoppingBag },
    { label: 'Valor registrado', value: money(data.summary.registeredValueCents), detail: 'Soma dos valores dos pedidos', Icon: Wallet },
    { label: 'Ticket médio', value: money(data.summary.averageOrderValueCents), detail: 'Valor médio por pedido', Icon: BarChart3 },
    { label: 'Produtos', value: String(data.summary.totalProducts), detail: 'Itens disponíveis no catálogo', Icon: Package },
  ] : []

  return (
    <main className="min-w-0 px-4 py-8 text-[#f7f7f8] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-[1240px] space-y-7">
        <a href="/" className={`inline-flex min-h-11 items-center gap-2 text-sm text-[#bfc3cc] no-underline hover:text-white ${focus}`}><ArrowLeft size={17} aria-hidden="true" /> Voltar à loja pública</a>
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[2px] text-[#ffad8c]">COCKPIT / PAINEL E-COMMERCE</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-1px] sm:text-4xl">Visão geral</h1>
            <p className="mt-3 text-sm leading-6 text-[#bfc3cc]">Uma leitura clara dos pedidos e do catálogo. Sem alterações na loja.</p>
            {user && <p className="mt-2 break-all text-xs text-[#c7cbd3]">Conectado como {user.email}</p>}
          </div>
          {user && <button type="button" onClick={() => void refresh()} disabled={pending} aria-busy={pending}
            className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#ff875a] px-5 text-sm font-bold text-[#1c0c06] disabled:opacity-60 ${focus}`}>
            <RefreshCw size={16} aria-hidden="true" className={pending ? 'animate-spin motion-reduce:animate-none' : ''} /> Atualizar dados
          </button>}
        </header>
        <div className="flex flex-col gap-2 rounded-xl border border-[#ff875a40] bg-[#ff633b0c] px-4 py-3 text-sm text-[#ffd0b9] sm:flex-row sm:justify-between">
          <p className="font-semibold">Dados demonstrativos compartilhados</p><p className="text-xs leading-5">Painel de leitura • não são dados privados da sua conta</p>
        </div>
        <p role="status" aria-live="polite" className="text-sm text-[#c7cbd3]">{status}</p>
        {error && <div role="alert" className="rounded-xl border border-[#ff875a55] bg-[#251813] p-5">
          <p className="text-sm text-[#ffd0b9]">{error}</p>
          <button type="button" disabled={pending} onClick={() => void refresh(!checked)} className={`mt-3 min-h-11 text-sm font-bold text-[#ffba9e] underline ${focus}`}>Tentar novamente</button>
        </div>}
        {!pending && checked && !user && <section className={`${panel} p-6 sm:p-10`} aria-labelledby="dashboard-login-title">
          <h2 id="dashboard-login-title" className="text-xl font-bold">Acesse o painel com sua conta</h2>
          <p className="mt-3 text-sm leading-6 text-[#bfc3cc]">O painel requer uma sessão autenticada. A loja e o acompanhamento de pedidos continuam públicos.</p>
          <a href="/login" className={`mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#ff875a] px-5 text-sm font-bold text-[#1c0c06] no-underline ${focus}`}>Entrar na sua conta <ArrowUpRight aria-hidden="true" size={17} /></a>
        </section>}
        {pending && <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className={`${panel} h-36 bg-[#181a1f]`} />)}</div>}
        {data && <>
          <section aria-label="Indicadores da base completa">
            <p className="mb-4 text-xs text-[#bfc3cc]">Indicadores da base completa. Os filtros abaixo afetam somente a tabela de pedidos.</p>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{kpis.map(({ label, value, detail, Icon }) => <div key={label} className={`${panel} p-5`}>
              <div className="flex items-center justify-between gap-3"><dt className="text-sm text-[#c7cbd3]">{label}</dt><Icon aria-hidden="true" size={18} className="text-[#ff956f]" /></div>
              <dd className="mt-5 break-words text-2xl font-extrabold tracking-[-.5px] xl:text-3xl">{value}</dd><p className="mt-2 text-xs text-[#aeb3bd]">{detail}</p>
            </div>)}</dl>
          </section>
          <div className="grid min-w-0 gap-5 lg:grid-cols-2">
            <section aria-labelledby="distribution-title" className={`${panel} p-5 sm:p-6`}>
              <h2 id="distribution-title" className="text-lg font-bold">Distribuição dos pedidos</h2><p className="mt-2 text-xs text-[#aeb3bd]">Todos os pedidos, por etapa atual</p>
              <ul className="mt-6 space-y-5">{data.statusDistribution.map(({ step: index, label, count }) => <li key={index}>
                <div className="mb-2 flex justify-between gap-3 text-sm"><span>{label}</span><span className="font-bold text-[#ffba9e]">{count}</span></div>
                <div role="img" aria-label={`${label}: ${count} de ${data.summary.totalOrders} pedidos`} className="h-2 rounded-full bg-[#2b2e35]">
                  <div className="h-full rounded-full bg-[#ff875a]" style={{ width: `${data.summary.totalOrders ? count / data.summary.totalOrders * 100 : 0}%` }} />
                </div>
              </li>)}</ul>
            </section>
            <section aria-labelledby="dates-title" className={`${panel} p-5 sm:p-6`}>
              <h2 id="dates-title" className="text-lg font-bold">Pedidos por data</h2><p className="mt-2 text-xs text-[#aeb3bd]">Datas de registro existentes na base, sem projeções</p>
              {data.ordersByDate.length ? <ul className="mt-6 space-y-4">{data.ordersByDate.map(({ date, count }) => <li key={date} className="rounded-xl bg-[#1c1f25] p-3">
                <div className="flex justify-between gap-3 text-sm"><time dateTime={date}>{dateLabel(date)}</time><span className="font-bold">{count} {count === 1 ? 'pedido' : 'pedidos'}</span></div>
              </li>)}</ul> : <p className="mt-6 text-sm text-[#bfc3cc]">Nenhum pedido com data disponível.</p>}
              {data.orders.some((order) => order.placedDate === null) && <p className="mt-4 text-xs text-[#bfc3cc]">Pedidos com data indisponível estão incluídos nos indicadores, mas não nesta lista.</p>}
            </section>
          </div>
          <section aria-labelledby="orders-title" className={`${panel} overflow-hidden`}>
            <div className="p-5 sm:p-6"><h2 id="orders-title" className="text-lg font-bold">Pedidos registrados</h2><p className="mt-2 text-xs text-[#aeb3bd]">Filtros somente da tabela • {orders.length} de {data.orders.length} pedidos</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
                <label className="min-w-0 space-y-2 text-xs font-semibold"><span>Buscar pedido ou produto</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className={field} placeholder="ID ou nome do produto" /></label>
                <label className="min-w-0 space-y-2 text-xs font-semibold"><span>Status do pedido</span><select value={step} onChange={(event) => setStep(event.target.value)} className={field}><option value="">Todos os status</option>{data.statusDistribution.map((item) => <option key={item.step} value={item.step}>{item.label}</option>)}</select></label>
                <label className="min-w-0 space-y-2 text-xs font-semibold"><span>Data inicial</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-invalid={Boolean(dateError)} aria-describedby={dateError ? 'dashboard-date-error' : undefined} className={field} /></label>
                <label className="min-w-0 space-y-2 text-xs font-semibold"><span>Data final</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-invalid={Boolean(dateError)} aria-describedby={dateError ? 'dashboard-date-error' : undefined} className={field} /></label>
              </div>
              {dateError && <p role="alert" id="dashboard-date-error" className="mt-3 text-sm text-[#ffba9e]">{dateError}</p>}
              <button type="button" onClick={() => { setSearch(''); setStep(''); setFrom(''); setTo('') }} className={`mt-3 min-h-11 text-sm font-semibold text-[#ffba9e] underline ${focus}`}>Limpar filtros</button>
            </div>
            <div role="region" aria-label="Tabela de pedidos" tabIndex={0} className={`max-w-full overflow-x-auto border-t border-[#303239] ${focus}`}>
              <table className="w-full min-w-[740px] border-collapse text-left text-sm"><caption className="sr-only">Pedidos registrados — filtros não alteram os indicadores da base completa</caption>
                <thead className="bg-[#1c1f25] text-xs text-[#bfc3cc]"><tr>{['Pedido', 'Produto', 'Data', 'Quantidade', 'Valor', 'Status'].map((label) => <th key={label} scope="col" className="px-5 py-4 font-semibold">{label}</th>)}</tr></thead>
                <tbody>{orders.map((order) => <tr key={order.id} className="border-t border-[#303239]">
                  <th scope="row" className="px-5 py-5 font-semibold text-[#ffba9e]">{order.id}</th><td className="px-5 py-5"><p>{order.productName}</p><p className="mt-1 text-xs text-[#aeb3bd]">{order.variant || 'Sem variante'}</p></td>
                  <td className="whitespace-nowrap px-5 py-5">{dateLabel(order.placedDate)}</td><td className="px-5 py-5">{order.quantity}</td><td className="whitespace-nowrap px-5 py-5 font-semibold">{money(order.totalCents)}</td><td className="px-5 py-5"><span className="inline-block whitespace-nowrap rounded-full border border-[#ff875a40] bg-[#ff633b0c] px-3 py-1 text-xs text-[#ffd0b9]">{order.statusLabel}</span></td>
                </tr>)}{!orders.length && <tr><td colSpan={6} className="px-5 py-9 text-center text-[#bfc3cc]">{dateError ? 'Corrija o período para visualizar os pedidos.' : data.orders.length ? 'Nenhum pedido encontrado para os filtros selecionados.' : 'Nenhum pedido registrado.'}</td></tr>}</tbody>
              </table>
            </div>
          </section>
          <section aria-labelledby="catalog-title"><div className="mb-4 flex items-center justify-between gap-4"><h2 id="catalog-title" className="text-lg font-bold">Catálogo de produtos</h2><span className="text-xs text-[#bfc3cc]">{data.products.length} produtos</span></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.products.map((product) => <article key={product.id} className={`${panel} p-5`}>
              <div className="mb-5 inline-flex rounded-xl border border-[#ff875a33] bg-[#ff633b0c] p-3 text-[#ff956f]"><Package aria-hidden="true" size={22} /></div>
              <p className="text-xs text-[#bfc3cc]">{product.category || 'Sem categoria'}</p><h3 className="mt-2 break-words text-lg font-bold">{product.name}</h3><p className="mt-4 text-xl font-extrabold text-[#ffba9e]">{money(product.priceCents)}</p>
            </article>)}</div>{!data.products.length && <p className={`${panel} p-6 text-sm text-[#bfc3cc]`}>Nenhum produto no catálogo.</p>}
          </section>
        </>}
      </div>
    </main>
  )
}
