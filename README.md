# PMI Summit Brasília

Portal de conferência em português construído com TanStack Start, React, Vite
e Tailwind CSS. Inclui trilhas e programação por dia, perfis de palestrantes,
simulação de inscrições, planejamento de PDUs e guia de Brasília.
Identidade visual em verde-floresta, esmeralda e menta, com tons sage e dourado.

Datas, local, valores, convidados e patrocínios são propostas a confirmar com
o PMI Distrito Federal. O checkout e o envio de propostas são simulações locais:
não realizam cobranças, não reservam vagas e não armazenam dados pessoais.
Os PDUs são estimativas, sujeitos à aprovação e à participação efetiva.

## Scripts

```bash
npm install            # install deps (builds the better-sqlite3 native binding)
npm run generate-routes # tsr generate -> src/routeTree.gen.ts
npm run dev            # Vite dev server on http://localhost:5000
npm run build          # production build (dist/)
npm test               # vitest run
npx tsc --noEmit        # verificação de tipos
```

O script legado `npm start` não é o servidor SSR do TanStack Start e depende de
uma compilação separada da API. A validação deste portal usa `npm run dev` e
`npm run build`; configure o adaptador de produção antes de publicar o evento.

## Compatibilidade com a API anterior

A home não usa o catálogo nem o fluxo de pedidos. A API SQLite e seus testes
foram preservados para compatibilidade; não representam inscrições do Summit.

The API is defined once in `src/server/db.ts` and served by both the dev Vite
plugin (`src/server/apiPlugin.ts`) and the production Express router
(`src/server/index.ts`), so behavior is identical in dev and prod.

- `GET /api/products` — 3 seeded products (Orbit, Pulse, Wave; `created_at ASC`).
- `GET /api/orders/:id` — order + events; `404` with a pt-BR not-found message.
- `POST /api/orders/:id/advance` — advances `current_step`, wrapping to 0 at the end.
- `POST /api/reset-seed` — re-seeds, returns `{ success, products, order }`.

SQLite lives at `data/store.db` (gitignored, seeded on first run).

The original static mockup is kept for reference at `docs/Cockpit_Store_360.html`.
