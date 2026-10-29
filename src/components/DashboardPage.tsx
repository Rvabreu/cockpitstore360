import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUpRight, BarChart3, LayoutDashboard, Package, RefreshCw, ShieldCheck, ShoppingBag, Wallet } from 'lucide-react'
import { AuthError, createAuthService, type AuthUser } from '../services/authService'
import { DashboardError, isCalendarDate, loadDashboard } from '../services/dashboardService'
import type { DashboardData } from '../types/dashboard'

const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateLabel = (date: string | null) => date ? date.split('-').reverse().join('/') : 'Data indisponível'
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff956f]'
const panel = 'min-w-0 rounded-2xl border border-[#303239] bg-[#131519] shadow-[0_12px_32px_#00000014]'
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
  const statusColors = ['#ffc29c', '#ff875a', '#c96bff', '#65cdb0']
  const inProgress = data?.statusDistribution.slice(0, 3).reduce((sum, item) => sum + item.count, 0) ?? 0
  const delivered = data?.statusDistribution[3].count ?? 0
  let angle = 0
  const segments = data?.statusDistribution.map(({ count }, index) => {
    const start = angle
    angle += data.summary.totalOrders ? count / data.summary.totalOrders * 360 : 0
    return `${statusColors[index]} ${start}deg ${angle}deg`
  }) ?? []
  const donut = data?.summary.totalOrders ? `conic-gradient(${segments.join(', ')})` : '#30343c'
  const maxDateCount = data?.ordersByDate.reduce((max, item) => Math.max(max, item.count), 0) || 1

  return (
    <main className="min-w-0 bg-[radial-gradient(ellipse_at_top_right,#ff633b0b,transparent_55%)] px-3 py-5 text-[#f7f7f8] sm:px-6 sm:py-8">
      <div className={`mx-auto grid max-w-[1440px] min-w-0 gap-5 ${data ? 'min-[1200px]:grid-cols-[210px_minmax(0,1fr)]' : ''}`}>
        {data && <aside className="min-w-0 min-[1200px]:self-start min-[1200px]:sticky min-[1200px]:top-[103px]">
          <div className={`${panel} p-2 min-[1200px]:p-4`}>
            <div className="hidden items-center gap-3 border-b border-[#303239] pb-5 min-[1200px]:flex"><div className="rounded-xl bg-[#ff875a] p-2 text-[#1c0c06]"><LayoutDashboard size={21} aria-hidden="true" /></div><div><p className="text-sm font-bold">Cockpit</p><p className="mt-1 text-[10px] uppercase tracking-[1.5px] text-[#aeb3bd]">Operação e-commerce</p></div></div>
            <nav aria-label="Navegação do painel" className="grid grid-cols-3 gap-1 min-[1200px]:mt-4 min-[1200px]:grid-cols-1 min-[1200px]:gap-2">
              {[{ label: 'Visão geral', id: 'painel-visao-geral', Icon: LayoutDashboard }, { label: 'Pedidos', id: 'painel-pedidos', Icon: ShoppingBag }, { label: 'Catálogo', id: 'painel-catalogo', Icon: Package }].map(({ label, id, Icon }, index) => <a key={id} href={`#${id}`} className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-2 text-[11px] font-semibold no-underline sm:text-sm min-[1200px]:justify-start min-[1200px]:px-3 ${index === 0 ? 'border border-[#ff875a33] bg-[#ff633b12] text-[#ffc29c]' : 'text-[#c7cbd3] hover:bg-[#ffffff08] hover:text-white'} ${focus}`}><Icon aria-hidden="true" size={17} className="hidden shrink-0 min-[360px]:block" />{label}</a>)}
            </nav>
            <div className="mt-7 hidden rounded-xl border border-[#303239] bg-[#0c0e11] p-4 min-[1200px]:block"><ShieldCheck size={18} aria-hidden="true" className="text-[#65cdb0]" /><p className="mt-3 text-xs font-semibold">Modo de leitura</p><p className="mt-2 text-xs leading-5 text-[#aeb3bd]">Consulte a operação. Os dados são demonstrativos e compartilhados.</p></div>
          </div>
        </aside>}
        <div className="min-w-0 space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <a href="/" className={`mb-3 inline-flex min-h-11 items-center gap-2 text-xs text-[#bfc3cc] no-underline hover:text-white ${focus}`}><ArrowLeft size={15} aria-hidden="true" /> Voltar à loja pública</a>
            <p className="text-[10px] font-bold tracking-[2px] text-[#ffad8c]">SEU E-COMMERCE, EM PERSPECTIVA</p>
            <h1 className="mt-2 text-[29px] font-extrabold leading-tight tracking-[-1px] sm:text-4xl">Centro operacional</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#bfc3cc]">Pedidos, etapas e catálogo em uma visão integrada da operação.</p>
          </div>
          {user && <button type="button" onClick={() => void refresh()} disabled={pending} aria-busy={pending}
            className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#ff875a] px-5 text-sm font-bold text-[#1c0c06] disabled:opacity-60 ${focus}`}>
            <RefreshCw size={16} aria-hidden="true" className={pending ? 'animate-spin motion-reduce:animate-none' : ''} /> Atualizar dados
          </button>}
        </header>
        <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-[#303239] bg-[#131519] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3"><ShieldCheck aria-hidden="true" size={19} className="shrink-0 text-[#65cdb0]" /><div className="min-w-0"><p className="text-xs font-semibold text-[#d7dbe2]">{user ? 'Sessão autenticada' : 'Acesso com sessão autenticada'}</p>{user && <p className="mt-1 break-all text-xs text-[#aeb3bd]">Conectado como {user.email}</p>}</div></div>
          <p role="status" aria-live="polite" className="text-xs text-[#c7cbd3]">{status}</p>
        </div>
        <div className="rounded-xl border border-[#ff875a33] bg-[#ff633b08] px-4 py-3 text-[#ffd0b9]"><p className="text-xs font-semibold">Dados demonstrativos compartilhados</p><p className="mt-1 text-xs leading-5 text-[#bfc3cc]">Painel de leitura • não são dados privados da sua conta</p></div>
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
          <section id="painel-visao-geral" aria-label="Indicadores da base completa" className="scroll-mt-[105px] space-y-4">
            <div className="grid min-w-0 gap-5 overflow-hidden rounded-2xl border border-[#ff875a44] bg-[linear-gradient(115deg,#34201a,#17181d_65%)] p-5 sm:p-6 min-[851px]:grid-cols-[1fr_1fr]">
              <div><p className="text-[10px] font-bold tracking-[2px] text-[#ffad8c]">PANORAMA DA OPERAÇÃO</p><h2 className="mt-3 text-xl font-bold">Visão geral</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#c7cbd3]">Do pedido à entrega: acompanhe o que está em andamento e o que já chegou à etapa de entrega.</p></div>
              <dl className="grid min-w-0 grid-cols-2 gap-3 self-center"><div className="rounded-xl border border-[#ff875a22] bg-[#ff875a0b] p-4"><dt className="text-xs leading-5 text-[#ffd0b9]">Pedidos em andamento</dt><dd className="mt-2 break-words text-3xl font-extrabold">{inProgress}</dd></div><div className="rounded-xl border border-[#65cdb022] bg-[#65cdb00b] p-4"><dt className="text-xs leading-5 text-[#a4e4d2]">Pedidos entregues</dt><dd className="mt-2 break-words text-3xl font-extrabold">{delivered}</dd></div></dl>
            </div>
            <p className="text-xs leading-5 text-[#bfc3cc]">Indicadores da base completa. Os filtros abaixo afetam somente a tabela de pedidos.</p>
            <dl className="grid gap-3 sm:grid-cols-2 min-[1300px]:grid-cols-4">{kpis.map(({ label, value, detail, Icon }) => <div key={label} className={`${panel} relative overflow-hidden p-5`}>
              <dt className="flex items-center justify-between gap-3 text-xs font-semibold text-[#c7cbd3]">{label}<span className="rounded-lg bg-[#ff875a10] p-2"><Icon aria-hidden="true" size={17} className="text-[#ff956f]" /></span></dt>
              <dd className="mt-3 break-words text-2xl font-extrabold tracking-[-.5px]">{value}</dd><p className="mt-2 text-xs text-[#aeb3bd]">{detail}</p><div aria-hidden="true" className="absolute bottom-0 left-5 h-[2px] w-10 bg-[#ff875a]" />
            </div>)}</dl>
          </section>
          <div className="grid min-w-0 gap-5 min-[851px]:grid-cols-2 min-[1200px]:grid-cols-1 min-[1350px]:grid-cols-[.95fr_1.05fr]">
            <section aria-labelledby="distribution-title" className={`${panel} p-5 sm:p-6`}>
              <h2 id="distribution-title" className="text-lg font-bold">Distribuição dos pedidos</h2><p className="mt-2 text-xs text-[#aeb3bd]">Todos os pedidos, por etapa atual</p>
              <div className="mt-6 flex min-w-0 flex-col items-center gap-6 min-[600px]:flex-row min-[851px]:flex-col min-[1200px]:flex-row min-[1350px]:flex-col">
                <div role="img" aria-label={`Distribuição dos pedidos: ${data.summary.totalOrders} pedidos`} className="grid h-40 w-40 shrink-0 place-items-center rounded-full p-4" style={{ background: donut }}>
                  <div aria-hidden="true" className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#131519]"><span className="text-3xl font-extrabold">{data.summary.totalOrders}</span><span className="mt-1 text-[10px] uppercase tracking-[1.5px] text-[#aeb3bd]">Pedidos</span></div>
                </div>
                <ul className="w-full min-w-0 space-y-3">{data.statusDistribution.map(({ step: index, label, count }) => <li key={index}>
                  <div role="img" aria-label={`${label}: ${count} de ${data.summary.totalOrders} pedidos`} className="flex items-center justify-between gap-3 rounded-lg bg-[#ffffff03] px-3 py-2 text-xs"><span className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: statusColors[index] }} />{label}</span><span className="font-bold text-[#e4e7ed]">{count}</span></div>
                </li>)}</ul>
              </div>
            </section>
            <section aria-labelledby="dates-title" className={`${panel} p-5 sm:p-6`}>
              <h2 id="dates-title" className="text-lg font-bold">Pedidos por data</h2><p className="mt-2 text-xs text-[#aeb3bd]">Datas de registro existentes na base, sem projeções</p>
              {data.ordersByDate.length ? <div className="mt-6 max-w-full overflow-x-auto"><ul className="flex gap-4 border-b border-[#383c45] bg-[repeating-linear-gradient(to_top,transparent_0px,transparent_47px,#ffffff06_48px)] px-2 pb-3">{data.ordersByDate.map(({ date, count }) => <li key={date} className="min-w-[88px] flex-1">
                <div role="img" aria-label={`${dateLabel(date)}: ${count} pedidos`} className="flex h-44 flex-col items-center justify-end gap-2"><span className="text-xs font-bold text-[#ffc29c]">{count} {count === 1 ? 'pedido' : 'pedidos'}</span><div aria-hidden="true" className="w-full max-w-12 rounded-t-lg bg-[linear-gradient(to_top,#ff633b,#ffc29c)] shadow-[0_0_24px_#ff875a12]" style={{ height: `${count / maxDateCount * 130}px`, minHeight: count ? '2px' : '0px' }} /></div>
                <time dateTime={date} className="mt-3 block text-center text-[10px] text-[#bfc3cc]">{dateLabel(date)}</time>
              </li>)}</ul></div> : <div className="mt-6 rounded-xl border border-dashed border-[#383c45] p-6 text-center"><BarChart3 aria-hidden="true" size={26} className="mx-auto text-[#747b88]" /><p className="mt-3 text-sm text-[#bfc3cc]">Nenhum pedido com data disponível.</p></div>}
              {data.orders.some((order) => order.placedDate === null) && <p className="mt-4 text-xs text-[#bfc3cc]">Pedidos com data indisponível estão incluídos nos indicadores, mas não nesta lista.</p>}
            </section>
          </div>
          <section id="painel-pedidos" aria-labelledby="orders-title" className={`${panel} scroll-mt-[105px] overflow-hidden`}>
            <div className="p-5 sm:p-6"><h2 id="orders-title" className="text-lg font-bold">Pedidos registrados</h2><p className="mt-2 text-xs text-[#aeb3bd]">Filtros somente da tabela • {orders.length} de {data.orders.length} pedidos</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 min-[1350px]:grid-cols-[2fr_1fr_1fr_1fr]">
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
          <section id="painel-catalogo" aria-labelledby="catalog-title" className="scroll-mt-[105px]"><div className="mb-4 flex items-center justify-between gap-4"><h2 id="catalog-title" className="text-lg font-bold">Catálogo de produtos</h2><span className="text-xs text-[#bfc3cc]">{data.products.length} produtos</span></div>
            <div className="grid gap-4 sm:grid-cols-2 min-[1300px]:grid-cols-3">{data.products.map((product, index) => <article key={product.id} className={`${panel} overflow-hidden`}>
              <div aria-hidden="true" className="flex h-24 items-center justify-between border-b border-[#303239] bg-[radial-gradient(ellipse_at_top_right,#ff875a22,transparent_70%)] px-5"><Package size={32} className="text-[#ffad8c]" /><span className="text-4xl font-black text-[#ff875a18]">{String(index + 1).padStart(2, '0')}</span></div>
              <div className="p-5"><p className="text-xs text-[#bfc3cc]">{product.category || 'Sem categoria'}</p><h3 className="mt-2 break-words text-base font-bold">{product.name}</h3><div className="mt-5 border-t border-[#303239] pt-4"><p className="break-words text-xl font-extrabold text-[#ffba9e]">{money(product.priceCents)}</p></div></div>
            </article>)}</div>{!data.products.length && <p className={`${panel} p-6 text-sm text-[#bfc3cc]`}>Nenhum produto no catálogo.</p>}
          </section>
        </>}
        </div>
      </div>
    </main>
  )
}
