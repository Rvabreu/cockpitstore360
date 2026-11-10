import { AlertCircle, FileText, Info, ShieldCheck } from 'lucide-react'
import { EVENT_METADATA } from '../data/eventData'

export default function AboutSection() {
  return (
    <section id="sobre" className="py-12 border-b border-[#1f2229]">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="text-[#ff916c] font-extrabold tracking-[2.4px] uppercase text-[11px] mb-2">
              CONTEXTO & DIRETRIZES
            </div>
            <h2 className="text-[28px] sm:text-[34px] font-black tracking-[-1.2px] text-white">
              Sobre esta proposta preliminar
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-[#21242d] text-[#c3c6d1] border border-[#373a46] self-start md:self-auto">
            <Info className="w-3.5 h-3.5 text-[#ff875a]" aria-hidden="true" />
            Transparência e conformidade
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Natureza do Protótipo */}
          <div className="bg-[#12141a] border border-[#2b2e37] rounded-2xl p-6 sm:p-7 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#ff633b1f] text-[#ff875a] flex items-center justify-center mb-4">
                <FileText className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-[18px] font-bold text-white mb-2.5">
                Estrutura Preliminar de Evento
              </h3>
              <p className="text-[13px] leading-[1.65] text-[#a4a7b2]">
                Este site funciona como uma demonstração interativa de grade para um evento temático de
                gestão de projetos. A distribuição em 13 blocos cobre desde a recepção matinal até o happy
                hour de encerramento, equilibrando temas técnicos, competências humanas e governança corporativa.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-[#232630] text-[11px] text-[#ff9c7a] font-semibold">
              ✓ Proposta aprovada para avaliação conceitual
            </div>
          </div>

          {/* Card 2: Ressalvas Institucionais e PDUs */}
          <div className="bg-[#12141a] border border-[#ff633b33] rounded-2xl p-6 sm:p-7 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#ef44441c] text-[#f87171] flex items-center justify-center mb-4">
                <AlertCircle className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-[18px] font-bold text-white mb-2.5">
                Independência & Isenção de Vínculos
              </h3>
              <p className="text-[13px] leading-[1.65] text-[#a4a7b2]">
                Não há afiliação formal, licenciamento, homologação ou patrocínio oficial do PMI (Project
                Management Institute). Este rascunho não concede créditos de educação contínua (PDUs) nem
                emite certificados de horas oficiais.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-[#232630] text-[11px] text-[#ef4444] font-semibold">
              ⚠️ Sem concessão de PDUs ou chancela institucional
            </div>
          </div>

          {/* Card 3: Metodologias & Práticas */}
          <div className="bg-[#12141a] border border-[#2b2e37] rounded-2xl p-6 sm:p-7 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#57d4a51f] text-[#57d4a5] flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-[18px] font-bold text-white mb-2.5">
                Pluralidade Metodológica
              </h3>
              <p className="text-[13px] leading-[1.65] text-[#a4a7b2]">
                {EVENT_METADATA.methodologyNotice} As discussões estimulam abordagens práticas que
                harmonizam processos preditivos, ágeis, OKRs e ferramentas de síntese visual de acordo com a
                necessidade de cada iniciativa.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-[#232630] text-[11px] text-[#57d4a5] font-semibold">
              ✓ Liberdade metodológica sem padrões obrigatórios
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
