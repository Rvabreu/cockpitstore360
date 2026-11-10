import { createFileRoute } from '@tanstack/react-router'
import EventDisclaimer from '../components/EventDisclaimer'
import HeroSection from '../components/HeroSection'
import AboutSection from '../components/AboutSection'
import EditorialAxesSection from '../components/EditorialAxesSection'
import AgendaSection from '../components/AgendaSection'
import FaqSection from '../components/FaqSection'

export const Route = createFileRoute('/')({
  component: EventOnePage,
})

function EventOnePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <EventDisclaimer />
      <main id="conteudo-principal" className="flex-1 focus:outline-none">
        <HeroSection />
        <AboutSection />
        <EditorialAxesSection />
        <AgendaSection />
        <FaqSection />
      </main>
    </div>
  )
}
