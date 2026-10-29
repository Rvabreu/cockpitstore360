import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Package, ShieldCheck } from 'lucide-react'
import { AuthError, createAuthService, type AuthUser } from '../services/authService'
import { isProductId, loadCheckoutCatalog } from '../services/checkoutService'
import type { CheckoutProduct, CheckoutReceipt, CheckoutRequest } from '../types/checkout'

const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff956f]'
const panel = 'min-w-0 rounded-2xl border border-[#303239] bg-[#131519]'
const button = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#ff875a] px-4 text-sm font-bold text-[#1c0c06] disabled:opacity-50 ${focus}`
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

  return <main className="min-w-0 px-3 py-6 text-[#f7f7f8] sm:px-6 sm:py-10"><div className="mx-auto max-w-[1100px] space-y-5">
    <a href="/" className={`inline-flex min-h-11 items-center gap-2 text-sm text-[#bfc3cc] no-underline ${focus}`}><ArrowLeft size={17} aria-hidden="true" />Voltar à loja pública</a>
    <header><p className="text-[10px] font-bold tracking-[2px] text-[#ffad8c]">CHECKOUT DEMONSTRATIVO</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-1px] sm:text-4xl">Finalizar compra</h1><p className="mt-3 text-sm leading-6 text-[#bfc3cc]">Revise seu carrinho e gere um recibo de simulação.</p>{user && <p className="mt-2 break-all text-xs text-[#bfc3cc]">Conectado como {user.email}</p>}</header>
    <div className="flex items-start gap-3 rounded-xl border border-[#ff875a44] bg-[#ff633b0c] p-4"><ShieldCheck aria-hidden="true" size={20} className="shrink-0 text-[#ffad8c]" /><div><p className="text-sm font-bold text-[#ffd0b9]">Simulação sem cobrança</p><p className="mt-1 text-xs leading-5 text-[#bfc3cc]">Nenhum pagamento, reserva de estoque ou entrega será realizado. Não solicitamos dados de cartão nem endereço.</p></div></div>
    <ol aria-label="Etapas do checkout" className="grid grid-cols-3 gap-2">{['Carrinho', 'Revisão', 'Recibo'].map((label, index) => <li key={label} aria-current={(receipt ? 2 : review ? 1 : 0) === index ? 'step' : undefined} className={`rounded-xl border p-3 text-center text-xs font-semibold ${ (receipt ? 2 : review ? 1 : 0) === index ? 'border-[#ff875a55] bg-[#ff633b12] text-[#ffc29c]' : 'border-[#303239] text-[#aeb3bd]'}`}>{index + 1}. {label}</li>)}</ol>
    <p role="status" aria-live="polite" className="text-sm text-[#ffd0b9]">{status}</p>
    {warning && <p className="rounded-xl border border-[#ff875a33] p-4 text-sm leading-6 text-[#ffd0b9]">{warning}</p>}
    {error && <div role="alert" className="rounded-xl border border-[#ff875a55] bg-[#251813] p-4"><p className="text-sm text-[#ffd0b9]">{error}</p>{(!catalog || !ready || (attempt.current && user && review)) && <button type="button" disabled={pending} onClick={() => void (!catalog || !ready ? initialize() : conclude())} className={`mt-3 min-h-11 text-sm font-bold text-[#ffba9e] underline ${focus}`}>Tentar novamente</button>}</div>}
    {receipt ? <section aria-labelledby="receipt-title" className={`${panel} p-5 sm:p-8`}><div className="inline-flex rounded-xl bg-[#65cdb015] p-3 text-[#65cdb0]"><Check aria-hidden="true" size={25} /></div><h2 id="receipt-title" className="mt-4 text-xl font-bold">Recibo da simulação</h2><p className="mt-3 break-all text-sm text-[#bfc3cc]">Identificador: {receipt.id}</p><p className="mt-2 text-xs text-[#bfc3cc]">Registrado em <time dateTime={receipt.createdAt}>{new Date(receipt.createdAt).toLocaleString('pt-BR', { timeZone: 'UTC' })} UTC</time></p>{priceChanged && <p className="mt-4 rounded-xl bg-[#ff633b12] p-3 text-sm text-[#ffd0b9]">Os preços foram atualizados pelo servidor. O recibo apresenta os valores confirmados.</p>}<ul className="mt-5 divide-y divide-[#303239]">{receipt.items.map((item) => <li key={item.productId} className="flex min-w-0 flex-wrap justify-between gap-3 py-4"><div className="min-w-0"><h3 className="break-words text-sm font-semibold">{item.name}</h3><p className="mt-1 text-xs text-[#aeb3bd]">{item.quantity} × {money(item.unitPriceCents)}</p></div><p className="text-sm font-bold">{money(item.lineTotalCents)}</p></li>)}</ul><p className="mt-4 border-t border-[#303239] pt-4 text-lg font-bold">Total simulado: {money(receipt.totalCents)}</p><a href="/" className={`${button} mt-6 no-underline`}>Continuar comprando</a></section>
      : catalog && <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="cart-title" className={`${panel} p-5 sm:p-6`}><h2 id="cart-title" className="text-xl font-bold">{review ? 'Revise seu pedido' : 'Seu carrinho'}</h2>
          {!review && <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><label className="min-w-0 text-xs font-semibold">Produto para adicionar<select value={selection} disabled={pending} onChange={(event) => setSelection(event.target.value)} className={`mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#393c44] bg-[#0c0e11] px-3 text-sm ${focus}`}><option value="">Selecione um produto</option>{catalog.map((product) => <option key={product.id} value={product.id}>{product.name} — {money(Math.round(product.price * 100))}</option>)}</select></label><button type="button" disabled={pending || !selection || cart.length >= 20 || cart.some((item) => item.productId === selection && item.quantity >= 10)} onClick={() => { const existing = cart.find((item) => item.productId === selection); edit(existing ? cart.map((item) => item.productId === selection ? { ...item, quantity: item.quantity + 1 } : item) : [...cart, { productId: selection, quantity: 1 }]) }} className={`${button} sm:self-end`}>Adicionar produto</button></div>}
          {!cart.length && <p className="mt-6 rounded-xl border border-dashed border-[#393c44] p-6 text-sm text-[#bfc3cc]">Seu carrinho está vazio.</p>}
          <ul className="mt-5 divide-y divide-[#303239]">{lines.map(({ productId, quantity, product }) => <li key={productId} className="min-w-0 py-5"><div className="flex min-w-0 items-start gap-3"><Package size={21} aria-hidden="true" className="mt-1 shrink-0 text-[#ff956f]" /><div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold">{product?.name ?? 'Produto indisponível'}</h3><p className="mt-2 text-xs text-[#aeb3bd]">Valor unitário: {money(product ? Math.round(product.price * 100) : 0)}</p></div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3">{review ? <p className="text-sm text-[#bfc3cc]">Quantidade: {quantity}</p> : <label className="text-xs text-[#bfc3cc]">Quantidade de {product?.name ?? productId}<input type="number" min={1} max={10} step={1} value={quantity} disabled={pending} onChange={(event) => { const next = Number(event.target.value); if (!Number.isInteger(next) || next < 1 || next > 10) { setQuantityError('Informe uma quantidade entre 1 e 10.'); return }; edit(cart.map((item) => item.productId === productId ? { ...item, quantity: next } : item)) }} className={`ml-2 min-h-11 w-16 rounded-lg border border-[#393c44] bg-[#0c0e11] px-2 text-sm ${focus}`} /></label>}<p className="text-sm font-bold text-[#ffd0b9]">Subtotal: {money(product ? Math.round(product.price * 100) * quantity : 0)}</p>{!review && <button type="button" disabled={pending} onClick={() => edit(cart.filter((item) => item.productId !== productId))} className={`min-h-11 text-xs text-[#ffba9e] underline ${focus}`}>Remover {product?.name ?? productId}</button>}</div></li>)}</ul>
          {quantityError && <p role="alert" className="mt-3 text-sm text-[#ffba9e]">{quantityError}</p>}{!validCart && cart.length > 0 && !quantityError && <p role="alert" className="text-sm text-[#ffba9e]">Revise os itens e o limite total da simulação.</p>}
          {review && <button type="button" disabled={pending} onClick={() => setReview(false)} className={`mt-4 min-h-11 text-sm text-[#ffba9e] underline ${focus}`}>Editar carrinho</button>}
        </section>
        <aside aria-label="Resumo da compra" className={`${panel} self-start p-5 sm:p-6`}><h2 className="text-lg font-bold">Resumo da compra</h2><dl className="mt-5 space-y-4"><div className="flex justify-between gap-3 text-sm"><dt>Itens</dt><dd>{cart.reduce((sum, item) => sum + item.quantity, 0)}</dd></div><div className="border-t border-[#303239] pt-4"><dt className="text-xs text-[#aeb3bd]">Total estimado</dt><dd className="mt-2 break-words text-2xl font-extrabold">{money(total)}</dd></div></dl><p className="mt-4 text-xs leading-5 text-[#aeb3bd]">Os valores finais são calculados pelo servidor. Sem frete, pagamento ou entrega nesta simulação.</p>{!review ? <button type="button" disabled={pending || !validCart || Boolean(quantityError)} onClick={() => { setReview(true); setError('') }} className={`${button} mt-5 w-full`}>Revisar pedido</button> : user ? <button type="button" disabled={pending || !ready || !validCart || Boolean(quantityError)} onClick={() => void conclude()} className={`${button} mt-5 w-full`}>Concluir simulação</button> : <a href="/login" className={`${button} mt-5 w-full no-underline`}>Entrar para concluir</a>}{!user && !review && <a href="/login" className={`mt-3 inline-flex min-h-11 text-sm text-[#ffba9e] no-underline ${focus}`}>Entrar para concluir</a>}</aside>
      </div>}
  </div></main>
}
