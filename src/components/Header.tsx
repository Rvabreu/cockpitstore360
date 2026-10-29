import { useAuth } from '../context/auth'

export default function Header() {
  const { user, loading, pending, error, logout } = useAuth()
  return (
    <header className="border-b border-[#232429] bg-[rgba(9,10,12,.95)] backdrop-blur-[16px] sticky top-0 z-20">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8 py-4 flex items-center flex-wrap gap-x-5 gap-y-4">
        <a href="/" className="flex items-center gap-[11px] no-underline" aria-label="Cockpit Store 360, início">
          <span className="grid place-items-center w-[35px] h-[35px] rounded-[11px] text-[#17100d] bg-[linear-gradient(130deg,#ff956f,#ff4b24)] font-black text-[19px] shadow-[0_0_28px_#ff613c3a]">
            C
          </span>
           <strong className="text-[13px] sm:text-[17px] tracking-[-.6px]">
            COCKPIT <em className="not-italic text-[#ff633b]">STORE</em> 360
          </strong>
        </a>
        <span className="hidden xl:block text-[10px] tracking-[1.5px] font-extrabold text-[#ffba9e] bg-[#ff633b12] border border-[#ff633b55] rounded-[40px] px-[11px] py-2">
          DEMO FICTÍCIA
        </span>
        <nav aria-label="Navegação principal" className="order-3 w-full min-[851px]:order-none min-[851px]:w-auto flex justify-between gap-4 min-[851px]:ml-auto">
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
        <div className="ml-auto min-[851px]:ml-0 text-xs flex items-center gap-3">
          {loading ? <span role="status" className="text-[#a6a9b1]">Verificando sessão…</span> : user ? <>
            <a href="/login" className="text-[#57d4a5] font-semibold">Conta conectada</a>
            <button type="button" onClick={() => void logout()} disabled={pending !== null}
              className="rounded-lg border border-[#474a51] px-3 py-2 disabled:opacity-50">
              {pending === 'logout' ? 'Saindo…' : 'Sair'}
            </button>
          </> : <a href="/login" className="rounded-lg bg-[#ff633b] text-[#160c08] px-4 py-2 font-bold">Entrar</a>}
        </div>
        {error && user && <p role="alert" className="order-4 w-full text-sm text-[#ffb69d]">{error}</p>}
      </div>
    </header>
  )
}
