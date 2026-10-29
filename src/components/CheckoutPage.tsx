import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Package, ReceiptText, ShieldCheck, ShoppingBag } from 'lucide-react'
import { AuthError, createAuthService, type AuthUser } from '../services/authService'
import { isProductId } from '../services/checkoutService'
import { isPaymentId, loadPaymentCatalog, loadPaymentOrder, PaymentError, redirectToStripe } from '../services/paymentsService'
import type { PaymentCatalog, PaymentOrder } from '../types/payment'
import type { CheckoutRequest } from '../types/checkout'

const money = (cents: number) => `${(cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'USD' })} USD`
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff956f]'
const panel = 'min-w-0 rounded-2xl border border-[#303239] bg-[#131519]'
const button = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#ff875a44] bg-[#30190f] px-4 text-sm font-bold text-[#fff0e5] hover:bg-[#49291b] disabled:opacity-50 ${focus}`
type Cart = { productId: string; quantity: number }[]
type Attempt = { userId: string; payload: CheckoutRequest }
type Props = { initialProductId?: string; invalidInitialSelection?: boolean; initialOrderId?: string; returnStatus?: 'sucesso' | 'cancelado' }

export default function CheckoutPage({ initialProductId, invalidInitialSelection = false, initialOrderId, returnStatus }: Props = {}) {
  const [auth] = useState(createAuthService)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)
  const [catalog, setCatalog] = useState<PaymentCatalog | null>(null)
  const [cart, setCart] = useState<Cart>([])
  const [selection, setSelection] = useState('')
  const [review, setReview] = useState(false)
  const [order, setOrder] = useState<PaymentOrder | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Verificando sessão…')
  const [warning, setWarning] = useState('')
  const [quantityError, setQuantityError] = useState('')
  const attempt = useRef<Attempt | null>(null)
  const busy = useRef(false)
  const mounted = useRef(false)
  const generation = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const poll = useRef({ requests: 0, started: 0 })
  const initialized = useRef(false)
  const account = useRef<string | null>(null)
  const ownedId = useRef<string | null>(null)

  function stopPolling() { if (timer.current) clearTimeout(timer.current); timer.current = null }
  function clearAccount() {
    stopPolling(); setUser(null); account.current = null; setCatalog(null); setCart([]); setOrder(null); setOrderId(null); ownedId.current = null; attempt.current = null
  }
  function reconcile(next: AuthUser | null) {
    if (account.current !== next?.id && account.current !== null) {
      stopPolling(); attempt.current = null; setCatalog(null); setOrder(null); setOrderId(null); ownedId.current = null; setCart([])
      setWarning('A sessão mudou. A tentativa anterior não será repetida nesta conta.')
    }
    account.current = next?.id ?? null; setUser(next)
    if (!next) { setCatalog(null); setOrder(null); setOrderId(null); ownedId.current = null; attempt.current = null; stopPolling() }
  }
  async function handleFailure(failure: unknown) {
    const current = generation.current
    setError(failure instanceof AuthError || failure instanceof PaymentError ? failure.message : 'Não foi possível consultar o pagamento. Tente novamente.')
    if ((failure instanceof AuthError || failure instanceof PaymentError) && failure.status === 401) {
      clearAccount(); setWarning('Sua sessão expirou. Entre novamente para continuar.'); setStatus('Sessão não autenticada.'); return
    }
    if (failure instanceof AuthError && failure.recoveredSession) { reconcile(failure.recoveredSession.user); setReady(true) }
    else if (failure instanceof AuthError && failure.recoveryFailed) setReady(false)
    else if (failure instanceof PaymentError && failure.status === 403) {
      setReady(false)
      try {
        const session = await auth.bootstrap()
        if (mounted.current && generation.current === current) { reconcile(session.user); setReady(true) }
      } catch { if (mounted.current && generation.current === current) setReady(false) }
    }
  }
  function schedule(id: string) {
    stopPolling()
    if (poll.current.requests >= 30 || Date.now() - poll.current.started >= 60000) {
      setStatus('Pagamento em confirmação. Atualize manualmente para consultar novamente.'); return
    }
    timer.current = setTimeout(() => {
      if (!mounted.current || ownedId.current !== id || !account.current) return
      if (poll.current.requests >= 30 || Date.now() - poll.current.started >= 60000) { setStatus('Pagamento em confirmação. Atualize manualmente para consultar novamente.'); return }
      void refreshOrder(id, false)
    }, 2000)
  }
  async function refreshOrder(id: string, manual = true) {
    if (busy.current || !account.current) return
    stopPolling(); busy.current = true
    const current = ++generation.current
    const owner = account.current
    const abort = new AbortController(); controller.current?.abort(); controller.current = abort
    const active = () => mounted.current && generation.current === current && account.current === owner && !abort.signal.aborted
    if (manual) poll.current = { requests: 0, started: Date.now() }
    poll.current.requests++
    setPending(true); setError('')
    let continuePolling = false
    try {
      const confirmed = await loadPaymentOrder(id, abort.signal)
      if (!active()) return
      setOrder(confirmed); setOrderId(id); ownedId.current = id
      setStatus(confirmed.status === 'paid' ? 'Pagamento confirmado pelo servidor.' : confirmed.status === 'pending' ? 'Pagamento em confirmação.' : confirmed.status === 'expired' ? 'Sessão de pagamento expirada.' : 'O servidor informou falha no pagamento.')
      continuePolling = confirmed.status === 'pending'
    } catch (failure) {
      if (active()) { setOrder(null); setStatus('O pagamento não foi confirmado nesta consulta.'); await handleFailure(failure) }
    } finally {
      if (mounted.current && generation.current === current) { busy.current = false; setPending(false); if (continuePolling && active()) schedule(id) }
    }
  }
  async function initialize() {
    if (busy.current) return
    stopPolling(); busy.current = true
    const current = ++generation.current
    const abort = new AbortController(); controller.current?.abort(); controller.current = abort
    const active = () => mounted.current && generation.current === current && !abort.signal.aborted
    setPending(true); setError(''); setStatus('Verificando sessão…')
    let nextOrder: string | null = null
    try {
      const session = await auth.bootstrap()
      if (!active()) return
      reconcile(session.user); setReady(true)
      if (invalidInitialSelection || (initialOrderId !== undefined && !isPaymentId(initialOrderId))) { setError('Seleção de produto ou pedido inválida.'); setStatus('Revise o endereço do checkout.'); return }
      if (!session.user) { setStatus('Entre para consultar preços em USD e continuar.'); return }
      if (initialOrderId) {
        nextOrder = initialOrderId; setOrderId(initialOrderId); ownedId.current = initialOrderId
        try { const live = await loadPaymentCatalog(abort.signal); if (active()) setCatalog(live) }
        catch (failure) { if (active() && failure instanceof PaymentError && [401, 403].includes(failure.status)) { nextOrder = null; await handleFailure(failure) } }
        return
      }
      const live = await loadPaymentCatalog(abort.signal)
      if (!active()) return
      setCatalog(live)
      if (!initialized.current) {
        initialized.current = true
        if (initialProductId !== undefined && (!isProductId(initialProductId) || !live.products.some((item) => item.id === initialProductId))) setError('Seleção de produto inválida.')
        else if (initialProductId) setCart([{ productId: initialProductId, quantity: 1 }])
      }
      setStatus('Preços em USD atualizados. Revise os itens antes de pagar.')
    } catch (failure) { if (active()) { setCatalog(null); setStatus('Pagamentos indisponíveis.'); await handleFailure(failure) } }
    finally {
      if (mounted.current && generation.current === current) { busy.current = false; setPending(false); if (nextOrder && active()) void refreshOrder(nextOrder) }
    }
  }
  useEffect(() => {
    mounted.current = true; void initialize()
    return () => { mounted.current = false; generation.current++; controller.current?.abort(); stopPolling(); busy.current = false; attempt.current = null }
  }, [])

  const lines = cart.map((item) => ({ ...item, product: catalog?.products.find((product) => product.id === item.productId) }))
  const total = lines.reduce((sum, item) => sum + (item.product?.unitPriceCents ?? 0) * item.quantity, 0)
  const validCart = cart.length > 0 && cart.length <= 20 && lines.every((item) => item.product && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 10) && Number.isSafeInteger(total) && total <= 100000000
  function edit(next: Cart) {
    if (busy.current) return
    if (attempt.current) { attempt.current = null; setWarning('A tentativa anterior pode ter iniciado um pagamento. Ao alterar o carrinho, uma nova tentativa será criada.') }
    setCart(next); setReview(false); setError(''); setStatus(''); setQuantityError('')
  }
  async function pay() {
    if (busy.current || !ready || !user || !validCart || quantityError || !review) return
    stopPolling(); busy.current = true
    const current = ++generation.current
    const owner = user.id
    const active = () => mounted.current && generation.current === current && account.current === owner
    setPending(true); setError(''); setStatus('Iniciando pagamento com Stripe…')
    let checkOrder: string | null = null
    try {
      if (!attempt.current || attempt.current.userId !== owner) attempt.current = { userId: owner, payload: { items: cart.map((item) => ({ ...item })).sort((a, b) => a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0), idempotencyKey: crypto.randomUUID() } }
      const result = await auth.createPayment(attempt.current.payload)
      if (!active()) return
      setOrderId(result.orderId); ownedId.current = result.orderId
      if (result.status === 'pending' && result.checkoutUrl) { setStatus('Redirecionando para o Stripe. O pagamento ainda não foi confirmado.'); redirectToStripe(result.checkoutUrl) }
      else { checkOrder = result.orderId; setStatus('Consultando o pagamento no servidor…') }
    } catch (failure) { if (active()) { setStatus('O pagamento não foi confirmado nesta tela.'); await handleFailure(failure) } }
    finally { if (mounted.current && generation.current === current) { busy.current = false; setPending(false); if (checkOrder && active()) void refreshOrder(checkOrder) } }
  }

  return <main className="min-w-0 bg-[radial-gradient(ellipse_at_top_right,#ff875a0c,transparent_55%)] px-3 py-6 text-[#f7f7f8] sm:px-6 sm:py-10"><div className="mx-auto max-w-[1100px] space-y-6">
    <a href="/" className={`inline-flex min-h-11 items-center gap-2 text-sm text-[#bfc3cc] no-underline ${focus}`}><ArrowLeft size={17} aria-hidden="true" />Voltar à loja pública</a>
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[2px] text-[#ffad8c]">Sua compra em 3 etapas · USD</p><h1 className="mt-3 text-[34px] font-extrabold leading-tight tracking-[-1.5px] sm:text-5xl">Finalizar compra</h1><p className="mt-3 max-w-lg text-sm leading-6 text-[#bfc3cc]">Revise os preços em dólares e continue no checkout hospedado pelo Stripe.</p></div>{user && <div className="min-w-0 rounded-xl border border-[#303239] bg-[#15171b] p-3 sm:max-w-[300px]"><p className="text-[10px] uppercase tracking-wider text-[#949ba8]">Conectado como</p><p className="mt-1 break-all text-xs font-semibold">{user.email}</p></div>}</header>
    <ol aria-label="Etapas do checkout" className="grid grid-cols-3 gap-2 rounded-2xl border border-[#303239] bg-[#121418] p-2">{['Carrinho', 'Revisão', 'Pagamento'].map((label, index) => { const current = orderId ? 2 : review ? 1 : 0; const Icon = [ShoppingBag, ClipboardCheck, ReceiptText][index]; return <li key={label} aria-current={current === index ? 'step' : undefined} className={`flex min-w-0 flex-col items-center gap-2 rounded-xl px-2 py-3 text-xs font-semibold sm:flex-row sm:gap-3 sm:px-4 ${current === index ? 'bg-[#ff875a] text-[#291208]' : 'text-[#aeb3bd]'}`}><span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full border border-current">{index + 1}</span><span className="flex items-center gap-2"><Icon size={15} aria-hidden="true" className="hidden sm:block" />{label}</span></li> })}</ol>
    {catalog?.mode === 'test' && <p className="rounded-xl border border-[#ff875a44] bg-[#ff633b12] p-4 text-sm font-semibold text-[#ffd0b9]">Modo de teste: nenhum valor real é cobrado.</p>}
    {catalog?.mode === 'live' && <p className="rounded-xl border border-[#ff875a44] p-4 text-sm text-[#ffd0b9]">Modo real: ao concluir no Stripe, seu método de pagamento poderá ser cobrado em USD.</p>}
    <div className="flex items-start gap-3 rounded-xl border border-[#303239] p-4"><ShieldCheck size={20} aria-hidden="true" className="shrink-0 text-[#ffad8c]" /><p className="text-xs leading-5 text-[#bfc3cc]">Os dados de pagamento são informados no Stripe, não nesta aplicação. O retorno à loja não confirma pagamento: a confirmação vem do servidor após notificação verificada.</p></div>
    {returnStatus && <p className="rounded-xl border border-[#303239] p-4 text-sm text-[#bfc3cc]">{returnStatus === 'cancelado' ? 'Você voltou do Stripe. O pagamento ainda não foi confirmado.' : 'Você voltou do Stripe. Consultando a confirmação no servidor.'}</p>}
    <p role="status" aria-live="polite" className="text-sm text-[#ffd0b9]">{status}</p>
    {warning && <p className="rounded-xl border border-[#ff875a33] p-4 text-sm leading-6 text-[#ffd0b9]">{warning}</p>}
    {error && <div role="alert" className="rounded-xl border border-[#ff875a55] bg-[#251813] p-4"><p className="text-sm text-[#ffd0b9]">{error}</p>{!orderId && <button type="button" disabled={pending} onClick={() => void (!catalog || !ready ? initialize() : pay())} className={`mt-3 min-h-11 text-sm font-bold text-[#ffba9e] underline ${focus}`}>Tentar novamente</button>}</div>}
    {!user && ready && !pending && <section className={`${panel} p-6`}><h2 className="text-xl font-bold">Entre para continuar</h2><p className="mt-3 text-sm leading-6 text-[#bfc3cc]">Acesse sua conta para consultar o catálogo em USD e seus pagamentos.</p><a href="/login" className={`${button} mt-5 no-underline`}>Entrar para pagar</a></section>}
    {user && orderId && <section aria-labelledby="payment-title" className="mx-auto min-w-0 max-w-[780px] overflow-hidden rounded-3xl border border-[#3b4942] bg-[#141a17]">
      <div className="border-b border-dashed border-[#3b4942] p-5 sm:p-8"><span className="inline-flex items-center gap-2 rounded-full border border-[#65cdb044] bg-[#65cdb012] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#9be0c6]">{order?.status === 'paid' ? <Check size={14} aria-hidden="true" /> : <ReceiptText size={14} aria-hidden="true" />}{order?.status === 'paid' ? 'Confirmado pelo servidor' : 'Consulta de pagamento'}</span><h2 id="payment-title" className="mt-5 text-2xl font-extrabold">{order?.status === 'paid' ? 'Pagamento confirmado' : 'Status do pagamento'}</h2><p className="mt-4 break-all font-mono text-xs text-[#d6e4dc]">Identificador: {orderId}</p>{order && <time dateTime={order.createdAt} className="mt-3 block text-xs text-[#bfc3cc]">{new Date(order.createdAt).toLocaleString('pt-BR', { timeZone: 'UTC' })} UTC</time>}</div>
      <div className="p-5 sm:p-8">{order && <><ul className="divide-y divide-[#303c35]">{order.items.map((item) => <li key={item.productId} className="flex min-w-0 flex-wrap justify-between gap-3 py-4"><div className="min-w-0"><h3 className="break-words text-sm font-semibold">{item.name}</h3><p className="mt-2 text-xs text-[#a7b9ad]">{item.quantity} × {money(item.unitPriceCents)}</p></div><p className="text-sm font-bold">{money(item.lineTotalCents)}</p></li>)}</ul><p className="mt-5 border-t border-[#3b4942] pt-5 text-2xl font-extrabold">Total do pedido: {money(order.totalCents)}</p><p className="mt-3 text-xs text-[#bfc3cc]">Valores registrados pelo servidor, não convertidos do catálogo em BRL.</p></>}
        <button type="button" disabled={pending || !ready} onClick={() => void refreshOrder(orderId)} className={`${button} mt-6`}>Atualizar pagamento</button><a href="/" className={`ml-0 mt-4 flex min-h-11 items-center gap-2 text-sm text-[#ffba9e] no-underline ${focus}`}>Continuar comprando<ArrowRight size={16} aria-hidden="true" /></a>
      </div></section>}
    {user && catalog && !orderId && <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-labelledby="cart-title" className={`${panel} p-4 sm:p-6`}><h2 id="cart-title" className="text-xl font-bold">{review ? 'Revise seu pedido' : 'Seu carrinho'}</h2>{review && <p className="mt-5 rounded-xl border border-[#ff875a33] bg-[#ff633b08] p-4 text-sm leading-6 text-[#c5c8d0]">Confira os itens e quantidades. O servidor calcula os valores finais em USD antes de abrir o Stripe.</p>}
        {!review && <div className="mt-6 grid min-w-0 gap-3 rounded-2xl border border-[#303239] bg-[#0b0d10] p-4 sm:grid-cols-[minmax(0,1fr)_auto]"><label className="min-w-0 text-xs font-semibold">Produto para adicionar<select value={selection} disabled={pending} onChange={(event) => setSelection(event.target.value)} className={`mt-2 min-h-12 w-full min-w-0 rounded-xl border border-[#45404a] bg-[#1a1b20] px-3 text-sm ${focus}`}><option value="">Selecione um produto</option>{catalog.products.map((product) => <option key={product.id} value={product.id}>{product.name} — {money(product.unitPriceCents)}</option>)}</select></label><button type="button" disabled={pending || !selection || cart.length >= 20 || cart.some((item) => item.productId === selection && item.quantity >= 10)} onClick={() => { const existing = cart.find((item) => item.productId === selection); edit(existing ? cart.map((item) => item.productId === selection ? { ...item, quantity: item.quantity + 1 } : item) : [...cart, { productId: selection, quantity: 1 }]) }} className={`${button} sm:self-end`}>Adicionar produto</button></div>}
        {!cart.length && <div className="mt-6 rounded-2xl border border-dashed border-[#393c44] p-6 text-center"><ShoppingBag size={32} aria-hidden="true" className="mx-auto text-[#ffad8c]" /><p className="mt-4 font-semibold">Seu carrinho está vazio.</p><a href="/#colecao" className={`mt-4 inline-flex min-h-11 items-center text-sm font-bold text-[#ffba9e] no-underline ${focus}`}>Explorar catálogo</a></div>}
        <ul className="mt-5 space-y-4">{lines.map(({ productId, quantity, product }) => <li key={productId} className="min-w-0 rounded-2xl border border-[#35363e] bg-[linear-gradient(125deg,#1c1e24,#15161a)] p-4 sm:p-5"><div className="flex min-w-0 items-start gap-4"><div aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-[#ff875a33] bg-[#ff633b12] text-[#ffad8c]"><Package size={27} /></div><div className="min-w-0"><h3 className="break-words text-base font-bold">{product?.name ?? 'Produto indisponível'}</h3><p className="mt-2 text-xs text-[#aeb3bd]">Valor unitário: {money(product?.unitPriceCents ?? 0)}</p></div></div><div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[#34353c] pt-4">{review ? <p className="text-sm text-[#bfc3cc]">Quantidade: {quantity}</p> : <label className="flex min-w-0 flex-wrap items-center gap-3 text-xs text-[#bfc3cc]"><span className="max-w-[200px] break-words">Quantidade de {product?.name ?? productId}</span><input type="number" min={1} max={10} step={1} value={quantity} disabled={pending} onChange={(event) => { const next = Number(event.target.value); if (!Number.isInteger(next) || next < 1 || next > 10) { setQuantityError('Informe uma quantidade entre 1 e 10.'); return }; edit(cart.map((item) => item.productId === productId ? { ...item, quantity: next } : item)) }} className={`min-h-11 w-16 rounded-lg border border-[#50515b] bg-[#0c0e11] px-2 text-center text-sm ${focus}`} /></label>}<p className="text-sm font-bold text-[#ffd0b9]">Subtotal: {money((product?.unitPriceCents ?? 0) * quantity)}</p></div>{!review && <button type="button" disabled={pending} onClick={() => edit(cart.filter((item) => item.productId !== productId))} className={`mt-2 min-h-11 max-w-full break-words text-left text-xs text-[#c3c7d0] underline ${focus}`}>Remover {product?.name ?? productId}</button>}</li>)}</ul>
        {quantityError && <p role="alert" className="mt-3 text-sm text-[#ffba9e]">{quantityError}</p>}{!validCart && cart.length > 0 && !quantityError && <p role="alert" className="text-sm text-[#ffba9e]">Revise os itens e o limite total do pagamento.</p>}{review && <button type="button" disabled={pending} onClick={() => setReview(false)} className={`mt-4 min-h-11 text-sm text-[#ffba9e] underline ${focus}`}>Editar carrinho</button>}
      </section>
      <aside aria-label="Resumo da compra" className="min-w-0 self-start overflow-hidden rounded-3xl border border-[#ffc3a1] bg-[linear-gradient(150deg,#ffcca8,#ff9d76)] p-5 text-[#30190f] lg:sticky lg:top-24 sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[2px]">Checkout em dólares</p><h2 className="mt-4 text-xl font-extrabold">Resumo da compra</h2><dl className="mt-6 space-y-5"><div className="flex justify-between text-sm"><dt>Itens</dt><dd>{cart.reduce((sum, item) => sum + item.quantity, 0)}</dd></div><div className="border-t border-[#6a3a2633] pt-5"><dt className="text-xs">Total estimado em USD</dt><dd className="mt-3 break-words text-[30px] font-extrabold">{money(total)}</dd></div></dl><p className="mt-4 text-xs leading-5">Preços explícitos em USD. Sem conversão automática de BRL. O valor final será apresentado no Stripe.</p>{!review ? <button type="button" disabled={pending || !validCart || Boolean(quantityError)} onClick={() => { setReview(true); setError('') }} className={`${button} mt-6 w-full`}>Revisar pedido</button> : <button type="button" disabled={pending || !ready || !validCart || Boolean(quantityError)} onClick={() => void pay()} className={`${button} mt-6 w-full`}>Pagar com Stripe<ArrowRight size={16} aria-hidden="true" /></button>}</aside>
    </div>}
  </div></main>
}
