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

### Login com Google (OAuth/OIDC)

Esta extensão parte de `feat/secure-auth-login` / PR #4, commit `e10dae8`,
confirmado diretamente no clone. A reconciliação ao final deste README descreve
o histórico da entrega anterior de autenticação local, não a base desta extensão.

O login local por e-mail/senha permanece disponível. Google é opcional: sem
configuração, `/login` informa que está indisponível e não inicia o fluxo.
Configuração parcial ou inválida também mantém Google indisponível. Falhas ao
verificar disponibilidade não bloqueiam o formulário local.

Configure **somente no servidor**, sem prefixo `VITE_`, as variáveis abaixo.
`.env.example` contém exemplos sem segredos; injete os valores no ambiente do
processo (secret manager em produção). Não assuma que `npm start` carrega `.env`
automaticamente. Nunca comite `.env`, credenciais reais ou tokens.

| Variável | Valor |
| --- | --- |
| `AUTH_ORIGIN` | Origem pública explícita, sem caminho/barra final; `http://localhost:5000` em dev, `https://loja.example.com` em produção. |
| `GOOGLE_CLIENT_ID` | Client ID da credencial OAuth Google do tipo **Web application**. |
| `GOOGLE_CLIENT_SECRET` | Segredo dessa credencial, apenas no servidor/secret manager. |
| `GOOGLE_REDIRECT_URI` | **Exatamente** `AUTH_ORIGIN` + `/api/auth/google/callback`, sem parâmetros, fragmento ou barra final. |

Exemplo dev: `http://localhost:5000/api/auth/google/callback`. Exemplo produção:
`https://loja.example.com/api/auth/google/callback`. Produção exige HTTPS;
HTTP é apenas para localhost em desenvolvimento. Host/porta diferentes exigem
atualizar tanto `AUTH_ORIGIN` quanto o callback e o cadastro no Google.

No Google Cloud Console:

1. Crie/selecione um projeto e configure a tela de consentimento OAuth (Google
   Auth Platform: branding, audience e data access), incluindo domínio autorizado
   em produção e política de privacidade conforme exigido pelo Google.
2. Crie uma credencial OAuth 2.0 **Web application**. Cadastre a URI de
   redirecionamento exata acima em **Authorized redirect URIs**; origem JavaScript
   não substitui callback. Este fluxo é server-side, sem SDK/token no navegador.
3. Em modo de teste, adicione explicitamente os **test users** autorizados na
   audiência/consentimento. Publicação/verificação deve seguir a política Google.
4. Use somente os scopes `openid email profile`; não solicite acesso offline,
   Drive, Gmail ou outras permissões. Guarde o secret fora de bundles e logs.

Contratos da UI (cookies same-origin, `cache: no-store`):

- `GET /api/auth/google/status` → `{ available: boolean }`, sem detalhes de
  configuração ou segredos. Mesmas restrições de origem dos GETs de auth.
- `POST /api/auth/google/start`, JSON estrito `{ returnTo }`, exige sessão
  anônima/atual, `Origin` do navegador e `X-CSRF-Token` em memória; retorna
  `{ authorizationUrl }`. A UI só navega para HTTPS em
  `accounts.google.com/o/oauth2/v2/auth`, sem credenciais, portas alternativas ou
  fragmentos. O retorno permite somente `/`, `/#colecao`, `/#pedidos`, `/#fluxo`,
  `/black-friday` e `/promocoes-black-friday`.
- `GET /api/auth/google/callback`: o servidor verifica o fluxo e redireciona ao
  retorno seguro ou `/login?google=cancelled|error|unavailable`. A rota valida
  esse enum e apresenta mensagens genéricas pt-BR, nunca conteúdo do provedor.

O backend troca o código e valida a identidade antes de criar/rotacionar a
sessão cookie/CSRF existente. **Não há tokens OAuth, senha, sessão ou CSRF em
localStorage/sessionStorage**; tokens do provedor não são persistidos. Desabilite
ou redija logs de URLs/query do callback (inclusive no proxy/APM): `code`,
`state`, tokens e dados pessoais não devem aparecer em access logs, traces ou
mensagens de erro. Limite acesso ao banco e mantenha backups/WAL/SHM protegidos.

