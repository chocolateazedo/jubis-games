# Jubis Games 🎮

Site oficial dos jogos do João — [jubis-games.cloud](https://jubis-games.cloud).

## Estrutura

```
jubis-games/
├── index.php              ← página inicial (lista os jogos)
├── includes/
│   └── games.php          ← descobre os jogos automaticamente
├── assets/
│   ├── css/style.css
│   ├── js/main.js
│   └── img/favicon.svg
├── games/
│   └── <slug-do-jogo>/
│       ├── game.json      ← metadados (título, descrição, emoji, tags)
│       ├── index.html     ← o jogo em si
│       └── cover.png      ← capa opcional (16:10)
└── .htaccess
```

## Como o João adiciona um novo jogo

1. Crie uma pasta nova dentro de `games/` (ex.: `games/super-aventura/`).
2. Coloque o jogo em `index.html` dentro dessa pasta.
3. Crie um arquivo `game.json` com as informações:

```json
{
  "title": "Super Aventura",
  "description": "Frase curtinha que aparece no cartão.",
  "emoji": "🚀",
  "tags": ["aventura", "1 jogador"],
  "entry": "index.html",
  "cover": "cover.png",
  "order": 2
}
```

Pronto! Faz upload e o jogo aparece automaticamente na página inicial. Não precisa mexer no `index.php`.

### Campos do `game.json`

| Campo | Obrigatório | O que é |
|---|---|---|
| `title` | sim | Nome do jogo |
| `description` | não | Frase curta no cartão |
| `emoji` | não | Emoji da capa quando não há `cover` |
| `tags` | não | Lista de etiquetas (ex.: `["plataforma", "co-op"]`) |
| `entry` | não | Arquivo de entrada — padrão `index.html` |
| `cover` | não | Imagem de capa (16:10, ex.: `cover.png`) |
| `order` | não | Ordem na grade — menor número aparece primeiro |
| `hidden` | não | `true` esconde o jogo da página |


## Jogos publicados

- Block Blast (`games/block-blast`)
- Jogo de Desenho (`games/jogo-de-desenho`)
- Jogo dos 7 Erros (`games/jogo-dos-7-erros`)
- Jogo de Jardim (`games/jogo-de-jardim`)
- Bate Bola (`games/bate-bola`)
- Pega Bolinha (`games/pega-bolinha`)
- Bate Martelo Arcade 3D (`games/bate-martelo-arcade-3d`)
- Damas (`games/damas`)
- Jogo da Velha (`games/jogo-da-velha`)
- Stickman runner (`games/stickman-runner`)
- Jogo de Stop (`games/jogo-de-stop`)
- Jogo de Inglês (`games/jogo-de-ingles`)
- Xadrez x1 (`games/xadrez-x1`) — multiplayer online (PHP + polling) com chat de texto entre os jogadores
- Jubis Fire (`games/jubis-fire`) — battle royale 3D até 4 jogadores (Three.js + WebRTC/PeerJS, lobby em PHP) com chat de texto e chat de voz
- Plantão dos Vovôs (`games/plantao-dos-vovos`) — aventura top-down 2D de cuidado a idosos
- Crônicas do Bosque (`games/cronicas-bosque`) — **RPG de viagem no tempo** (VR + PC + celular): cure o futuro do bosque mudando o passado. 3 eras (Semente/Bosque/Ermo) com o mesmo terreno, combate por turnos/ATB com essências e companheira, causalidade entre eras, chefe que se vence **cantando** (Acalanto), partículas e trilha procedural por era. Controles mobile completos (joystick + botões Ação/Pular/Correr + fullscreen). **Multilanguage** (PT-BR/EN/ES, seletor na tela inicial). Reaproveita os assets CC0 do Bosque VR
- Bosque VR (`games/bosque-vr`) — RPG/ambiente 3D em primeira pessoa numa floresta com lago e sol. Tem **bichinhos** que vagam (Kenney Cube Pets, CC0), **NPCs com quem conversar** (Kenney Blocky Characters, CC0) e **construção** com o Kenney Building Kit (CC0) — as construções são salvas no PostgreSQL (schema `jubis`, via `buildings.php`) num mundo compartilhado. Dá pra **construir dentro do VR** (menu 3D + mira pelo controle) e tem **multiplayer P2P de até 5 aparelhos** (PeerJS, código de sala) com avatares e construções sincronizadas. Funciona em óculos VR (Meta Quest, WebXR) com o controle (gatilho esquerdo = correr, grip = pular, Y = construir), no PC (mouse + WASD, Shift/Espaço) e no celular (arrastar + direcional). Sons de passos CC0 (Kenney RPG Audio)
- Futebol Online 3D (`games/futebol-online`) — pelada 3×3 em **3D** (Three.js) multiplayer online (WebRTC/PeerJS, host-autoritativo) com até 4 jogadores; os lugares vazios viram bots. Condução de bola ao tocar e chute (espaço/CHUTAR). Tem modo "jogar sozinho"
- Salão de Damas (`games/salao-de-damas`) — salão 3D multiplayer online onde os jogadores andam de cartola, sentam nas mesas e jogam damas (com regra do **sopro**), conversam por **chat de texto** (balões 3D) e por **chat de voz** com proximidade (WebRTC/PeerJS). Tem **2º andar** que abre quando o térreo lota
- Batata Quente (`games/batata-quente`) — pega-pega 3D online (WebRTC/PeerJS, host-autoritativo) de 2 a 10 jogadores: quem segura a batata por 10s explode; encoste em alguém pra passar. Último de pé vence
- Truco Online (`games/truco-online`) — truco 1×1 online (WebRTC/PeerJS) ou contra o robô: manilha pela vira, truco/retruco/seis/nove/doze, jogo até 12 pontos

## Área logada (contas + Jubis Coin)

O site tem uma **área logada** com cadastro próprio (self signup), login e a moeda
**Jubis Coin** (o mecanismo de ganhar/gastar vem depois; o saldo e os helpers já existem).

- Páginas: `cadastro.php`, `entrar.php`, `conta.php`, `sair.php`.
- Lógica: `includes/auth.php` (sessão, CSRF, signup/login, moeda) + `includes/db.php`.
- Banco: **PostgreSQL** no schema próprio **`jubis`** (tabelas `jubis.users` e
  `jubis.coin_ledger`) — isolado de outros projetos no mesmo banco. Schema em
  `includes/schema.sql` (idempotente).
- Senhas com `password_hash` (bcrypt); formulários com token CSRF.

**Configuração do banco (não versionada):** defina a env var `JUBIS_DATABASE_URL`
no servidor **ou** crie `includes/db_config.local.php` a partir de
`includes/db_config.example.php` (esse arquivo é gitignored — nunca suba a senha).
Formato: `postgresql://usuario:senha@host:porta/banco`.

## Requisitos do servidor

- PHP 7.4+ com a extensão **`pdo_pgsql`** (necessária para a área logada)
- Acesso de rede ao servidor PostgreSQL configurado em `JUBIS_DATABASE_URL`
- Apache com `mod_rewrite` (opcional, mas recomendado)

> Dev local: `./dev.sh up` já constrói uma imagem com `pdo_pgsql` (ver `dev/Dockerfile`).

## Rodando localmente

```bash
php -S localhost:8080
# abre http://localhost:8080
```
