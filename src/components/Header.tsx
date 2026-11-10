import { useState } from 'react'
import { Calendar, Menu, Printer, X } from 'lucide-react'
import { EVENT_METADATA } from '../data/eventData'

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  const navLinks = [
    { href: '#inicio', label: 'Início' },
    { href: '#sobre', label: 'Sobre a Proposta' },
    { href: '#eixos', label: 'Eixos Editoriais' },
    { href: '#agenda', label: 'Grade de Horários' },
    { href: '#faq', label: 'Dúvidas Frequentes' },
  ]

  return (
    <>
      {/* Skip link for screen readers and keyboard navigation */}
      <a
        href="#agenda"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#ff633b] focus:text-[#160c08] focus:font-bold focus:rounded-lg focus:shadow-lg focus:outline-none"
      >
        Pular para a programação de palestras
      </a>

      <header className="h-[79px] border-b border-[#232429] bg-[rgba(9,10,12,.95)] backdrop-blur-[16px] sticky top-0 z-30 transition-all">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8 h-full flex items-center justify-between gap-4">
          {/* Logo / Brand */}
          <a
            href="#inicio"
            className="flex items-center gap-3 no-underline focus:outline-none focus:ring-2 focus:ring-[#ff633b] rounded-lg p-1"
            aria-label="Ir para o topo da página do evento"
          >
            <span className="grid place-items-center w-[36px] h-[36px] rounded-[11px] text-[#17100d] bg-[linear-gradient(130deg,#ff956f,#ff4b24)] font-black text-[18px] shadow-[0_0_24px_#ff613c3a] flex-shrink-0">
              GP
            </span>
            <div className="flex flex-col">
              <span className="text-[15px] sm:text-[17px] font-extrabold tracking-[-.4px] text-white leading-tight">
                Palestras <span className="text-[#ff633b]">PMI</span>
              </span>
              <span className="text-[10px] tracking-[1.2px] uppercase text-[#a5a7ae] font-semibold">
                Gestão de Projetos
              </span>
            </div>
          </a>

          {/* Preliminary Badge */}
          <span className="hidden lg:inline-flex text-[10px] tracking-[1.4px] font-extrabold text-[#ffba9e] bg-[#ff633b14] border border-[#ff633b55] rounded-[40px] px-[12px] py-1.5 whitespace-nowrap">
            {EVENT_METADATA.statusBadge}
          </span>

          {/* Desktop Navigation */}
          <nav
            aria-label="Navegação principal"
            className="hidden md:flex items-center gap-6"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[13px] text-[#c0c0c5] font-semibold hover:text-white transition no-underline focus:outline-none focus:ring-2 focus:ring-[#ff633b] rounded px-1"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Actions: Print Button & Mobile Menu Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              aria-label="Imprimir grade preliminar em formato compacto"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#3b3e46] bg-[#1a1d22] hover:bg-[#252830] text-[#e1e2e7] text-[12px] font-bold transition focus:outline-none focus:ring-2 focus:ring-[#ff633b]"
            >
              <Printer className="w-3.5 h-3.5 text-[#ff875a]" aria-hidden="true" />
              <span className="hidden sm:inline">Imprimir agenda</span>
            </button>

            <a
              href="#agenda"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#ff633b] hover:bg-[#ff7b57] text-[#160c08] text-[12px] font-extrabold transition no-underline focus:outline-none focus:ring-2 focus:ring-white"
            >
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Ver grade</span>
            </a>

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-[#c0c0c5] hover:text-white hover:bg-[#1a1d22] transition focus:outline-none focus:ring-2 focus:ring-[#ff633b]"
              aria-label={mobileMenuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" aria-hidden="true" />
              ) : (
                <Menu className="w-6 h-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div
            id="mobile-navigation"
            className="md:hidden border-b border-[#2a2c32] bg-[#0e1014] px-4 py-4 space-y-2 animate-fadeIn shadow-2xl"
          >
            <div className="pb-2 border-b border-[#23252a] flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-[#ff9c7a] uppercase tracking-wider">
                Menu de navegação
              </span>
              <span className="text-[10px] text-[#a5a7ae] bg-[#1a1c22] px-2 py-0.5 rounded">
                Preliminar
              </span>
            </div>
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2.5 px-3 rounded-lg text-[14px] text-[#d6d8de] hover:text-white hover:bg-[#191b20] font-medium transition no-underline"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-2 border-t border-[#23252a] flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  handlePrint()
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-[#1b1e24] text-[13px] text-white font-semibold border border-[#343842]"
              >
                <Printer className="w-4 h-4 text-[#ff875a]" aria-hidden="true" />
                Imprimir programação
              </button>
            </div>
          </div>
        )}
      </header>
    </>
  )
}
