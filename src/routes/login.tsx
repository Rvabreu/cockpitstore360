import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Eye, EyeOff, LockKeyhole, MoveLeft } from 'lucide-react'

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [
      { title: 'Entrar | COCKPIT STORE 360' },
      {
        name: 'description',
        content: 'Acesse a demonstração da COCKPIT STORE 360.',
      },
    ],
  }),
  component: LoginPage,
})

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [feedback, setFeedback] = useState('')

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFeedback('Esta tela é demonstrativa e não está conectada a uma conta. Nenhum login foi realizado.')
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,99,59,0.13),transparent_48%)]"
      />
      <div className="relative w-full max-w-[460px]">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 rounded-lg text-sm font-medium text-[#b8bbc2] no-underline transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff9c7a]"
        >
          <MoveLeft aria-hidden="true" className="h-4 w-4" />
          Voltar à loja
        </Link>

        <section className="rounded-[24px] border border-[#2a2c31] bg-[#111316]/95 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.42)] sm:p-10">
          <div className="mb-8 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[linear-gradient(130deg,#ff956f,#ff4b24)] text-xl font-black text-[#17100d] shadow-[0_0_28px_#ff613c3a]">
              C
            </span>
            <div className="leading-tight">
              <p className="m-0 text-[15px] font-extrabold tracking-[-.4px] text-[#f7f7f8]">
                COCKPIT <span className="text-[#ff633b]">STORE</span> 360
              </p>
              <p className="m-0 mt-1 text-[10px] font-bold tracking-[1.4px] text-[#ffb69d]">DEMO FICTÍCIA</p>
            </div>
          </div>

          <div className="mb-7">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#ff633b40] bg-[#ff633b12] px-3 py-1.5 text-[11px] font-semibold text-[#ffb69d]">
              <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />
              Área de acesso
            </div>
            <h1 className="m-0 text-[30px] font-bold tracking-[-1.2px] text-[#f7f7f8] sm:text-[34px]">
              Boas-vindas de volta.
            </h1>
            <p className="mb-0 mt-2 text-sm leading-6 text-[#a6a9b1]">
              Entre para continuar sua experiência na Cockpit Store 360.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#e5e6e9]">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="voce@exemplo.com"
                onChange={() => setFeedback('')}
                className="h-12 w-full rounded-xl border border-[#393b42] bg-[#0b0c0f] px-4 text-sm text-white outline-none transition placeholder:text-[#747780] hover:border-[#565963] focus:border-[#ff875a] focus:ring-2 focus:ring-[#ff633b]/25"
              />
            </div>

            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="password" className="text-sm font-semibold text-[#e5e6e9]">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => setFeedback('A recuperação de senha não está conectada. Nenhum e-mail será enviado nesta demonstração.')}
                  className="rounded text-xs font-semibold text-[#ff9c7a] transition hover:text-[#ffc0a8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff9c7a]"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Digite sua senha"
                  onChange={() => setFeedback('')}
                  className="h-12 w-full rounded-xl border border-[#393b42] bg-[#0b0c0f] px-4 pr-12 text-sm text-white outline-none transition placeholder:text-[#747780] hover:border-[#565963] focus:border-[#ff875a] focus:ring-2 focus:ring-[#ff633b]/25"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-[#a6a9b1] transition hover:text-white focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#ff9c7a]"
                >
                  {showPassword ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <label className="mb-6 flex w-fit cursor-pointer items-center gap-2.5 text-sm text-[#b8bbc2]">
              <input
                type="checkbox"
                name="remember"
                className="h-4 w-4 accent-[#ff633b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff9c7a]"
              />
              Manter conectado
            </label>

            <button
              type="submit"
              className="h-12 w-full rounded-xl border border-[#ff754e] bg-[#ff633b] px-4 text-sm font-extrabold text-[#190d08] shadow-[0_8px_24px_#ff633b24] transition hover:-translate-y-px hover:bg-[#ff805a] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#ffb69d] active:translate-y-0"
            >
              Entrar
            </button>
          </form>

          <p aria-live="polite" role={feedback ? 'status' : undefined} className="mb-0 mt-5 min-h-5 text-center text-xs leading-5 text-[#ffb69d]">
            {feedback}
          </p>

          <div className="mt-5 border-t border-[#2a2c31] pt-5 text-center">
            <p className="m-0 text-xs leading-5 text-[#8f929b]">
              Esta página é apenas uma demonstração visual. A autenticação e a recuperação de conta não estão disponíveis.
            </p>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-[#777a83]">
          COCKPIT STORE 360 <span className="px-1.5 text-[#ff633b]">•</span> Projeto fictício
        </p>
      </div>
    </main>
  )
}
