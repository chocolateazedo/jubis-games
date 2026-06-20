-- Jubis Games — schema da área logada (PostgreSQL).
-- Fica num schema próprio "jubis", isolado do projeto Top Terapia (schema public).
-- Idempotente: pode rodar várias vezes sem problema.

create schema if not exists jubis;

-- Usuários (self signup)
create table if not exists jubis.users (
  id          bigserial primary key,
  username    text        not null,                 -- nome de exibição (como digitado)
  username_lc text        not null unique,          -- lower(username): unicidade case-insensitive
  pass_hash   text        not null,                 -- password_hash (bcrypt)
  email       text        not null default '',
  jubis_coins integer     not null default 0 check (jubis_coins >= 0),
  created_at  timestamptz not null default now(),
  last_login  timestamptz
);

-- Extrato da moeda Jubis Coin (cada crédito/débito vira uma linha)
create table if not exists jubis.coin_ledger (
  id            bigserial   primary key,
  user_id       bigint      not null references jubis.users(id) on delete cascade,
  delta         integer     not null,               -- + ganhou / - gastou
  reason        text        not null default '',
  balance_after integer     not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_coin_ledger_user on jubis.coin_ledger (user_id, created_at desc);
