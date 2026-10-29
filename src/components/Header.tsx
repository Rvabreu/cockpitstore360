import { Link } from '@tanstack/react-router'
import { LogOut, UserRound } from 'lucide-react'
import { useAuth } from '../context/useAuth'

export default function Header() {
  const { user, isLoading, logout, sessionError } = useAuth()
  return (
    <header className="border-b border-[#232429] bg-[rgba(9,10,12,.95)] backdrop-blur-[16px] sticky top-0 z-20">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8 h-[79px] flex items-center gap-3 min-[851px]:gap-5">
        <a href="/#inicio" className="flex shrink-0 items-center gap-2 min-[851px]:gap-[11px] no-underline">
          <span className="grid place-items-center w-[35px] h-[35px] rounded-[11px] text-[#17100d] bg-[linear-gradient(130deg,#ff956f,#ff4b24)] font-black text-[19px] shadow-[0_0_28px_#ff613c3a]">
            C
          </span>
          <strong className="text-[13px] sm:text-[17px] min-[851px]:max-[1050px]:text-[14px] tracking-[-.6px]">
            COCKPIT <em className="not-italic text-[#ff633b]">STORE</em> 360
          </strong>
        </a>
        <span className="hidden min-[1440px]:block shrink-0 text-[10px] tracking-[1.5px] font-extrabold text-[#ffba9e] bg-[#ff633b12] border border-[#ff633b55] rounded-[40px] px-[11px] py-2">
          DEMO FICTÍCIA
        </span>
        <nav aria-label="Navegação principal" className="hidden min-[851px]:flex shrink-0 gap-3 min-[1050px]:gap-5 ml-auto">
          <Link to="/dashboard" className="text-[13px] text-[#c0c0c5] font-semibold hover:text-white no-underline focus-visible:outline-2 focus-visible:outline-[#ff633b]">
            Dashboard
          </Link>
          <a href="/#colecao" className="text-[13px] text-[#c0c0c5] font-semibold hover:text-white no-underline">
            Produtos
          </a>
          <a href="/#pedidos" className="text-[13px] text-[#c0c0c5] font-semibold hover:text-white no-underline">
            Meus pedidos
          </a>
          <a href="/#fluxo" className="text-[13px] text-[#c0c0c5] font-semibold hover:text-white no-underline">
            Como evoluímos
          </a>
        </nav>
        <img
          src="/assets/logo_ai_cockpit_referencia.svg"
          alt="Logo AI Cockpit, marca de referência"
          className="hidden min-[1280px]:block shrink-0 h-[31px] w-[120px] object-contain object-left opacity-90"
        />
        <div className="ml-auto min-[851px]:ml-0 flex min-w-0 items-center gap-2">
          {isLoading ? (
            <span role="status" aria-label="Verificando sessão" className="h-8 w-16 animate-pulse rounded-lg bg-[#17191d]" />
          ) : user ? (
            <>
              <span aria-hidden="true" className="hidden sm:grid shrink-0 size-8 place-items-center rounded-full border border-[#ff633b55] bg-[#ff633b12] text-sm font-bold text-[#ff956f]">
                {user.name.trim().charAt(0).toLocaleUpperCase('pt-BR')}
              </span>
              <span title={user.name} className="hidden min-[390px]:block max-w-[68px] sm:max-w-[100px] truncate text-xs font-semibold text-[#c0c0c5]">{user.name}</span>
              <button type="button" onClick={() => void logout()} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#232429] px-2.5 py-2.5 text-xs font-semibold hover:border-[#ff633b] hover:text-[#ff956f] focus-visible:outline-2 focus-visible:outline-[#ff633b]">
                <LogOut aria-hidden="true" className="hidden sm:block size-3.5" /> Sair
              </button>
            </>
          ) : (
            <Link to="/login" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#ff633b55] bg-[#ff633b12] px-3 py-2.5 text-xs font-bold text-[#ff956f] no-underline hover:bg-[#ff633b22] focus-visible:outline-2 focus-visible:outline-[#ff633b]">
              <UserRound aria-hidden="true" className="size-3.5" /> Entrar
            </Link>
          )}
        </div>
      </div>
      {!isLoading && user?.role === 'admin' && <nav aria-label="Área administrativa" className="max-w-[1240px] mx-auto px-4 sm:px-8 pb-3 flex flex-wrap gap-3">
        <Link to="/crm" className="rounded-lg border border-[#ff633b55] px-4 py-2 text-sm font-semibold text-[#ff956f] focus-visible:outline-2 focus-visible:outline-[#ff633b]">CRM · Contatos</Link>
      </nav>}
      {sessionError && <p role="alert" className="absolute top-full inset-x-0 border-b border-[#ff633b55] bg-[#17191d] px-4 py-2 text-center text-xs text-[#ffba9e]">{sessionError}</p>}
    </header>
  )
}
