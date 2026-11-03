import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ArrowRight, Check, LockKeyhole, SlidersHorizontal, Sparkles, Zap } from 'lucide-react'
import { useAuth } from '../context/auth'
import { useStore } from '../context/useStore'
import { SESSION_ERROR } from '../services/authService'
import { CAMPAIGN_END, INITIAL_FILTERS, comboFor, couponSaving, formatCents, promotionFor, selectPromotions } from '../services/blackFridayPromotions'
import type { PromotionSort } from '../services/blackFridayPromotions'
import '../components/BlackFriday.css'
import '../components/BlackFridayPromotions.css'

export const Route = createFileRoute('/promocoes-black-friday')({
  head: () => ({ meta: [{ title: 'Promoções Black Friday | COCKPIT STORE 360' }] }),
  component: BlackFridayPromotionsPage,
})

export function BlackFridayPromotionsPage() {
  const { products } = useStore()
  const { user, loading, pending, error, refresh } = useAuth()
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [sort, setSort] = useState<PromotionSort>('discount')
  const [now, setNow] = useState<number | null>(null)
  const [couponProduct, setCouponProduct] = useState('')
  const [simulation, setSimulation] = useState<'coupon' | 'combo' | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const ended = now !== null && now >= CAMPAIGN_END
  const active = now !== null && !ended
  const visible = selectPromotions(products, filters, sort)
  const categories = [...new Set(products.map((product) => product.category))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const flashProducts = products.filter((product) => promotionFor(product).flash)
  const selectedProduct = products.find((product) => product.id === couponProduct)
  const saving = selectedProduct ? couponSaving(selectedProduct) : 0
  const combo = comboFor(products)
  const sessionBusy = loading || pending !== null
  const sessionFailed = error === SESSION_ERROR
  const vipUnlocked = Boolean(user) && !loading && !sessionFailed
  const reset = () => { setFilters(INITIAL_FILTERS); setSort('discount') }
  const seconds = now === null ? null : Math.max(0, Math.ceil((CAMPAIGN_END - now) / 1000))
  const time = seconds === null ? '— dias · —:—:—' : `${Math.floor(seconds / 86400)} dias · ${[Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60].map((n) => String(n).padStart(2, '0')).join(':')}`

  return <main className="bf-page bfp-page">
    <div className="bf-ribbon"><Sparkles size={14} aria-hidden="true" /> BLACK EDITION / OFERTAS E BENEFÍCIOS DEMONSTRATIVOS</div>
    <section className="bfp-intro" aria-labelledby="promotions-title">
      <a href="/black-friday" className="bf-text-link">Black Friday / campanha e passe VIP <ArrowRight size={16} aria-hidden="true" /></a>
      <div className="bfp-intro-grid"><div><p className="bf-eyebrow">SUA CURADORIA. SEU UPGRADE.</p><h1 id="promotions-title">Mais possibilidades.<br /><span>Menos no preço.</span></h1><p>Explore todas as promoções Black Friday. Encontre o seu essencial entre preços Black, ofertas relâmpago e acesso VIP.</p></div><div className="bfp-seal"><span>BLACK FRIDAY</span><strong>ATÉ 60%</strong><b>OFF / EDIÇÃO 2026</b></div></div>
      <p className="bf-fine">Catálogo, preços, estoque, popularidade e ofertas relâmpago fictícios. Sem compra, reserva, cobrança ou checkout.</p>
    </section>
    <section className="bfp-flash" aria-labelledby="flash-title">
      <div><p className="bf-eyebrow"><Zap size={14} aria-hidden="true" /> FLASH DEALS / SIMULAÇÃO</p><h2 id="flash-title">{ended ? 'Ofertas relâmpago encerradas.' : 'O tempo faz parte da oferta.'}</h2><p>Seleção relâmpago fictícia: {flashProducts.length ? flashProducts.map((product) => product.name).join(' + ') : 'nenhuma oferta configurada'}.</p><p>Prazo único: 28/11/2026, 00h · Brasília. Sem renovação automática.</p></div>
      <div className="bfp-flash-clock"><strong aria-label="Tempo restante das ofertas relâmpago">{time}</strong><span>{now === null ? 'Calculando prazo…' : ended ? 'Campanha encerrada · benefícios indisponíveis' : 'Prazo da campanha demonstrativa'}</span></div>
    </section>
    <section className="bfp-catalog" aria-labelledby="catalog-title">
      <div className="bf-section-heading"><div><p className="bf-eyebrow">O CATÁLOGO COMPLETO. DO SEU JEITO.</p><h2 id="catalog-title">Todas as promoções.</h2></div><SlidersHorizontal size={22} aria-hidden="true" /></div>
      <div className="bfp-filters">
        <label htmlFor="bfp-category">Categoria<select id="bfp-category" value={filters.category} onChange={(event) => setFilters((old) => ({ ...old, category: event.target.value }))}><option value="">Todas as categorias</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label htmlFor="bfp-discount">Faixa de desconto<select id="bfp-discount" value={filters.discount} onChange={(event) => setFilters((old) => ({ ...old, discount: event.target.value }))}><option value="">Todos os descontos</option><option value="under50">De 0% a menos de 50%</option><option value="50plus">50% ou mais</option></select></label>
        <label htmlFor="bfp-sort">Ordenar por<select id="bfp-sort" value={sort} onChange={(event) => setSort(event.target.value as PromotionSort)}><option value="discount">Maior desconto</option><option value="price">Menor preço Black</option><option value="popular">Mais populares (fictício)</option></select></label>
        <fieldset><legend>Tipo de oferta</legend><label><input type="checkbox" checked={filters.flash} onChange={(event) => setFilters((old) => ({ ...old, flash: event.target.checked }))} /> Ofertas relâmpago</label><label><input type="checkbox" checked={filters.vip} onChange={(event) => setFilters((old) => ({ ...old, vip: event.target.checked }))} /> Exclusivas VIP</label></fieldset>
      </div>
      <div className="bfp-results"><p role="status" aria-live="polite">{visible.length} de {products.length} produtos exibidos</p><button type="button" onClick={reset}>Limpar filtros e ordenação</button></div>
      <div className="bfp-session">{loading ? <p role="status">Verificando sessão VIP…</p> : vipUnlocked ? <p role="status"><Check size={16} aria-hidden="true" /> Passe VIP ativo · ofertas exclusivas liberadas.</p> : <p>Visitante: <a href="/black-friday#passe-vip">Ativar passe VIP</a> ou <a href="/login?returnTo=%2Fpromocoes-black-friday">Entrar com senha ou Google</a>. Qualquer login libera o VIP.</p>}
        {sessionFailed && <div role="alert" className="bf-alert">{SESSION_ERROR} <button type="button" disabled={sessionBusy} onClick={() => void refresh()}>Verificar sessão novamente</button></div>}
      </div>
      {ended && <p className="bf-alert" role="status">Campanha encerrada. Preços e economias abaixo são históricos fictícios; cupons, combos e ofertas não estão ativos.</p>}
      {visible.length === 0 ? <div className="bfp-empty"><h3>Nenhuma oferta nesta combinação.</h3><p>Tente outra categoria ou remova um filtro.</p><button className="bf-button" type="button" onClick={reset}>Ver todo o catálogo</button></div> : <div className="bf-grid" aria-label="Produtos filtrados">{visible.map((product) => {
        const offer = promotionFor(product)
        const locked = offer.vip && !vipUnlocked
        return <article className={`bf-card ${offer.vip ? 'bf-card-vip' : ''}`} key={product.id} aria-label={product.name}>
          <div className="bf-card-image" role="img" aria-label={product.name} style={{ backgroundImage: `url(${product.image.split('#')[0]})`, backgroundPosition: offer.crop }}><span className="bf-sale">{offer.discount ? `−${offer.discount}%` : '0% · CATÁLOGO'}</span>{offer.vip && <span className="bf-vip-tag"><LockKeyhole size={12} aria-hidden="true" /> EXCLUSIVO VIP</span>}</div>
          <div className="bf-card-body"><p className="bf-eyebrow">{product.category}</p><h3>{product.name}</h3><p className="bf-product-description">{product.description}</p>
            {offer.flash && <p className="bfp-flash-tag"><Zap size={13} aria-hidden="true" /> {ended ? 'Relâmpago encerrada' : 'Oferta relâmpago fictícia'}</p>}
            <div className="bf-price"><span>Original fictício</span><del>{formatCents(offer.originalCents)}</del><span>{ended ? 'Preço Black histórico' : 'Preço Black Friday'}{offer.vip ? ' VIP' : ''}</span><strong>{formatCents(offer.priceCents)}</strong><span>Economia {formatCents(offer.savingCents)} · {offer.discount}% OFF</span></div>
            <div className="bf-stock">{offer.stock !== null && offer.total !== null ? <><span>Estoque fictício: <b>{offer.stock} de {offer.total} unidades</b></span><meter min={0} max={offer.total} value={offer.stock} aria-label={`Estoque fictício de ${product.name}`} /></> : <span>Sem estoque promocional simulado.</span>}</div>
            <p className="bf-fine">{offer.popularity === null ? 'Popularidade não simulada.' : `Popularidade fictícia: ${offer.popularity} pontos (não são vendas).`}</p>
            {ended ? <div className="bf-card-action bfp-ended">Oferta encerrada</div> : loading && offer.vip ? <div className="bf-card-action bf-locked" role="status">Verificando acesso VIP…</div> : locked ? <a href="/black-friday#passe-vip" className="bf-card-action bf-locked"><LockKeyhole size={15} aria-hidden="true" /> Desbloquear oferta VIP</a> : <div className="bf-card-action bf-unlocked"><Check size={16} aria-hidden="true" /> {offer.vip ? 'Oferta VIP liberada' : 'Oferta pública · demonstração'}</div>}
          </div>
        </article>
      })}</div>}
    </section>
    <section className="bfp-benefits" aria-labelledby="benefits-title"><div className="bf-section-heading"><div><p className="bf-eyebrow">UM EXTRA NO SEU UPGRADE</p><h2 id="benefits-title">Cupons & combos.</h2></div></div><p className="bf-fine">Simulações locais, sem carrinho ou pedido. Válidos somente até o prazo da campanha. Não cumulativos entre si.</p>
      <div className="bfp-benefit-grid">
        <article className="bfp-benefit" aria-labelledby="coupon-title"><span className="bf-pass-badge">CUPOM DEMONSTRATIVO</span><h3 id="coupon-title">BLACK10</h3><p>10% extra no preço Black de um produto público, mínimo de R$ 300,00 e desconto máximo de R$ 50,00. Uma unidade por simulação. Não vale para produtos VIP ou combos. Arredondamento ao centavo mais próximo.</p><label htmlFor="coupon-product">Produto para simular<select id="coupon-product" value={couponProduct} onChange={(event) => { setCouponProduct(event.target.value); setSimulation(null) }}><option value="">Selecione um produto</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label>
          <button type="button" className="bf-button" disabled={!active || !selectedProduct} onClick={() => setSimulation('coupon')}>Simular cupom BLACK10</button>
          {simulation === 'coupon' && active && selectedProduct && <p role="status" className="bfp-simulation">{saving ? `Simulação: subtotal Black ${formatCents(promotionFor(selectedProduct).priceCents)} − cupom ${formatCents(saving)} = ${formatCents(promotionFor(selectedProduct).priceCents - saving)}. Sem compra ou reserva.` : 'Cupom não aplicável: selecione um produto público com preço Black de pelo menos R$ 300,00.'}</p>}
          {!active && <p className="bf-fine">{ended ? 'Cupom encerrado.' : 'Verificando prazo da campanha…'}</p>}
        </article>
        <article className="bfp-benefit" aria-labelledby="combo-title"><span className="bf-pass-badge">COMBO DEMONSTRATIVO / VIP</span><h3 id="combo-title">Dupla de som.</h3><p>Uma unidade Orbit Headphones Pro + uma Wave Mini Speaker. 5% extra sobre a soma dos preços Black; não combina com BLACK10. Requer passe VIP porque inclui Wave. Arredondamento ao centavo mais próximo.</p>
          {combo ? <div className="bfp-combo-price"><span>Soma original: {formatCents(combo.originalCents)}</span><span>Soma Black: {formatCents(combo.subtotalCents)}</span><span>Extra combo: −{formatCents(combo.extraSavingCents)}</span><strong>{formatCents(combo.priceCents)}</strong><span>Economia total: {formatCents(combo.savingCents)}</span></div> : <p className="bf-fine">Combo indisponível: os dois produtos precisam estar no catálogo.</p>}
          <button type="button" className="bf-button" disabled={!active || !combo || sessionBusy || sessionFailed || (combo.vip && !vipUnlocked)} onClick={() => setSimulation('combo')}>Simular combo VIP</button>
          {simulation === 'combo' && active && vipUnlocked && combo && <p role="status" className="bfp-simulation">Simulação VIP: {formatCents(combo.priceCents)} pela dupla. Nenhum pedido, cobrança ou reserva foi criado.</p>}
          {ended ? <p className="bf-fine">Combo encerrado.</p> : !vipUnlocked && <a href="/black-friday#passe-vip" className="bf-text-link">Ativar VIP para simular o combo <ArrowRight size={15} aria-hidden="true" /></a>}
        </article>
      </div>
    </section>
    <div className="bf-endnote"><span>BLACK FRIDAY / CATÁLOGO COMPLETO</span><p>Experiência fictícia. Benefícios não representam autorização comercial.</p><a href="/black-friday">Voltar à campanha <ArrowRight size={14} aria-hidden="true" /></a></div>
  </main>
}
