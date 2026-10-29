import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Package, ShieldCheck } from 'lucide-react'
import { AuthError, createAuthService, type AuthUser } from '../services/authService'

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff956f]'
const inputStyle = `h-[52px] w-full min-w-0 rounded-xl border border-[#393c44] bg-[#0c0e11] px-4 text-sm text-[#f7f7f8] disabled:opacity-60 ${focus}`
type Errors = { email?: string; password?: string; confirmation?: string }

export default function RegistrationPage() {
  const [auth] = useState(createAuthService)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [ready, setReady] = useState(false)
  const [pending, setPending] = useState(false)
  const [created, setCreated] = useState(false)
  const [status, setStatus] = useState('Verificando sessão…')
  const [authError, setAuthError] = useState('')
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const confirmationInput = useRef<HTMLInputElement>(null)
  const mounted = useRef(false)
  const generation = useRef(0)
  const busy = useRef(false)

  async function bootstrap() {
    if (busy.current) return
    busy.current = true
    const current = ++generation.current
    const active = () => mounted.current && current === generation.current
    setPending(true)
    setReady(false)
    setAuthError('')
    setStatus('Verificando sessão…')
    try {
      const session = await auth.bootstrap()
      if (!active()) return
      setUser(session.user)
      setReady(true)
      setStatus(session.user ? 'Você já está conectado.' : '')
    } catch (error) {
      if (active()) {
        setAuthError(error instanceof AuthError ? error.message : new AuthError(0).message)
        setStatus('Não foi possível verificar a sessão.')
      }
    } finally {
      if (active()) { busy.current = false; setPending(false) }
    }
  }

  useEffect(() => {
    mounted.current = true
    const passwordElement = passwordInput.current
    const confirmationElement = confirmationInput.current
    void bootstrap()
    return () => {
      mounted.current = false
      generation.current++
      busy.current = false
      if (passwordElement) passwordElement.value = ''
      if (confirmationElement) confirmationElement.value = ''
    }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready || user || busy.current || created) return
    busy.current = true
    const current = ++generation.current
    const active = () => mounted.current && current === generation.current
    // Retain both elements even if success or navigation detaches the form.
    const passwordElement = passwordInput.current
    const confirmationElement = confirmationInput.current
    setStatus('')
    setAuthError('')
    try {
      const next: Errors = {}
      const normalizedEmail = email.trim()
      if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) next.email = 'Informe um e-mail válido.'
      if (password.length < 12 || password.length > 128 || new TextEncoder().encode(password).length > 512) next.password = 'Sua senha deve ter entre 12 e 128 caracteres.'
      if (confirmation !== password) next.confirmation = 'A confirmação deve ser igual à senha.'
      setErrors(next)
      if (Object.keys(next).length) {
        if (next.email) emailInput.current?.focus()
        else if (next.password) passwordInput.current?.focus()
        else confirmationInput.current?.focus()
        return
      }
      setPending(true)
      await auth.register(normalizedEmail, password)
      if (active()) {
        setCreated(true)
        setStatus('Conta criada. Entre para acessar sua conta.')
      }
    } catch (error) {
      if (active()) {
        setAuthError(error instanceof AuthError ? error.message : new AuthError(0).message)
        if (error instanceof AuthError && error.recoveredSession) {
          setUser(error.recoveredSession.user)
          setReady(true)
          setStatus(error.recoveredSession.user ? 'Você já está conectado.' : '')
        } else if (error instanceof AuthError && error.recoveryFailed) setReady(false)
      }
    } finally {
      if (passwordElement) passwordElement.value = ''
      if (confirmationElement) confirmationElement.value = ''
      setPassword('')
      setConfirmation('')
      if (active()) {
        setShowPassword(false)
        setShowConfirmation(false)
        busy.current = false
        setPending(false)
      }
    }
  }

  return <main className="min-w-0 px-3 py-6 text-[#f7f7f8] sm:px-6 sm:py-10">
    <div className="mx-auto max-w-[1040px]">
      <a href="/" className={`mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-[#bfc3cc] no-underline hover:text-white ${focus}`}><ArrowLeft size={17} aria-hidden="true" />Voltar à loja pública</a>
      <div className="grid min-w-0 overflow-hidden rounded-3xl border border-[#303239] bg-[#131519] shadow-[0_24px_80px_#00000025] lg:grid-cols-2">
        <section aria-labelledby="registration-title" className="min-w-0 p-6 sm:p-10 lg:order-2 lg:border-l lg:border-[#303239]">
          <p className="text-[10px] font-bold tracking-[2px] text-[#ffad8c]">SUA CONTA NA COCKPIT</p>
          <h1 id="registration-title" className="mt-3 text-3xl font-extrabold tracking-[-1px]">Criar conta</h1>
          <p className="mt-3 text-sm leading-6 text-[#bfc3cc]">Cadastre seu e-mail e uma senha. Após o cadastro, entre para acessar sua conta.</p>
          <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-[#c7cbd3]"><ShieldCheck size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-[#ff956f]" />Segurança: senhas protegidas e sessão segura</p>
          {user ? <div className="mt-7 rounded-xl border border-[#393c44] bg-[#0c0e11] p-5"><h2 className="text-lg font-bold">Sua conta</h2><p className="mt-2 break-all text-sm text-[#bfc3cc]">{user.email}</p><a href="/dashboard" className={`mt-4 inline-flex min-h-11 items-center font-semibold text-[#ffad8c] no-underline ${focus}`}>Abrir painel <ArrowRight aria-hidden="true" size={17} /></a></div>
            : created ? <div className="mt-7 rounded-xl border border-[#ff875a33] bg-[#ff633b0c] p-5"><p className="text-sm leading-6 text-[#bfc3cc]">O próximo passo é entrar com o e-mail e a senha que você cadastrou.</p><a href="/login" className={`mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#ff875a] px-4 text-sm font-bold text-[#1c0c06] no-underline ${focus}`}>Entrar na sua conta <ArrowRight size={17} aria-hidden="true" /></a></div>
              : <form noValidate onSubmit={submit} aria-busy={pending} className="mt-7 space-y-5">
                <div><label htmlFor="registration-email" className="mb-2 block text-sm font-semibold">E-mail</label><input ref={emailInput} id="registration-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={pending} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'registration-email-error' : undefined} className={inputStyle} />{errors.email && <p id="registration-email-error" role="alert" className="mt-2 text-sm text-[#ffb392]">{errors.email}</p>}</div>
                {[{ id: 'registration-password', label: 'Senha', value: password, setValue: setPassword, visible: showPassword, toggle: () => setShowPassword((value) => !value), ref: passwordInput, error: errors.password, show: 'Mostrar senha', hide: 'Ocultar senha' }, { id: 'registration-confirmation', label: 'Confirmar senha', value: confirmation, setValue: setConfirmation, visible: showConfirmation, toggle: () => setShowConfirmation((value) => !value), ref: confirmationInput, error: errors.confirmation, show: 'Mostrar confirmação', hide: 'Ocultar confirmação' }].map((item) => <div key={item.id}>
                  <label htmlFor={item.id} className="mb-2 block text-sm font-semibold">{item.label}</label><div className="relative"><input ref={item.ref} id={item.id} type={item.visible ? 'text' : 'password'} autoComplete="new-password" value={item.value} onChange={(event) => item.setValue(event.target.value)} disabled={pending} aria-invalid={Boolean(item.error)} aria-describedby={item.error ? `${item.id}-error` : item.id === 'registration-password' ? 'registration-password-hint' : undefined} className={`${inputStyle} pr-14`} /><button type="button" onClick={item.toggle} disabled={pending} aria-pressed={item.visible} aria-label={item.visible ? item.hide : item.show} className={`absolute right-1 top-1 grid h-11 w-11 place-items-center rounded-lg text-[#c3c6ce] hover:text-white ${focus}`}>{item.visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}</button></div>{item.id === 'registration-password' && <p id="registration-password-hint" className="mt-2 text-xs text-[#aeb3bd]">Use de 12 a 128 caracteres. Espaços fazem parte da senha.</p>}{item.error && <p id={`${item.id}-error`} role="alert" className="mt-2 text-sm text-[#ffb392]">{item.error}</p>}
                </div>)}
                <button type="submit" disabled={!ready || pending} className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(120deg,#ff875a,#ff633b)] text-sm font-extrabold text-[#1c0c06] disabled:cursor-not-allowed disabled:opacity-60 ${focus}`}>{pending && ready ? 'Criando conta…' : 'Criar conta'}<ArrowRight size={18} aria-hidden="true" /></button>
              </form>}
          <p role="status" aria-live="polite" className="mt-4 text-sm leading-6 text-[#ffd0b9]">{status}</p>
          {authError && <p role="alert" className="mt-3 text-sm leading-6 text-[#ffb392]">{authError}</p>}
          {!ready && authError && <button type="button" onClick={() => void bootstrap()} disabled={pending} className={`mt-3 min-h-11 text-sm font-semibold text-[#ffad8c] ${focus}`}>Tentar novamente</button>}
          {!user && !created && <a href="/login" className={`mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#ffad8c] no-underline hover:text-white ${focus}`}>Já tenho conta. Entrar</a>}
        </section>
        <section aria-labelledby="registration-welcome" className="relative min-w-0 overflow-hidden border-t border-[#303239] bg-[radial-gradient(ellipse_at_top_left,#ff633b20,transparent_70%)] p-6 sm:p-10 lg:order-1 lg:border-t-0">
          <p className="text-[10px] font-bold tracking-[2px] text-[#ffad8c]">UM NOVO PONTO DE PARTIDA</p><h2 id="registration-welcome" className="mt-5 text-[32px] font-extrabold leading-tight tracking-[-1px] sm:text-[42px]">Sua próxima experiência começa <span className="text-[#ff875a]">aqui.</span></h2><p className="mt-5 text-sm leading-7 text-[#bfc3cc]">Crie sua conta para acessar o painel. A loja e o acompanhamento de pedidos continuam públicos.</p><div className="mt-8 flex items-start gap-3 rounded-2xl border border-[#353038] bg-[#151519] p-5"><Package aria-hidden="true" size={24} className="shrink-0 text-[#ff956f]" /><div><p className="text-sm font-bold">Uma conta, um acesso.</p><p className="mt-2 text-xs leading-6 text-[#aeb3bd]">O painel apresenta dados demonstrativos compartilhados, não dados privados da sua conta.</p></div></div>
        </section>
      </div>
    </div>
  </main>
}
