import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowDown, ArrowLeft, ArrowUpRight } from 'lucide-react'
import ProductCard from '../components/ProductCard'
import { useStore } from '../context/useStore'

export const Route = createFileRoute('/black-friday')({
  component: BlackFridayPage,
  head: () => ({
    meta: [
      { title: 'Black Friday | COCKPIT STORE 360' },
      { name: 'description', content: 'Explore a seleção Black Friday da COCKPIT STORE 360. Uma campanha ilustrativa de tecnologia com produtos fictícios e valores demonstrativos.' },
    ],
  }),
})

const focusClass = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffb69d]'

function BlackFridayPage() {
  const { products } = useStore()
  const featuredProduct = products.find((product) => product.id === 'prod-orbit') ?? products[0]

  return (
    <main id="black-friday" className="overflow-hidden">
      <section aria-labelledby="campaign-title" className="relative border-b border-[#ff633b30] bg-[radial-gradient(ellipse_at_90%_20%,#ff633b1c,transparent_55%)]">
        <div aria-hidden="true" className="absolute -left-20 top-40 h-96 w-96 rounded-full border border-[#ff633b15]" />
        <div className="relative max-w-[1240px] mx-auto px-4 sm:px-8 pt-8 pb-12 lg:pt-12 lg:pb-20">
          <Link to="/" hash="inicio" className={`inline-flex min-h-11 items-center gap-2 rounded-lg text-sm text-[#b9bbc2] hover:text-white no-underline ${focusClass}`}>
            <ArrowLeft size={16} aria-hidden="true" /> Voltar à loja
          </Link>
          <div className="grid gap-10 lg:grid-cols-[1.25fr_.75fr] lg:gap-16 items-center mt-8">
            <div>
              <p className="text-[#ffac90] font-bold text-[11px] uppercase tracking-[3px] mb-6">Store 360 / Edição especial</p>
              <h1 id="campaign-title" className="text-[clamp(58px,9vw,112px)] font-black uppercase tracking-[-.065em] leading-[.88] m-0">
                Black<br /><span className="text-[#ff7954]">Friday.</span>
              </h1>
              <p className="text-2xl sm:text-3xl font-semibold tracking-[-1px] mt-7 mb-4 max-w-lg">Seu próximo setup começa aqui.</p>
              <p className="text-[#b9bbc2] text-sm sm:text-base leading-7 max-w-[490px]">Som, conexão e movimento. Explore uma seleção de tecnologia em uma experiência feita para inspirar.</p>
              <a href="#catalogo-black-friday" className={`inline-flex min-h-12 items-center justify-center gap-4 rounded-xl bg-[#ff7954] px-6 py-4 mt-7 text-[#190d09] text-sm font-extrabold no-underline hover:bg-[#ff9c7a] ${focusClass}`}>
                Explorar seleção <ArrowDown size={18} aria-hidden="true" />
              </a>
              <p className="text-[#a6a9b1] text-xs leading-5 mt-5 max-w-[460px]">Campanha ilustrativa. Produtos fictícios e valores demonstrativos, sem descontos ou venda real.</p>
            </div>
            {featuredProduct && (
              <aside aria-label="Destaque da campanha" className="relative rounded-[28px] border border-[#ff795460] bg-[#ff633b0a] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <span className="text-[11px] font-extrabold uppercase tracking-[2px] text-[#ffac90]">Em destaque</span>
                  <span className="text-[10px] rounded-full border border-[#ff633b55] px-3 py-1.5 text-[#ffc4af]">Seleção ilustrativa</span>
                </div>
                <ProductCard product={featuredProduct} variant="campaign" />
                <a href="#catalogo-black-friday" className={`flex min-h-12 items-center justify-between gap-3 px-2 mt-3 rounded-lg font-semibold text-sm text-[#ffb69d] no-underline hover:text-white ${focusClass}`}>
                  Ver no catálogo <ArrowUpRight size={18} aria-hidden="true" />
                </a>
              </aside>
            )}
          </div>
        </div>
      </section>

      <div aria-hidden="true" className="bg-[#ff7954] text-[#190d09] py-4 px-4 text-center font-black text-[11px] sm:text-sm tracking-[2px] uppercase">
        Mais som. Mais conexão. Mais você.
      </div>

      <section id="catalogo-black-friday" aria-labelledby="catalog-title" className="max-w-[1240px] mx-auto px-4 sm:px-8 py-14 sm:py-20 scroll-mt-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-8">
          <div>
            <p className="text-[#ffac90] font-bold text-[11px] uppercase tracking-[2.6px] mb-3">O seu próximo favorito</p>
            <h2 id="catalog-title" className="text-3xl sm:text-4xl tracking-[-1.4px] font-bold mb-4">Tecnologia em boa companhia.</h2>
            <p className="text-[#b9bbc2] text-sm leading-6 max-w-[620px]">Catálogo ilustrativo com os valores atuais da loja. Todos os preços são demonstrativos; esta página não oferece descontos nem realiza compras.</p>
          </div>
          <span className="self-start shrink-0 rounded-full border border-[#3b3d44] px-4 py-2 text-[11px] text-[#b9bbc2]">{products.length} produtos fictícios</span>
        </div>
        <div className="grid grid-cols-1 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3 gap-5">
          {products.map((product) => <ProductCard key={product.id} product={product} variant="campaign" />)}
        </div>
        {products.length === 0 && <p className="text-[#b9bbc2] py-6">Nenhum produto disponível para exibir nesta demonstração.</p>}
      </section>

      <section aria-labelledby="journey-title" className="max-w-[1240px] mx-auto px-4 sm:px-8 pb-16">
        <div className="rounded-3xl border border-[#34363b] bg-[#111316] p-6 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-7">
          <div>
            <p className="text-[#ffac90] font-bold text-[11px] uppercase tracking-[2px] mb-3">Além da seleção</p>
            <h2 id="journey-title" className="text-2xl font-bold tracking-[-.8px] mb-3">Uma experiência que continua.</h2>
            <p className="text-[#b9bbc2] text-sm leading-6 max-w-[560px]">Conheça a loja e explore a demonstração de acompanhamento de pedidos. Sem compra real, com cada etapa da jornada em foco.</p>
          </div>
          <Link to="/" hash="pedidos" className={`inline-flex min-h-12 items-center justify-center gap-3 rounded-xl border border-[#ff795480] px-5 py-4 font-semibold text-sm text-[#ffb69d] no-underline hover:bg-[#ff633b12] ${focusClass}`}>
            Conhecer acompanhamento <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  )
}
