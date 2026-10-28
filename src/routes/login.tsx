import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, Package, ShieldCheck, Sparkles, Truck } from 'lucide-react'
import { useAuth } from '../context/useAuth'

export const Route = createFileRoute('/login')({
  head: () => ({ meta: [{ title: 'Entrar | COCKPIT STORE 360' }] }),
  component: LoginPage,
})

export function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const submission = useRef(false)

  useEffect(() => {
    if (!isLoading && isAuthenticated) void navigate({ to: '/', replace: true })
  }, [isAuthenticated, isLoading, navigate])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submission.current || isLoading) return
    setError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Informe um e-mail válido para entrar.')
      emailInput.current?.focus()
      return
    }
    if (!password) {
      setError('Informe sua senha para entrar.')
      passwordInput.current?.focus()
      return
    }
    submission.current = true
    setSubmitting(true)
    try {
      await login(email, password, rememberMe)
      // The authentication effect handles both restored sessions and new logins.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar. Tente novamente.')
    } finally {
      submission.current = false
      setSubmitting(false)
    }
  }

  const busy = submitting || isLoading
  const inputClass = 'w-full rounded-xl border border-[#232429] bg-[#08090b] py-3.5 pl-11 pr-4 text-sm text-[#f7f7f8] placeholder:text-[#656872] focus:border-[#ff633b] focus:outline-none focus:ring-2 focus:ring-[#ff633b]/20 disabled:opacity-60'

  return (
    <main className="relative min-h-[calc(100svh-79px)] overflow-hidden px-4 py-8 sm:px-8 sm:py-14 lg:flex lg:items-center">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_10%_30%,#ff633b0c,transparent_55%)]" />
      <div className="relative mx-auto grid w-full max-w-[1120px] gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-20">
        <section aria-labelledby="login-intro" className="hidden lg:block">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#ff633b40] bg-[#ff633b0a] px-3 py-2 text-[10px] font-bold uppercase tracking-[2px] text-[#ff956f]">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-[#ff633b]" /> Sua loja. Sua experiência.
          </span>
          <h2 id="login-intro" className="mt-7 text-[54px] font-extrabold leading-[1.08] tracking-[-2px]">Tudo que você gosta.<br /><span className="text-[#ff956f]">Em um só lugar.</span></h2>
          <p className="mt-6 max-w-[400px] text-base leading-7 text-[#a6a9b1]">Conecte-se à COCKPIT STORE 360 e fique por dentro de cada etapa, da escolha à entrega.</p>
          <div aria-label="Prévia demonstrativa do acompanhamento de pedido" className="relative mt-10 rounded-2xl border border-[#232429] bg-[linear-gradient(145deg,#17191d,#0d0f12)] p-6 shadow-[0_24px_60px_#00000030]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl border border-[#ff633b30] bg-[#ff633b10] text-[#ff956f]"><Package aria-hidden="true" className="size-5" /></span><div><p className="text-sm font-bold">Cada etapa, mais perto de você</p><p className="mt-1 text-xs text-[#a6a9b1]">Acompanhamento em tempo real</p></div></div>
            </div>
            <ol className="mt-6 grid grid-cols-3 gap-3 text-xs">
              <li className="border-t-2 border-[#ff633b] pt-3"><Check aria-hidden="true" className="mb-2 size-4 text-[#ff956f]" /><span className="font-semibold">Confirmado</span></li>
              <li className="border-t-2 border-[#ff633b] pt-3"><Package aria-hidden="true" className="mb-2 size-4 text-[#ff956f]" /><span className="font-semibold">Em separação</span></li>
              <li className="border-t-2 border-[#32343b] pt-3 text-[#a6a9b1]"><Truck aria-hidden="true" className="mb-2 size-4" /><span>Até sua porta</span></li>
            </ol>
            <p className="mt-5 border-t border-[#232429] pt-4 text-[10px] text-[#a6a9b1]">Prévia ilustrativa da experiência na loja.</p>
          </div>
          <p className="mt-6 flex items-center gap-2 text-xs text-[#a6a9b1]"><ShieldCheck aria-hidden="true" className="size-4 text-[#ff956f]" /> Uma conexão simples para continuar sua jornada.</p>
        </section>
        <section aria-labelledby="login-title" className="mx-auto w-full max-w-[460px] rounded-3xl border border-[#232429] bg-[#111316] p-6 shadow-[0_24px_80px_#00000040] sm:p-9">
        <div className="mb-8 flex items-center gap-3">
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-[linear-gradient(130deg,#ff956f,#ff4b24)] text-2xl font-black text-[#17100d] shadow-[0_0_28px_#ff613c3a]">C</span>
          <div>
            <div className="text-sm font-extrabold tracking-tight">COCKPIT <span className="text-[#ff633b]">STORE</span> 360</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[1.8px] text-[#a6a9b1]">Seu próximo passo começa aqui</div>
          </div>
        </div>
        <h1 id="login-title" className="text-3xl font-extrabold tracking-[-1px]">Acesse sua conta</h1>
        <p className="mt-3 text-sm leading-6 text-[#a6a9b1]">Que bom ter você por aqui. Entre para continuar sua experiência na loja.</p>
        <form noValidate onSubmit={handleSubmit} aria-busy={busy} className="mt-7 space-y-5">
          <div>
            <label htmlFor="login-email" className="mb-2 block text-xs font-semibold text-[#c0c0c5]">E-mail</label>
            <div className="relative">
              <Mail aria-hidden="true" className="absolute left-4 top-4 size-4 text-[#656872]" />
              <input ref={emailInput} id="login-email" name="email" type="email" autoComplete="username" inputMode="email" autoCapitalize="none" required value={email} onChange={(event) => { setEmail(event.target.value); setError('') }} disabled={busy} placeholder="seu@email.com.br" className={inputClass} aria-describedby={error ? 'login-error' : undefined} />
            </div>
          </div>
          <div>
            <label htmlFor="login-password" className="mb-2 block text-xs font-semibold text-[#c0c0c5]">Senha</label>
            <div className="relative">
              <LockKeyhole aria-hidden="true" className="absolute left-4 top-4 size-4 text-[#656872]" />
              <input ref={passwordInput} id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} disabled={busy} placeholder="Sua senha" className={`${inputClass} pr-12`} aria-describedby={error ? 'login-error' : undefined} />
              <button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} aria-controls="login-password" disabled={busy} onClick={() => setShowPassword((value) => !value)} className="absolute right-1 top-1 rounded-lg p-3 text-[#a6a9b1] hover:text-[#ff956f] focus-visible:outline-2 focus-visible:outline-[#ff633b]">
                {showPassword ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
              </button>
            </div>
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-2.5 text-xs text-[#c0c0c5]">
            <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} disabled={busy} className="size-4 accent-[#ff633b]" /> Lembrar-me
          </label>
          {error && <p id="login-error" role="alert" className="rounded-xl border border-[#ff633b55] bg-[#ff633b12] p-3 text-sm text-[#ffba9e]">{error}</p>}
          <button type="submit" disabled={busy || isAuthenticated} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(130deg,#ff956f,#ff4b24)] px-4 py-3.5 text-sm font-extrabold text-[#17100d] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff633b]">
            {busy ? <><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />{submitting ? 'Entrando...' : 'Verificando sessão...'}</> : <>Entrar na minha conta <ArrowRight aria-hidden="true" className="size-4" /></>}
          </button>
        </form>
        <div className="my-6 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[1.5px] text-[#656872]"><span className="h-px flex-1 bg-[#232429]" />Explore a demonstração<span className="h-px flex-1 bg-[#232429]" /></div>
        <button type="button" disabled={busy} onClick={() => { setEmail('cliente@cockpitstore360.com.br'); setPassword('demo123'); setError(''); emailInput.current?.focus() }} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#232429] bg-[#17191d] px-3 py-3 text-xs font-semibold text-[#f7f7f8] transition hover:border-[#ff633b55] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[#ff633b]">
          <Sparkles aria-hidden="true" className="size-4 text-[#ff956f]" /> Preencher como Cliente Demo
        </button>
        <p className="mt-3 text-center text-[11px] leading-5 text-[#a6a9b1]">Ambiente demonstrativo. Dados e produtos fictícios.</p>
        <Link to="/" className="mx-auto mt-7 flex w-fit items-center gap-2 text-xs font-semibold text-[#a6a9b1] no-underline hover:text-[#ff956f]"><ArrowLeft aria-hidden="true" className="size-3.5" /> Voltar à loja</Link>
      </section>
      </div>
    </main>
  )
}
