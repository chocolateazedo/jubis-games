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
- Salão de Damas (`games/salao-de-damas`) — salão 3D multiplayer online onde os jogadores andam de cartola, sentam nas mesas e jogam damas (com regra do **sopro**), conversam por **chat de texto** (balões 3D) e por **chat de voz** com proximidade (WebRTC/PeerJS). Tem **2º andar** que abre quando o térreo lota

## Requisitos do servidor

- PHP 7.4+ (qualquer hospedagem compartilhada já tem)
- Apache com `mod_rewrite` (opcional, mas recomendado)

## Rodando localmente

```bash
php -S localhost:8080
# abre http://localhost:8080
```
