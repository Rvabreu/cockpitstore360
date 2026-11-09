import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUpRight, Backpack, BookOpen, BrainCircuit, Check, Medal, ShieldCheck, Sparkles, Ticket, Users, Zap } from 'lucide-react'
import {
  BLACK_FRIDAY_OFFERS, OFFER_CATEGORIES, calculateSummary, filterOffers, formatBRL,
  getCountdown, resolveCoupon,
} from '../services/blackFridayOffers'
import type { BlackFridayOffer, Coupon, OfferCategory, OfferSort } from '../services/blackFridayOffers'
import blackFridayCss from '../black-friday.css?url'

export const Route = createFileRoute('/black-friday')({
  component: BlackFridayPage,
  head: () => ({
    meta: [
      { title: 'Black Friday PMI Summit DF | Brasília — Simulação de ofertas' },
      { name: 'description', content: 'Gestão de projetos, liderança e inovação no Centro-Oeste. Explore passaportes, workshops, kits e mentoria PMI Summit DF em uma campanha ilustrativa, sem pagamento.' },
    ],
    links: [{ rel: 'stylesheet', href: blackFridayCss }],
  }),
})

// Original architectural illustration, not an official event or PMI logo.
function BrasiliaArt() {
  return <svg className="bf-brasilia-art" viewBox="0 0 620 640" role="img" aria-label="Ilustração original de Brasília: Congresso Nacional, Catedral e conexões de um evento">
    <circle cx="332" cy="292" r="218" fill="#f2cd7510" stroke="#f2cd7530" />
    <circle cx="332" cy="292" r="179" fill="none" stroke="#92ffc530" strokeDasharray="3 13" />
    <path d="M55 466 332 565 594 466 332 370Z M55 496 332 595 594 496" fill="#172620" stroke="#a8ffb640" />
    <g fill="none" stroke="#f2cd75" strokeWidth="3" strokeLinejoin="round">
      <path d="M244 440V228h34v212m17 0V228h34v212M237 228h99M204 439h168" />
      <path d="M112 426h120m-108-2q48-76 96 0M367 394h127q-62 79-127 0ZM358 439h143" />
      <path d="M410 348q43-51 46-130 5 79 53 130m-91 0q26-55 38-130m0 0q-2 73 44 130M407 352h107" />
    </g>
    <g stroke="#a8ffb6" fill="none" strokeWidth="2">
      <path d="m106 329 77-136 188-43 135 112M150 517l93-52 119 32 164-42" strokeDasharray="5 8" />
      <circle cx="106" cy="329" r="7" /><circle cx="183" cy="193" r="7" /><circle cx="371" cy="150" r="7" /><circle cx="506" cy="262" r="7" />
      <path d="m367 143 4-23 4 23m-19 7h30" />
    </g>
    <text x="94" y="113" fill="#a8ffb6" fontSize="13" letterSpacing="4">CONEXÕES QUE TRANSFORMAM</text>
    <text x="238" y="621" fill="#f2cd75" fontSize="13" letterSpacing="5">BRASÍLIA / DF</text>
  </svg>
}

function OfferArt({ offer }: { offer: BlackFridayOffer }) {
  const Icon = { passport: Ticket, workshop: BrainCircuit, kit: Backpack, mentoring: Users }[offer.art]
  const labels = { passport: ['ACESSO VIP', '02 DIAS / GRANDES IDEIAS'], workshop: ['IA + ÁGIL', 'APRENDER. APLICAR. LIDERAR.'], kit: ['SMART KIT', 'SEU PRÓXIMO PROJETO'], mentoring: ['1 : 1', 'LIDERANÇA COM PROPÓSITO'] }
  return <div className={`bf-offer-art bf-art-${offer.art}`} aria-hidden="true"><span className="bf-art-edition">PMI SUMMIT DF / 2026</span><Icon size={62} strokeWidth={1} /><strong>{labels[offer.art][0]}</strong><span>{labels[offer.art][1]}</span>{offer.art === 'kit' && <div className="bf-kit-icons"><BookOpen size={24} /><Medal size={24} /></div>}</div>
}

export function CampaignCountdown() {
  const [countdown, setCountdown] = useState<ReturnType<typeof getCountdown> | null>(null)
  useEffect(() => {
    const update = () => setCountdown(getCountdown(Date.now()))
    update()
    const interval = window.setInterval(update, 1000)
    return () => window.clearInterval(interval)
  }, [])
  return (
    <div className="bf-countdown">
      <div className="bf-countdown-label"><span className="bf-dot" />{countdown?.ended ? 'Campanha encerrada' : 'Seu próximo capítulo tem hora marcada'}</div>
      <div className="bf-clock" role="timer" aria-label={countdown?.ended ? 'Campanha encerrada' : 'Tempo restante para o fim da campanha'}>
        {(['days', 'hours', 'minutes', 'seconds'] as const).map((unit, index) => (
          <div key={unit}><strong>{countdown ? String(countdown[unit]).padStart(2, '0') : '--'}</strong><span>{['dias', 'horas', 'min', 'seg'][index]}</span></div>
        ))}
      </div>
      <p>Até 30/11/2026, às 23:59:59 (horário de Brasília).</p>
    </div>
  )
}

