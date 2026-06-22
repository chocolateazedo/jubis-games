# Jubis Games — Login, Contas e Jubis Coins (handover)

Documento de passagem de bastão sobre a **área logada** do Jubis Games: criação de
conta (self signup), login/sessão e a moeda **Jubis Coin**. Explica o que já existe,
como funciona por dentro, como usar nos jogos/páginas, o que é segredo e o que ainda
falta definir.

> TL;DR: cadastro + login + sessão **funcionam**. O **saldo** de Jubis Coins e os
> helpers de creditar/debitar (com extrato) **já funcionam**. O **mecanismo** de
> "como o jogador ganha/gasta" ainda **não foi definido** — quando for, é só chamar
> `jubis_add_coins()` / `jubis_spend_coins()`.

---

## 1. Visão geral

- Site em **PHP** (hospedagem compartilhada Apache), jogos descobertos
  automaticamente em `games/`. Tudo em **PT-BR** pro jogador.
- A área logada tem **cadastro próprio** (não usa OAuth/terceiros), **login** com
  sessão PHP e a moeda **Jubis Coin** por usuário.
- Banco: **PostgreSQL**, no schema próprio **`jubis`** (o mesmo servidor do projeto
  Top Terapia, mas **isolado** no schema `jubis` — não toca no `public` do outro
  projeto).

## 2. Arquivos

| Arquivo | Papel |
|---|---|
| `includes/db.php` | Conexão PDO PostgreSQL; lê a URL do banco (env ou arquivo local); `set search_path to jubis, public`. `jubis_db()` e `jubis_db_migrate()`. |
| `includes/auth.php` | Núcleo: sessão, CSRF, validação, signup/login/logout, helpers de usuário e **da moeda** (`jubis_add_coins`, `jubis_spend_coins`). Sem HTML. |
| `includes/auth_ui.php` | Cabeçalho/rodapé HTML das páginas de conta (mesmo tema do site). `jubis_ui_head()` / `jubis_ui_foot()`. |
| `includes/schema.sql` | DDL idempotente (`create ... if not exists`) das tabelas no schema `jubis`. |
| `includes/db_config.example.php` | **Modelo** da config do banco (placeholder). É o único versionado. |
| `includes/db_config.local.php` | **Segredo, gitignored** — URL real com senha. Criado a partir do `.example`. |
| `cadastro.php` | Página de criar conta (self signup). Entra direto após criar. |
| `entrar.php` | Página de login. |
| `conta.php` | Área logada: mostra saldo de Jubis Coins. Exige login. |
| `sair.php` | Logout e volta pra home. |

Todas as funções têm prefixo `jubis_` pra não colidir com nada.

## 3. Banco de dados

### Conexão e segredo (NUNCA versionar a senha)
A URL de conexão é lida nesta ordem (`includes/db.php` → `jubis_database_url()`):
1. env var **`JUBIS_DATABASE_URL`** (recomendado em produção);
2. env var `DATABASE_URL`;
3. arquivo **`includes/db_config.local.php`** (gitignored) que faz `return 'postgresql://usuario:senha@host:porta/banco';`.

`.gitignore` já protege: `includes/db_config.local.php`, `includes/db_config.php`,
`data/users/`. **Só** `db_config.example.php` (com placeholders) vai pro repositório.

Requisito do servidor: PHP 7.4+ com a extensão **`pdo_pgsql`**. O dev local
(`./dev.sh up`) já sobe uma imagem com `pdo_pgsql`.

### Isolamento
`jubis_db()` faz `set search_path to jubis, public`. Todas as tabelas vivem em
`jubis.*`. O schema `public` (do Top Terapia) **não é tocado**.

