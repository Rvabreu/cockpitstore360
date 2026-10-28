import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { PackageX } from 'lucide-react'
import Footer from '../components/Footer'
import Header from '../components/Header'
import { AuthProvider } from '../context/useAuth'

import appCss from '../styles.css?url'

// R3-2: dark-only port. Hard-force dark unconditionally — no localStorage read,
// no auto/light/matchMedia branch. suppressHydrationWarning on <html> keeps SSR
// and client markup in sync (resolves the original hydration-mismatch warning).
const THEME_INIT_SCRIPT = `(function(){try{var root=document.documentElement;root.classList.add('dark');root.style.colorScheme='dark';}catch(e){}})();`

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
        title: 'COCKPIT STORE 360 | Demo AI Cockpit',
      },
    ],
    links: [
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
    <main className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#17191d] text-[#ff633b] flex items-center justify-center mx-auto mb-6 border border-[#2a2c31]">
        <PackageX className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight text-[#f7f7f8]">
        Página não encontrada
      </h1>
      <p className="mt-3 text-sm text-[#a6a9b1]">
        A rota que você tentou acessar não existe ou foi movida.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 mt-8 px-5 py-2.5 rounded-xl bg-[#ff633b] text-[#160c08] font-bold text-sm transition hover:-translate-y-0.5 no-underline"
      >
        Voltar à loja
      </Link>
    </main>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="font-sans antialiased min-h-screen bg-[#08090b] text-[#f7f7f8] selection:bg-[#ff633b]/20">
        <AuthProvider>
          <Header />
          {children}
          <Footer />
        </AuthProvider>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