function OfferCard({ offer, selected, onToggle }: { offer: BlackFridayOffer; selected: boolean; onToggle: () => void }) {
  return (
    <article className={`bf-card bf-card-${offer.art} ${selected ? 'bf-card-selected' : ''}`}>
      <div className="bf-card-media">
        <OfferArt offer={offer} />
        <span className="bf-discount">−{offer.discountPercent}%</span>
      </div>
      <div className="bf-card-content">
        <span className="bf-eyebrow">{offer.category}</span>
        <div className="bf-card-badges">{offer.badges.map((badge) => <span key={badge}><Sparkles size={12} />{badge}</span>)}</div>
        <h3>{offer.name}</h3>
        <p className="bf-description">{offer.description}</p>
        <ul className="bf-benefits">{offer.benefits.map((benefit) => <li key={benefit}><Check size={14} />{benefit}</li>)}</ul>
        <div className="bf-pricing"><span>De <del>{formatBRL(offer.originalCents)}</del></span><span>Por</span><strong>{formatBRL(offer.promotionalCents)}</strong><small>Economize {formatBRL(offer.savingsCents)}</small></div>
        <p className="bf-lot">Lote fictício {offer.lot}</p>
        <button type="button" className={`bf-button ${selected ? 'bf-button-selected' : 'bf-button-secondary'}`} aria-pressed={selected} aria-label={`${selected ? 'Remover' : 'Selecionar'} ${offer.name}`} onClick={onToggle}>
          {selected ? <Check size={16} /> : <Zap size={16} />}{selected ? 'Selecionada · remover' : 'Adicionar à simulação'}
        </button>
      </div>
    </article>
  )
}