### Tabelas (`includes/schema.sql`)
```sql
create schema if not exists jubis;

-- Usuários (self signup)
create table if not exists jubis.users (
  id          bigserial primary key,
  username    text        not null,                 -- nome como digitado (exibição)
  username_lc text        not null unique,          -- lower(username): unicidade case-insensitive
  pass_hash   text        not null,                 -- password_hash (bcrypt)
  email       text        not null default '',      -- opcional
  jubis_coins integer     not null default 0 check (jubis_coins >= 0),
  created_at  timestamptz not null default now(),
  last_login  timestamptz
);

-- Extrato da moeda (cada crédito/débito vira uma linha)
create table if not exists jubis.coin_ledger (
  id            bigserial   primary key,
  user_id       bigint      not null references jubis.users(id) on delete cascade,
  delta         integer     not null,               -- + ganhou / - gastou
  reason        text        not null default '',
  balance_after integer     not null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_coin_ledger_user on jubis.coin_ledger (user_id, created_at desc);
```
> Também existe `jubis.buildings` (criada sob demanda por `games/bosque-vr/buildings.php`)
> — é do jogo Bosque VR, não do login, mas mora no mesmo schema `jubis` e referencia
> `jubis.users(id)`.

### Migração / setup
`jubis_db_migrate()` roda o `schema.sql` inteiro (idempotente). Não há `setup.php`
pronto; pra criar/atualizar as tabelas, rode `jubis_db_migrate()` uma vez (ex.: num
script de setup temporário) **ou** aplique o `schema.sql` direto no banco. As tabelas
do Bosque VR se autocriam na primeira chamada do `buildings.php`.

## 4. Criação de conta (self signup)

Fluxo (`cadastro.php` → `jubis_signup()`):
1. Form com **nome de usuário**, **senha** e **e-mail (opcional)**, mais um
   **token CSRF** escondido.
2. No POST: confere CSRF (`jubis_csrf_check`), depois `jubis_signup($username, $password, $email)`.
3. Validações (`auth.php`):
   - usuário: regex `^[a-zA-Z0-9_]{3,20}$` (3–20, letras/números/_; sem espaço/acento);
   - senha: mínimo 6 caracteres;
   - e-mail: vazio **ou** válido (`FILTER_VALIDATE_EMAIL`).
4. Insere em `jubis.users` com `username` (como digitado), `username_lc`
   (lowercase, **único**) e `pass_hash = password_hash($senha, PASSWORD_DEFAULT)`
   (bcrypt). E-mail guardado pra recuperação futura.
5. Unicidade case-insensitive: índice único em `username_lc`. Colisão → PostgreSQL
   devolve SQLSTATE `23505`, traduzido pra "Esse nome de usuário já existe".
6. Sucesso → **loga automaticamente** e manda pra `conta.php`.

## 5. Login, sessão e logout

- **Sessão** (`jubis_session_start`): cookie `jubis_sess`, `HttpOnly`, `SameSite=Lax`,
  `Secure` quando em HTTPS. Cookie é **do domínio inteiro** → a sessão vale tanto nas
  páginas PHP quanto dentro dos jogos (ex.: o Bosque VR chama `buildings.php` e já
  vem logado).
- **Login** (`jubis_login`): carrega o usuário por `username_lc`, confere com
  `password_verify`. Em falha, atraso de 250 ms (anti força-bruta) e mensagem
  genérica "Usuário ou senha incorretos". Em sucesso: `session_regenerate_id(true)`
  (anti fixation), grava `$_SESSION['user']` e atualiza `last_login`.
- **Logout** (`sair.php` → `jubis_logout`): limpa `$_SESSION`, expira o cookie,
  `session_destroy()`.
- Helpers: `jubis_current_username()`, `jubis_current_user()` (array do banco),
  `jubis_is_logged_in()`, `jubis_require_login()` (redireciona pra `entrar.php` se
  não logado).

## 6. Segurança (o que já está coberto)

- Senhas com **bcrypt** (`password_hash`/`password_verify`).
- **CSRF** em todo POST (`jubis_csrf_token` no form, `jubis_csrf_check` no servidor;
  `hash_equals`). Em APIs JSON (ex.: `buildings.php`) o token vai no header `X-CSRF`.
- **SQL** sempre com prepared statements (PDO, `EMULATE_PREPARES=false`).
- **XSS**: toda saída passa por `jubis_e()` (`htmlspecialchars`).
- Cookie `HttpOnly`/`SameSite=Lax`/`Secure`, `session_regenerate_id` no login.
- Segredo do banco fora do git.
- **Pendências de segurança conhecidas**: não há rate limit por IP no signup/login
  (só o atraso de 250 ms), nem verificação de e-mail, nem fluxo de "esqueci a senha".

