import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, Sparkles, UserRound } from 'lucide-react'
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
  const demoButtonClass = 'flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#32343b] bg-transparent px-3 py-3 text-xs font-semibold text-[#f7f7f8] transition hover:border-[#ff633b] hover:bg-[#ff633b08] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff633b]'

  function fillDemo(email: string, password: string) {
    setEmail(email)
    setPassword(password)
    setError('')
    emailInput.current?.focus()
  }

  return (
    <main className="relative isolate overflow-hidden bg-[#08090b] px-4 py-10 sm:px-8 sm:py-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_15%,#ff633b16,transparent_60%)]">
        <div className="absolute left-1/2 top-[-160px] size-[560px] -translate-x-1/2 rounded-full border border-[#ff633b0d]" />
        <div className="absolute left-1/2 top-[-260px] size-[760px] -translate-x-1/2 rounded-full border border-[#ff633b08]" />
      </div>
      <div className="relative mx-auto w-full max-w-[680px]">
        <header className="mb-8 text-center sm:mb-10">
          <div className="mb-7 inline-flex items-center gap-3">
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-[linear-gradient(130deg,#ff956f,#ff4b24)] text-xl font-black text-[#17100d] shadow-[0_0_28px_#ff613c30]">C</span>
            <div className="text-sm font-extrabold tracking-tight">COCKPIT <span className="text-[#ff956f]">STORE</span>{' '}360</div>
          </div>
          <h1 id="login-title" className="text-[32px] font-extrabold leading-tight tracking-[-1px] sm:text-[48px] sm:tracking-[-2px]">Acesse sua conta</h1>
          <p className="mx-auto mt-4 max-w-[440px] text-sm leading-6 text-[#a6a9b1]">Que bom ter você por aqui. Entre para continuar sua experiência na loja.</p>
        </header>
        <section aria-labelledby="login-title" className="relative rounded-3xl border border-[#232429] bg-[#111316] p-6 shadow-[0_24px_80px_#00000040] sm:p-10">
          <div aria-hidden="true" className="absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,#ff956f,#ff4b24,transparent)] sm:inset-x-10" />
          <div className="mx-auto w-full max-w-[440px]">
            <form noValidate onSubmit={handleSubmit} aria-busy={busy} className="space-y-5">
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
              <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2.5 text-xs text-[#c0c0c5]">
                <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} disabled={busy} className="size-4 accent-[#ff633b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff633b]" /> Lembrar-me
              </label>
              {error && <p id="login-error" role="alert" className="rounded-xl border border-[#ff633b55] bg-[#ff633b12] p-3 text-sm text-[#ffba9e]">{error}</p>}
              <button type="submit" disabled={busy || isAuthenticated} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(130deg,#ff956f,#ff4b24)] px-4 py-3.5 text-sm font-extrabold text-[#17100d] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff633b]">
                {busy ? <><LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />{submitting ? 'Entrando...' : 'Verificando sessão...'}</> : <>Entrar na minha conta <ArrowRight aria-hidden="true" className="size-4 shrink-0" /></>}
              </button>
            </form>
            <div className="my-6 flex items-center gap-3"><span aria-hidden="true" className="h-px flex-1 bg-[#232429]" /><h2 className="text-xs font-semibold text-[#a6a9b1]">Experimente a loja</h2><span aria-hidden="true" className="h-px flex-1 bg-[#232429]" /></div>
            <div className="space-y-3">
              <button type="button" disabled={busy} onClick={() => fillDemo('cliente@cockpitstore360.com.br', 'demo123')} className={demoButtonClass}>
                <Sparkles aria-hidden="true" className="size-4 shrink-0 text-[#ff956f]" /><span>Preencher como Cliente Demo</span>
              </button>
              <button type="button" disabled={busy} onClick={() => fillDemo('admin@cockpitstore360.com.br', 'admin123')} className={demoButtonClass}>
                <UserRound aria-hidden="true" className="size-4 shrink-0 text-[#ff956f]" /><span>Preencher como Administrador Demo</span>
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] leading-5 text-[#a6a9b1]">Ambiente demonstrativo. Dados e produtos fictícios.</p>
            <Link to="/" className="mx-auto mt-5 flex min-h-11 w-fit items-center gap-2 rounded-lg text-xs font-semibold text-[#a6a9b1] no-underline hover:text-[#ff956f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff633b]"><ArrowLeft aria-hidden="true" className="size-3.5" /> Voltar à loja</Link>
          </div>
        </section>
        <p className="mt-7 text-center text-[11px] leading-6 tracking-wide text-[#a6a9b1]">Sua conta · Seus pedidos · Sua experiência</p>
      </div>
    </main>
  )
}
