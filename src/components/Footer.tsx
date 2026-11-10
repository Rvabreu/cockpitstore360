import { ArrowUp, Calendar } from 'lucide-react'
import { EVENT_METADATA } from '../data/eventData'

export default function Footer() {
  return (
    <footer className="border-t border-[#23262f] bg-[#090a0d] text-[#8e919b] py-12">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-8 border-b border-[#1c1e25]">
          <div className="max-w-[550px]">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="grid place-items-center w-[30px] h-[30px] rounded-lg text-[#17100d] bg-[linear-gradient(130deg,#ff956f,#ff4b24)] font-black text-[15px]">
                GP
              </span>
              <strong className="text-[16px] text-white">
                Palestras de Gestão de Projetos — PMI
              </strong>
            </div>
            <p className="text-[12px] leading-[1.65] text-[#9a9da8]">
              {EVENT_METADATA.officialDisclaimerText}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="text-[12px] text-[#b3b6c2] bg-[#14161d] border border-[#2d313c] rounded-xl px-3.5 py-2.5 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#ff875a]" aria-hidden="true" />
              <span>{EVENT_METADATA.dateDisclaimer}</span>
            </div>
            <a
              href="#inicio"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1a1c24] hover:bg-[#252834] text-white text-[12px] font-bold border border-[#313542] transition no-underline"
              aria-label="Voltar ao início da página"
            >
              <ArrowUp className="w-3.5 h-3.5 text-[#ff875a]" aria-hidden="true" />
              Topo
            </a>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#787b87]">
          <span>
            {EVENT_METADATA.axesEditorialNotice}
          </span>
          <span className="text-[#a5a8b5]">
            Protótipo conceitual One-Page • Português (pt-BR)
          </span>
        </div>
      </div>
    </footer>
  )
}
