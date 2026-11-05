import { useLocale } from '../i18n/LocaleProvider'

export default function Footer() {
  const { t } = useLocale()
  return (
    <div className="max-w-[1240px] mx-auto px-8">
      <footer className="border-t border-[#2b2e32] pt-7 pb-[43px] flex flex-col min-[851px]:flex-row justify-between text-[12px] text-[#85878d] gap-[9px]">
        <span>{t.footer.project}</span>
        <span>{t.footer.disclaimer}</span>
      </footer>
    </div>
  )
}
