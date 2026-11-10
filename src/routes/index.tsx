import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { ArrowUpRight, CalendarDays, MapPin, MoveRight, Sparkles, Users, Globe2, Check, Plus, Minus } from 'lucide-react'
import TodaySchedule from '../components/TodaySchedule'

export const Route = createFileRoute('/')({ component: SummitPage })

const tracks = [
  { title: 'Inteligência Artificial & PMO do Futuro', subtitle: 'Inteligência que amplia impacto.', description: 'Aplicações práticas, responsabilidade e novas possibilidades da IA para os escritórios de projetos.', icon: '01', pdus: [2, 0, 2] },
  { title: 'Liderança Ágil & Transformação Digital', subtitle: 'Pessoas movem o futuro.', description: 'Comunicação, agilidade e equipes que prosperam em ambientes de mudança e transformação.', icon: '02', pdus: [0, 4, 0] },
  { title: 'Mega Projetos Governamentais & ESG no DF', subtitle: 'Da complexidade à entrega.', description: 'Governança, sustentabilidade e execução para transformar decisões em impacto público.', icon: '03', pdus: [4, 0, 0] },
  { title: 'Gestão Estratégica & Carreira PMP', subtitle: 'Uma visão além do projeto.', description: 'Valor de negócio, estratégia e preparação para o próximo passo da sua carreira e certificação.', icon: '04', pdus: [0, 0, 4] },
]
const agenda = [
  [ ['08:00', 'Credenciamento & café de conexões', 'Encontro de boas-vindas'], ['09:00', 'O futuro é um projeto coletivo', 'Abertura · plenária'], ['10:30', 'IA na prática: da promessa ao valor', 'Inteligência Artificial · painel'], ['13:30', 'Projetos que transformam organizações', 'Gestão de Projetos · casos e debate'], ['15:30', 'Liderar é construir pontes', 'Liderança · workshop'], ['17:00', 'Conexões que continuam', 'Networking · encerramento do dia'] ],
  [ ['08:30', 'Café, ideias e novos encontros', 'Networking'], ['09:00', 'Estratégia em movimento', 'Estratégia e Inovação · plenária'], ['10:30', 'Laboratório de decisões com IA', 'Inteligência Artificial · oficina'], ['13:30', 'Da governança à entrega de valor', 'Gestão de Projetos · painel'], ['15:00', 'O próximo capítulo da sua liderança', 'Liderança · conversa'], ['16:30', 'Compromissos para o futuro', 'Encerramento · plenária'] ],
]
const speakers = [
  { initials: 'GP', role: 'Gestão de projetos', name: 'Quem transforma planos em impacto', bio: 'Perfil de profissional com experiência em portfólios complexos, governança e entrega de valor.', color: 'cyan' },
  { initials: 'LD', role: 'Liderança & pessoas', name: 'Quem inspira novas lideranças', bio: 'Perfil de liderança dedicada ao desenvolvimento de equipes, negociação e cultura de colaboração.', color: 'gold' },
  { initials: 'IA', role: 'Inteligência artificial', name: 'Quem conecta tecnologia e propósito', bio: 'Perfil de especialista em aplicações de IA, ética e transformação dos processos de trabalho.', color: 'blue' },
  { initials: 'EI', role: 'Estratégia & inovação', name: 'Quem enxerga o próximo horizonte', bio: 'Perfil de executivo com atuação em inovação, estratégia e transformação organizacional.', color: 'purple' },
]
const passes = [
  { id: 'member', name: 'Membro PMI DF', price: 490, detail: 'Para membros do capítulo PMI DF. Elegibilidade a verificar na inscrição oficial.', benefits: ['Dois dias de conteúdo', 'Networking e área de exposição', 'Condição especial para membros'] },
  { id: 'general', name: 'Passe Geral Summit', price: 690, detail: 'Para profissionais que querem ampliar repertório e conexões. Benefícios propostos, sujeitos à confirmação.', benefits: ['Dois dias de conteúdo', 'Palestras magnas', 'Feira de negócios e networking', 'Acesso às quatro trilhas'] },
  { id: 'vip', name: 'Passaporte VIP + Masterclass', price: 990, detail: 'Benefícios propostos, sujeitos à confirmação. Certificado e PDUs dependem de participação e aprovação; sem garantia de créditos.', benefits: ['Todos os benefícios do Passe Geral Summit', 'Masterclass e workshops práticos propostos', 'Almoço executivo com palestrantes proposto', 'Certificado especial de participação e PDUs propostos, sujeitos à aprovação'] },
  { id: 'student', name: 'Combo Estudante / Acadêmico', price: 290, detail: 'Para estudantes e acadêmicos. Comprovação de vínculo na inscrição oficial. Benefícios propostos.', benefits: ['Dois dias de conteúdo', 'Networking e área de exposição', 'Condição especial para estudantes e acadêmicos'] },
]
const money = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`

export function SummitPage() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])
  const [day, setDay] = useState(0)
  const [passId, setPassId] = useState('general')
  const [quantity, setQuantity] = useState('1')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [checkoutState, setCheckoutState] = useState<'editing' | 'review' | 'confirmed'>('editing')
  const [checkoutMessage, setCheckoutMessage] = useState('')
  const [selectedTracks, setSelectedTracks] = useState<number[]>([])
  const [submissionMessage, setSubmissionMessage] = useState('')
  const pass = passes.find((item) => item.id === passId)!
  const count = Number(quantity)
  const validQuantity = Number.isInteger(count) && count >= 1 && count <= 10
  const pduVector = selectedTracks.reduce((sum, index) => sum.map((value, category) => value + tracks[index].pdus[category]), [0, 0, 0])
  const totalPdus = pduVector.reduce((sum, value) => sum + value, 0)
  function invalidateCheckout() {
    setCheckoutState('editing')
    setCheckoutMessage('')
  }
  function reviewCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validQuantity || name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !consent) {
      setCheckoutMessage('Informe nome, e-mail válido, quantidade entre 1 e 10 e aceite o consentimento para revisar.')
      return
    }
    setCheckoutState('review')
    setCheckoutMessage('Revise os dados abaixo antes de confirmar a simulação.')
  }
  function confirmCheckout() {
    if (checkoutState !== 'review') return
    setCheckoutState('confirmed')
    setCheckoutMessage('Inscrição SIMULADA confirmada. Nenhuma cobrança foi realizada. Nenhum dado foi enviado ou persistido. Esta simulação não reserva ingresso.')
  }
  function submitWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    if (String(data.get('author')).trim().length < 2 || String(data.get('title')).trim().length < 5 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.get('contact')).trim()) || !data.get('work-consent')) {
      setSubmissionMessage('Preencha nome, e-mail válido, título com pelo menos 5 caracteres e consentimento.')
      return
    }
    setSubmissionMessage('Submissão SIMULADA concluída. Nenhum dado foi enviado ou persistido. Não constitui inscrição de trabalho; chamada oficial e critérios a confirmar.')
    event.currentTarget.reset()
  }

  return (
    <main id="conteudo" tabIndex={-1}>
      <section id="inicio" className="summit-hero" aria-labelledby="hero-title">
        <div className="hero-grid" aria-hidden="true" />
        <div className="container hero-layout">
          <div className="hero-copy">
            <p className="eyebrow"><span className="live-dot" /> BRASÍLIA. O PRÓXIMO HORIZONTE.</p>
            <h1 id="hero-title">PMI SUMMIT<br />{' '}<span>BRASÍLIA</span>{' '}<span className="hero-year">2027</span></h1>
            <p className="hero-headline">Grandes projetos.<br />Novas lideranças.<br /><em>Um futuro em comum.</em></p>
            <p className="hero-description">Uma proposta para o maior encontro de gestão de projetos, liderança e inteligência artificial do Centro-Oeste. Dois dias para ampliar sua visão e transformar conexões em impacto.</p>
            <div className="hero-details"><span><CalendarDays size={18} aria-hidden="true" />18 e 19 de setembro de 2027</span><span><MapPin size={18} aria-hidden="true" />Centro de Convenções Ulysses · Brasília</span></div>
            <p className="fine-print">Data e local propostos, sujeitos à confirmação.</p>
            <div className="hero-actions"><a className="button button-primary" href="#ingressos">Garantir Ingresso <ArrowUpRight size={18} aria-hidden="true" /></a><a className="button button-secondary" href="#programacao">Ver programação <MoveRight size={18} aria-hidden="true" /></a></div>
            <a className="text-link" href="#submissao">Inscrever Trabalho / Palestrante <ArrowUpRight size={15} aria-hidden="true" /></a>
          </div>
          <div className="hero-visual"><div className="edition-label">01 / VISÃO DE FUTURO</div><img src="/assets/brasilia-horizon.svg" alt="Ilustração do Congresso Nacional e da Catedral de Brasília conectados por órbitas" width="720" height="780" /><div className="visual-caption"><span>15°47′ S / 47°53′ O</span><span>A CAPITAL DAS POSSIBILIDADES</span></div></div>
        </div>
        <div className="container hero-benefits"><span><Sparkles aria-hidden="true" size={20} /><b>Até 16 PDUs</b> estimados</span><span><Globe2 aria-hidden="true" size={20} />Preparação para certificações internacionais</span><span><Users aria-hidden="true" size={20} />Networking com propósito</span><a href="#sobre">Explore o encontro <span aria-hidden="true">↓</span></a></div>
      </section>

      <TodaySchedule />

      <section id="sobre" className="section section-light">
        <div className="container about-layout"><div><p className="eyebrow">O ENCONTRO</p><h2>O futuro não acontece.<br /><span>Nós o projetamos.</span></h2></div><div><p className="large-copy">No coração do Brasil, uma comunidade que pensa grande se encontra para fazer a diferença.</p><p>O PMI Summit Brasília conecta profissionais, lideranças, estudantes e organizações em torno de desafios reais. Um espaço para trocar experiências, explorar a IA e fortalecer a gestão de projetos no Centro-Oeste.</p><p>Conteúdo aplicado, conversas relevantes e preparação para sua jornada de desenvolvimento e certificação internacional — sem promessa de aprovação ou certificação concedida.</p><div className="about-stats"><div><strong>02</strong><span>dias de imersão</span></div><div><strong>04</strong><span>trilhas de conhecimento</span></div><div><strong>∞</strong><span>possibilidades de conexão</span></div></div></div></div>
      </section>

      <section id="trilhas" className="section">
        <div className="container"><div className="section-heading"><div><p className="eyebrow">QUATRO CAMINHOS. UM NOVO HORIZONTE.</p><h2>Conhecimento que<br /><span>move você adiante.</span></h2></div><p>Escolha suas perspectivas. Cruze fronteiras. Encontre novas formas de liderar e entregar valor.</p></div><div className="track-grid">{tracks.map((track) => <article className="track-card" key={track.icon}><div className="card-top"><span>{track.icon}</span><ArrowUpRight size={23} aria-hidden="true" /></div><h3>{track.title}</h3><strong>{track.subtitle}</strong><p>{track.description}</p><span className="track-bottom">CONTEÚDO PROPOSTO · 4 PDUs ESTIMADOS</span></article>)}</div></div>
      </section>

      <section id="programacao" className="section section-panel">
        <div className="container agenda-layout"><div><p className="eyebrow">A EXPERIÊNCIA</p><h2>Dois dias.<br /><span>Ideias sem limites.</span></h2><p>Da plenária à conversa no café: cada encontro pode abrir uma nova possibilidade.</p><p className="fine-print">Programação preliminar ilustrativa. Horários, temas e formatos sujeitos à confirmação. Intervalo para almoço entre as sessões da manhã e da tarde.</p><div className="day-switch" role="group" aria-label="Selecionar dia da programação">{['18 SET · DIA 01', '19 SET · DIA 02'].map((label, index) => <button key={label} type="button" aria-pressed={day === index} onClick={() => setDay(index)}>{label}</button>)}</div></div><div className="agenda-list" aria-live="polite" aria-label={`Programação do dia ${day + 1}`}>{agenda[day].map(([time, title, tag]) => <article className="agenda-item" key={title}><time>{time}</time><div><p>{tag}</p><h3>{title}</h3></div><ArrowUpRight size={18} aria-hidden="true" /></article>)}</div></div>
      </section>

      <section className="section section-light" id="convidados"><div className="container"><div className="section-heading"><div><p className="eyebrow">VOZES QUE AMPLIAM PERSPECTIVAS</p><h2>Experiências diferentes.<br /><span>Impacto compartilhado.</span></h2></div><p>Convidados a confirmar. Os quatro perfis abaixo são ilustrativos, não representam pessoas ou afiliações anunciadas.</p></div><div className="speaker-grid">{speakers.map((speaker) => <article className="speaker-card" key={speaker.initials}><div className={`speaker-art ${speaker.color}`} aria-hidden="true"><span>{speaker.initials}</span><div className="speaker-orbit" /><small>PERFIL ILUSTRATIVO</small></div><p className="eyebrow">{speaker.role}</p><h3>{speaker.name}</h3><p>{speaker.bio}</p><span className="fine-print">Convidado a confirmar</span></article>)}</div></div></section>

      <section id="ingressos" className="section"><div className="container"><div className="section-heading"><div><p className="eyebrow">SEU PRÓXIMO PASSO</p><h2>Invista no que<br /><span>vem depois.</span></h2></div><p>Preços exemplificativos, não são uma oferta de venda. Todos os benefícios e condições dependem de confirmação oficial.</p></div><div className="pass-grid">{passes.map((item) => <article className={`pass-card ${passId === item.id ? 'selected' : ''}`} key={item.id}><div className="card-top"><span>{item.id === 'vip' ? 'EXPERIÊNCIA AMPLIADA' : 'PASSE · 2 DIAS'}</span>{passId === item.id && <Check size={20} aria-label="Passe selecionado" />}</div><h3>{item.name}</h3><p className="pass-price">{money(item.price)}<small>/ pessoa</small></p><p>{item.detail}</p><ul>{item.benefits.map((benefit) => <li key={benefit}><Check size={15} aria-hidden="true" />{benefit}</li>)}</ul><button className={`button ${passId === item.id ? 'button-primary' : 'button-secondary'}`} type="button" aria-pressed={passId === item.id} onClick={() => { setPassId(item.id); invalidateCheckout() }}>Selecionar {item.name}</button></article>)}</div>
        <div className="checkout-layout"><div><p className="eyebrow">EXPERIMENTE A JORNADA</p><h3 className="checkout-title">Sua participação<br />começa por aqui.</h3><p>Este formulário é uma demonstração local. Não há pagamento, reserva, envio ou armazenamento de dados. Use dados fictícios.</p><label htmlFor="ticket-quantity">Quantidade de ingressos (1 a 10)</label><div className="quantity-control"><button type="button" aria-label="Diminuir quantidade" disabled={!validQuantity || count <= 1} onClick={() => { setQuantity(String(count - 1)); invalidateCheckout() }}><Minus size={18} aria-hidden="true" /></button><input id="ticket-quantity" type="number" min="1" max="10" step="1" value={quantity} onChange={(event) => { setQuantity(event.target.value); invalidateCheckout() }} /><button type="button" aria-label="Aumentar quantidade" disabled={!validQuantity || count >= 10} onClick={() => { setQuantity(String(count + 1)); invalidateCheckout() }}><Plus size={18} aria-hidden="true" /></button></div><div className="order-total" aria-live="polite"><span>{pass.name} · {validQuantity ? `${count} ingresso(s)` : 'Quantidade inválida'}</span><strong>{validQuantity ? money(pass.price * count) : '—'}</strong><small>Total exemplificativo · sem cobrança</small></div></div>
          <form className="summit-form" noValidate onSubmit={reviewCheckout}>
            <fieldset disabled={!hydrated}>
              <label htmlFor="attendee-name">Nome completo</label><input id="attendee-name" autoComplete="off" value={name} required onChange={(event) => { setName(event.target.value); invalidateCheckout() }} placeholder="Seu nome (use dados fictícios)" />
              <label htmlFor="attendee-email">E-mail</label><input id="attendee-email" type="email" autoComplete="off" required value={email} onChange={(event) => { setEmail(event.target.value); invalidateCheckout() }} placeholder="voce@example.com" />
              <label className="checkbox-label"><input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); invalidateCheckout() }} />Entendo que esta inscrição é simulada, sem cobrança, reserva ou armazenamento de dados.</label>
              <button className="button button-primary" type="submit">Revisar inscrição simulada <MoveRight size={18} aria-hidden="true" /></button>
              <p className="form-message" role="status">{checkoutMessage}</p>
              {checkoutState === 'review' && <div className="review-box"><h4>Revise sua inscrição</h4><p>{name.trim()} · {email.trim()}</p><p>{pass.name} · {count} ingresso(s) · {money(pass.price * count)}</p><p className="fine-print">Alterar qualquer dado exige uma nova revisão.</p><button type="button" className="button button-primary" onClick={confirmCheckout}>Confirmar simulação</button></div>}
            </fieldset>
            <noscript><p className="fine-print">Ative o JavaScript para usar esta simulação local. Sem JavaScript, o formulário permanece desabilitado.</p></noscript>
          </form>
        </div></div></section>

      <section id="pdus" className="section section-panel"><div className="container pdu-layout"><div><p className="eyebrow">DESENVOLVIMENTO CONTÍNUO</p><h2>Conhecimento hoje.<br /><span>Evolução sempre.</span></h2><p>Explore como as trilhas podem contribuir para o PMI Talent Triangle®. Selecione os conteúdos para estimar sua jornada.</p><p className="fine-print">Calculadora ilustrativa. PDUs sujeitos à aprovação, enquadramento das atividades e participação efetiva. Até 16 PDUs estimados; não há promessa de crédito aprovado, certificado ou certificação concedida.</p></div><div className="pdu-calculator"><div className="card-top"><h3>Planeje seus PDUs</h3><button type="button" className="text-link" onClick={() => setSelectedTracks([])}>Limpar seleção</button></div><div className="pdu-options">{tracks.map((track, index) => <label className="checkbox-label" key={track.icon}><input type="checkbox" checked={selectedTracks.includes(index)} onChange={(event) => setSelectedTracks(event.target.checked ? [...selectedTracks, index] : selectedTracks.filter((item) => item !== index))} />{track.title}<span>4 PDUs</span></label>)}</div><div className="pdu-results" aria-live="polite"><div className="pdu-total"><strong>{totalPdus}</strong><span>de até 16<br />PDUs estimados</span></div><dl>{['Ways of Working', 'Power Skills', 'Business Acumen'].map((category, index) => <div key={category}><dt>{category}</dt><dd>{pduVector[index]}</dd></div>)}</dl></div></div></div></section>

      <section id="local" className="section section-light"><div className="container location-layout"><div className="location-art"><img src="/assets/brasilia-horizon.svg" alt="Arquitetura de Brasília em ilustração vetorial" width="720" height="780" /><span>BRASÍLIA / DISTRITO FEDERAL</span></div><div><p className="eyebrow">O CENÁRIO DO NOSSO ENCONTRO</p><h2>No centro do país.<br /><span>No centro da mudança.</span></h2><h3>Centro de Convenções Ulysses</h3><p>Eixo Monumental, Ala Sul, Setor de Divulgação Cultural 5, Brasília – DF, 70070-350.</p><p className="fine-print">Local proposto, sujeito à confirmação. Confira o endereço e planeje seu deslocamento.</p><a className="button button-dark" href="https://www.google.com/maps/search/?api=1&query=Centro+de+Conven%C3%A7%C3%B5es+Ulysses+Guimar%C3%A3es+Bras%C3%ADlia" target="_blank" rel="noopener noreferrer">Abrir no Google Maps <ArrowUpRight size={18} aria-hidden="true" /><span className="sr-only"> (nova aba)</span></a><div className="location-guide"><div><h4>Sua estadia em Brasília</h4><p>Busque hospedagem nos setores Hoteleiro Norte e Sul. Compare distância, acessibilidade e condições diretamente com o hotel. Nenhum hotel parceiro está confirmado.</p></div><div><h4>Além do auditório</h4><p>Uma proposta de jantar de networking para continuar as conexões. Data, local, vagas e valores a confirmar; não incluído nos passes.</p></div></div></div></div></section>

      <section className="section sponsors-section" id="patrocinio"><div className="container"><div className="section-heading"><div><p className="eyebrow">CONSTRUA ESSE FUTURO COM A GENTE</p><h2>Marcas que acreditam.<br /><span>Conexões que ficam.</span></h2></div><p>Cotas de patrocínio propostas. Nenhum patrocinador confirmado ou marca associada a esta demonstração.</p></div><div className="sponsor-grid">{[['Diamante', 'Presença estratégica', 'Maior destaque e experiências de conexão propostas.'], ['Ouro', 'Conexões de valor', 'Visibilidade de marca e ativações propostas.'], ['Prata', 'Faça parte da conversa', 'Presença institucional e exposição propostas.']].map(([tier, title, detail]) => <article key={tier}><span className="eyebrow">COTA {tier}</span><h3>{title}</h3><p>{detail}</p><a className="text-link" href="#submissao">Manifestar interesse <ArrowUpRight size={16} aria-hidden="true" /></a></article>)}</div><div className="support-line"><span>APOIO INSTITUCIONAL PROPOSTO</span><strong>PMI DF</strong><p>Participação e apoio sujeitos à confirmação oficial.</p></div></div></section>

      <section id="submissao" className="section submission-section"><div className="container submission-layout"><div><p className="eyebrow">DO SEU PROJETO PARA O PALCO</p><h2>Compartilhe o que<br /><span>você faz acontecer.</span></h2><p>Tem um caso, uma pesquisa ou uma perspectiva que merece ser compartilhada? Experimente a submissão de trabalho ou manifeste interesse em patrocinar.</p><p className="fine-print">Formulário local simulado. Use dados fictícios. Nenhum dado é enviado ou persistido. Chamada de trabalhos, avaliação, prazos e condições comerciais a confirmar.</p></div>
        <form className="summit-form" noValidate onSubmit={submitWork}>
          <fieldset disabled={!hydrated}>
            <div className="form-row"><div><label htmlFor="work-author">Nome</label><input id="work-author" name="author" required autoComplete="off" /></div><div><label htmlFor="work-contact">E-mail de contato</label><input id="work-contact" name="contact" type="email" required autoComplete="off" /></div></div>
            <label htmlFor="work-kind">Tipo de interesse</label><select id="work-kind" name="kind"><option>Submissão de trabalho</option><option>Palestrante</option><option>Patrocínio Diamante</option><option>Patrocínio Ouro</option><option>Patrocínio Prata</option></select>
            <label htmlFor="work-title">Título do trabalho ou proposta</label><input id="work-title" name="title" required minLength={5} />
            <label htmlFor="work-description">Resumo (opcional)</label><textarea id="work-description" name="description" rows={3} />
            <label className="checkbox-label"><input type="checkbox" name="work-consent" required />Entendo que esta submissão é apenas uma simulação e não será enviada.</label>
            <button className="button button-primary" type="submit">Simular envio de proposta <ArrowUpRight size={18} aria-hidden="true" /></button>
            <p className="form-message" role="status">{submissionMessage}</p>
          </fieldset>
          <noscript><p className="fine-print">Ative o JavaScript para usar esta simulação local. Sem JavaScript, o formulário permanece desabilitado.</p></noscript>
        </form>
      </div></section>
    </main>
  )
}