export function BlackFridayPage() {
  const [category, setCategory] = useState<OfferCategory>('Todos')
  const [sort, setSort] = useState<OfferSort>('discount')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<Coupon | null>(null)
  const [couponMessage, setCouponMessage] = useState('')
  const offers = filterOffers(category, sort)
  const summary = calculateSummary(selectedIds, coupon)
  const toggleOffer = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  return (
    <main className="bf-page" id="black-friday">
      <div className="bf-container">
        <section className="bf-hero" aria-labelledby="bf-title">
          <div className="bf-hero-art"><BrasiliaArt /></div>
          <div className="bf-hero-copy">
            <div className="bf-eyebrow"><span className="bf-dot" />BRASÍLIA / DF · EDIÇÃO ILUSTRATIVA 2026</div>
            <h1 id="bf-title">BLACK FRIDAY{' '}<br /><span>PMI SUMMIT DF</span></h1>
            <p className="bf-hero-slogan">Grandes projetos.<br />Novas conexões. <em>Mais impacto.</em></p>
            <p>Gestão de projetos, liderança e inovação no Centro-Oeste.<br />O seu próximo capítulo começa em Brasília/DF.</p>
            <div className="bf-hero-actions"><a href="#ofertas" className="bf-button bf-button-primary">Explorar ofertas <ArrowDown size={16} /></a><a href="#simulacao" className="bf-button bf-button-secondary">Simular economia <ArrowUpRight size={16} /></a></div>
            <div className="bf-hero-note"><ShieldCheck size={14} />Campanha ilustrativa. Nenhuma compra será realizada.</div>
          </div>
          <div className="bf-hero-stamp" aria-label="Até 40% de desconto nas ofertas"><span>ATÉ</span><strong>40<small>%</small></strong><span>OFF / NA SELEÇÃO</span></div>
          <span className="bf-hero-caption">ARTE ORIGINAL INSPIRADA EM BRASÍLIA · NÃO É LOGO OFICIAL</span>
        </section>

        <div className="bf-campaign-strip">
          <div className="bf-strip-copy"><Zap size={25} /><div><strong>O ponto de encontro de quem faz acontecer.</strong><p>4 experiências para conectar conhecimento, pessoas e propósito.</p></div></div>
          <CampaignCountdown />
        </div>

        <section className="bf-offers" id="ofertas" aria-labelledby="bf-offers-title">
          <div className="bf-section-heading"><div><span className="bf-eyebrow">INVISTA NO SEU PRÓXIMO CAPÍTULO</span><h2 id="bf-offers-title">Sua próxima grande <span>conexão.</span></h2><p>Do congresso à mentoria. Benefícios, preços e lotes ilustrativos, com economia transparente.</p></div><span className="bf-outline-tag">{BLACK_FRIDAY_OFFERS.length} ofertas selecionadas</span></div>
          <div className="bf-filters">
            <div className="bf-category-filters" role="group" aria-label="Filtrar por categoria">{OFFER_CATEGORIES.map((item) => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)} className={category === item ? 'bf-category-active' : ''}>{item}</button>)}</div>
            <div className="bf-filter-options"><label className="bf-sort">Ordenar por<select value={sort} onChange={(event) => setSort(event.target.value as OfferSort)}><option value="discount">Maior desconto (%)</option><option value="savings">Maior economia (R$)</option><option value="price">Menor preço</option></select></label></div>
          </div>
          <p className="bf-result-count" role="status">{offers.length} {offers.length === 1 ? 'oferta encontrada' : 'ofertas encontradas'}</p>
          <div className="bf-card-grid">{offers.map((offer) => <OfferCard key={offer.id} offer={offer} selected={selectedIds.includes(offer.id)} onToggle={() => toggleOffer(offer.id)} />)}</div>
        </section>

        <section className="bf-simulation" id="simulacao" aria-labelledby="bf-summary-title">
          <div className="bf-simulation-copy"><span className="bf-eyebrow">MAIS CONHECIMENTO. MENOS NO PREÇO.</span><h2 id="bf-summary-title">Planeje seu investimento.<br /><span>Simule sua economia.</span></h2><p>Selecione uma unidade de cada oferta e acompanhe os valores em tempo real. Cada combo ou kit conta como uma seleção.</p><div className="bf-coupon-tip"><Ticket size={24} /><div><strong>Uma vantagem a mais para sua comunidade.</strong><p><b>PMIDF20</b> · 20% extra para membros/filiados PMI DF.<br /><b>SUMMIT360</b> · 15% extra para congressistas/grupos corporativos.<br />Sobre o subtotal promocional. Um cupom por vez, não cumulativos.</p></div></div><p className="bf-disclaimer">Simulação sem validação de filiação ou elegibilidade. Ofertas, benefícios (inclusive PDUs), lotes e preços são ilustrativos, sem vínculo com condições oficiais do evento. Os filtros não removem ofertas já selecionadas. Esta página não reserva vagas ou estoque, gera pedidos ou processa pagamentos, mesmo após o encerramento da campanha.</p></div>
          <aside className="bf-summary" aria-label="Resumo da simulação">
            <div className="bf-summary-heading"><h3>Seu próximo capítulo, em números.</h3><span>{summary.offers.length} {summary.offers.length === 1 ? 'oferta' : 'ofertas'}</span></div>
            {summary.offers.length === 0 ? <p className="bf-summary-empty">Sua seleção começa nas ofertas acima.</p> : <ul className="bf-selected-list">{summary.offers.map((offer) => <li key={offer.id}><div><strong>{offer.name}</strong><small>1 {offer.category === 'Combos' ? 'kit' : 'unidade'} · {formatBRL(offer.promotionalCents)}</small></div><button type="button" aria-label={`Remover ${offer.name} do resumo`} onClick={() => toggleOffer(offer.id)}>Remover</button></li>)}</ul>}
            <form className="bf-coupon-form" onSubmit={(event) => { event.preventDefault(); const next = resolveCoupon(couponInput); setCoupon(next); setCouponMessage(next ? `Cupom ${next.code} simulado: ${next.percent}% de desconto extra, sem validação de elegibilidade.` : 'Cupom inválido. Use PMIDF20 ou SUMMIT360. Nenhum desconto de cupom aplicado.') }}>
              <label htmlFor="bf-coupon">Cupom de desconto</label><div><input id="bf-coupon" value={couponInput} placeholder="PMIDF20 ou SUMMIT360" aria-describedby="bf-coupon-help bf-coupon-message" onChange={(event) => { setCouponInput(event.target.value); if (coupon) { setCoupon(null); setCouponMessage('Cupom alterado. Aplique novamente para simular; desconto removido.') } }} /><button type="submit" className="bf-button bf-button-secondary">Aplicar</button></div>
              <small id="bf-coupon-help">Não cumulativo. Sobre o subtotal promocional. Filiação e elegibilidade não são validadas.</small>
              <p id="bf-coupon-message" role="status" className={coupon ? 'bf-coupon-success' : ''}>{couponMessage}</p>
            </form>
            <dl className="bf-totals"><div><dt>Preço original</dt><dd>{formatBRL(summary.originalCents)}</dd></div><div><dt>Subtotal promocional</dt><dd>{formatBRL(summary.subtotalCents)}</dd></div><div><dt>Cupom{coupon ? ` ${coupon.code} (${coupon.percent}%)` : ''}</dt><dd>− {formatBRL(summary.couponDiscountCents)}</dd></div><div className="bf-total"><dt>Total simulado</dt><dd>{formatBRL(summary.totalCents)}</dd></div></dl>
            <div className="bf-total-saving"><Sparkles size={17} />Economia total <strong>{formatBRL(summary.savingsCents)}</strong></div>
            <p className="bf-summary-note"><ShieldCheck size={14} />Demonstração sem checkout ou pagamento.</p>
          </aside>
        </section>
        <section className="bf-closing"><span className="bf-eyebrow">PMI SUMMIT DF / BRASÍLIA</span><h2>Conexões hoje. <span>Impacto amanhã.</span></h2><p>Projetos que movem o Centro-Oeste. Líderes que constroem o futuro.</p><a href="#ofertas" className="bf-button bf-button-secondary">Voltar às ofertas <ArrowUpRight size={16} /></a></section>
      </div>
    </main>
  )
}
