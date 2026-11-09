export default function Header() {
  return (
    <header className="border-b border-[#49335f] bg-[rgba(16,9,27,.95)] backdrop-blur-[16px] sticky top-0 z-20">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8 min-h-[79px] py-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <a href="/" aria-label="Cockpit Store 360 — voltar à vitrine" className="flex items-center gap-[11px] no-underline focus-visible:outline-2 focus-visible:outline-[#ff995e] focus-visible:outline-offset-4">
          <span className="grid place-items-center w-[35px] h-[35px] rounded-[11px] text-white bg-[linear-gradient(130deg,#6b32c9,#4f17a8)] font-black text-[19px] shadow-[0_0_28px_#6b32c93a]">
            C
          </span>
          <strong className="text-[17px] tracking-[-.6px]">
            COCKPIT <em className="not-italic text-[#ff995e]">STORE</em> 360
          </strong>
        </a>
        <span className="hidden min-[1150px]:block text-[10px] tracking-[1.5px] font-extrabold text-[#d2b5ff] bg-[#4f17a812] border border-[#6b32c955] rounded-[40px] px-[11px] py-2">
          DEMO FICTÍCIA
        </span>
        <a href="/black-friday" className="ml-auto inline-flex max-w-full items-center gap-2 rounded-full border border-[#ff610f70] bg-[#4f17a830] px-3 sm:px-4 py-2 text-xs font-extrabold text-[#ff995e] no-underline hover:bg-[#6b32c950] focus-visible:outline-2 focus-visible:outline-[#ff995e] focus-visible:outline-offset-4">
          <span aria-hidden="true">↗</span><span>Black Friday <span className="block sm:inline text-[#d2b5ff]">PMI Summit DF</span></span>
        </a>
        <nav aria-label="Navegação principal" className="flex w-full min-[851px]:w-auto items-center justify-between min-[851px]:justify-start gap-4 min-[1150px]:gap-7">
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
          className="hidden min-[1150px]:block h-[31px] w-[140px] object-contain object-left opacity-90"
        />
      </div>
    </header>
  )
}
