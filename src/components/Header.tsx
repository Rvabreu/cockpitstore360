import { useLocale } from '../i18n/LocaleProvider'

export default function Header() {
  const { locale, setLocale, t } = useLocale()
  return (
    <header className="min-h-[79px] border-b border-[#232429] bg-[rgba(9,10,12,.95)] backdrop-blur-[16px] sticky top-0 z-20">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8 min-h-[79px] py-3 flex flex-wrap items-center gap-x-4 gap-y-3">
        <a href="#inicio" className="flex items-center gap-[11px] no-underline">
          <span className="shrink-0 grid place-items-center w-[35px] h-[35px] rounded-[11px] text-[#17100d] bg-[linear-gradient(130deg,#ff956f,#ff4b24)] font-black text-[19px] shadow-[0_0_28px_#ff613c3a]">
            C
          </span>
          <strong className="text-[15px] sm:text-[17px] tracking-[-.6px] whitespace-nowrap">
            COCKPIT <em className="not-italic text-[#ff633b]">STORE</em> 360
          </strong>
        </a>
        <span className="text-[10px] tracking-[1.5px] font-extrabold text-[#ffba9e] bg-[#ff633b12] border border-[#ff633b55] rounded-[40px] px-[11px] py-2">
          {t.header.demo}
        </span>
        <nav aria-label={t.header.navigation} className="hidden min-[851px]:flex flex-wrap gap-4 ml-auto">
          <a href="#colecao" className="text-[13px] text-[#c0c0c5] font-semibold hover:text-white no-underline">
            {t.header.products}
          </a>
          <a href="#pedidos" className="text-[13px] text-[#c0c0c5] font-semibold hover:text-white no-underline">
            {t.header.orders}
          </a>
          <a href="#fluxo" className="text-[13px] text-[#c0c0c5] font-semibold hover:text-white no-underline">
            {t.header.flow}
          </a>
        </nav>
        <img
          src="/assets/logo_ai_cockpit_referencia.svg"
          alt={t.header.logo}
          className="hidden min-[1100px]:block h-[31px] w-[140px] object-contain object-left opacity-90"
        />
        <div role="group" aria-label={t.header.language} className="flex gap-1 ml-auto min-[851px]:ml-0 text-[11px] shrink-0">
          {(['pt-BR', 'es'] as const).map((language) => (
            <button
              key={language}
              type="button"
              aria-pressed={locale === language}
              onClick={() => setLocale(language)}
              className={`px-2 py-2 rounded-lg border ${locale === language ? 'border-[#ff633b] bg-[#ff633b12] text-[#ffba9e]' : 'border-[#38393d] text-[#c0c0c5]'}`}
            >
              {language === 'pt-BR' ? 'PT Português' : 'ES Español'}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
