export default function Header() {
  return (
    <header className="h-[79px] border-b border-[#232429] bg-[rgba(9,10,12,.95)] backdrop-blur-[16px] sticky top-0 z-20">
      <div className="max-w-[1240px] mx-auto px-[18px] min-[851px]:px-8 h-full flex items-center gap-3 min-[851px]:gap-6">
        <a href="#inicio" className="shrink-0 no-underline" aria-label="PMI Summit DF — início">
          <img
            src="/assets/logo_pmi_summit_df.svg"
            alt="PMI SUMMIT DF"
            width="216"
            height="56"
            className="w-[200px] min-[851px]:w-[216px] h-auto"
          />
        </a>
        <span className="text-[9px] min-[851px]:text-[10px] tracking-[1px] font-extrabold text-[#ffba9e] bg-[#ff633b12] border border-[#ff633b55] rounded-[40px] px-[10px] py-2 whitespace-nowrap ml-auto min-[851px]:ml-0">
          DEMO FICTÍCIA
        </span>
        <span className="hidden min-[1100px]:block text-[11px] text-[#a6a9b1] border-l border-[#34363b] pl-6 tracking-[1.2px] uppercase">
          Brasília / DF
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
      </div>
    </header>
  )
}
