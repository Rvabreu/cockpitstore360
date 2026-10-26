export default function Header() {
  return (
    <header className="h-[79px] border-b border-[#232429] bg-[rgba(9,10,12,.95)] backdrop-blur-[16px] sticky top-0 z-20">
      <div className="max-w-[1240px] mx-auto px-8 h-full flex items-center gap-7">
        <a href="#inicio" className="flex items-center gap-[11px] no-underline">
          <span className="grid place-items-center w-[35px] h-[35px] rounded-[11px] text-[#17100d] bg-[linear-gradient(130deg,#ff956f,#ff4b24)] font-black text-[19px] shadow-[0_0_28px_#ff613c3a]">
            C
          </span>
          <strong className="text-[17px] tracking-[-.6px]">
            COCKPIT <em className="not-italic text-[#ff633b]">STORE</em> 360
          </strong>
        </a>
        <span className="text-[10px] tracking-[1.5px] font-extrabold text-[#ffba9e] bg-[#ff633b12] border border-[#ff633b55] rounded-[40px] px-[11px] py-2">
          DEMO FICTÍCIA
        </span>
        <nav className="hidden min-[851px]:flex gap-7 ml-auto">
          <a href="#colecao" className="text-[13px] text-[#c0c0c5] font-semibold hover:text-white no-underline">
            Produtos
          </a>
          <a href="#pedidos" className="text-[13px] text-[#c0c0c5] font-semibold hover:text-white no-underline">
            Meus pedidos
          </a>
          <a href="#fluxo" className="text-[13px] text-[#c0c0c5] font-semibold hover:text-white no-underline">
            Como evoluímos
          </a>
        </nav>
        <img
          src="/assets/logo_ai_cockpit_referencia.svg"
          alt="Logo AI Cockpit, marca de referência"
          className="hidden min-[851px]:block h-[31px] w-[140px] object-contain object-left opacity-90"
        />
      </div>
    </header>
  )
}
