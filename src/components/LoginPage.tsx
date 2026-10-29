import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Package, ShieldCheck, Sparkles } from 'lucide-react'
import { AuthError, createAuthService, type AuthUser } from '../services/authService'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [status, setStatus] = useState('Verificando sessão…')
  const [authError, setAuthError] = useState('')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)
  const [pending, setPending] = useState(false)
  const [auth] = useState(createAuthService)
  const mounted = useRef(false)
  const submitting = useRef(false)
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    mounted.current = true
    let active = true
    auth.bootstrap().then((session) => {
      if (!active) return
      setUser(session.user)
      setReady(true)
      setStatus(session.user ? 'Sessão autenticada.' : '')
    }).catch((error: unknown) => {
      if (!active) return
      setStatus('')
      setAuthError(error instanceof AuthError ? error.message : new AuthError(0).message)
    })
    return () => { active = false; mounted.current = false }
  }, [auth])

  async function retryBootstrap() {
    if (submitting.current) return
    submitting.current = true
    setPending(true)
    setAuthError('')
    setStatus('Verificando sessão…')
    try {
      const session = await auth.bootstrap()
      if (!mounted.current) return
      setUser(session.user)
      setReady(true)
      setStatus(session.user ? 'Sessão autenticada.' : '')
    } catch (error) {
      if (mounted.current) {
        setStatus('')
        setAuthError(error instanceof AuthError ? error.message : new AuthError(0).message)
      }
    } finally {
      submitting.current = false
      if (mounted.current) setPending(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready || submitting.current) return
    setStatus('')
    setAuthError('')
    submitting.current = true
    try {
      const nextErrors: typeof errors = {}
      if (!email.trim()) nextErrors.email = 'Informe seu e-mail.'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254) nextErrors.email = 'Informe um e-mail válido.'
      if (!password) nextErrors.password = 'Informe sua senha.'
      setErrors(nextErrors)
      if (nextErrors.email) { emailInput.current?.focus(); return }
      if (nextErrors.password) { passwordInput.current?.focus(); return }
      setPending(true)
      const session = await auth.login(email.trim().toLowerCase(), password)
      if (!mounted.current) return
      setUser(session.user)
      setStatus('Sessão autenticada.')
    } catch (error) {
      if (mounted.current) {
        setAuthError(error instanceof AuthError ? error.message : new AuthError(0).message)
        if (error instanceof AuthError && error.recoveredSession) {
          setUser(error.recoveredSession.user)
          setReady(true)
          setStatus(error.recoveredSession.user ? 'Sessão autenticada.' : 'Sessão encerrada.')
        } else if (error instanceof AuthError && error.recoveryFailed) setReady(false)
      }
    } finally {
      submitting.current = false
      // Clear the input too: successful login unmounts the form in the same
      // React batch, so a detached/autofilled node must not retain the password.
      if (passwordInput.current) passwordInput.current.value = ''
      if (mounted.current) {
        setPassword('')
        setShowPassword(false)
        setPending(false)
      }
    }
  }

  async function handleLogout() {
    if (submitting.current) return
    submitting.current = true
    setPending(true)
    setAuthError('')
    let logoutConfirmed = false
    try {
      await auth.logout()
      logoutConfirmed = true
      if (!mounted.current) return
      setUser(null)
      setReady(false)
      setStatus('Sessão encerrada.')
      const session = await auth.bootstrap()
      if (!mounted.current) return
      setUser(session.user)
      setReady(true)
      setStatus(session.user ? 'Sessão autenticada.' : 'Sessão encerrada.')
    } catch (error) {
      if (mounted.current) {
        setAuthError(error instanceof AuthError ? error.message : new AuthError(0).message)
        if (logoutConfirmed) {
          setUser(null)
          setReady(false)
          setStatus('Sessão encerrada.')
        } else if (error instanceof AuthError && error.recoveredSession) {
          setUser(error.recoveredSession.user)
          setReady(true)
          setStatus(error.recoveredSession.user ? 'Sessão autenticada.' : 'Sessão encerrada.')
        } else {
          setStatus(user ? 'Sessão autenticada.' : '')
          if (error instanceof AuthError && error.recoveryFailed) setReady(false)
        }
      }
    } finally {
      submitting.current = false
      if (passwordInput.current) passwordInput.current.value = ''
      if (mounted.current) {
        setPassword('')
        setShowPassword(false)
        setPending(false)
      }
    }
  }

  const focus = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff956f]'
  const inputStyle = 'w-full min-h-[52px] rounded-xl border border-[#383b43] bg-[#0c0e11] px-4 text-[15px] text-[#f7f7f8] placeholder:text-[#747985] focus:border-[#ff875a] focus:outline-2 focus:outline-offset-2 focus:outline-[#ff875a] aria-invalid:border-[#ff956f]'

  return (
    <main className="relative px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-[1160px]">
        <a href="/" className={`mb-7 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#c3c6ce] no-underline hover:text-white ${focus}`}>
          <ArrowLeft aria-hidden="true" size={17} /> Voltar à loja pública
        </a>
        <div className="grid overflow-hidden rounded-[28px] border border-[#303239] bg-[#111316] lg:grid-cols-[1fr_1fr]">
          <section aria-labelledby="login-title" className="min-w-0 border-[#303239] bg-[#15171b] p-6 sm:p-10 lg:order-2 lg:border-l lg:p-12">
            <span className="text-[11px] font-bold tracking-[2px] text-[#ffad8c]">BEM-VINDO DE VOLTA</span>
            <h1 id="login-title" className="mt-3 text-[28px] font-extrabold leading-tight tracking-[-.8px] sm:text-[32px]">{user ? 'Sua conta' : 'Entrar na sua conta'}</h1>
            <p className="mt-3 text-sm leading-6 text-[#b9bdc6]">Acesse sua conta na COCKPIT STORE 360. A loja e o acompanhamento de pedidos continuam públicos.</p>
            <div id="login-security" className="mt-6 flex items-start gap-3 rounded-xl border border-[#ff875a45] bg-[#ff633b0c] p-4 text-[13px] leading-6 text-[#ffd0b9]">
              <ShieldCheck aria-hidden="true" size={20} className="mt-0.5 shrink-0" />
              <p>Segurança: senhas protegidas e sessão segura</p>
            </div>
            {user ? (
              <div className="mt-6 space-y-5">
                <p className="break-all text-sm text-[#f7f7f8]">{user.email}</p>
                <a href="/dashboard" className={`inline-flex min-h-11 items-center text-sm font-bold text-[#ffba9e] ${focus}`}>Abrir painel</a>
                <button type="button" onClick={handleLogout} disabled={pending} className={`min-h-[52px] w-full rounded-xl bg-[#ff875a] text-sm font-extrabold text-[#1c0c06] disabled:cursor-wait disabled:opacity-60 ${focus}`}>{pending ? 'Saindo…' : 'Sair'}</button>
              </div>
            ) : (
            <form noValidate onSubmit={handleSubmit} aria-describedby="login-security" aria-busy={pending || !ready} className="mt-6 space-y-5">
              <div>
                <label htmlFor="login-email" className="mb-2 block text-sm font-semibold">E-mail</label>
                <input ref={emailInput} id="login-email" type="email" autoComplete="username" value={email}
                  onChange={(event) => { setEmail(event.target.value); setStatus('') }}
                  aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'login-email-error' : undefined}
                  disabled={pending} className={inputStyle} />
                {errors.email && <p id="login-email-error" role="alert" className="mt-2 text-sm text-[#ffb392]">{errors.email}</p>}
              </div>
              <div>
                <label htmlFor="login-password" className="mb-2 block text-sm font-semibold">Senha</label>
                <div className="relative">
                  <input ref={passwordInput} id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password}
                    onChange={(event) => { setPassword(event.target.value); setStatus('') }}
                    aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'login-password-error' : undefined}
                    disabled={pending} className={`${inputStyle} pr-14`} />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} disabled={pending} aria-pressed={showPassword}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className={`absolute right-1 top-1 grid h-11 w-11 place-items-center rounded-lg text-[#c3c6ce] hover:text-white ${focus}`}>
                    {showPassword ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
                  </button>
                </div>
                {errors.password && <p id="login-password-error" role="alert" className="mt-2 text-sm text-[#ffb392]">{errors.password}</p>}
              </div>
              <button type="submit" disabled={!ready || pending} className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(120deg,#ff875a,#ff633b)] text-sm font-extrabold text-[#1c0c06] shadow-[0_8px_28px_#ff633b18] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 ${focus}`}>
                {pending ? 'Entrando…' : 'Entrar'} <ArrowRight aria-hidden="true" size={18} />
              </button>
            </form>
            )}
            {!user && <a href="/cadastro" className={`mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#ffad8c] no-underline hover:text-white ${focus}`}>Criar conta</a>}
            <p role="status" className="mt-4 text-sm leading-6 text-[#ffd0b9]">{status}</p>
            {authError && <p role="alert" className="mt-3 text-sm leading-6 text-[#ffb392]">{authError}</p>}
            {!ready && authError && <button type="button" onClick={retryBootstrap} disabled={pending} className={`mt-4 min-h-11 text-sm font-semibold text-[#ffad8c] ${focus}`}>Tentar novamente</button>}
          </section>
          <section aria-labelledby="login-welcome" className="relative flex min-w-0 flex-col justify-between overflow-hidden border-t border-[#303239] bg-[radial-gradient(ellipse_at_top_left,#ff633b20,transparent_70%)] p-6 sm:p-10 lg:order-1 lg:border-t-0 lg:p-12">
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 -left-20 h-80 w-80 rounded-full border border-[#ff633b20]" />
            <div className="relative">
              <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[2px] text-[#ffad8c]">
                <Sparkles aria-hidden="true" size={16} /> SUA PRÓXIMA EXPERIÊNCIA
              </span>
              <h2 id="login-welcome" className="mt-5 max-w-sm text-[32px] font-extrabold leading-[1.12] tracking-[-1.3px] sm:text-[44px]">
                Mais perto de<br />cada <span className="text-[#ff875a]">nova conquista.</span>
              </h2>
              <p className="mt-5 max-w-sm text-[15px] leading-7 text-[#b9bdc6]">
                Uma experiência pensada para acompanhar pedidos e descobrir os produtos que combinam com você.
              </p>
            </div>
            <div className="relative mt-8 flex items-start gap-4 rounded-2xl border border-[#353038] bg-[#151519] p-5 lg:mt-14">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ff633b15] text-[#ff956f]">
                <Package aria-hidden="true" size={22} />
              </span>
              <div>
                <p className="text-sm font-bold">Cada etapa, com clareza.</p>
                <p className="mt-1 text-[13px] leading-6 text-[#aeb3be]">Explore o acompanhamento público de pedidos na loja, do início à entrega.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
