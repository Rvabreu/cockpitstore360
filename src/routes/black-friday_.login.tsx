import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowUpRight, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react'
import loginCss from '../black-friday-login.css?url'

export const Route = createFileRoute('/black-friday_/login')({
  component: BlackFridayLoginPage,
  head: () => ({
    meta: [
      { title: 'Login demonstrativo | Black Friday PMI Summit DF' },
      { name: 'description', content: 'Conheça a experiência demonstrativa de login do PMI Summit DF. Sem autenticação ou envio de credenciais. As ofertas continuam públicas.' },
    ],
    links: [{ rel: 'stylesheet', href: loginCss }],
  }),
})

export function BlackFridayLoginPage() {
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({ email: '', password: '' })
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const email = emailRef.current
    const password = passwordRef.current
    if (!email || !password) return
    const next = {
      email: email.validity.valueMissing ? 'Informe seu e-mail.' : email.validity.typeMismatch ? 'Informe um e-mail válido.' : '',
      password: password.validity.valueMissing ? 'Informe uma senha fictícia para a demonstração.' : '',
    }
    setErrors(next)
    setSubmitted(false)
    if (next.email || next.password) {
      const firstInvalid = next.email ? email : password
      firstInvalid.focus()
      return
    }
    // No credential names, requests, persistence or authentication: DOM-only demo.
    password.value = ''
    setShowPassword(false)
    setSubmitted(true)
  }

  return (
    <main className="bf-login-page">
      <div className="bf-login-container">
        <a className="bf-login-back" href="/black-friday#ofertas"><ArrowLeft size={16} aria-hidden="true" />Voltar às ofertas</a>
        <div className="bf-login-layout">
          <section className="bf-login-story" aria-labelledby="bf-login-story-title">
            <span className="bf-login-eyebrow">BLACK FRIDAY · BRASÍLIA / DF</span>
            <h1 id="bf-login-story-title">PMI SUMMIT DF<span>Seu próximo<br />capítulo começa<br /><em>com conexões.</em></span></h1>
            <p>Gestão de projetos, liderança e inovação no Centro-Oeste. Uma experiência feita para quem transforma ideias em impacto.</p>
            <div className="bf-login-art" aria-hidden="true"><span className="bf-login-orbit" /><Sparkles size={64} strokeWidth={1} /><span>PROJETOS. PESSOAS. PROPÓSITO.</span><strong>DF / 2026</strong></div>
            <p className="bf-login-public">As ofertas são públicas. Você não precisa entrar para explorar ou simular sua economia.</p>
          </section>
          <section className="bf-login-card" aria-labelledby="bf-login-title">
            <span className="bf-login-eyebrow">UMA EXPERIÊNCIA ILUSTRATIVA</span>
            <h2 id="bf-login-title">Entrar</h2>
            <p className="bf-login-intro">Explore a demonstração de login da Black Friday.</p>
            <div className="bf-login-notice" id="bf-login-demo"><ShieldCheck size={20} aria-hidden="true" /><p><strong>Login demonstrativo, sem autenticação.</strong> Use dados fictícios, não sua senha real. Nenhuma credencial é enviada ou salva. Nenhuma sessão será criada.</p></div>
            <form noValidate aria-label="Login demonstrativo" aria-describedby="bf-login-demo" onSubmit={handleSubmit} onChange={() => { setSubmitted(false); setErrors({ email: '', password: '' }) }}>
              <div className="bf-login-field">
                <label htmlFor="bf-login-email">E-mail</label>
                <input ref={emailRef} id="bf-login-email" type="email" autoComplete="username" required placeholder="voce@exemplo.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'bf-login-email-error' : undefined} />
                {errors.email && <p id="bf-login-email-error" className="bf-login-error" role="alert">{errors.email}</p>}
              </div>
              <div className="bf-login-field">
                <label htmlFor="bf-login-password">Senha</label>
                <div className="bf-login-password">
                  <input ref={passwordRef} id="bf-login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required placeholder="Use uma senha fictícia" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'bf-login-password-error' : undefined} />
                  <button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} aria-controls="bf-login-password" onClick={() => setShowPassword((current) => !current)}>{showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}</button>
                </div>
                {errors.password && <p id="bf-login-password-error" className="bf-login-error" role="alert">{errors.password}</p>}
              </div>
              <button type="submit" className="bf-login-submit">Simular entrada <ArrowUpRight size={18} aria-hidden="true" /></button>
            </form>
            <div className="bf-login-feedback" role="status" aria-live="polite">
              {submitted && <><p>Demonstração concluída. Nenhuma autenticação foi realizada, nenhuma sessão foi criada e a senha foi limpa.</p><a href="/black-friday#ofertas">Explorar ofertas públicas <ArrowUpRight size={16} aria-hidden="true" /></a></>}
            </div>
            <p className="bf-login-footnote">Esta página não valida filiação ao PMI DF e não realiza reservas ou pagamentos.</p>
          </section>
        </div>
      </div>
    </main>
  )
}
