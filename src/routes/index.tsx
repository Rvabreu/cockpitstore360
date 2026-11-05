import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useStore } from '../context/useStore'
import ProductCard from '../components/ProductCard'
import OrderTimeline from '../components/OrderTimeline'
import { normalizeOrderId } from '../services/storeService'
import { searchFeedback, useLocale, type SearchFeedback } from '../i18n/LocaleProvider'

export const Route = createFileRoute('/')({
  component: StorefrontPage,
})

type Mode = 'before' | 'after'

export function StorefrontPage() {
  const { t, translateData, formatCurrency } = useLocale()
  const flowNodes = [
    { marker: '01', title: 'Lens', subtitle: t.flow.context },
    { marker: '02', title: 'Intelligent Requirements', subtitle: t.flow.requirements },
    { marker: '03', title: 'Jira / BusinessMap', subtitle: t.flow.backlog },
    { marker: '04', title: 'Reasoning', subtitle: t.flow.implementation },
    { marker: '05', title: 'Bitbucket', subtitle: t.flow.versioning },
    { marker: '06', title: 'Smart Engineering', subtitle: t.flow.documentation },
    { marker: '07', title: 'Lens', subtitle: t.flow.updatedContext },
    { marker: '✓', title: t.flow.cycle, subtitle: t.flow.knowledge, highlight: true },
  ]
  const { products, order, advanceOrder, getOrder } = useStore()
  const [mode, setMode] = useState<Mode>('before')
  const [searchValue, setSearchValue] = useState('CS-2048')
  const [feedback, setFeedback] = useState<SearchFeedback>({ key: 'initial', ok: false })

  const isLastStep = order.currentStep >= order.events.length - 1
  const statusBadge = translateData(mode === 'before' ? 'Pedido confirmado' : order.statusLabel)
  const stateExplanation =
    mode === 'before'
      ? t.demo.beforeExplanation
      : t.demo.afterExplanation

  const handleAdvance = () => {
    if (mode !== 'after') return
    void advanceOrder('CS-2048')
  }

  const handleSearch = async () => {
    const value = normalizeOrderId(searchValue)
    const result = await getOrder(value)
    setFeedback(searchFeedback(result))
  }

  const handleContact = () => {
    window.alert(t.order.contactAlert)
  }

  return (
    <main id="inicio">
      {/* Hero */}
      <section className="pt-[64px] pb-[30px]">
        <div className="max-w-[1240px] mx-auto px-8">
          <div
            className="min-h-[406px] border border-[#303034] rounded-[28px] overflow-hidden flex items-center relative"
            style={{
              backgroundImage:
                "linear-gradient(90deg,#101114 1%,rgba(16,17,20,.97) 27%,rgba(16,17,20,.08) 71%),url('/assets/hero_produtos.svg')",
              backgroundPosition: 'right center',
              backgroundSize: 'cover',
              backgroundRepeat: 'no-repeat',
            }}
          >
            <div className="px-6 sm:px-[58px] py-[60px] max-w-[650px] relative z-[2]">
              <div className="text-[#ff916c] font-extrabold tracking-[2.6px] uppercase text-[11px]">
                {t.hero.eyebrow}
              </div>
              <h1 className="text-[clamp(37px,4.2vw,62px)] tracking-[-2.8px] leading-[1.05] my-[18px]">
                {t.hero.title}
                <br />
                <span className="text-[#ff9c7a]">{t.hero.accent}</span>
              </h1>
              <p className="leading-[1.6] text-[#c0c2c7] text-[16px] max-w-[470px]">
                {t.hero.description}
              </p>
              <div className="flex flex-wrap gap-3 mt-[30px]">
                <a
                  href="#pedidos"
                  className="px-[18px] py-[13px] rounded-[12px] border border-[#ff633b] bg-[#ff633b] text-[#160c08] font-bold text-[13px] transition hover:-translate-y-px no-underline"
                >
                  {t.hero.track}
                </a>
                <a
                  href="#colecao"
                  className="px-[18px] py-[13px] rounded-[12px] border border-[#474a51] bg-[#ffffff08] text-white font-bold text-[13px] transition hover:-translate-y-px no-underline"
                >
                  {t.hero.explore}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Catálogo */}
      <section className="py-10" id="colecao">
        <div className="max-w-[1240px] mx-auto px-8">
          <div className="flex flex-wrap items-end justify-between mb-[23px] gap-5">
            <div>
              <div className="text-[#ff916c] font-extrabold tracking-[2.6px] uppercase text-[11px]">
                {t.catalog.eyebrow}
              </div>
              <h2 className="text-[31px] tracking-[-1.2px] my-2">{t.catalog.title}</h2>
              <p className="text-[#abaeb6] text-[14px] leading-[1.6] m-0 max-w-[670px]">
                {t.catalog.description}
              </p>
            </div>
            <span className="inline-flex text-[#ffb69d] border border-[#ff714545] bg-[#ff643b12] px-[10px] py-[6px] rounded-[40px] text-[11px] font-semibold whitespace-nowrap">
              {t.catalog.badge}
            </span>
          </div>
          <div className="grid grid-cols-1 min-[851px]:grid-cols-3 gap-[17px]">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* Pedidos — demo panel */}
      <section className="pt-[35px] pb-[70px]" id="pedidos">
        <div className="max-w-[1240px] mx-auto px-8">
          <div className="flex flex-col min-[851px]:flex-row min-[851px]:items-end min-[851px]:justify-between gap-5">
            <div>
              <div className="text-[#ff916c] font-extrabold tracking-[2.6px] uppercase text-[11px]">
                {t.order.eyebrow}
              </div>
              <h2 className="text-[35px] tracking-[-1.5px] my-[9px]">
                {t.order.title} <span className="text-[#ff9c7a]">{t.order.accent}</span>
              </h2>
              <p className="text-[#abaeb6] text-[14px] leading-[1.6] m-0 max-w-[670px]">
                {t.order.description}
              </p>
            </div>
            <div
              className="flex items-center gap-[6px] border border-[#38393d] bg-[#15171a] p-[5px] rounded-[14px] w-full min-[851px]:w-auto"
              role="group"
              aria-label={t.order.selectMode}
            >
              <button
                type="button"
                onClick={() => setMode('before')}
                aria-pressed={mode === 'before'}
                className={`border-0 rounded-[10px] px-4 py-[11px] text-[12px] font-extrabold ${
                  mode === 'before' ? 'bg-white text-[#121212]' : 'bg-transparent text-[#b7b8be]'
                }`}
              >
                {t.order.before}
              </button>
              <button
                type="button"
                onClick={() => setMode('after')}
                aria-pressed={mode === 'after'}
                className={`border-0 rounded-[10px] px-4 py-[11px] text-[12px] font-extrabold ${
                  mode === 'after' ? 'bg-white text-[#121212]' : 'bg-transparent text-[#b7b8be]'
                }`}
              >
                {t.order.after}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 min-[851px]:grid-cols-[1.14fr_.86fr] gap-[19px] mt-[25px]">
            {/* Order card */}
            <div className="bg-[#131519] border border-[#2b2d33] rounded-[22px] p-[29px]">
              <div className="flex flex-wrap justify-between items-start gap-[15px] pb-5 border-b border-[#34363a]">
                <div>
                  <div className="text-[#a4a6ae] text-[11px] font-extrabold uppercase tracking-[1.4px]">
                    {t.order.details}
                  </div>
                  <div className="text-[33px] font-extrabold tracking-[-1.5px] my-[7px]">#{order.id}</div>
                  <div className="text-[#a9abb2] text-[12px]">{t.order.purchase} {order.placedAt} • {t.order.total} {formatCurrency(order.total)}</div>
                </div>
                <span className="border border-[#ff6c3d55] bg-[#ff6c3d17] text-[#ffac90] px-3 py-[9px] rounded-[40px] text-[12px] font-extrabold whitespace-nowrap">
                  {statusBadge}
                </span>
              </div>

              <div className="flex gap-[14px] py-[18px] border-b border-[#323438] items-center">
                <div
                  className="shrink-0 w-[62px] h-[62px] rounded-[12px] border border-[#373a3d]"
                  style={{
                    backgroundImage: "url('/assets/hero_produtos.svg')",
                    backgroundPosition: '92% 22%',
                    backgroundSize: '270%',
                  }}
                />
                <div>
                  <h4 className="m-0 mb-1 text-[13px]">{translateData(order.productName)}</h4>
                  <p className="m-0 text-[#a6a8af] text-[12px]">{order.quantity} {order.quantity === 1 ? t.order.unit : t.order.units} • {translateData(order.variant)}</p>
                </div>
              </div>

              {mode === 'before' ? (
                <div className="p-[24px] bg-[#201917] border border-dashed border-[#835441] rounded-[15px] mt-[22px]">
                  <div className="text-[31px] mb-[10px]">◌</div>
                  <strong className="text-[18px]">{t.order.received}</strong>
                  <p className="text-[#e1bbac] leading-[1.7] text-[13px]">
                    {t.order.contactDescription}
                  </p>
                  <button
                    type="button"
                    onClick={handleContact}
                    className="px-[18px] py-[13px] rounded-[12px] border border-[#474a51] bg-[#ffffff08] text-white font-bold text-[13px] transition hover:-translate-y-px"
                  >
                    {t.order.contact}
                  </button>
                </div>
              ) : (
                <div className="pt-[19px]">
                  <div className="text-[#a4a6ae] text-[11px] font-extrabold uppercase tracking-[1.4px] flex items-center">
                    <span className="inline-block w-2 h-2 bg-[#6ee7b7] rounded-full shadow-[0_0_10px_#6ee7b740] mr-[6px]" />
                    {t.order.timeline}
                  </div>
                  <OrderTimeline events={order.events} />
                  <div className="mt-[11px] border-t border-[#333] pt-[18px] flex items-center justify-between gap-4">
                    <p className="text-[#aab0b9] text-[12px] m-0">
                      {t.order.update}
                    </p>
                    <span className="inline-flex text-[#ffb69d] border border-[#ff714545] bg-[#ff643b12] px-[10px] py-[6px] rounded-[40px] text-[11px] font-semibold whitespace-nowrap">
                      {t.order.selfService}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Side aside */}
            <aside className="bg-[#101113] border border-[#2b2d33] rounded-[22px] p-[29px]">
              <div className="flex items-center gap-4">
                <div className="w-[42px] h-[42px] rounded-[13px] grid place-items-center bg-[#ff613d21] text-[#ff805d] text-[21px]">
                  ↗
                </div>
                <div>
                  <div className="text-[#a4a6ae] text-[11px] font-extrabold uppercase tracking-[1.4px]">
                    {t.demo.eyebrow}
                  </div>
                  <h3 className="text-[21px] tracking-[-.5px] my-[5px]">
                    {t.demo.title}
                    <br />
                    {t.demo.accent}
                  </h3>
                </div>
              </div>

              <p className="text-[#a8abb2] text-[12px] leading-[1.7]">{stateExplanation}</p>

              <div className="grid grid-cols-2 gap-[9px] mt-5">
                <div className="p-[14px] rounded-[13px] bg-[#1b1d21] border border-[#333]">
                  <b className="block text-white text-[19px]">1</b>
                  <small className="text-[#a9acb2] text-[11px]">{t.demo.pain}</small>
                </div>
                <div className="p-[14px] rounded-[13px] bg-[#1b1d21] border border-[#333]">
                  <b className="block text-white text-[19px]">1</b>
                  <small className="text-[#a9acb2] text-[11px]">{t.demo.story}</small>
                </div>
              </div>

              <div className="rounded-[17px] border border-[#34363b] p-[21px] mt-[17px] bg-[#1a1d20]">
                <h4 className="m-0 mb-[9px] text-[14px]">{t.demo.simulator}</h4>
                <p className="text-[#a4a7af] text-[12px] leading-[1.7]">
                  {t.demo.instructions}
                </p>
                <button
                  type="button"
                  onClick={handleAdvance}
                  disabled={mode !== 'after'}
                  className="w-full px-[18px] py-[13px] rounded-[12px] border border-[#ff633b] bg-[#ff633b] text-[#160c08] font-bold text-[13px] transition hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {isLastStep ? t.demo.restart : t.demo.advance}
                </button>

                <div className="mt-[15px] text-[#a4a6ae] text-[11px] font-extrabold uppercase tracking-[1.4px]">
                  {t.demo.searchTitle}
                </div>
                <div className="flex gap-2 mt-[13px]">
                  <input
                    aria-label={t.demo.orderNumber}
                    value={searchValue}
                    placeholder={t.demo.placeholder}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="w-full min-w-0 bg-[#101115] border border-[#393b3f] rounded-[10px] text-white p-3 text-[12px]"
                  />
                  <button
                    type="button"
                    onClick={handleSearch}
                    className="px-[15px] py-[11px] rounded-[12px] border border-[#474a51] bg-[#212327] text-white font-bold text-[13px] whitespace-nowrap transition hover:-translate-y-px"
                  >
                    {t.demo.search}
                  </button>
                </div>
                <p
                  aria-live="polite"
                  className={`text-[12px] leading-[1.7] mt-3 ${feedback.ok ? 'text-[#64dfb0]' : 'text-[#a8abb2]'}`}
                >
                  {'key' in feedback ? t.feedback[feedback.key] : feedback.message}
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Fluxo */}
      <section className="pt-[35px] pb-[80px]" id="fluxo">
        <div className="max-w-[1240px] mx-auto px-8">
          <div className="text-[#ff916c] font-extrabold tracking-[2.6px] uppercase text-[11px]">
            {t.flow.eyebrow}
          </div>
          <h2 className="text-[34px] tracking-[-1.4px] mt-2 mb-3">{t.flow.title}</h2>
          <p className="text-[#abaeb6] text-[14px] leading-[1.6] m-0 mb-[22px] max-w-[670px]">
            {t.flow.description}
          </p>
          <div className="grid grid-cols-2 min-[851px]:grid-cols-4 gap-[11px]">
            {flowNodes.map((node) => (
              <div
                key={`${node.marker}-${node.subtitle}`}
                className={`min-w-0 break-words border rounded-[15px] p-5 min-h-[115px] ${
                  node.highlight ? 'border-[#ff74446a] bg-[#ff633b12]' : 'border-[#34363b] bg-[#15171a]'
                }`}
              >
                <i className="not-italic text-[#ff633b] text-[21px]">{node.marker}</i>
                <strong className="block mt-[11px] mb-[5px] text-[14px]">{node.title}</strong>
                <small className="text-[#a5a7ae] text-[11px] leading-[1.4]">{node.subtitle}</small>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
