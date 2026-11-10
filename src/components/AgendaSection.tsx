import { useState } from 'react'
import {
  Award,
  Calendar,
  Coffee,
  Filter,
  Printer,
  Sparkles,
  Users,
  Utensils,
} from 'lucide-react'
import { EDITORIAL_AXES, EVENT_METADATA, SCHEDULE_ITEMS } from '../data/eventData'

type FilterMode = 'all' | 'sessions' | 'breaks' | 'ways-of-working' | 'power-skills' | 'business-acumen'

export default function AgendaSection() {
  const [activeFilter, setActiveFilter] = useState<FilterMode>('all')

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  const filteredItems = SCHEDULE_ITEMS.filter((item) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'sessions') return item.category === 'session' || item.category === 'ceremony'
    if (activeFilter === 'breaks') return item.isBreak
    if (activeFilter === 'ways-of-working') return item.axisId === 'ways-of-working'
    if (activeFilter === 'power-skills') return item.axisId === 'power-skills'
    if (activeFilter === 'business-acumen') return item.axisId === 'business-acumen'
    return true
  })

  const getBreakIcon = (title: string) => {
    if (title.includes('Almoço')) return <Utensils className="w-4 h-4" aria-hidden="true" />
    if (title.includes('Happy Hour')) return <Sparkles className="w-4 h-4" aria-hidden="true" />
    if (title.includes('Networking') || title.includes('Capítulos')) {
      return <Users className="w-4 h-4" aria-hidden="true" />
    }
    return <Coffee className="w-4 h-4" aria-hidden="true" />
  }

  return (
    <section id="agenda" className="py-12 sm:py-16">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8">
        {/* Header of Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="text-[#ff916c] font-extrabold tracking-[2.4px] uppercase text-[11px] mb-2">
              GRADE DE HORÁRIOS COMPLETA
            </div>
            <h2 className="text-[28px] sm:text-[36px] font-black tracking-[-1.2px] text-white">
              Programação Preliminar do Evento
            </h2>
            <p className="text-[14px] text-[#a4a7b2] mt-2 max-w-[650px]">
              Todos os 13 blocos do dia organizados em ordem cronológica com horários, temas,
              intervalos de conexão e eixos editoriais de referência.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 self-start md:self-auto">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#171a22] border border-[#343844] text-[12px] text-[#ff9c7a]">
              <Calendar className="w-4 h-4 text-[#ff875a]" aria-hidden="true" />
              <span>{EVENT_METADATA.dateDisclaimer}</span>
            </div>
            <button
              type="button"
              onClick={handlePrint}
              className="no-print inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#3e424c] bg-[#1a1c22] hover:bg-[#252831] text-white font-bold text-[12px] transition"
            >
              <Printer className="w-4 h-4 text-[#ff875a]" aria-hidden="true" />
              Imprimir
            </button>
          </div>
        </div>

        {/* Filter Tabs / Controls */}
        <div
          role="region"
          aria-label="Filtros da grade"
          className="no-print mb-8 p-1.5 rounded-2xl bg-[#111317] border border-[#272a33] flex flex-wrap gap-1.5 items-center"
        >
          <div className="px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#797d8a] flex items-center gap-1.5 hidden sm:flex">
            <Filter className="w-3.5 h-3.5" aria-hidden="true" />
            Filtrar:
          </div>

          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition ${
              activeFilter === 'all'
                ? 'bg-[#ff633b] text-[#160c08] shadow-md'
                : 'text-[#a9acb5] hover:text-white hover:bg-[#1a1c22]'
            }`}
          >
            Todos os blocos (13)
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('sessions')}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition ${
              activeFilter === 'sessions'
                ? 'bg-white text-[#121418] shadow-md'
                : 'text-[#a9acb5] hover:text-white hover:bg-[#1a1c22]'
            }`}
          >
            Palestras & Sessões (8)
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('breaks')}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition ${
              activeFilter === 'breaks'
                ? 'bg-[#2a2d36] text-[#ff9c7a] border border-[#ff633b40]'
                : 'text-[#a9acb5] hover:text-white hover:bg-[#1a1c22]'
            }`}
          >
            Intervalos & Networking (5)
          </button>

          <span className="hidden lg:inline-block w-px h-5 bg-[#2a2c33] mx-1" />

          <button
            type="button"
            onClick={() => setActiveFilter('ways-of-working')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition ${
              activeFilter === 'ways-of-working'
                ? 'bg-[#57d4a5] text-[#062419]'
                : 'text-[#57d4a5] hover:bg-[#57d4a514]'
            }`}
          >
            Ways of Working
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('power-skills')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition ${
              activeFilter === 'power-skills'
                ? 'bg-[#ff875a] text-[#240b03]'
                : 'text-[#ff875a] hover:bg-[#ff633b14]'
            }`}
          >
            Power Skills
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('business-acumen')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition ${
              activeFilter === 'business-acumen'
                ? 'bg-[#60a5fa] text-[#081e3d]'
                : 'text-[#60a5fa] hover:bg-[#60a5fa14]'
            }`}
          >
            Business Acumen
          </button>
        </div>

        {/* Schedule List */}
        <div className="space-y-4 print-page" aria-label="Lista de horários e palestras">
          {filteredItems.map((item) => {
            const axis = item.axisId ? EDITORIAL_AXES[item.axisId] : null

            // Distinguish breaks from sessions
            if (item.isBreak) {
              return (
                <article
                  key={item.id}
                  className="print-card print-card-break border border-dashed border-[#443831] bg-[#141211] rounded-2xl p-5 sm:p-6 transition hover:border-[#634b3f]"
                  aria-label={`Intervalo: ${item.title}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-[#291e17] text-[#ff875a] flex-shrink-0">
                        {getBreakIcon(item.title)}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <time
                            dateTime={`${item.startTime}/${item.endTime}`}
                            className="font-mono text-[14px] sm:text-[15px] font-black text-[#ff9c7a] tracking-tight"
                          >
                            {item.timeRange}
                          </time>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#ff633b1f] text-[#ff9c7a] border border-[#ff633b40]">
                            {item.badgeLabel}
                          </span>
                        </div>
                        <h3 className="text-[17px] sm:text-[18px] font-bold text-[#f2ede9]">
                          {item.title}
                        </h3>
                      </div>
                    </div>
                  </div>
                  <p className="mt-2.5 text-[13px] leading-[1.6] text-[#b8ada6] sm:pl-12">
                    {item.description}
                  </p>
                </article>
              )
            }

            // Ceremony (item 12: Premiação PMO do Ano)
            if (item.category === 'ceremony') {
              return (
                <article
                  key={item.id}
                  className="print-card border border-[#eab30855] bg-[linear-gradient(135deg,#1f1a0e_0%,#13120c_100%)] rounded-2xl p-6 sm:p-7 shadow-lg shadow-[#eab30810]"
                  aria-label={`Cerimônia: ${item.title}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="p-3 rounded-xl bg-[#ca8a0426] text-[#facc15] flex-shrink-0">
                        <Award className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <time
                            dateTime={`${item.startTime}/${item.endTime}`}
                            className="font-mono text-[15px] sm:text-[16px] font-black text-[#facc15] tracking-tight"
                          >
                            {item.timeRange}
                          </time>
                          <span className="text-[10px] uppercase font-extrabold tracking-wider px-2.5 py-0.5 rounded-full bg-[#ca8a0422] text-[#facc15] border border-[#facc1555]">
                            {item.badgeLabel}
                          </span>
                        </div>
                        <h3 className="text-[19px] sm:text-[21px] font-black text-white">
                          {item.title}
                        </h3>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] leading-[1.65] text-[#d6d0ba] sm:pl-14">
                    {item.description}
                  </p>
                </article>
              )
            }

            // Standard Technical / Leadership Session
            return (
              <article
                key={item.id}
                className="print-card border border-[#282c36] bg-[#12141a] rounded-2xl p-6 sm:p-7 transition hover:border-[#3d4352] hover:bg-[#14171f]"
                aria-label={`Palestra: ${item.title}`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="font-mono text-[11px] font-bold text-[#717684] bg-[#191c24] border border-[#2b2f3a] rounded-lg px-2.5 py-1.5 flex-shrink-0 mt-0.5">
                      Bloco #{String(item.index).padStart(2, '0')}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                        <time
                          dateTime={`${item.startTime}/${item.endTime}`}
                          className="font-mono text-[15px] sm:text-[16px] font-black text-white tracking-tight"
                        >
                          {item.timeRange}
                        </time>
                        {axis && (
                          <span
                            className={`text-[10px] uppercase font-extrabold tracking-wider px-2.5 py-0.5 rounded-full border ${axis.borderBadge} ${axis.bgBadge} ${axis.colorBadge}`}
                          >
                            {axis.title} ({axis.subtitle})
                          </span>
                        )}
                        <span className="text-[10px] font-semibold text-[#8b8f9c] bg-[#1a1d25] px-2 py-0.5 rounded border border-[#292c36]">
                          {item.badgeLabel}
                        </span>
                      </div>
                      <h3 className="text-[18px] sm:text-[20px] font-extrabold text-white leading-snug">
                        {item.title}
                      </h3>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-[13px] sm:text-[14px] leading-[1.65] text-[#a4a8b4] sm:pl-16">
                  {item.description}
                </p>

                {axis && (
                  <div className="mt-4 pt-3.5 border-t border-[#21242d] flex flex-wrap items-center justify-between gap-2 text-[11px] sm:pl-16 text-[#7d8290]">
                    <span>
                      Classificação editorial:{' '}
                      <strong className="text-[#c7cad4]">{axis.title}</strong> — {axis.description}
                    </span>
                    <span className="italic text-[#9ca1af]">Sem atribuição oficial de PDUs</span>
                  </div>
                )}
              </article>
            )
          })}
        </div>

        {/* Empty state if filter yields zero */}
        {filteredItems.length === 0 && (
          <div className="text-center py-12 p-6 rounded-2xl bg-[#14161c] border border-[#2d313c]">
            <p className="text-[15px] text-[#a5a8b5] mb-3">Nenhum bloco encontrado para o filtro selecionado.</p>
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className="px-4 py-2 rounded-xl bg-[#ff633b] text-[#160c08] font-bold text-[12px]"
            >
              Exibir todos os 13 blocos
            </button>
          </div>
        )}

        {/* Print note */}
        <div className="mt-8 p-4 rounded-xl bg-[#15171d] border border-[#2c2f38] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[12px] text-[#9ca0ab]">
          <span>
            💡 <strong>Dica de impressão:</strong> Utilize a opção de impressão do seu navegador para gerar
            uma versão em página limpa e compacta da grade horária.
          </span>
          <button
            type="button"
            onClick={handlePrint}
            className="no-print font-bold text-[#ff9c7a] hover:text-white transition whitespace-nowrap self-start sm:self-auto"
          >
            Imprimir agora →
          </button>
        </div>
      </div>
    </section>
  )
}
