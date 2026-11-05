import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { dictionaries, ptBR, type Dictionary, type Locale } from './dictionaries'

export const LOCALE_STORAGE_KEY = 'store360-locale'

type LocaleContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Dictionary
}

// Standalone components keep their existing Portuguese contract.
const LocaleContext = createContext<LocaleContextValue>({ locale: 'pt-BR', setLocale: () => {}, t: ptBR })

export function LocaleProvider({ children }: { children: ReactNode }) {
  // SSR and the first client render must never inspect browser preferences.
  const [locale, setLocale] = useState<Locale>('pt-BR')
  const [preferenceLoaded, setPreferenceLoaded] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY)
      if (saved === 'pt-BR' || saved === 'es') setLocale(saved)
    } catch {
      // Storage can be blocked; switching languages still works in memory.
    }
    setPreferenceLoaded(true)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
    if (!preferenceLoaded) return
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    } catch {
      // Persistence is optional, not a prerequisite for rendering.
    }
  }, [locale, preferenceLoaded])

  return <LocaleContext.Provider value={{ locale, setLocale, t: dictionaries[locale] }}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const context = useContext(LocaleContext)
  return {
    ...context,
    translateData: (value: string): string =>
      Object.prototype.hasOwnProperty.call(context.t.data, value)
        ? context.t.data[value as keyof Dictionary['data']]
        : value,
    formatCurrency: (value: number): string =>
      new Intl.NumberFormat(context.locale, { style: 'currency', currency: 'BRL' }).format(value),
  }
}

export type SearchFeedback = { key: keyof Dictionary['feedback']; ok: boolean } | { message: string; ok: boolean }

export function searchFeedback(result: { message: string; ok: boolean }): SearchFeedback {
  for (const key of ['found', 'notFound'] as const) {
    if (result.message === ptBR.feedback[key]) return { key, ok: result.ok }
  }
  return result
}
