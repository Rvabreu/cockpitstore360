import { ArrowUpRight, Award } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <a href="/#inicio"><img src="/assets/pmi-summit-logo.svg" alt="PMI Summit Brasília • DF Chapter" width="220" height="62" /></a>
            <p>Conectando pessoas, projetos e possibilidades na capital do Brasil.</p>
            <span><Award size={18} aria-hidden="true" /> Excelência em gestão de projetos</span>
          </div>
          <div className="footer-links">
            <h3>Explore o Summit</h3>
            <a href="/#sobre">Sobre o evento</a>
            <a href="/#trilhas">Trilhas & Programação</a>
            <a href="/#ingressos">Ingressos e inscrições</a>
            <a href="/#pdus">Planeje seus PDUs</a>
            <a href="/#submissao">Trabalhos e palestrantes</a>
          </div>
          <div className="footer-links">
            <h3>PMI Distrito Federal</h3>
            <p>Project Management Institute<br />Capítulo Distrito Federal · Brasília, DF</p>
            <a href="https://www.pmi.org/membership/chapters" target="_blank" rel="noreferrer">Contato: diretório oficial de capítulos <ArrowUpRight size={14} aria-hidden="true" /></a>
            <a href="https://www.pmi.org" target="_blank" rel="noreferrer">Conheça o PMI <ArrowUpRight size={14} aria-hidden="true" /></a>
          </div>
          <div className="footer-links">
            <h3>Conecte-se</h3>
            <a href="https://www.linkedin.com/company/project-management-institute/" target="_blank" rel="noreferrer">LinkedIn · PMI Global <ArrowUpRight size={14} aria-hidden="true" /></a>
            <a href="https://www.instagram.com/pmi_org/" target="_blank" rel="noreferrer">Instagram · PMI Global <ArrowUpRight size={14} aria-hidden="true" /></a>
            <a href="/#local">Guia de Brasília</a>
            <a href="/#submissao">Fale com a organização</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2027 PMI Summit Brasília. Todos os direitos reservados.</span>
          <span>Proposta de portal · Informações sujeitas à confirmação pelo PMI DF.</span>
        </div>
      </div>
    </footer>
  )
}
