import { Briefcase, Compass, Layers, Users } from 'lucide-react'
import { EDITORIAL_AXES, EVENT_METADATA } from '../data/eventData'

export default function EditorialAxesSection() {
  const axesList = [
    {
      ...EDITORIAL_AXES['ways-of-working'],
      icon: Layers,
      highlight: 'Ágil, Preditivo & IA',
      sessionsCount: '3 palestras',
    },
    {
      ...EDITORIAL_AXES['power-skills'],
      icon: Users,
      highlight: 'Liderança & Negociação',
      sessionsCount: '1 palestra',
    },
    {
      ...EDITORIAL_AXES['business-acumen'],
      icon: Briefcase,
      highlight: 'Estratégia, PMO & ESG',
      sessionsCount: '3 palestras',
    },
  ]

  return (
    <section id="eixos" className="py-12 border-b border-[#1f2229]">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[#ff916c] font-extrabold tracking-[2.4px] uppercase text-[11px] mb-2">
              ORGANIZAÇÃO TEMÁTICA
            </div>
            <h2 className="text-[28px] sm:text-[34px] font-black tracking-[-1.2px] text-white">
              Eixos Editoriais de Conteúdo
            </h2>
          </div>
          <span className="text-[12px] text-[#9ca0ab] max-w-[400px]">
            Classificação editorial para estruturar a jornada de aprendizado durante o evento.
          </span>
        </div>

        {/* Editorial Disclaimer Banner */}
        <div className="p-4 rounded-xl bg-[#161820] border border-[#2d313c] mb-8 text-[12px] text-[#b8bac4] flex items-start gap-3">
          <Compass className="w-4 h-4 text-[#ff875a] flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <strong className="text-white mr-1">Aviso de Classificação Editorial:</strong>
            {EVENT_METADATA.axesEditorialNotice}
          </div>
        </div>

        {/* 3 Axes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {axesList.map((axis) => {
            const Icon = axis.icon
            return (
              <div
                key={axis.id}
                className="bg-[#12141a] border border-[#2b2e37] rounded-2xl p-6 sm:p-7 flex flex-col justify-between hover:border-[#3d4250] transition relative overflow-hidden"
              >
                <div
                  className="absolute top-0 right-0 w-32 h-32 pointer-events-none rounded-full blur-2xl opacity-10"
                  style={{
                    backgroundColor:
                      axis.id === 'ways-of-working'
                        ? '#57d4a5'
                        : axis.id === 'power-skills'
                          ? '#ff633b'
                          : '#60a5fa',
                  }}
                />

                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center ${axis.bgBadge} ${axis.colorBadge} border ${axis.borderBadge}`}
                    >
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <span
                      className={`text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-full border ${axis.borderBadge} ${axis.bgBadge} ${axis.colorBadge}`}
                    >
                      {axis.sessionsCount}
                    </span>
                  </div>

                  <span className="text-[12px] font-bold text-[#8e929e] block mb-1">
                    {axis.subtitle}
                  </span>
                  <h3 className="text-[20px] font-black text-white mb-3 tracking-tight">
                    {axis.title}
                  </h3>

                  <p className="text-[13px] leading-[1.65] text-[#a4a7b2] mb-4">
                    {axis.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#232630] flex items-center justify-between text-[11px]">
                  <span className="text-[#848792]">Foco principal:</span>
                  <span className="font-semibold text-white">{axis.highlight}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
