import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Package, ReceiptText, ShieldCheck, ShoppingBag } from 'lucide-react'
import { AuthError, createAuthService, type AuthUser } from '../services/authService'
import { isProductId, loadCheckoutCatalog } from '../services/checkoutService'
import type { CheckoutProduct, CheckoutReceipt, CheckoutRequest } from '../types/checkout'

const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff956f]'
const panel = 'min-w-0 rounded-2xl border border-[#303239] bg-[#131519]'
const button = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#ff875a44] bg-[#30190f] px-4 text-sm font-bold text-[#fff0e5] hover:bg-[#49291b] disabled:opacity-50 ${focus}`
type Cart = { productId: string; quantity: number }[]
type Attempt = { userId: string; payload: CheckoutRequest; estimated: number; prices: Record<string, number> }

export default function CheckoutPage({ initialProductId, invalidInitialSelection = false }: { initialProductId?: string; invalidInitialSelection?: boolean } = {}) {
  const [auth] = useState(createAuthService)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)
  const [catalog, setCatalog] = useState<CheckoutProduct[] | null>(null)
  const [cart, setCart] = useState<Cart>([])
  const [selection, setSelection] = useState('')
  const [review, setReview] = useState(false)
  const [receipt, setReceipt] = useState<CheckoutReceipt | null>(null)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Verificando sessão…')
  const [warning, setWarning] = useState('')
  const [quantityError, setQuantityError] = useState('')
  const [priceChanged, setPriceChanged] = useState(false)
  const attempt = useRef<Attempt | null>(null)
  const busy = useRef(false)
  const mounted = useRef(false)
  const generation = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const initialized = useRef(false)
  const uncertain = 'A tentativa anterior pode ter sido concluída. Ao alterar o carrinho, uma nova simulação será criada.'

  async function initialize() {
    if (busy.current) return
    busy.current = true
    const current = ++generation.current
    const abort = new AbortController()
    controller.current?.abort()
    controller.current = abort
    const active = () => mounted.current && generation.current === current && !abort.signal.aborted
    setPending(true); setError(''); setStatus('Verificando sessão…')
    try {
      const session = await auth.bootstrap()
      if (!active()) return
      if (attempt.current && attempt.current.userId !== session.user?.id) { attempt.current = null; setWarning('A sessão mudou. A tentativa anterior não será repetida nesta conta.') }
      setUser(session.user); setReady(true)
      setStatus('Carregando catálogo…')
      const products = await loadCheckoutCatalog(abort.signal)
      if (!active()) return
      setCatalog(products)
      if (!initialized.current) {
        initialized.current = true
        if (invalidInitialSelection || (initialProductId !== undefined && (!isProductId(initialProductId) || !products.some((item) => item.id === initialProductId)))) setError('Seleção de produto inválida.')
        else if (initialProductId) setCart([{ productId: initialProductId, quantity: 1 }])
      }
      setStatus('Catálogo atualizado. Revise os itens antes de concluir.')
    } catch (failure) {
      if (active()) { setCatalog(null); setError(failure instanceof Error ? failure.message : 'Não foi possível carregar o checkout. Tente novamente.'); setStatus('Dados indisponíveis.') }
    } finally { if (active()) { busy.current = false; setPending(false) } }
  }

  useEffect(() => {
    mounted.current = true
    void initialize()
    return () => { mounted.current = false; generation.current++; controller.current?.abort(); busy.current = false; attempt.current = null }
  }, [])

  const lines = cart.map((item) => ({ ...item, product: catalog?.find((product) => product.id === item.productId) }))
  const total = lines.reduce((sum, item) => sum + (item.product ? Math.round(item.product.price * 100) * item.quantity : 0), 0)
  const validCart = cart.length > 0 && cart.length <= 20 && lines.every((item) => item.product && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 10)
    && Number.isSafeInteger(total) && total <= 100000000

  function edit(next: Cart) {
    if (busy.current) return
    if (attempt.current) { attempt.current = null; setWarning(uncertain) }
    setCart(next); setReview(false); setReceipt(null); setError(''); setStatus(''); setQuantityError('')
  }

  async function conclude() {
    if (busy.current || !ready || !user || !validCart || quantityError || !review || receipt) return
    busy.current = true
    const current = ++generation.current
    const active = () => mounted.current && current === generation.current
    setPending(true); setError(''); setStatus('Concluindo simulação…')
    try {
      if (!attempt.current || attempt.current.userId !== user.id) {
        attempt.current = { userId: user.id, estimated: total, prices: Object.fromEntries(lines.map((item) => [item.productId, Math.round(item.product!.price * 100)])), payload: { items: cart.map((item) => ({ ...item })).sort((a, b) => a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0), idempotencyKey: crypto.randomUUID() } }
      }
      const sent = attempt.current
      const result = await auth.checkout(sent.payload)
      if (!active()) return
      setReceipt(result.receipt); setPriceChanged(result.receipt.totalCents !== sent.estimated || result.receipt.items.some((item) => item.unitPriceCents !== sent.prices[item.productId])); setCart([]); setReview(false)
      attempt.current = null; setWarning(''); setStatus('Simulação concluída. Nenhum pagamento foi realizado.')
    } catch (failure) {
      if (!active()) return
      setError(failure instanceof AuthError ? failure.message : 'Não foi possível concluir a simulação. Tente novamente.')
      setStatus('A simulação não foi confirmada nesta tela.')
      if (failure instanceof AuthError && failure.status === 401) {
        setUser(null); setReceipt(null); attempt.current = null; setWarning('Sua sessão expirou. Entre novamente antes de concluir.')
      } else if (failure instanceof AuthError && failure.recoveredSession) {
        const recovered = failure.recoveredSession.user
        if (recovered?.id !== user.id) { attempt.current = null; setReceipt(null); setWarning('A sessão mudou. A tentativa anterior não será repetida nesta conta.') }
        setUser(recovered); setReady(true)
      } else if (failure instanceof AuthError && failure.recoveryFailed) setReady(false)
    } finally { if (active()) { busy.current = false; setPending(false) } }
  }

  return <main className="min-w-0 bg-[radial-gradient(ellipse_at_top_right,#ff875a0c,transparent_55%)] px-3 py-6 text-[#f7f7f8] sm:px-6 sm:py-10"><div className="mx-auto max-w-[1100px] space-y-6">
    <a href="/" className={`inline-flex min-h-11 items-center gap-2 text-sm text-[#bfc3cc] no-underline ${focus}`}><ArrowLeft size={17} aria-hidden="true" />Voltar à loja pública</a>
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[2px] text-[#ffad8c]">Sua compra em 3 etapas</p><h1 className="mt-3 text-[34px] font-extrabold leading-tight tracking-[-1.5px] sm:text-5xl">Finalizar compra<span aria-hidden="true" className="text-[#ff875a]">.</span></h1><p className="mt-3 max-w-lg text-sm leading-6 text-[#bfc3cc]">Escolha seus itens. Revise cada detalhe. Guarde seu recibo de simulação.</p></div>{user && <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#303239] bg-[#15171b] p-3 sm:max-w-[300px]"><ShieldCheck size={19} aria-hidden="true" className="shrink-0 text-[#ffad8c]" /><div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-[#949ba8]">Conectado como</p><p className="mt-1 break-all text-xs font-semibold text-[#e1e3e7]">{user.email}</p></div></div>}</header>
    <ol aria-label="Etapas do checkout" className="grid grid-cols-3 gap-2 rounded-2xl border border-[#303239] bg-[#121418] p-2 sm:gap-3 sm:p-3">{['Carrinho', 'Revisão', 'Recibo'].map((label, index) => {
      const current = receipt ? 2 : review ? 1 : 0
      const Icon = [ShoppingBag, ClipboardCheck, ReceiptText][index]
      return <li key={label} aria-current={current === index ? 'step' : undefined} className={`flex min-w-0 flex-col items-center gap-2 rounded-xl px-2 py-3 text-xs font-semibold sm:flex-row sm:gap-3 sm:px-4 ${current === index ? 'bg-[#ff875a] text-[#291208]' : 'text-[#aeb3bd]'}`}><span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-[11px] ${current === index ? 'border-[#76381f44] bg-[#ffffff22]' : 'border-[#393c44]'}`}>{current > index ? <Check size={14} /> : index + 1}</span><span className="flex items-center gap-2"><Icon size={15} aria-hidden="true" className="hidden sm:block" />{label}</span></li>
    })}</ol>
    <div className="flex items-start gap-3 rounded-xl border border-[#ff875a33] bg-[#ff633b08] p-4"><ShieldCheck aria-hidden="true" size={20} className="shrink-0 text-[#ffad8c]" /><div><p className="text-sm font-bold text-[#ffd0b9]">Simulação sem cobrança</p><p className="mt-1 text-xs leading-5 text-[#bfc3cc]">Nenhum pagamento, reserva de estoque ou entrega será realizado. Não solicitamos dados de cartão nem endereço.</p></div></div>
    <p role="status" aria-live="polite" className="text-sm text-[#ffd0b9]">{status}</p>
    {warning && <p className="rounded-xl border border-[#ff875a33] p-4 text-sm leading-6 text-[#ffd0b9]">{warning}</p>}
    {error && <div role="alert" className="rounded-xl border border-[#ff875a55] bg-[#251813] p-4"><p className="text-sm text-[#ffd0b9]">{error}</p>{(!catalog || !ready || (attempt.current && user && review)) && <button type="button" disabled={pending} onClick={() => void (!catalog || !ready ? initialize() : conclude())} className={`mt-3 min-h-11 text-sm font-bold text-[#ffba9e] underline ${focus}`}>Tentar novamente</button>}</div>}
    {receipt ? <section aria-labelledby="receipt-title" className="mx-auto min-w-0 max-w-[780px] overflow-hidden rounded-3xl border border-[#3b4942] bg-[#141a17] shadow-[0_20px_70px_#00000033]">
      <div className="border-b border-dashed border-[#3b4942] p-5 sm:p-8"><span className="inline-flex items-center gap-2 rounded-full border border-[#65cdb044] bg-[#65cdb012] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#9be0c6]"><Check size={14} aria-hidden="true" />Simulação registrada</span><h2 id="receipt-title" className="mt-5 text-2xl font-extrabold tracking-[-.5px] sm:text-3xl">Recibo da simulação</h2><p className="mt-3 text-sm leading-6 text-[#b9c7bf]">Um registro dos seus itens, com valores confirmados pelo servidor. Sem pagamento realizado.</p><div className="mt-5 grid gap-4 rounded-xl bg-[#0b110e] p-4 sm:grid-cols-2"><div><p className="text-[10px] uppercase tracking-wider text-[#8fa397]">Identificador</p><p className="mt-2 break-all font-mono text-xs leading-5 text-[#d6e4dc]">{receipt.id}</p></div><div><p className="text-[10px] uppercase tracking-wider text-[#8fa397]">Registrado em</p><time dateTime={receipt.createdAt} className="mt-2 block text-xs leading-5 text-[#d6e4dc]">{new Date(receipt.createdAt).toLocaleString('pt-BR', { timeZone: 'UTC' })} UTC</time></div></div>{priceChanged && <p className="mt-4 rounded-xl border border-[#ff875a33] bg-[#ff633b12] p-3 text-sm text-[#ffd0b9]">Os preços foram atualizados pelo servidor. O recibo apresenta os valores confirmados.</p>}</div>
      <div className="p-5 sm:p-8"><ul className="divide-y divide-[#303c35]">{receipt.items.map((item) => <li key={item.productId} className="flex min-w-0 flex-wrap justify-between gap-3 py-4"><div className="min-w-0"><h3 className="break-words text-sm font-semibold">{item.name}</h3><p className="mt-2 text-xs text-[#a7b9ad]">{item.quantity} × {money(item.unitPriceCents)}</p></div><p className="text-sm font-bold text-[#d6e4dc]">{money(item.lineTotalCents)}</p></li>)}</ul><div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-dashed border-[#3b4942] pt-6"><p className="text-sm text-[#a7b9ad]">Total simulado</p><p className="break-words text-3xl font-extrabold text-[#c5eedb]">{money(receipt.totalCents)}</p></div><a href="/" className={`${button} mt-7 w-full no-underline sm:w-auto`}>Continuar comprando<ArrowRight size={16} aria-hidden="true" /></a></div>
    </section>
      : catalog && <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="cart-title" className={`${panel} p-4 sm:p-6`}><div className="flex items-center gap-3"><div aria-hidden="true" className="rounded-xl border border-[#ff875a33] bg-[#ff633b0c] p-3 text-[#ffad8c]">{review ? <ClipboardCheck size={21} /> : <ShoppingBag size={21} />}</div><div><p className="text-[10px] font-bold uppercase tracking-wider text-[#89919f]">{review ? 'Etapa 02 · Confira os detalhes' : 'Etapa 01 · Seus favoritos'}</p><h2 id="cart-title" className="mt-1 text-xl font-bold">{review ? 'Revise seu pedido' : 'Seu carrinho'}</h2></div></div>{review && <p className="mt-5 rounded-xl border border-[#ff875a33] bg-[#ff633b08] p-4 text-sm leading-6 text-[#c5c8d0]">Confira os itens e quantidades abaixo. O total é estimado; os valores finais serão calculados pelo servidor antes de emitir o recibo.</p>}
          {!review && <div className="mt-6 grid min-w-0 gap-3 rounded-2xl border border-[#303239] bg-[#0b0d10] p-4 sm:grid-cols-[minmax(0,1fr)_auto]"><label className="min-w-0 text-xs font-semibold text-[#c5c8d0]">Produto para adicionar<select value={selection} disabled={pending} onChange={(event) => setSelection(event.target.value)} className={`mt-2 min-h-12 w-full min-w-0 rounded-xl border border-[#45404a] bg-[#1a1b20] px-3 text-sm text-[#f7f7f8] ${focus}`}><option value="">Selecione um produto</option>{catalog.map((product) => <option key={product.id} value={product.id}>{product.name} — {money(Math.round(product.price * 100))}</option>)}</select></label><button type="button" disabled={pending || !selection || cart.length >= 20 || cart.some((item) => item.productId === selection && item.quantity >= 10)} onClick={() => { const existing = cart.find((item) => item.productId === selection); edit(existing ? cart.map((item) => item.productId === selection ? { ...item, quantity: item.quantity + 1 } : item) : [...cart, { productId: selection, quantity: 1 }]) }} className={`${button} min-h-12 sm:self-end`}>Adicionar produto</button></div>}
          {!cart.length && <div className="mt-6 rounded-2xl border border-dashed border-[#393c44] bg-[#0c0e1144] p-6 text-center sm:p-10"><ShoppingBag size={32} aria-hidden="true" className="mx-auto text-[#ffad8c]" /><p className="mt-4 text-base font-semibold">Seu carrinho está vazio.</p><p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-[#aeb3bd]">Adicione um item pelo seletor acima ou descubra os produtos disponíveis na loja.</p><a href="/#colecao" className={`mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#ffba9e] no-underline ${focus}`}>Explorar catálogo<ArrowRight size={15} aria-hidden="true" /></a></div>}
          <ul className="mt-5 space-y-4">{lines.map(({ productId, quantity, product }) => <li key={productId} className="min-w-0 rounded-2xl border border-[#35363e] bg-[linear-gradient(125deg,#1c1e24,#15161a)] p-4 sm:p-5"><div className="flex min-w-0 items-start gap-4"><div aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-[#ff875a33] bg-[linear-gradient(135deg,#ffb18a22,#ff633b08)] text-[#ffad8c]"><Package size={27} /></div><div className="min-w-0 flex-1"><h3 className="break-words text-base font-bold leading-6 sm:text-lg">{product?.name ?? 'Produto indisponível'}</h3><p className="mt-2 text-xs text-[#aeb3bd]">Valor unitário: <span className="font-semibold text-[#d8dbe2]">{money(product ? Math.round(product.price * 100) : 0)}</span></p></div></div><div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[#34353c] pt-4">{review ? <p className="rounded-lg bg-[#ffffff06] px-3 py-2 text-sm text-[#bfc3cc]">Quantidade: {quantity}</p> : <label className="flex min-w-0 flex-wrap items-center gap-3 text-xs text-[#bfc3cc]"><span className="max-w-[200px] break-words">Quantidade de {product?.name ?? productId}</span><input type="number" min={1} max={10} step={1} value={quantity} disabled={pending} onChange={(event) => { const next = Number(event.target.value); if (!Number.isInteger(next) || next < 1 || next > 10) { setQuantityError('Informe uma quantidade entre 1 e 10.'); return }; edit(cart.map((item) => item.productId === productId ? { ...item, quantity: next } : item)) }} className={`min-h-11 w-16 rounded-lg border border-[#50515b] bg-[#0c0e11] px-2 text-center text-sm font-bold text-white ${focus}`} /></label>}<p className="text-base font-bold text-[#ffd0b9]"><span className="text-xs font-normal text-[#aeb3bd]">Subtotal: </span>{money(product ? Math.round(product.price * 100) * quantity : 0)}</p></div>{!review && <button type="button" disabled={pending} onClick={() => edit(cart.filter((item) => item.productId !== productId))} className={`mt-2 min-h-11 max-w-full break-words text-left text-xs text-[#c3c7d0] underline decoration-[#60636d] underline-offset-4 hover:text-[#ffba9e] ${focus}`}>Remover {product?.name ?? productId}</button>}</li>)}</ul>
          {quantityError && <p role="alert" className="mt-3 text-sm text-[#ffba9e]">{quantityError}</p>}{!validCart && cart.length > 0 && !quantityError && <p role="alert" className="text-sm text-[#ffba9e]">Revise os itens e o limite total da simulação.</p>}
          {review && <button type="button" disabled={pending} onClick={() => setReview(false)} className={`mt-4 min-h-11 text-sm text-[#ffba9e] underline ${focus}`}>Editar carrinho</button>}
        </section>
        <aside aria-label="Resumo da compra" className="min-w-0 self-start overflow-hidden rounded-3xl border border-[#ffc3a1] bg-[linear-gradient(150deg,#ffcca8,#ff9d76)] text-[#30190f] shadow-[0_20px_60px_#ff633b12] lg:sticky lg:top-24"><div className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-bold uppercase tracking-[2px] text-[#6a3a26]">Tudo em um só lugar</p><ReceiptText size={21} aria-hidden="true" /></div><h2 className="mt-4 text-xl font-extrabold tracking-[-.5px]">Resumo da compra</h2><dl className="mt-6 space-y-5"><div className="flex justify-between gap-3 text-sm"><dt>Itens</dt><dd className="font-bold">{cart.reduce((sum, item) => sum + item.quantity, 0)}</dd></div><div className="border-t border-[#6a3a2633] pt-5"><dt className="text-xs font-medium text-[#623523]">Total estimado</dt><dd className="mt-3 break-words text-[34px] font-extrabold leading-tight tracking-[-1px]">{money(total)}</dd></div></dl><p className="mt-4 text-xs leading-5 text-[#623523]">Os valores finais são calculados pelo servidor. Sem frete, pagamento ou entrega nesta simulação.</p>{!review ? <button type="button" disabled={pending || !validCart || Boolean(quantityError)} onClick={() => { setReview(true); setError('') }} className={`${button} mt-6 w-full bg-[#30190f] text-[#fff0e5] hover:bg-[#49291b]`}>Revisar pedido<ArrowRight size={16} aria-hidden="true" /></button> : user ? <button type="button" disabled={pending || !ready || !validCart || Boolean(quantityError)} onClick={() => void conclude()} className={`${button} mt-6 w-full bg-[#30190f] text-[#fff0e5] hover:bg-[#49291b]`}>Concluir simulação<ArrowRight size={16} aria-hidden="true" /></button> : <a href="/login" className={`${button} mt-6 w-full bg-[#30190f] text-[#fff0e5] no-underline`}>Entrar para concluir<ArrowRight size={16} aria-hidden="true" /></a>}{!user && !review && <a href="/login" className={`mt-3 inline-flex min-h-11 text-sm font-semibold text-[#49291b] underline underline-offset-4 ${focus}`}>Entrar para concluir</a>}</div><div className="flex items-start gap-3 border-t border-[#6a3a2633] bg-[#ffffff15] px-5 py-4 sm:px-6"><ShieldCheck size={18} aria-hidden="true" className="shrink-0" /><p className="text-[11px] font-medium leading-5">Este fluxo gera apenas uma simulação. Nenhum pagamento será realizado.</p></div></aside>
      </div>}
  </div></main>
}
