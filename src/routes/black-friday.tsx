import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowDown, ArrowRight, Check, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '../context/auth'
import { useStore } from '../context/useStore'
import { OTP_ERROR, SESSION_ERROR, requestBlackFridayOtp } from '../services/authService'
import type { BlackFridayOtp } from '../services/authService'
import { CAMPAIGN_END, formatCents, promotionFor } from '../services/blackFridayPromotions'
import '../components/BlackFriday.css'

export const Route = createFileRoute('/black-friday')({
  head: () => ({ meta: [{ title: 'Black Friday | Até 60% OFF | COCKPIT STORE 360' }] }),
  component: BlackFridayPage,
})

export { CAMPAIGN_END } from '../services/blackFridayPromotions'

export function BlackFridayPage() {
  const { products } = useStore()
  const { user, loading, pending, error: sessionError, verifyBlackFridayOtp, refresh } = useAuth()
  // Identical SSR/first-client markup; the browser clock starts only after hydration.
  const [now, setNow] = useState<number | null>(null)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState<BlackFridayOtp | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const alertRef = useRef<HTMLDivElement>(null)
  const successRef = useRef<HTMLDivElement>(null)
  const submitting = useRef(false)
  const busy = loading || pending !== null || requesting
  const sessionFailed = sessionError === SESSION_ERROR
  const seconds = challenge && now !== null ? Math.max(0, Math.ceil((challenge.expiresAt - now) / 1000)) : 0
  const expired = Boolean(challenge && seconds === 0)
  const remaining = now === null ? null : Math.max(0, Math.floor((CAMPAIGN_END - now) / 1000))
  const ended = now !== null && now >= CAMPAIGN_END
  const units = remaining === null ? ['—', '—', '—', '—'] : [Math.floor(remaining / 86400), Math.floor(remaining / 3600) % 24,
    Math.floor(remaining / 60) % 60, remaining % 60].map((value) => String(value).padStart(2, '0'))

  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => { if (challenge && !busy && !user) codeRef.current?.focus() }, [challenge, busy, user])
  useEffect(() => { if ((error === OTP_ERROR || sessionFailed) && !busy) alertRef.current?.focus() }, [error, sessionFailed, busy])
  useEffect(() => {
    if (user) {
      setCode(''); setChallenge(null); setError(null)
      if (notice === 'verified') successRef.current?.focus()
    }
  }, [user, notice])

  async function requestCode(event?: FormEvent) {
    event?.preventDefault()
    if (busy || submitting.current || sessionFailed) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254) {
      setError('Informe um e-mail válido.'); emailRef.current?.focus(); return
    }
    submitting.current = true; setRequesting(true); setError(null); setNotice(null)
    try {
      const next = await requestBlackFridayOtp(email.trim())
      setNow(Date.now()); setChallenge(next); setCode('')
      setNotice('Novo código solicitado. O código anterior não é mais válido.')
    } catch { setError(OTP_ERROR) }
    finally { submitting.current = false; setRequesting(false) }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault()
    if (busy || submitting.current || !challenge) return
    if (Date.now() >= challenge.expiresAt) { setNow(Date.now()); return }
    if (!/^\d{6}$/.test(code)) { setError('Informe os seis dígitos do código.'); codeRef.current?.focus(); return }
    submitting.current = true; setError(null)
    try {
      if (await verifyBlackFridayOtp(email.trim(), code)) setNotice('verified')
      else { setCode(''); setError(OTP_ERROR) }
    } finally { submitting.current = false }
  }

  return <main className="bf-page">
    <div className="bf-ribbon"><Sparkles size={14} aria-hidden="true" /> NÃO É SÓ UMA OFERTA. É O SEU PRÓXIMO UPGRADE. <span>27 NOV / 2026</span></div>
    <section className="bf-hero" aria-labelledby="bf-title">
      <div className="bf-hero-copy">
        <p className="bf-eyebrow"><span /> COCKPIT BLACK EDITION / 2026</p>
        <h1 id="bf-title" aria-label="BLACK FRIDAY">BLACK<br /><span>FRIDAY</span><b aria-hidden="true">®</b></h1>
        <p className="bf-hero-description">O extraordinário.<br /><strong>Por menos do que você imagina.</strong></p>
        <div className="bf-hero-actions"><a href="#ofertas" className="bf-button">{ended ? 'Ver histórico de ofertas' : 'Explorar ofertas'} <ArrowDown size={18} aria-hidden="true" /></a><a href="#passe-vip" className="bf-text-link">{ended ? 'Acessar minha conta' : user ? 'Meu passe VIP' : 'Desbloquear acesso VIP'} <ArrowRight size={16} aria-hidden="true" /></a></div>
        <p className="bf-fine">{ended ? 'Campanha encerrada · Preços e estoques históricos fictícios' : 'Campanha demonstrativa · Preços e estoques fictícios'}</p>
        <a href="/promocoes-black-friday" className="bf-text-link">Todas as promoções, filtros e benefícios <ArrowRight size={16} aria-hidden="true" /></a>
      </div>
      <div className="bf-hero-art">
        <span className="bf-art-label">DESIGN. SOM. MOVIMENTO.</span>
        <img src="/assets/hero_produtos.svg" alt="Fones Orbit, relógio Pulse e caixa de som Wave da coleção Cockpit" />
        <div className="bf-discount"><span>ATÉ</span><strong>60<small>%</small></strong><b>OFF</b></div>
        <span className="bf-art-index">ESSENCIAIS / VOL. 03</span>
      </div>
    </section>
    <section className="bf-countdown" aria-label="Prazo da campanha">
      <div><p className="bf-eyebrow">{ended ? 'PRAZO FINALIZADO' : 'O TEMPO ESTÁ CORRENDO'}</p><h2>{ended ? 'Campanha encerrada.' : 'O upgrade tem hora marcada.'}</h2><p>Até 28/11/2026, 00h · horário de Brasília</p></div>
      <div className="bf-clock" aria-label={remaining === null ? 'Calculando tempo restante' : 'Tempo restante da campanha'}>{units.map((value, index) => <div key={index}><strong>{value}</strong><span>{['DIAS', 'HORAS', 'MIN', 'SEG'][index]}</span></div>)}</div>
    </section>
    <section id="ofertas" className="bf-offers" aria-labelledby="offers-title">
      <div className="bf-section-heading"><div><p className="bf-eyebrow">CURADORIA COCKPIT / PREÇOS BLACK</p><h2 id="offers-title">Seu próximo essencial.</h2></div><a href="/promocoes-black-friday" className="bf-text-link">Filtrar todas as promoções <ArrowRight size={16} aria-hidden="true" /></a></div>
      <p className="bf-fine">Valores e unidades simulados, sem reserva ou compra real. Descontos calculados sobre o preço do catálogo fictício.</p>
      {ended && <p className="bf-alert" role="status">Campanha encerrada. Preços e economias são históricos fictícios. Entrar não reativa ofertas, cupons ou combos.</p>}
      <div className="bf-grid">{products.map((product) => {
        const offer = promotionFor(product)
        const locked = offer.vip && !user
        return <article className={`bf-card ${offer.vip ? 'bf-card-vip' : ''}`} key={product.id} aria-label={product.name}>
          <div className="bf-card-image" role="img" aria-label={product.name} style={{ backgroundImage: `url(${product.image.split('#')[0]})`, backgroundPosition: offer.crop }}>
            <span className="bf-sale">{offer.discount ? `−${offer.discount}%` : 'CATÁLOGO'}</span>{offer.vip && <span className="bf-vip-tag"><LockKeyhole size={12} aria-hidden="true" /> EXCLUSIVO VIP</span>}
          </div>
          <div className="bf-card-body"><p className="bf-eyebrow">{product.category}</p><h3>{product.name}</h3><p className="bf-product-description">{product.description}</p>
            <div className="bf-price"><del>{formatCents(offer.originalCents)}</del><strong>{formatCents(offer.priceCents)}</strong><span>{ended ? 'Preço histórico fictício' : 'Preço fictício'} {offer.vip ? 'VIP' : 'Black'} · Economia {formatCents(offer.savingCents)}</span></div>
            <div className="bf-stock">{offer.stock !== null && offer.total !== null ? <><span>Estoque fictício: <b>{offer.stock} de {offer.total} unidades</b></span><meter min={0} max={offer.total} value={offer.stock} aria-label={`Estoque fictício de ${product.name}`} /></> : <span>Sem estoque promocional simulado.</span>}</div>
            {ended ? <div className="bf-card-action bf-locked">Oferta encerrada</div> : locked ? <a className="bf-card-action bf-locked" href="#passe-vip"><LockKeyhole size={15} aria-hidden="true" /> Desbloquear oferta VIP</a> : <div className="bf-card-action bf-unlocked"><Check size={16} aria-hidden="true" /> {offer.vip ? 'Oferta VIP liberada' : 'Oferta aberta para você'}</div>}
            <p className="bf-fine">{ended ? 'Somente histórico · autenticação não reativa a campanha.' : locked ? 'Entre com qualquer acesso para liberar.' : 'Somente demonstração · sem checkout.'}</p>
          </div>
        </article>
      })}</div>
    </section>
    <section id="passe-vip" className="bf-pass" aria-labelledby="pass-title">
      <div className="bf-pass-copy"><span className="bf-pass-badge"><Sparkles size={15} aria-hidden="true" /> THE BLACK LIST</span><h2 id="pass-title">{ended ? <>A campanha acabou.<br /><span>Seu acesso continua.</span></> : <>Algumas ofertas<br />não são para todos.<br /><span>São para você.</span></>}</h2><p>{ended ? 'Login e código único continuam disponíveis para acessar sua conta. Nenhuma oferta encerrada será reativada.' : 'Seu passe VIP abre os preços exclusivos desta seleção. Sem senha nova, sem complicação.'}</p><ul><li><Check size={16} aria-hidden="true" /> {ended ? 'Autenticação disponível, campanha encerrada' : 'Ofertas exclusivas, acesso imediato'}</li><li><ShieldCheck size={16} aria-hidden="true" /> Sessão segura neste navegador</li></ul><p className="bf-fine">{ended ? 'A sessão não renova o prazo da campanha.' : 'Qualquer login existente também libera as ofertas VIP.'} Nenhuma permissão de compra ou administração é concedida.</p></div>
      <div className="bf-pass-panel">
        {user ? <div ref={successRef} tabIndex={-1} className="bf-success" role="status"><div className="bf-success-icon"><Check size={30} aria-hidden="true" /></div><p className="bf-eyebrow">ACESSO CONFIRMADO</p><h3>Você está na lista.</h3><p>{ended ? 'Sua sessão está ativa. A campanha terminou e as ofertas permanecem encerradas.' : 'Seu passe VIP está ativo. As ofertas exclusivas já estão liberadas.'}</p><a className="bf-button" href="#ofertas">{ended ? 'Ver histórico da campanha' : 'Ver minhas ofertas'} <ArrowRight size={18} aria-hidden="true" /></a></div> : <>
          <p className="bf-eyebrow">PASSE VIP BLACK FRIDAY / {challenge ? '02' : '01'} DE 02</p><h3>{challenge ? 'Seu código. Seu acesso.' : 'Entre para a lista.'}</h3>
          <p className="bf-login-method">Login instantâneo sem senha · Código único</p>
          <p className="bf-panel-intro">{challenge ? `Confirme o código para ${email.trim()}.` : 'Informe seu e-mail para solicitar um código de acesso de uso único.'}</p>
          <p className="bf-original-access">Já tem conta com senha ou Google? <a href="/login?returnTo=%2Fblack-friday">Use seu acesso original.</a> O código VIP não vincula nem substitui contas existentes.</p>
          {(error || sessionFailed) && <div ref={alertRef} id="bf-error" tabIndex={-1} role="alert" className="bf-alert">{error || SESSION_ERROR}{sessionFailed && <button disabled={busy} onClick={() => void refresh()} type="button">Verificar sessão novamente</button>}</div>}
          {!challenge ? <form onSubmit={requestCode} noValidate aria-busy={busy}><label htmlFor="bf-email">E-mail</label><input ref={emailRef} id="bf-email" type="email" autoComplete="email" inputMode="email" maxLength={254} required value={email} disabled={busy} aria-invalid={error === 'Informe um e-mail válido.'} aria-describedby={error ? 'bf-error' : undefined} onChange={(event) => { setEmail(event.target.value); setError(null) }} /><button className="bf-button" disabled={busy || sessionFailed} type="submit">{loading ? 'Verificando sessão…' : requesting ? 'Solicitando…' : 'Solicitar código VIP'} <ArrowRight size={17} aria-hidden="true" /></button></form> : <>
            {challenge.demo && !expired && <div className="bf-demo"><strong>MODO DEMONSTRAÇÃO · SEM ENVIO DE E-MAIL</strong><p>Este código está visível apenas no preview demo. Não use dados pessoais reais.</p><span>Código demo: <b>{challenge.demoCode}</b></span></div>}
            <form onSubmit={verifyCode} noValidate aria-busy={busy}><label htmlFor="bf-code">Código de seis dígitos</label><input ref={codeRef} id="bf-code" className="bf-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} disabled={busy || expired} aria-describedby={error ? 'bf-expiry bf-error' : 'bf-expiry'} aria-invalid={Boolean(error)} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError(null) }} /><p id="bf-expiry" className="bf-fine" role={expired ? 'status' : undefined}>{expired ? 'Código expirado. Solicite um novo código.' : `Código válido por ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}.`}</p><button className="bf-button" disabled={busy || expired} type="submit">{pending === 'otp' ? 'Validando…' : ended ? 'Validar e acessar conta' : 'Validar e liberar VIP'} <ArrowRight size={17} aria-hidden="true" /></button></form>
            <div className="bf-resend"><button type="button" disabled={busy} onClick={() => void requestCode()}>{requesting ? 'Solicitando…' : 'Reenviar código'}</button><button type="button" disabled={busy} onClick={() => { setChallenge(null); setCode(''); setError(null); setNotice(null); setTimeout(() => emailRef.current?.focus(), 0) }}>Alterar e-mail</button></div>
            {notice && notice !== 'verified' && <p className="bf-fine" role="status">{notice}</p>}
          </>}
          <p className="bf-fine bf-trust"><ShieldCheck size={14} aria-hidden="true" /> Código e sessão nunca salvos no armazenamento do navegador.</p>
        </>}
      </div>
    </section>
    <div className="bf-endnote"><span>BLACK FRIDAY / COCKPIT STORE 360</span><p>Experiência fictícia para demonstração. Sem checkout, cobrança ou reserva de estoque.</p><a href="/">Voltar à loja <ArrowRight size={14} aria-hidden="true" /></a></div>
  </main>
}
