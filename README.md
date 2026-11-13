# COCKPIT STORE 360

Demo full-stack e-commerce storefront ("COCKPIT STORE 360") built with TanStack
Start + SQLite (`better-sqlite3`). Dark-only single page: hero, product catalog,
an order-tracking "antes/depois" demo, and the AI Cockpit flow. A fictional demo
for pre-sales and training — not an official product.

## Scripts

```bash
npm install            # install deps (builds the better-sqlite3 native binding)
npm run generate-routes # tsr generate -> src/routeTree.gen.ts
npm run dev            # Vite dev server on http://localhost:5000
npm run build          # production build (dist/)
npm start              # Express production server (serves dist/client + /api)
npm test               # vitest run
```

## API

The API is defined once in `src/server/db.ts` and served by both the dev Vite
plugin (`src/server/apiPlugin.ts`) and the production Express router
(`src/server/index.ts`), so behavior is identical in dev and prod.

- `GET /api/products` — 3 seeded products (Orbit, Pulse, Wave; `created_at ASC`).
- `GET /api/orders/:id` — order + events; `404` with a pt-BR not-found message.
- `POST /api/orders/:id/advance` — advances `current_step`, wrapping to 0 at the end.
- `POST /api/reset-seed` — re-seeds, returns `{ success, products, order }`.

SQLite lives at `data/store.db` (gitignored, seeded on first run).

## Fotos dos produtos

O clone contém apenas `public/assets/hero_produtos.svg` e
`public/assets/logo_ai_cockpit_referencia.svg`. As fotos individuais ainda não
foram fornecidas. Adicione e versione os três arquivos reais em `public/assets/`:

- `orbit-headphones.webp` — Orbit Headphones Pro.
- `pulse-watch.webp` — Pulse Watch S2.
- `wave-speaker.jpg` — Wave Mini Speaker.

Enquanto esses arquivos estiverem ausentes, `INITIAL_PRODUCTS` em
`src/services/storeService.ts` mantém os caminhos locais válidos
`/assets/hero_produtos.svg#orbit`, `#pulse` e `#wave`, com os recortes atuais.
Não são criadas fotos fictícias nem URLs externas. O card já aceita fotos locais
via `product.image`, com texto alternativo do produto, altura de 175px e
`object-fit: cover`; em caso de erro, usa o recorte correspondente do SVG.

Após adicionar/versionar as fotos, atualize os três campos `image` em
`INITIAL_PRODUCTS` para `/assets/orbit-headphones.webp`,
`/assets/pulse-watch.webp` e `/assets/wave-speaker.jpg`. Esse seed é compartilhado
pela memória/fallback inicial de localStorage e por `src/server/db.ts` no SQLite.
A API (`GET /api/products`) é a fonte de verdade e suas respostas são espelhadas
no localStorage; dados já persistidos não são migrados por esta alteração.
Para atualizar uma base existente, altere apenas os campos `products.image` no
SQLite, preservando pedidos/eventos; o cache local será atualizado na próxima
resposta bem-sucedida da API. Em uso offline, o cache de produtos do localStorage
(`cockpit_store_products_v1`) precisa ser atualizado separadamente, sem apagar o
cache de pedidos. **Não use `POST /api/reset-seed` como migração de imagens**:
esse reset explícito já existente apaga produtos, pedidos e eventos e os recria
a partir dos seeds.

The original static mockup is kept for reference at `docs/Cockpit_Store_360.html`.