## 7. Jubis Coin (a moeda)

### Estado atual
- Cada usuário tem `jubis_coins` (inteiro, **nunca negativo** — `check >= 0` e
  `greatest(0, ...)` no update).
- Toda movimentação vira uma linha em `jubis.coin_ledger` (extrato: quanto, por quê,
  saldo depois, quando).
- `conta.php` mostra o saldo. O texto avisa que **ganhar/trocar vem em breve**.
- **O mecanismo de COMO ganhar e COMO gastar ainda NÃO existe** — é a parte a definir.

### A API da moeda (é só isso que o mecanismo futuro precisa chamar)
```php
jubis_coins(array $user): int
// lê o saldo do array de usuário.

jubis_add_coins(string $username, int $delta, string $reason = ''): ?array
// credita (delta>0) ou debita (delta<0) de forma ATÔMICA (transação),
// nunca deixa negativo, e registra no coin_ledger. Retorna o usuário atualizado.

jubis_spend_coins(string $username, int $amount, string $reason = ''): array
// tenta gastar `amount`; retorna ['ok'=>true,'user'=>...] ou ['error'=>...]
// (ex.: 'Jubis Coins insuficientes.').
```
Exemplo (creditar por uma conquista):
```php
require_once __DIR__ . '/includes/auth.php';
$me = jubis_current_username();
if ($me) jubis_add_coins($me, 10, 'venceu uma partida');
```

### Como dar o próximo passo (sugestão de design)
O "como ganhar/gastar" deve ser **autoritativo no servidor** (nunca confiar no
cliente pra creditar). Padrão recomendado:
1. Criar endpoints PHP por evento de jogo (ex.: `games/<jogo>/reward.php`) que
   **validam** o que aconteceu (sessão logada + CSRF + alguma checagem anti-fraude)
   e então chamam `jubis_add_coins()` com um `reason` claro.
2. Idempotência: evitar creditar o mesmo evento duas vezes (ex.: uma tabela de
   "eventos já pagos" ou um token único por partida).
3. Loja/troca: uma página que lista itens e usa `jubis_spend_coins()`; registrar o
   que foi comprado.
4. Anti-fraude mínimo: limites por tempo (X coins/dia), validação do resultado no
   servidor, e o `coin_ledger` pra auditar.

## 8. Quem já usa a área logada hoje

- **Bosque VR** (`games/bosque-vr/buildings.php`): as construções são salvas no
  PostgreSQL (`jubis.buildings`) **só pra usuários logados** (usa
  `jubis_current_user()` + CSRF via header `X-CSRF`; `GET` devolve o token e o nome
  do usuário). Quem não está logado constrói localmente, mas não salva. É o **modelo
  de referência** de como um jogo consome a área logada de dentro de um `index.html`
  estático (cookie de sessão vale no mesmo domínio → `fetch('buildings.php')` já vem
  autenticado).

## 9. Como rodar/testar localmente

```bash
./dev.sh up          # PHP em Docker (com pdo_pgsql) em http://localhost:8095
# crie includes/db_config.local.php a partir do .example, OU defina JUBIS_DATABASE_URL
# garanta as tabelas: rode jubis_db_migrate() uma vez ou aplique includes/schema.sql
```
Cheque: criar conta em `/cadastro.php`, entrar em `/entrar.php`, ver saldo em
`/conta.php`, sair em `/sair.php`.

## 10. O que falta (resumo pro próximo)

- [ ] Definir e implementar **como ganhar** Jubis Coins (endpoints por jogo,
      validação no servidor, idempotência).
- [ ] Definir e implementar **como gastar** (loja/troca usando `jubis_spend_coins`).
- [ ] Integrar o estado de login na **home** (`index.php`) — link "Entrar/Minha conta"
      e mostrar o saldo no topo (hoje as páginas de conta existem, mas a home pode
      destacar melhor o acesso).
- [ ] (Opcional) recuperação de senha por e-mail e rate limit no login/signup.
- [ ] Criar um `setup.php` (ou comando) que chame `jubis_db_migrate()` de forma
      controlada, em vez de depender da autocriação.
