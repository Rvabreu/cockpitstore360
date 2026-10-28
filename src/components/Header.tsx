export default function Header() {
  return (
    <header className="h-[79px] border-b border-[#232429] bg-[rgba(9,10,12,.95)] backdrop-blur-[16px] sticky top-0 z-20">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8 h-full flex items-center gap-3 min-[851px]:gap-5">
        <a href="/#inicio" className="flex min-h-11 shrink-0 items-center gap-2 min-[851px]:gap-[11px] no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff956f]">
          <span className="grid place-items-center w-[35px] h-[35px] rounded-[11px] text-[#17100d] bg-[linear-gradient(130deg,#ff956f,#ff4b24)] font-black text-[19px] shadow-[0_0_28px_#ff613c3a]">
            C
          </span>
          <strong className="text-[13px] min-[851px]:text-[17px] tracking-[-.6px]">
            COCKPIT <em className="not-italic text-[#ff633b]">STORE</em> 360
          </strong>
        </a>
        <span className="hidden min-[1100px]:inline-block shrink-0 text-[10px] tracking-[1.5px] font-extrabold text-[#ffba9e] bg-[#ff633b12] border border-[#ff633b55] rounded-[40px] px-[11px] py-2">
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
        <a href="/login" className="ml-auto min-[851px]:ml-0 inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-[#ff875a55] bg-[#ff633b12] px-4 text-[13px] font-bold text-[#ffba9e] no-underline hover:bg-[#ff633b22] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff956f]">Entrar</a>
        <img
          src="/assets/logo_ai_cockpit_referencia.svg"
          alt="Logo AI Cockpit, marca de referência"
          className="hidden min-[851px]:block shrink-0 h-[31px] w-[110px] min-[1100px]:w-[140px] object-contain object-left opacity-90"
        />
      </div>
    </header>
  )
}
