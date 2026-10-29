# COCKPIT STORE 360

Demo full-stack e-commerce storefront ("COCKPIT STORE 360") built with TanStack
Start + SQLite (`better-sqlite3`). Dark-only single page: hero, product catalog,
an order-tracking "antes/depois" demo, and the AI Cockpit flow. A fictional demo
for pre-sales and training — not an official product.

## Scripts

```bash
npm ci                 # install deps (builds the better-sqlite3 native binding)
npm run generate-routes # tsr generate -> src/routeTree.gen.ts
npm run dev            # Vite dev server on http://localhost:5000
npm run build          # production build (dist/)
npm start              # Node 24 Express + TanStack SSR; AUTH_ORIGIN required
npm test               # vitest run
npm run typecheck      # TypeScript strict, sem emissão
npm run auth:provision # servidor-only; requer variáveis de provisionamento abaixo
```

## API

The Express API is defined once in `src/server/index.ts`, shared by the Vite
plugin (`src/server/apiPlugin.ts`) and production (`server.js`). Node 24 runs
the backend TypeScript directly with native type stripping and `.ts` imports.
Production serves `dist/client` and imports `dist/server/server.js` for SSR;
build before starting. There is no SPA wildcard or missing generated backend JS.

- `GET /api/products` — 3 seeded products (Orbit, Pulse, Wave; `created_at ASC`).
- `GET /api/orders/:id` — order + events; `404` with a pt-BR not-found message.
- `POST /api/orders/:id/advance` — advances `current_step`, wrapping to 0 at the end.
- `POST /api/reset-seed` — re-seeds, returns `{ success, products, order }`.

SQLite lives at `data/store.db` (gitignored, seeded on first run).

## Autenticação e configuração do servidor

Nenhuma conta ou senha padrão é criada. Não há cadastro, recuperação de senha
ou checkout real. Catálogo e pedidos fictícios continuam públicos; **todas as
mutações da API**, inclusive avançar pedido e resetar demo, exigem sessão/CSRF.

- `GET /api/auth/session` → `{ user: { authenticated: true } | null, csrfToken: string }`.
- `POST /api/auth/login` com JSON exato `{ email, password }` → mesmo formato.
- `POST /api/auth/logout` com JSON exato `{}` → sessão anônima nova.
- Mutações exigem `Origin` igual a `AUTH_ORIGIN`, cookie e `X-CSRF-Token` da
  sessão. A sessão inicial é obtida no navegador por GET same-origin. GET de
  origem externa não cria/renova cookie nem expõe token. Clientes não-browser
  devem enviar `Origin` configurado também no GET. Não existe CORS cross-origin.
- JSON máximo 4 KiB, senha 12 caracteres a 1024 bytes, e-mail máximo 254
  caracteres. Propriedades extras, arrays, JSON malformado e tipo incorreto
  são rejeitados. Erros de login são genéricos; senhas/tokens/PII não são logados.

`AUTH_ORIGIN` é a origem pública **exata**, sem caminho ou barra final, por
exemplo `https://loja.example.com`. É obrigatória e HTTPS em produção; o
servidor de produção assume `NODE_ENV=production` se não definido. Em Vite dev
o default é `http://localhost:5000`; altere ao trocar host/porta. Não use prefixo
`VITE_` para nenhuma configuração ou segredo de auth.

`AUTH_DB_PATH` define SQLite de auth (default `data/auth.db`);
`STORE_DB_PATH` define SQLite da demo (default `data/store.db`). Sessões são
persistidas somente como SHA-256 do ID aleatório de 256 bits; CSRF sincronizador
permanece no banco e somente na memória do frontend. Cookie HttpOnly,
SameSite=Lax, Path=/, sem Domain, Secure em HTTPS e nome
`__Host-cockpit-session`; somente desenvolvimento HTTP usa `cockpit-session`.
Login/logout rotacionam ID e token e invalidam a sessão anterior. GET não
estende a validade: expiração absoluta de 8 horas autenticada e 1 hora anônima.
Alterar senha pelo provisionamento invalida todas as sessões daquela conta.

