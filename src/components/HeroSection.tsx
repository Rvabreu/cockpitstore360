import { Calendar, Clock, Layers, Printer, ShieldAlert } from 'lucide-react'
import { EVENT_METADATA } from '../data/eventData'

export default function HeroSection() {
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  return (
    <section id="inicio" className="pt-8 sm:pt-12 pb-10">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8">
        <div
          className="border border-[#30333b] rounded-[24px] sm:rounded-[32px] overflow-hidden relative bg-[#101216] shadow-2xl"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at 85% 20%, rgba(255, 99, 59, 0.12) 0%, transparent 60%), linear-gradient(180deg, #121419 0%, #0d0e12 100%)',
          }}
        >
          <div className="p-6 sm:p-10 md:p-14 max-w-[850px] relative z-10">
            {/* Top Tag & Status */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-5">
              <span className="text-[#ff916c] font-extrabold tracking-[2px] uppercase text-[10px] sm:text-[11px] bg-[#ff633b18] border border-[#ff633b40] px-3 py-1 rounded-full">
                COMUNIDADE DE GESTÃO DE PROJETOS
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#fca5a5] bg-[#ef444414] border border-[#ef444433] px-3 py-1 rounded-full">
                <ShieldAlert className="w-3.5 h-3.5 text-[#ef4444]" aria-hidden="true" />
                Rascunho de protótipo — a confirmar
              </span>
            </div>

            {/* Main Heading */}
            <h1 className="text-[32px] sm:text-[46px] md:text-[56px] font-black tracking-[-2px] leading-[1.08] text-white my-4">
              Palestras de{' '}
              <span className="text-transparent bg-clip-text bg-[linear-gradient(120deg,#ffffff_30%,#ff9c7a_100%)]">
                Gestão de Projetos
              </span>
              <br />
              <span className="text-[#ff7e54] text-[26px] sm:text-[36px] md:text-[44px] font-extrabold block mt-1">
                Programação Preliminar
              </span>
            </h1>

            {/* Subtitle */}
            <p className="leading-[1.65] text-[#b4b7c0] text-[15px] sm:text-[17px] max-w-[700px] mb-6">
              Uma proposta visual completa inspirada nas melhores práticas de liderança de projetos,
              organizada em eixos temáticos editoriais para impulsionar discussões sobre inovação,
              resiliência e valor de negócio.
            </p>

            {/* Date highlight box */}
            <div className="inline-flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 rounded-2xl bg-[#171a21] border border-[#373a44] mb-8">
              <div className="flex items-center gap-2 text-[#ff9c7a]">
                <Calendar className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                <span className="text-[13px] uppercase font-bold tracking-wider text-[#a7aab3]">
                  Data de referência:
                </span>
              </div>
              <div className="text-[15px] sm:text-[16px] font-extrabold text-white">
                {EVENT_METADATA.referenceDate}
              </div>
              <span className="text-[11px] text-[#ffb69d] bg-[#ff633b18] px-2.5 py-1 rounded-md border border-[#ff633b30]">
                Cronograma sujeito à alteração
              </span>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3">
              <a
                href="#agenda"
                className="px-5 py-3 rounded-xl bg-[#ff633b] hover:bg-[#ff7b57] text-[#160c08] font-black text-[13px] tracking-wide transition transform hover:-translate-y-0.5 no-underline shadow-lg shadow-[#ff633b30]"
              >
                Explorar grade completa (13 blocos) ↓
              </a>
              <a
                href="#eixos"
                className="px-5 py-3 rounded-xl border border-[#3e424c] bg-[#1a1c22] hover:bg-[#252831] text-white font-bold text-[13px] transition transform hover:-translate-y-0.5 no-underline"
              >
                Conhecer eixos editoriais
              </a>
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-3 rounded-xl border border-[#3e424c] bg-[#14161b] hover:bg-[#1f2229] text-[#c4c6ce] hover:text-white font-bold text-[13px] transition inline-flex items-center gap-2"
              >
                <Printer className="w-4 h-4 text-[#ff875a]" aria-hidden="true" />
                Versão para impressão
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar at bottom of hero */}
          <div className="border-t border-[#292c34] bg-[#0c0d11]/80 px-6 sm:px-10 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#1d2028] text-[#ff875a]">
                <Clock className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <span className="block text-[18px] sm:text-[20px] font-black text-white">
                  13 blocos
                </span>
                <span className="text-[11px] text-[#8e919c] font-medium">08h00 às 19h30</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#1d2028] text-[#57d4a5]">
                <Layers className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <span className="block text-[18px] sm:text-[20px] font-black text-white">
                  3 eixos
                </span>
                <span className="text-[11px] text-[#8e919c] font-medium">Classificação editorial</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#1d2028] text-[#60a5fa]">
                <Calendar className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <span className="block text-[18px] sm:text-[20px] font-black text-white">
                  10/11/2026
                </span>
                <span className="text-[11px] text-[#8e919c] font-medium">A confirmar</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#1d2028] text-[#f59e0b]">
                <ShieldAlert className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <span className="block text-[18px] sm:text-[20px] font-black text-white">
                  Protótipo
                </span>
                <span className="text-[11px] text-[#8e919c] font-medium">Sem PDUs oficiais</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
