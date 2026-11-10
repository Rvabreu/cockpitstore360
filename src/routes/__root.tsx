import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { Compass } from 'lucide-react'
import Footer from '../components/Footer'
import Header from '../components/Header'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'PMI Summit Brasília | Conferência de Gestão, Inovação e Liderança',
      },
      { name: 'description', content: 'Conheça o PMI Summit Brasília: gestão de projetos, liderança, inovação e inteligência artificial. Explore trilhas, programação, inscrições e simule até 16 PDUs.' },
      { name: 'theme-color', content: '#27103d' },
      { property: 'og:title', content: 'PMI Summit Brasília | Projetos que transformam o futuro' },
      { property: 'og:description', content: 'Gestão de projetos, liderança e IA se encontram em Brasília. Confira a proposta de programação e planeje sua participação.' },
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: 'pt_BR' },
    ],
    links: [
      { rel: 'icon', type: 'image/svg+xml', href: '/assets/pmi-summit-favicon.svg' },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
})

function NotFound() {
  return (
    <main id="conteudo" className="container not-found">
      <Compass size={48} aria-hidden="true" />
      <h1>
        Página não encontrada
      </h1>
      <p>
        A rota que você tentou acessar não existe ou foi movida.
      </p>
      <Link
        to="/"
        className="button button-primary"
      >
        Voltar ao Summit
      </Link>
    </main>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        <Header />
        {children}
        <Footer />
        <Scripts />
      </body>
    </html>
  )
}
