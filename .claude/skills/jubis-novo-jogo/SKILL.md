---
name: jubis-novo-jogo
description: Cria um novo jogo para o Jubis Games (jubis-games.cloud) seguindo o template do projeto. Funciona para qualquer tipo — 2D (canvas ou DOM), 3D (Three.js via CDN), multiplayer local (mesmo aparelho) ou multiplayer online (WebRTC/PeerJS, PHP polling ou serviço externo). Use quando o usuário quiser criar, adicionar ou começar um jogo novo no Jubis Games.
---

# Criar um jogo novo no Jubis Games

O Jubis Games é o site de jogos do João (`jubis-games.cloud`), hospedado em Apache + PHP em
hospedagem compartilhada. Os jogos são **descobertos automaticamente**: você cria uma pasta dentro
de `games/`, e o jogo aparece sozinho na home — sem mexer no `index.php`.

Esta skill serve para criar **qualquer** tipo de jogo mantendo o padrão do projeto. Escolha a
arquitetura pelo tipo de jogo (seção "Decida a arquitetura"), mas **as regras invioláveis valem
sempre**.

## Como o site descobre os jogos (não quebre isso)

`includes/games.php` faz `scandir()` em `games/`. Para cada subpasta ele só publica o jogo se:
1. existir um `game.json` válido,
2. `hidden` não for `true`,
3. o arquivo de entrada (`entry`, padrão `index.html`) existir.

Os cartões da home são ordenados por `order` (menor primeiro), desempatando por título.
Se faltar `cover`, o cartão mostra o `emoji`.

## Regras invioláveis (valem para 2D, 3D e multiplayer)

1. **Pasta própria**: `games/<slug>/`, slug em `kebab-case`, sem acentos nem espaços
   (ex.: `corrida-espacial`).
2. **Dois arquivos no mínimo**: `game.json` (metadados) + o arquivo de entrada (`index.html`).
3. **Tudo em PT-BR para o jogador**: títulos, instruções, botões e textos do jogo em português.
   (O projeto inteiro é em português — siga o `README.md` e o `includes/games.php`.)
4. **Botão de voltar fixo** que sobe dois níveis até a home:
   `<a class="back" href="../../">← Voltar</a>`.
5. **Tema escuro padrão do estúdio**: `:root { color-scheme: dark; }`, fundo
   `radial-gradient` azul/roxo, fonte `Arial`/`system-ui`. Visual coerente com os outros jogos.
6. **Responsivo**: roda em celular, tablet e PC. Largura tipo `min(92vw, 760px)`; em jogos de tela
   cheia use `100dvh` e `env(safe-area-inset-*)`.
7. **Sem build e sem npm**: nada de bundler. Dependências só via **CDN** (`<script src>` ou
   `importmap`). O servidor é hospedagem compartilhada — não há Node.
8. **Recorde com `localStorage`** quando fizer sentido, com chave única por jogo
   (ex.: `'corrida-espacial-best'`).
9. **Botão "Reiniciar"** e, em jogos de ação, uma tela de "fim de jogo" com a pontuação.
10. **Acessível ao toque**: o jogo precisa ser jogável com o dedo (não só teclado/mouse).

## Fluxo de criação

1. **Pergunte/defina**: nome do jogo, tipo (2D/3D/local/online), como se joga, e se tem
   pontuação/recorde. Escolha o `slug`.
2. **Decida a arquitetura** (seção abaixo) e copie o template correspondente de `templates/`.
3. **Crie a pasta** `games/<slug>/` com o `index.html` (a partir do template) e o `game.json`.
4. **Implemente o jogo** dentro do template, respeitando as regras invioláveis.
5. **Defina `order`**: para WIP, comece com `"hidden": true` e tire quando estiver pronto
   (ou use um `order` alto para deixar por último).
6. **Teste** (seção "Testar").
7. **Atualize o `README.md`**: adicione o jogo na lista "Jogos publicados".
8. **Commit/PR** só quando o usuário pedir. Não mencione o Claude no corpo do PR.

## Decida a arquitetura por tipo de jogo

| Tipo de jogo | Arquitetura | Template base |
|---|---|---|
| 2D simples (clique, reflexo, puzzle, tabuleiro) | **1 arquivo** `index.html` com CSS+JS inline | `templates/2d-canvas.html` ou DOM puro |
| 2D complexo (muitas telas, loja, várias fases) | Pode separar `index.html` + `game.js` + `style.css` (padrão do `defesa-zumbi-vip`) | `templates/2d-canvas.html` e dividir depois |
| 3D | **Three.js via CDN** (`importmap`, módulos ES) | `templates/3d-threejs.html` |
| Multiplayer **local** (2 jogadores, mesmo aparelho) | 1 arquivo, "hotseat" — alterna turnos/controles (igual `damas`, `jogo-da-velha`) | `templates/2d-canvas.html` |
| Multiplayer **online** | Veja a seção dedicada — escolha o nível certo | `templates/multiplayer-webrtc.html` |

