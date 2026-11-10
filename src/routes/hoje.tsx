import { createFileRoute } from '@tanstack/react-router'
import TodaySchedule from '../components/TodaySchedule'

export const Route = createFileRoute('/hoje')({
  head: () => ({ meta: [
    { title: 'Programação de hoje | PMI Summit Brasília' },
    { name: 'description', content: 'Explore a programação de hoje em Brasília, a palestra magna proposta de Ricardo Vargas e sua agenda local. Informações e PDUs sujeitos à confirmação.' },
    { property: 'og:title', content: 'Programação de hoje | PMI Summit Brasília' },
    { property: 'og:description', content: 'Planeje seu dia com palestras, painéis e conexões. Programação fornecida para esta experiência, sujeita à confirmação.' },
  ] }),
  component: TodayPage,
})

export function TodayPage() {
  return <main id="conteudo" tabIndex={-1}><TodaySchedule standalone /></main>
}
