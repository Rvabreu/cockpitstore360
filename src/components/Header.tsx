export default function Header() {
  return (
    <header className="h-[79px] border-b border-[#232429] bg-[rgba(9,10,12,.95)] backdrop-blur-[16px] sticky top-0 z-20">
      <div className="max-w-[1240px] mx-auto px-3 sm:px-8 h-full flex items-center gap-2 min-[851px]:gap-4">
        <a href="/#inicio" className="flex min-h-11 shrink-0 items-center gap-2 min-[851px]:gap-[11px] no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff956f]">
          <span className="hidden min-[420px]:grid place-items-center w-[35px] h-[35px] rounded-[11px] text-[#17100d] bg-[linear-gradient(130deg,#ff956f,#ff4b24)] font-black text-[19px] shadow-[0_0_28px_#ff613c3a]">
            C
          </span>
          <strong className="text-[11px] min-[420px]:text-[13px] min-[1100px]:text-[17px] tracking-[-.6px]">
            <span className="hidden min-[390px]:inline">COCKPIT </span><em className="not-italic text-[#ff633b]">STORE</em> 360
          </strong>
        </a>
        <span className="hidden min-[1300px]:inline-block shrink-0 text-[10px] tracking-[1.5px] font-extrabold text-[#ffba9e] bg-[#ff633b12] border border-[#ff633b55] rounded-[40px] px-[11px] py-2">
          DEMO FICTÍCIA
        </span>
        <nav aria-label="Navegação principal" className="hidden min-[851px]:flex gap-5 ml-auto">
          <a href="/#colecao" className="inline-flex min-h-11 items-center text-[13px] text-[#c0c0c5] font-semibold hover:text-white no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff956f]">
            Produtos
          </a>
          <a href="/#pedidos" className="inline-flex min-h-11 items-center text-[13px] text-[#c0c0c5] font-semibold hover:text-white no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff956f]">
            Meus pedidos
          </a>
          <a href="/#fluxo" className="inline-flex min-h-11 items-center text-[13px] text-[#c0c0c5] font-semibold hover:text-white no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff956f]">
            Como evoluímos
          </a>
        </nav>
        <a href="/dashboard" className="ml-auto min-[851px]:ml-0 inline-flex min-h-11 shrink-0 items-center px-2 text-[13px] font-semibold text-[#c0c0c5] no-underline hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff956f]">Painel</a>
        <a href="/checkout" className="inline-flex min-h-11 shrink-0 items-center text-xs font-semibold text-[#c0c0c5] no-underline hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff956f]">Checkout</a>
        <a href="/login" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-[#ff875a55] bg-[#ff633b12] px-3 text-[13px] font-bold text-[#ffba9e] no-underline hover:bg-[#ff633b22] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff956f]">Entrar</a>
        <img
          src="/assets/logo_ai_cockpit_referencia.svg"
          alt="Logo AI Cockpit, marca de referência"
          className="hidden min-[1100px]:block shrink-0 h-[31px] w-[110px] min-[1300px]:w-[140px] object-contain object-left opacity-90"
        />
      </div>
    </header>
  )
}
