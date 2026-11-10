import { useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { FAQ_ITEMS } from '../data/eventData'

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx)
  }

  return (
    <section id="faq" className="py-12 border-b border-[#1f2229]">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8">
        <div className="mb-8">
          <div className="text-[#ff916c] font-extrabold tracking-[2.4px] uppercase text-[11px] mb-2">
            TRANSPARÊNCIA & CONFORMIDADE
          </div>
          <h2 className="text-[28px] sm:text-[34px] font-black tracking-[-1.2px] text-white">
            Perguntas Frequentes & Esclarecimentos
          </h2>
          <p className="text-[14px] text-[#a4a7b2] mt-2 max-w-[650px]">
            Tire dúvidas sobre o escopo preliminar, isenção de afiliação e uso deste protótipo.
          </p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndex === idx
            return (
              <div
                key={item.question}
                className="rounded-2xl border border-[#2b2e37] bg-[#12141a] overflow-hidden transition"
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left text-[15px] sm:text-[16px] font-bold text-white hover:text-[#ff9c7a] transition focus:outline-none focus:ring-2 focus:ring-[#ff633b]"
                  aria-expanded={isOpen}
                >
                  <span className="flex items-center gap-3">
                    <HelpCircle className="w-4 h-4 text-[#ff875a] flex-shrink-0" aria-hidden="true" />
                    {item.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-[#8c909c] transition-transform duration-200 flex-shrink-0 ${
                      isOpen ? 'rotate-180 text-[#ff875a]' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-[13px] sm:text-[14px] leading-[1.7] text-[#a8abb6] border-t border-[#1f2229]">
                    {item.answer}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