Política de identidade: **SEM autolink por e-mail**. A identidade social é fixa
por `provider + sub`, nunca apenas pelo endereço de e-mail. Colisão com conta
local é recusada, mesmo com e-mail Google verificado: não permite takeover nem
vinculação silenciosa. Usuários sociais não têm senha local válida; não devem
entrar pelo formulário de senha nem receber senha padrão. Vincular contas ou
recuperar acesso requer um fluxo autenticado específico, fora desta entrega.
O provisionamento local recusa uma conta que já possui identidade social, sem
convertê-la silenciosamente em conta de senha.

SQLite de auth é mantido separado do catálogo em `AUTH_DB_PATH`. A atualização
do schema para identidades/fluxos OAuth ocorre no servidor ao abrir o banco;
faça backup consistente antes do deploy, teste a migração de um banco existente
isolado e não apague/resemeie usuários ou sessões. Continue com uma única
instância por SQLite local, sem NFS/cluster.
São criadas idempotentemente `auth_identities` (chave `provider, subject`,
referência ao usuário) e `auth_google_flows`; o schema local existente é
preservado. Contas sociais usam um marcador não válido como hash scrypt, sem
senha utilizável. Fluxos de autorização expiram em 5 minutos; limites de start
e callback são independentes dos limites do login local.

Verificação determinística de frontend, sem rede Google:
`npx vitest run src/routes/-login.test.tsx src/services/googleAuthService.test.ts src/services/authService.test.ts src/services/authStore.test.ts --reporter=dot`.
Para validação real, use projeto/test user isolado: confira login, callback,
restauração após reload, logout, cancelamento, config ausente e colisão com
conta local; confirme a rotação de sessão e a ausência de segredos nos logs.

### Black Friday e Passe VIP sem senha

A rota **`/black-friday`** reúne a campanha em português, contador regressivo,
ofertas demonstrativas e o **Passe VIP Black Friday** com código de acesso único
de seis dígitos. O Header e `/login` oferecem atalhos. Login por senha e Google
continuam disponíveis; qualquer sessão autenticada desbloqueia a vitrine VIP.
Para voltar à campanha após o login original, use
`/login?returnTo=%2Fblack-friday`. Esse retorno está na allowlist local e Google.

A campanha demonstrativa termina em **28/11/2026 às 00:00 (UTC−03:00)**.
Preços, descontos e estoque promocional são fictícios; não há compra, reserva
de estoque ou checkout real. O bloqueio VIP é uma experiência de vitrine, não
um mecanismo de autorização para recursos administrativos ou compras.

Fluxo de demonstração local:

1. Execute `npm ci` e `npm run dev`; abra `http://localhost:5000/black-friday`.
2. Informe um e-mail novo, não usado por uma conta local ou Google existente.
3. No modo demonstrativo, a página identifica explicitamente a simulação e
   apresenta o código recebido do servidor. Insira os seis dígitos para entrar.
4. Confira o Header conectado e as ofertas VIP liberadas, recarregue para
   confirmar a sessão e use **Sair** para bloquear novamente a vitrine.

Esta entrega implementa **OTP demonstrativo, sem transporte SMTP/envio de
e-mail real**. Não são exigidas credenciais SMTP; para autenticação passwordless
real será necessário integrar entrega verificada e uma política de identidade
separada, sem reutilizar perfis demo.

O preview é permitido com `NODE_ENV=development` ou com a flag explícita
`AUTH_OTP_DEMO_PREVIEW=true`. **Isso não comprova posse do e-mail**: qualquer
pessoa que veja o preview pode entrar no perfil demonstrativo. Nunca habilite
essa flag em uma loja real ou exponha dados/permissões reais a contas demo.
Em produção sem demo explicitamente habilitado, o endpoint fica indisponível
(HTTP 503) e não retorna nenhum código. A flag tem padrão `false` em
`.env.example`; a ativação deve ser deliberada em demonstrações hospedadas.
Configurações de autenticação são exclusivas do servidor, nunca `VITE_*`.

