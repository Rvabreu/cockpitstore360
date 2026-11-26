import { createLink, Link } from '@tanstack/react-router'
import { forwardRef, type ComponentPropsWithoutRef } from 'react'

// TanStack currently overwrites activeProps aria-current with "page". Section
// destinations are locations within the home page, not separate current pages.
const SectionLink = createLink(forwardRef<HTMLAnchorElement, ComponentPropsWithoutRef<'a'>>(
  function SectionAnchor(props, ref) {
    return <a {...props} ref={ref} aria-current={props['aria-current'] ? 'location' : undefined} />
  },
))

const navLinkClass = 'inline-flex min-h-11 items-center rounded-lg px-3 text-[13px] text-[#c0c0c5] font-semibold hover:text-white hover:bg-[#ffffff08] no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff9c7a]'

export default function Header() {
  return (
    <header className="border-b border-[#232429] bg-[#090a0c]">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8 min-h-[79px] py-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <SectionLink to="/" hash="inicio" activeOptions={{ exact: true, includeHash: true }} activeProps={{ 'aria-current': 'location' }} aria-label="COCKPIT STORE 360 — início" className="flex min-h-11 items-center gap-[11px] rounded-lg no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff9c7a]">
          <span aria-hidden="true" className="grid place-items-center shrink-0 w-[35px] h-[35px] rounded-[11px] text-[#17100d] bg-[linear-gradient(130deg,#ff956f,#ff4b24)] font-black text-[19px] shadow-[0_0_28px_#ff613c3a]">
            C
          </span>
          <strong className="text-[15px] sm:text-[17px] tracking-[-.6px]">
            COCKPIT <em className="not-italic text-[#ff633b]">STORE</em> 360
          </strong>
        </SectionLink>
        <span className="text-[10px] tracking-[1.5px] font-extrabold text-[#ffba9e] bg-[#ff633b12] border border-[#ff633b55] rounded-[40px] px-[11px] py-2">
          DEMO FICTÍCIA
        </span>
        <nav aria-label="Navegação principal" className="flex flex-wrap gap-1 w-full min-[1100px]:w-auto min-[1100px]:ml-auto">
          <SectionLink to="/" hash="colecao" activeOptions={{ exact: true, includeHash: true }} activeProps={{ 'aria-current': 'location' }} className={navLinkClass}>
            Produtos
          </SectionLink>
          <SectionLink to="/" hash="pedidos" activeOptions={{ exact: true, includeHash: true }} activeProps={{ 'aria-current': 'location' }} className={navLinkClass}>
            Meus pedidos
          </SectionLink>
          <SectionLink to="/" hash="fluxo" activeOptions={{ exact: true, includeHash: true }} activeProps={{ 'aria-current': 'location' }} className={navLinkClass}>
            Como evoluímos
          </SectionLink>
          <Link
            to="/black-friday"
            className={`${navLinkClass} text-[#ffac90] border border-[#ff633b55]`}
            activeOptions={{ exact: true }}
            activeProps={{ className: 'bg-[#ff633b20] !text-[#ffb69d]', 'aria-current': 'page' }}
          >
            Black Friday
          </Link>
        </nav>
        <img
          src="/assets/logo_ai_cockpit_referencia.svg"
          alt="Logo AI Cockpit, marca de referência"
          className="hidden min-[1200px]:block h-[31px] w-[120px] object-contain object-left opacity-90"
        />
      </div>
    </header>
  )
}
