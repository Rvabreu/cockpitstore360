import { useState } from 'react'
import { ArrowUpRight, Menu, X } from 'lucide-react'

const navigation = [
  ['Sobre o Summit', 'sobre'],
  ['Trilhas & Programação', 'trilhas'],
  ['Ingressos', 'ingressos'],
  ['Simulador de PDUs', 'pdus'],
  ['Local', 'local'],
] as const

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <header className="summit-header">
        <div className="container header-inner">
          <a href="/#inicio" aria-label="PMI Summit Brasília — início" onClick={() => setMenuOpen(false)}>
            <img className="summit-logo" src="/assets/pmi-summit-logo.svg" alt="PMI Summit Brasília • DF Chapter" width="185" height="52" />
          </a>
          <nav className="desktop-nav" aria-label="Navegação principal">
            {navigation.map(([label, id]) => <a href={`/#${id}`} key={id}>{label}</a>)}
          </nav>
          <a className="button button-primary header-cta" href="/#ingressos">Inscreva-se Agora <ArrowUpRight size={16} aria-hidden="true" /></a>
          <button className="menu-toggle" type="button" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
        {menuOpen && <nav id="mobile-navigation" className="mobile-nav container" aria-label="Navegação móvel">
          {navigation.map(([label, id]) => <a href={`/#${id}`} key={id} onClick={() => setMenuOpen(false)}>{label}</a>)}
          <a className="button button-primary" href="/#ingressos" onClick={() => setMenuOpen(false)}>Inscreva-se Agora <ArrowUpRight size={16} aria-hidden="true" /></a>
        </nav>}
      </header>
    </>
  )
}
