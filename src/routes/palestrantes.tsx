import { createFileRoute } from '@tanstack/react-router'
import { ArrowUpRight, Clock3, MapPin, Sparkles } from 'lucide-react'
import IllustrativeSpeakers from '../components/IllustrativeSpeakers'
import { ricardoBio, sessions } from '../components/todaySchedule'

export const Route = createFileRoute('/palestrantes')({
  head: () => ({ meta: [
    { title: 'Palestrantes | PMI Summit Brasília' },
    { name: 'description', content: 'Conheça o destaque proposto de Ricardo Vargas e os perfis ilustrativos do PMI Summit Brasília. Participação e credenciais sujeitas à confirmação.' },
    { property: 'og:title', content: 'Palestrantes | PMI Summit Brasília' },
    { property: 'og:description', content: 'Perspectivas sobre projetos, liderança e IA. Ricardo Vargas segundo o briefing e demais perfis ilustrativos, a confirmar.' },
  ] }),
  component: SpeakersPage,
})

export function SpeakersPage() {
  const magna = sessions.find((session) => session.id === 'magna')!
  return (
    <main id="conteudo" tabIndex={-1}>
      <section className="section summit-hero speakers-hero" aria-labelledby="speakers-title">
        <div className="hero-grid" aria-hidden="true" />
        <div className="container">
          <a className="text-link" href="/#convidados">Voltar aos convidados na Home <ArrowUpRight size={16} aria-hidden="true" /></a>
          <p className="eyebrow">VOZES QUE AMPLIAM PERSPECTIVAS</p>
          <h1 id="speakers-title">Palestrantes.<br /><span>Ideias que conectam.</span></h1>
          <p className="speakers-intro">Gestão de projetos, liderança e inteligência artificial: perspectivas para aproximar estratégia e execução.</p>
          <div className="hero-actions"><a className="button button-primary" href="/hoje#programacao-hoje">Explore a programação de hoje <ArrowUpRight size={18} aria-hidden="true" /></a><a className="button button-secondary" href="#perfis-ilustrativos">Ver perfis ilustrativos</a></div>
          <p className="fine-print">Participações propostas, não confirmadas. Esta página não anuncia presenças ou afiliações oficiais.</p>
        </div>
      </section>

      <section className="section today-section speakers-content" aria-labelledby="ricardo-title">
        <div className="container">
          <p className="eyebrow">DESTAQUE DO BRIEFING · PARTICIPAÇÃO A CONFIRMAR</p>
          <article className="today-card today-magna speakers-feature" aria-labelledby="ricardo-title">
            <div className="magna-person">
              <div className="rv-avatar" role="img" aria-label="Avatar representativo de Ricardo Vargas, iniciais RV"><span>RV</span><Sparkles aria-hidden="true" /></div>
              <span className="fine-print">AVATAR REPRESENTATIVO · SEM FOTO</span>
              <small>Não foi fornecida fotografia de Ricardo Vargas.</small>
            </div>
            <div className="today-card-content">
              <p className="eyebrow">PALESTRA MAGNA PROPOSTA</p>
              <h2 id="ricardo-title">Ricardo Vargas</h2>
              <p className="today-summary">{ricardoBio}</p>
              <div className="speakers-session">
                <h3>{magna.title}</h3>
                <div className="today-meta"><span><Clock3 size={16} aria-hidden="true" /><time>{magna.start}</time>–<time>{magna.end}</time></span><span><MapPin size={16} aria-hidden="true" />{magna.stage}</span></div>
                <p className="today-summary">{magna.summary}</p>
                <p className="fine-print">Horários, local e participação sujeitos à confirmação.</p>
              </div>
              <div className="today-actions"><a className="button button-primary" href="/hoje#title-magna">Ver palestra na programação <ArrowUpRight size={18} aria-hidden="true" /></a></div>
            </div>
          </article>
          <div id="perfis-ilustrativos" className="speakers-profiles section-light">
            <div className="section-heading"><div><p className="eyebrow">PERSPECTIVAS PARA O ENCONTRO</p><h2>Perfis ilustrativos.<br /><span>Convidados a confirmar.</span></h2></div><p>Os quatro perfis abaixo são ilustrativos, não representam pessoas ou afiliações anunciadas. Nomes, biografias reais e participações ainda não foram confirmados.</p></div>
            <IllustrativeSpeakers />
          </div>
        </div>
      </section>
    </main>
  )
}