Regra geral: **comece sempre single-file**. Só divida em arquivos quando o jogo crescer de verdade.
Single-file é o padrão de 16 dos 17 jogos atuais.

### Jogo 3D

- Use **Three.js por `importmap`** (sem build). O template já traz cena, luz, sombra, chão,
  um objeto controlável (WASD/setas + toque), loop de animação, `resize` e coleta de itens com
  pontuação. É um joguinho 3D completo pronto para adaptar.
- Tela cheia (`100dvh`), HUD por cima com `position: fixed`, botão voltar por cima.
- Cuidado com performance no celular: limite contagem de objetos, use geometrias simples e
  `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.

### Multiplayer online — escolha o nível certo

A hospedagem é **estática + PHP** (sem servidor de WebSocket próprio). Em ordem de preferência:

1. **WebRTC peer-to-peer (PeerJS)** — *recomendado para 2 jogadores*. Zero infra: um jogador "Cria
   sala" e recebe um código, o outro "Entra" com o código. Dados trafegam direto entre os
   navegadores. Use `templates/multiplayer-webrtc.html`. Limitação: depende do broker público do
   PeerJS para o aperto de mão (pode cair); para produção séria, hospede um PeerServer próprio.
2. **PHP polling** — estado no servidor via PHP + arquivo/`session` JSON, com o cliente fazendo
   `fetch` a cada ~500ms–1s. Funciona na hospedagem compartilhada, mas tem latência. Bom para jogos
   por turnos (xadrez/damas online, jogo da velha online), ruim para ação em tempo real.
3. **Serviço externo de realtime** (Firebase, Supabase, Ably, PartyKit) — para salas grandes ou
   tempo real de verdade. Precisa de conta/chaves; confirme com o usuário antes, pois sai do modelo
   "sem cadastro" do site.

Para qualquer multiplayer online: **sempre ofereça também um modo de 1 jogador ou local**, porque o
P2P pode falhar e o jogo não pode virar uma tela morta.

## `game.json` — referência dos campos

```json
{
  "title": "Nome do Jogo",
  "description": "Frase curta que aparece no cartão.",
  "emoji": "🚀",
  "tags": ["arcade", "1 jogador"],
  "entry": "index.html",
  "cover": "cover.png",
  "order": 10,
  "hidden": false
}
```

| Campo | Obrigatório | O que é |
|---|---|---|
| `title` | sim | Nome do jogo |
| `description` | não | Frase curta no cartão |
| `emoji` | não | Emoji da capa quando não há `cover` (padrão `🎮`) |
| `tags` | não | Etiquetas, ex.: `["puzzle", "2 jogadores"]` |
| `entry` | não | Arquivo de entrada (padrão `index.html`) |
| `cover` | não | Imagem de capa **16:10** (ex.: `cover.png` ou `cover.svg`) |
| `order` | não | Ordem na grade — menor aparece primeiro |
| `hidden` | não | `true` esconde o jogo (use durante o desenvolvimento) |

Dica: copie `templates/game.json` e ajuste. Para `order`, olhe os `order` já usados e escolha um
valor que posicione o jogo onde você quer (não precisa ser único).

## Convenções de UI/estilo (para parecer parte do estúdio)

- Fundo: `radial-gradient` de azul-marinho/roxo para quase-preto, texto branco.
- Caixa central `.card`/`.wrap` com cantos arredondados (`border-radius: 14–18px`), borda translúcida
  e `box-shadow` suave.
- HUD simples no topo (pontos, tempo, recorde) com `font-weight: 700`.
- Botões: cantos arredondados, cor de destaque (ciano/roxo/verde), `cursor: pointer`.
- Emojis são bem-vindos no título do jogo (`<h1>🟣 Pega Bolinha</h1>`) — combina com o público.

## Testar

```bash
# na raiz do repositório
php -S localhost:8080
# home: http://localhost:8080
# jogo direto: http://localhost:8080/games/<slug>/
```

Cheque sempre:
- O cartão aparece na home (se não aparecer: `game.json` inválido, `hidden:true`, ou `entry` errado).
- O botão "← Voltar" leva para a home.
- Funciona no celular (use o modo responsivo do navegador) e responde ao toque.
- Recorde persiste ao recarregar a página.
- (Online) Testar em duas abas/dois aparelhos: criar sala em um, entrar com o código no outro.

Conferir no ar (depois de publicar):
```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://jubis-games.cloud/games/<slug>/index.html
```

## Templates disponíveis

- `templates/game.json` — metadados base.
- `templates/2d-canvas.html` — jogo 2D com `<canvas>`: loop `requestAnimationFrame`, input de
  teclado + mouse + toque, HUD, recorde em `localStorage`, pausa, reinício e tela de fim de jogo.
- `templates/3d-threejs.html` — jogo 3D com Three.js via `importmap`: cena, luz/sombra, objeto
  controlável, coleta de itens com pontuação, `resize` e HUD.
- `templates/multiplayer-webrtc.html` — esqueleto de multiplayer online 2 jogadores via PeerJS
  (criar sala / entrar com código), com posições sincronizadas e um ponto marcado para plugar a
  lógica do jogo.
