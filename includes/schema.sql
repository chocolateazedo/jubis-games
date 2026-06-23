-- Jubis Games — tabelas da área logada (MySQL).
-- Convivem no MESMO banco do Top Terapia, mas usam prefixo jubis_ pra não colidir
-- com as tabelas dele. Idempotente (create table if not exists).

create table if not exists jubis_users (
  id          bigint unsigned not null auto_increment primary key,
  username    varchar(32)  not null,                 -- nome como digitado (exibição)
  username_lc varchar(32)  not null,                 -- lower(username): unicidade case-insensitive
  pass_hash   varchar(255) not null,                 -- password_hash (bcrypt)
  email       varchar(255) not null default '',      -- opcional
  jubis_coins int          not null default 0,       -- saldo (nunca negativo; garantido no código)
  created_at  datetime     not null default current_timestamp,
  last_login  datetime     null,
  unique key uq_jubis_users_lc (username_lc)
) engine=InnoDB default charset=utf8mb4;

-- Extrato da moeda Jubis Coin (cada crédito/débito vira uma linha)
create table if not exists jubis_coin_ledger (
  id            bigint unsigned not null auto_increment primary key,
  user_id       bigint unsigned not null,
  delta         int          not null,               -- + ganhou / - gastou
  reason        varchar(255) not null default '',
  balance_after int          not null,
  created_at    datetime     not null default current_timestamp,
  key idx_jubis_ledger_user (user_id, created_at),
  constraint fk_jubis_ledger_user foreign key (user_id) references jubis_users(id) on delete cascade
) engine=InnoDB default charset=utf8mb4;