Contratos same-origin (cookie HttpOnly e `cache: no-store`):

- `POST /api/auth/otp/request`, JSON estrito `{ email }`, solicita o desafio;
  retorna `{ expiresAt, demo, demoCode? }` (epoch em milissegundos). O preview
  `demoCode` só pode existir no modo demonstrativo controlado.
- `POST /api/auth/otp/verify`, JSON estrito `{ email, code }`, confirma o código
  e retorna o mesmo `{ user, csrfToken }` da autenticação original.
- Ambos exigem sessão inicial, `Origin` exata e `X-CSRF-Token`; não guardam
  código, sessão ou CSRF em localStorage/sessionStorage.

O código é aleatório criptograficamente, armazenado somente como hash e tem
validade de cinco minutos, até cinco tentativas e uso único. Reenvio invalida
o código anterior; o desafio é ligado à sessão solicitante. A confirmação e
a rotação da sessão são atômicas. Limites persistidos por e-mail/IP restringem
pedidos e verificações sem alterar os limites do login por senha ou Google:
cada ação permite 5/e-mail e 30/IP a cada 15 minutos (`Retry-After` informa os
segundos restantes da janela, até 900).
O segredo HMAC aleatório de 256 bits é persistido no banco de autenticação;
proteja o banco, WAL/SHM e backups como segredos do servidor. Sua persistência
permite verificar desafios após reinício sem armazenar códigos em texto puro.

**Política de identidade:** o Passe VIP cria um perfil próprio sem senha válida.
Não converte nem vincula silenciosamente uma conta local/Google com o mesmo
e-mail. Para e-mail já cadastrado, use seu método de acesso original; o servidor
mantém erros genéricos. Recuperação e vinculação autenticada de contas seguem
fora do escopo. Faça backup de `AUTH_DB_PATH` antes do deploy; a migração SQLite
é aditiva e preserva usuários, sessões e identidades existentes.

### Catálogo de promoções da Black Friday

`/promocoes-black-friday` reúne o catálogo completo disponível na loja, com
navegação pelo Header e pela campanha `/black-friday`. Os filtros de categoria,
faixa de desconto, ofertas relâmpago e exclusivas VIP são combináveis; a
ordenação permite maior desconto, menor preço ou popularidade demonstrativa.
Cada oferta informa preço original, preço promocional, percentual e economia
em reais. Cupons e combos são simulações com condições explícitas, sem
aplicação em checkout, cobrança ou reserva de estoque.

O cupom demonstrativo **BLACK10** simula 10% extra em uma unidade de produto
público com preço Black de pelo menos R$ 300,00, limitado a R$ 50,00. Não vale
para itens VIP ou combos. O combo **Dupla de som** inclui uma unidade Orbit e
uma Wave, com 5% extra sobre a soma dos preços Black; exige VIP por incluir
Wave. Descontos adicionais são arredondados ao centavo mais próximo e não são
cumulativos entre si. Ambos ficam indisponíveis após o prazo da campanha.
Novos produtos do catálogo continuam visíveis, sem inventar desconto, estoque
promocional ou popularidade quando não houver configuração demonstrativa.

Os dados de popularidade e os benefícios promocionais não vêm de vendas reais.
As ofertas relâmpago seguem o prazo da campanha, sem reiniciar o relógio a cada
visita. Qualquer sessão autenticada libera a vitrine VIP; visitantes podem
navegar ao Passe VIP OTP ou usar seu login original. Essa liberação é apenas
visual e não concede autorização comercial.

Verificação da entrega: `npm test`, `npm run typecheck` e `npm run build`.
Os testes usam bancos SQLite temporários, relógio controlado e respostas
mockadas no navegador, sem SMTP ou conexão externa com Google. Incluem desafio
OTP, proteção Origin/CSRF, expiração, tentativas, replay, rotação da sessão e
desbloqueio da vitrine. Uma demonstração de Google real continua dependendo das
credenciais e test users descritos na seção anterior.

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