Senhas usam scrypt assíncrono com salt aleatório de 128 bits, N=32768, r=8,
p=3 e hash de 64 bytes; contas inexistentes executam a mesma derivação.
Limites persistidos: 5 tentativas por e-mail normalizado e 30 por IP a cada
15 minutos, inclusive tentativas bem-sucedidas; janela fixa desde a primeira
tentativa. Resposta 429 informa Retry-After (900 s conservadores). Relógio é
injetável nos testes. Criação de sessão anônima: 120/IP por 15 minutos;
até 4 derivações de login concorrentes por processo (excesso retorna 429).
IP vem **apenas do socket**; X-Forwarded-For não é confiado.
Atrás de proxy, todos compartilham o limite do IP do proxy: configure limitação
adicional na borda, não habilite trust proxy indiscriminadamente. O proxy deve
preservar Host/Origin e terminar HTTPS; restrinja acesso direto ao backend.

Execute uma única instância de servidor por banco SQLite local (não NFS,
cluster ou réplicas). Diretórios novos usam 0700 e arquivos DB 0600. Inicie com
`umask 077`, usuário de serviço dedicado e diretório existente restrito; inclua
arquivos WAL/SHM e backups nas mesmas restrições. Proteja também o SQLite da
demo. Faça backup consistente; limite tráfego/tamanho de headers na borda para
evitar crescimento abusivo de sessões anônimas e gasto de scrypt.

### Provisionar uma conta

Procedimento exclusivamente no servidor: configure AUTH_ORIGIN/AUTH_DB_PATH,
pare o serviço durante a alteração e injete `AUTH_USER_EMAIL` e
`AUTH_USER_PASSWORD` via secret manager ou prompt sem eco. Nunca passe segredos
como argumentos, cole senha na linha de comando/histórico ou grave em .env no
repositório. Exemplo **Bash interativo** (os valores não entram no histórico):

```bash
umask 077
export AUTH_ORIGIN=https://loja.example.com
export NODE_ENV=production
read -r -p 'E-mail: ' AUTH_USER_EMAIL
read -r -s -p 'Senha (mínimo 12 caracteres): ' AUTH_USER_PASSWORD
export AUTH_USER_EMAIL AUTH_USER_PASSWORD
node src/server/provision.ts
unset AUTH_USER_EMAIL AUTH_USER_PASSWORD
npm run build
npm start
```

O script não possui defaults e falha sem credenciais/configuração válida.
Reexecutar com o mesmo e-mail troca a senha e revoga sessões. Variáveis de
provisionamento nunca devem permanecer no ambiente do serviço web. Em produção
execute somente por operador autorizado no host; não exponha endpoint de
provisionamento e não inclua secrets no bundle, CI público ou logs.

### Verificação

`npx vitest run src/server --reporter=dot` executa testes Node com bancos
temporários/isolados e relógio controlado. `npx tsc --noEmit` verifica tipos.
O lockfile original da base estava inconsistente e foi corrigido para permitir
`npm ci`; dependências da entrega foram instaladas com esse comando.

Validação manual: provisione uma conta isolada, abra `/login`, entre, recarregue
a página para confirmar restauração e use **Sair** no Header. A sessão anterior
deve deixar de autenticar. Confira catálogo, links da loja e avanço do pedido
fictício antes/depois de sair. Não há linter configurado; execute `npm test`,
`npm run typecheck` e `npm run build` antes de publicar.

### Reconciliação com trabalhos paralelos

A base desta entrega é `main` em `cd2812f`, sem autenticação ou checkout real.
Foram inspecionados os PRs em rascunho #1 (tracking/checkout), #2
(login/dashboard/CRM) e #3 (tracking), todos abertos e não integrados na base.
Não foram importados recursos desses PRs: catálogo, pedidos e navegação da base
permanecem preservados. O HEAD inspecionado de #2 (`e9f685d`) usa bearer token;
uma futura integração deverá resolver explicitamente conflitos de auth,
Header, API e produção, mantendo **somente** este mecanismo de cookie/CSRF,
sem reintroduzir storage de tokens ou contas padrão. Checkout e recursos com
papéis/permissões exigirão seus próprios contratos de autorização e testes;
esta sessão não concede permissões administrativas implicitamente.

The original static mockup is kept for reference at `docs/Cockpit_Store_360.html`.
