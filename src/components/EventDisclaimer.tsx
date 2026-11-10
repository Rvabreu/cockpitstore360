import { AlertTriangle, Info } from 'lucide-react'
import { EVENT_METADATA } from '../data/eventData'

export default function EventDisclaimer() {
  return (
    <aside
      aria-label="Aviso de proposta preliminar"
      className="bg-[#181410] border-b border-[#3d2417] text-[#e8c6b2] text-[13px] py-3 px-4 relative z-10"
    >
      <div className="max-w-[1240px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start md:items-center gap-2.5">
          <span className="flex-shrink-0 mt-0.5 md:mt-0 p-1 rounded-md bg-[#ff633b26] text-[#ff805d]">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
          </span>
          <div>
            <strong className="text-white font-semibold mr-2">
              Proposta Preliminar Não Oficial:
            </strong>
            <span>
              Grade e horários são um protótipo editorial. Data de referência:{' '}
              <span className="font-bold text-white underline decoration-[#ff633b]">
                {EVENT_METADATA.referenceDate}
              </span>
              . Sem concessão de PDUs nem afiliação formal com o PMI.
            </span>
          </div>
        </div>
        <a
          href="#sobre"
          className="inline-flex items-center gap-1 text-[12px] font-bold text-[#ff9c7a] hover:text-white transition whitespace-nowrap self-start md:self-auto"
        >
          <Info className="w-3.5 h-3.5" aria-hidden="true" />
          Ver detalhes e ressalvas
        </a>
      </div>
    </aside>
  )
}
