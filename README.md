# COCKPIT STORE 360

Demo full-stack e-commerce storefront ("COCKPIT STORE 360") built with TanStack
Start + SQLite (`better-sqlite3`). Dark-only storefront: hero, product catalog,
an order-tracking "antes/depois" demo, and the AI Cockpit flow, plus login and an authenticated dashboard. A fictional demo
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

## Secure login

Open `/login` or select **Entrar** in the header. Authentication is now verified
by the server. The responsive form supports password visibility, accessible
validation, session restoration and logout. Credentials and session tokens are
never stored in browser storage or included in URLs.

There are no default users or passwords. Users can create an account at
`/cadastro` (linked from the anonymous login page), or you can provision
a user locally with `npm run auth:provision -- usuario@example.com`, supplying
the password through standard input or the `AUTH_PASSWORD` environment variable
from your secret manager. Never pass a password as a command-line argument or
commit it. Provisioning requires at least 12 characters and rejects duplicate
users instead of silently changing their password.

Users, password hashes, sessions and login limits live in `data/auth.db`, separate
from the tracking database. Passwords use salted scrypt; opaque session tokens
are hashed server-side. Sessions expire after eight hours, rotate on login and
are revoked on logout. Cookies are host-only, HttpOnly and SameSite=Strict, with
Secure and `__Host-` names in production. CSRF tokens remain in memory; requests
are checked against the configured origin. Login attempts are rate-limited.

Production startup requires `APP_ORIGIN` set to the exact public HTTPS origin
(for example `https://store.example.com`). Terminate TLS at a trusted reverse
proxy and restrict direct access to the backend; it does not infer trust from
Host or forwarded headers. Development defaults to `http://localhost:5000`.
Use a persistent volume and restrict access to `data/auth.db` and its backups.
`AUTH_DB_PATH` can select a different authentication database for the server and
provisioning command; use the same path for both.

Authentication identifies the signed-in account only. The storefront and shared
order simulator remain publicly accessible; there is no per-user order ownership
or authorization. Password recovery, email verification and MFA are not implemented.

### User registration

`/cadastro` accepts an email, password and local password confirmation. Registration
requires 12–128 UTF-16 characters and at most 512 UTF-8 bytes; passwords are never
trimmed. The confirmation is not sent to the server. Forms have no credential
`name` attributes, so pre-hydration submissions cannot put credentials in URLs.

A successful registration creates a salted password hash but no session and
sends no cookies. Use the login link after creation. The server rechecks the
anonymous CSRF bootstrap after hashing, then inserts atomically; duplicate emails
never overwrite credentials. Login and registration share rate-limit budgets,
and public registration is capped at 10,000 total users. A conflict uses a generic
409 response, which still indirectly reveals whether an email already exists.
Emails are not verified; do not treat registration as proof of mailbox ownership.

### Authentication API

- `GET /api/auth/session` — account or `null`, plus a CSRF token.
- `POST /api/auth/login` — JSON email/password, exact Origin and `X-CSRF-Token`.
- `POST /api/auth/register` — anonymous JSON email/password with the same checks;
  `201 {created:true}`, no automatic login; invalid fields return 400 and duplicate
  email returns a generic 409. Existing session cookies are rejected.
- `POST /api/auth/logout` — JSON object with the same origin/CSRF checks.

All authentication responses use `Cache-Control: no-store`. Failed credentials
return the same generic message for unknown users and wrong passwords. A 429
response includes `Retry-After`; clients do not automatically resend passwords.

## E-commerce dashboard

Open `/dashboard` or select **Painel** in the header. Sign in with a registered or provisioned
account to view a read-only overview of the shared demo dataset. It includes
order count, registered order value, average order value, product count, status
distribution, orders by date, an order table and the product catalog. The new
**Centro operacional** layout adds section navigation (sidebar on desktop,
compact links on mobile), a status donut, date bars and an operational summary.
Orders in progress are the sum of stages 0–2; delivered orders are stage 3.
Charts use only existing dates and counts, with explicit empty states instead of
invented projections or growth figures.

