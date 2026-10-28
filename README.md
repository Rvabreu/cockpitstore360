# COCKPIT STORE 360

Demo full-stack e-commerce storefront ("COCKPIT STORE 360") built with TanStack
Start + SQLite (`better-sqlite3`). Dark-only single page: hero, product catalog,
an order-tracking "antes/depois" demo, and the AI Cockpit flow. A fictional demo
for pre-sales and training — not an official product.

## Scripts

Use Node.js 24 or newer: the production server imports the shared TypeScript API
directly using Node's native type stripping.

```bash
npm ci                 # install locked deps (builds the better-sqlite3 native binding)
npm run generate-routes # tsr generate -> src/routeTree.gen.ts
npm run dev            # Vite dev server on http://localhost:5000
npm run build          # production build (dist/)
npm start              # Express production server (SSR + dist/client assets + /api)
npm test               # vitest run
```

## API

The API router is defined once in `src/server/index.ts`, backed by
`src/server/db.ts`, and served by both the Vite plugin (`src/server/apiPlugin.ts`)
and the production Express server (`server.js`), so behavior is identical in dev
and prod. Run `npm run build` before starting production: TanStack Start generates
an SSR handler in `dist/server/server.js`, not a static `index.html`.

- `GET /api/products` — 3 seeded products (Orbit, Pulse, Wave; `created_at ASC`).
- `GET /api/orders/:id` — order + events; `404` with a pt-BR not-found message.
- `POST /api/orders/:id/advance` — advances `current_step`, wrapping to 0 at the end.
- `POST /api/reset-seed` — re-seeds, returns `{ success, products, order }`.

SQLite lives at `data/store.db` (gitignored, seeded on first run).

The tracking simulator confirms each advance through the API before updating the
timeline. Searches validate the supplied order without replacing the demo card.
Read failures fall back to validated local data; failed advances never fabricate
a successful update. Browser storage is optional and does not prevent confirmed
updates when unavailable.

The original static mockup is kept for reference at `docs/Cockpit_Store_360.html`.
