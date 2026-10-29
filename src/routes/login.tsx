import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/auth'
import { safeReturnPath, SESSION_ERROR } from '../services/authService'
import { googleAvailable, googleResult, startGoogleLogin, GOOGLE_CANCELLED, GOOGLE_ERROR, GOOGLE_UNAVAILABLE } from '../services/googleAuthService'
import type { GoogleResult } from '../services/googleAuthService'

export const validateLoginSearch = (search: Record<string, unknown>) => ({
  returnTo: safeReturnPath(search.returnTo), google: googleResult(search.google),
})

export const Route = createFileRoute('/login')({
  validateSearch: validateLoginSearch,
  head: () => ({ meta: [{ title: 'Entrar | COCKPIT STORE 360' }] }),
  component: LoginPage,
})

function LoginPage() {
  const { returnTo, google } = Route.useSearch()
  const navigate = useNavigate()
  return <LoginScreen returnTo={returnTo} google={google} onAuthenticated={(path) => {
    const hash = path.split('#')[1]
    void navigate({ to: '/', hash, replace: true })
  }} />
}

export function LoginScreen({ returnTo = '/', google, onAuthenticated }: {
  returnTo?: string
  google?: GoogleResult
  onAuthenticated: (path: string) => void
}) {
  const { user, loading, pending, error, login, refresh } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const alertRef = useRef<HTMLDivElement>(null)
  const googleAlertRef = useRef<HTMLDivElement>(null)
  const [hydrated, setHydrated] = useState(false)
  const [googleStatus, setGoogleStatus] = useState<'pending' | 'available' | 'unavailable'>('pending')
  const [googlePending, setGooglePending] = useState(false)
  const [googleError, setGoogleError] = useState<string | null>(null)
  const googleStarting = useRef(false)
  const busy = loading || pending !== null || googlePending
  const googleDisabled = !hydrated || busy || googleStatus !== 'available' || error === SESSION_ERROR
  const googleMessage = googleError || (google === 'cancelled' ? GOOGLE_CANCELLED :
    google === 'error' ? GOOGLE_ERROR : google === 'unavailable' ? GOOGLE_UNAVAILABLE : null)

  useEffect(() => { setHydrated(true) }, [])
  useEffect(() => {
    if (loading || user) return
    let active = true
    setGoogleStatus('pending')
    void googleAvailable().then((available) => {
      if (active) setGoogleStatus(available ? 'available' : 'unavailable')
    }).catch(() => { if (active) setGoogleStatus('unavailable') })
    return () => { active = false }
  }, [loading, user])

  useEffect(() => {
    if (googleMessage && hydrated && !busy) googleAlertRef.current?.focus()
  }, [googleMessage, hydrated, busy])

  async function continueWithGoogle() {
    if (googleDisabled || googleStarting.current) return
    googleStarting.current = true
    setGooglePending(true)
    setGoogleError(null)
    try {
      await startGoogleLogin(returnTo)
    } catch {
      setGoogleError(GOOGLE_ERROR)
      setGooglePending(false)
      googleStarting.current = false
    }
  }

  useEffect(() => {
    if (error && !loading && !pending) alertRef.current?.focus()
  }, [error, loading, pending])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const next = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? undefined : 'Informe um e-mail válido.',
      password: password.length ? undefined : 'Informe sua senha.',
    }
    setErrors(next)
    if (next.email || next.password) {
      if (next.email) emailRef.current?.focus()
      else passwordRef.current?.focus()
      return
    }
    const success = await login(email.trim(), password)
    setPassword('')
    setVisible(false)
    if (success) onAuthenticated(safeReturnPath(returnTo))
  }

  return <main className="login-shell">
    <a href="/" className="login-back"><ArrowLeft size={16} aria-hidden="true" /> Voltar à loja</a>
    <div className="login-layout">
      <section className="login-editorial" aria-labelledby="login-editorial-title">
        <div className="login-eyebrow">SEU PRÓXIMO MOVIMENTO</div>
        <h2 id="login-editorial-title">Tecnologia que conecta.<br /><span>Uma experiência que acompanha.</span></h2>
        <p>Entre na sua conta e continue sua jornada na Cockpit Store 360.</p>
        <img src="/assets/hero_produtos.svg" alt="Seleção ilustrativa de fones de ouvido, relógio e caixa de som Cockpit" />
        <div className="login-editorial-foot"><span>ORBIT / PULSE / WAVE</span><span>DESIGN PARA O SEU DIA A DIA</span></div>
      </section>
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-icon"><ShieldCheck size={24} aria-hidden="true" /></div>
        <div className="login-eyebrow">COCKPIT STORE 360</div>
        <h1 id="login-title">{user ? 'Você está conectado.' : 'Bem-vindo de volta.'}</h1>
        <p className="login-intro">{user ? 'Sua sessão está ativa neste navegador.' : 'Entre com Google ou com seu e-mail e senha para acessar sua conta.'}</p>
        {error && <div ref={alertRef} role="alert" tabIndex={-1} className="login-alert">
          {error}
          {!user && error === SESSION_ERROR && <button type="button" disabled={busy} onClick={() => void refresh()}>Verificar sessão novamente</button>}
        </div>}
        {user ? <div className="login-connected">
          <p><ShieldCheck size={18} aria-hidden="true" /> Conta conectada com segurança.</p>
          <a className="login-submit" href={safeReturnPath(returnTo)}>Continuar na loja <ArrowRight size={18} aria-hidden="true" /></a>
          <p className="login-note">Para encerrar sua sessão, use “Sair” no menu superior.</p>
        </div> : <>
          {googleMessage && <div ref={googleAlertRef} role="alert" tabIndex={-1} className="login-alert">{googleMessage}</div>}
          <button className="login-google" type="button" disabled={googleDisabled} aria-busy={googlePending}
            aria-describedby="google-status" onClick={() => void continueWithGoogle()}>
            Continuar com Google
          </button>
          <p id="google-status" role="status" className="login-note">
            {googlePending ? 'Redirecionando para o Google…' : loading ? 'Verificando sessão…' :
              googleStatus === 'pending' ? 'Verificando disponibilidade do Google…' :
                googleStatus === 'unavailable' ? GOOGLE_UNAVAILABLE : 'Continue com segurança na página do Google.'}
          </p>
          <div className="login-separator"><span>ou entre com e-mail</span></div>
          <form onSubmit={submit} noValidate aria-busy={busy}>
          <label htmlFor="login-email">E-mail</label>
          <input ref={emailRef} id="login-email" type="email" name="email" autoComplete="username" inputMode="email"
            placeholder="seu@email.com" value={email} disabled={busy} required
            aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined}
            onChange={(event) => { setEmail(event.target.value); setErrors((old) => ({ ...old, email: undefined })) }} />
          {errors.email && <p className="login-field-error" id="email-error">{errors.email}</p>}
          <label htmlFor="login-password">Senha</label>
          <div className="login-password">
            <input ref={passwordRef} id="login-password" type={visible ? 'text' : 'password'} name="password"
              autoComplete="current-password" value={password} disabled={busy} required
              aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : undefined}
              onChange={(event) => { setPassword(event.target.value); setErrors((old) => ({ ...old, password: undefined })) }} />
            <button type="button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visible}
              aria-controls="login-password" disabled={busy} onClick={() => setVisible(!visible)}>
              {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
            </button>
          </div>
          {errors.password && <p className="login-field-error" id="password-error">{errors.password}</p>}
          <button className="login-submit" type="submit" disabled={busy}>
            {loading ? 'Verificando sessão…' : pending === 'login' ? 'Entrando…' : 'Entrar na conta'}
            {!busy && <ArrowRight size={18} aria-hidden="true" />}
          </button>
          <p role="status" className="login-note">{busy ? 'Aguarde um instante.' : 'Sua senha não é armazenada neste navegador.'}</p>
        </form></>}
        <div className="login-demo-note">Ambiente demonstrativo. O catálogo e os pedidos exibidos na loja são fictícios. Use uma conta provisionada pelo administrador ou Google, quando disponível.</div>
        <a href="/#colecao" className="login-browse">Explorar o catálogo sem entrar <ArrowRight size={14} aria-hidden="true" /></a>
      </section>
    </div>
  </main>
}