Indicators come from SQLite, not generated sales figures. Registered value sums
order totals; it is not paid revenue, profit or inventory. Search, status and
inclusive date filters affect only the order table; indicators describe the full
dataset. Invalid dates are shown as unavailable and excluded from the date series.
Use **Atualizar dados** to read a new snapshot, including changes made in the
public order simulator. There is no dashboard fallback to browser storage or seed
data when the server is unavailable.

`GET /api/auth/dashboard` requires a valid session linked to its CSRF cookie and
returns `401` when anonymous or expired. It is read-only, sends no cookies and
uses `Cache-Control: no-store`; foreign-origin requests are rejected. Client-side
route checks are not the authorization boundary: the API verifies the session
before reading the demo tracking database.

Any registered or provisioned account sees the same demonstrative operational data. This is
not an administrator role system or authorization for private customer orders.

## Stripe checkout in USD

Open `/checkout` or select a product's checkout link. Sign in to load the protected
USD catalog, build a cart and select **Pagar com Stripe**. The application redirects
to Stripe Hosted Checkout; card details are not collected by this site. The cart
remains in memory. The BRL storefront and demo dashboard are not automatically
converted to USD: checkout prices must be configured explicitly in USD cents.

Configure the following **server-side environment variables**, never in Git or a
client bundle:

- `STRIPE_SECRET_KEY`: begin with a Stripe test-mode secret key.
- `STRIPE_WEBHOOK_SECRET`: the signing secret for this environment's webhook.
- `STRIPE_USD_PRICES_JSON`: JSON object mapping existing product IDs to positive
  integer USD cent amounts. Set your own prices; there is no assumed FX rate or
  fallback price. Products without a configured USD price are not purchasable.
- `STRIPE_ALLOW_LIVE=true`: explicit opt-in required for a live-mode secret key.
- `APP_ORIGIN`: the externally served HTTPS application origin.

No Stripe configuration leaves payments unavailable (503), not simulated. Partial
or invalid configuration fails startup. Test mode is labeled explicitly and does
not charge real money; live payments require the merchant's activated Stripe
account, live keys, HTTPS and a correctly configured live webhook.

Configure Stripe to deliver checkout session completion, asynchronous payment
success/failure and expiration events to `POST /api/stripe/webhook`. This route
receives the raw body and verifies Stripe's signature. Use the matching webhook
secret for test or live mode. Expose the HTTPS endpoint to Stripe and verify delivery
and retries before enabling live payments.

Payment endpoints, all private and `no-store`:

- `GET /api/auth/payments/catalog`: configured USD products and test/live mode.
- `POST /api/auth/payments/checkout`: strict product IDs, quantities and UUID-v4
  idempotency key; session, Origin and CSRF required. Prices come from the server.
- `GET /api/auth/payments/orders/:id`: order status and immutable amounts, only for
  the owning account. Other accounts receive not-found.

Orders are stored separately in `auth.db`, not in the public tracking/dashboard.
Retries preserve the original account, item snapshot, Stripe parameters and key.
An uncertain network result is not evidence that no Checkout Session was created.
Do not create a fresh attempt unless you understand that another session may exist.

The return URL never proves payment. Only a validated Stripe webhook, corroborated
against the authoritative session and stored order, can mark payment confirmed.
The UI polls pending status for a bounded interval and then offers manual refresh.
Returning from cancellation does not mean the payment was canceled or failed.

Before launch, complete a real Stripe test-mode checkout, confirm the signed webhook
updates the owned order, verify duplicate/replayed events do not duplicate payment,
and exercise asynchronous/failed payments. Automated gateway fixtures are not proof
that a merchant account or production webhook is operational.

This integration does not reserve stock, schedule delivery, calculate tax or issue
fiscal invoices. Previous simulated receipts remain private historical data; the
legacy `POST /api/auth/checkout` simulation API does not move money and is not used
by the Stripe checkout interface.

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
