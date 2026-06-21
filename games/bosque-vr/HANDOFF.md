# Bosque VR — prompt de contexto para outra LLM

> Cole o conteúdo abaixo numa nova sessão de LLM para que ela entenda o projeto e o
> jogo, e preencha a linha **"Tarefa:"** no final com o que você quer que seja feito.

---

Você vai ajudar a continuar o desenvolvimento de um jogo web. Leia o contexto e siga as regras.

## O projeto (Jubis Games)

- Site de jogos infantis em PHP, hospedado em Apache (hospedagem compartilhada) no domínio jubis-games.cloud.
- Cada jogo vive em `games/<slug>/` e é descoberto automaticamente: basta ter um `game.json` válido + um `index.html`. Não se mexe no index.php da raiz.
- Deploy é por `git push` na branch `main`. Tudo em PT-BR para o jogador.
- REGRAS INVIOLÁVEIS: sem build e sem npm/bundler (dependências só via CDN, usando `<script src>` ou importmap); responsivo; botão fixo "← Voltar" com `<a class="back" href="../../">`; usar `localStorage` p/ recorde quando fizer sentido. Preferir assets CC0 (domínio público).
- Cache: o `.htaccess` da raiz não cacheia HTML/PHP (atualiza na hora), mas cacheia js/css/imagens ~7-30 dias. Por isso, em assets externos use `?v=N` na URL e incremente ao trocar.
- Testar local: `./dev.sh up` sobe um PHP em Docker em http://localhost:8095 (o jogo fica em /games/<slug>/).

## O jogo atual: "Bosque VR" (pasta games/bosque-vr/)

Ambiente 3D em PRIMEIRA PESSOA, só pra PASSEAR (sem objetivo/pontuação): floresta espaçosa com lago e sol. Funciona em 3 modos:

- VR (óculos Meta Quest, via WebXR): entra com o botão VR, anda com a alavanca esquerda do controle; alavanca direita faz giro em passos (snap turn).
- PC: clica pra travar o mouse (pointer lock), olha com o mouse, anda com WASD (Shift = correr).
- Celular: arrasta pra olhar + direcional (joystick) na tela pra andar.

### Stack e arquivos

- Single-file `index.html` com Three.js 0.160 via importmap:
  `{"imports":{"three":"https://unpkg.com/three@0.160.0/build/three.module.js","three/addons/":"https://unpkg.com/three@0.160.0/examples/jsm/"}}`
  Imports usados: THREE, VRButton (`three/addons/webxr/VRButton.js`), RGBELoader (`three/addons/loaders/RGBELoader.js`).
- Assets locais (CC0): `sky.hdr` (HDRI de céu, Poly Haven), `grass.jpg` (textura de grama, Poly Haven) e os modelos 3D em `models/` (`trees.glb`, `pines.glb`, `rocks.glb` — todos CC0 Quaternius/poly.pizza). `game.json` e `cover.svg` (capa) também na pasta.
- `renderer.xr.enabled=true`, `setReferenceSpaceType('local-floor')`, `setAnimationLoop(frame)` (obrigatório p/ WebXR).

### O que já está implementado

- Céu + iluminação por imagem (IBL): RGBELoader carrega sky.hdr → PMREMGenerator → `scene.environment` e `scene.background` (com fallback de céu sólido se falhar).
- Terreno com RELEVO: função `heightAt(x,z)` (colinas suaves via senos/cossenos); o chão é um PlaneGeometry (110x110 segmentos) deslocado por heightAt com normais recalculadas + textura grass.jpg repetida. O lago fica numa BACIA (heightAt afunda perto dele).
- Lago: disco translúcido azul (levemente reflexivo) em y≈LAKE_Y(-0.9), com anel de areia (praia). Constante `LAKE={x:34,z:-26,r:26}`.
- Árvores (~240, **modelos GLB CC0 do Quaternius**, via `GLTFLoader`, em `models/trees.glb` (folhosas) e `models/pines.glb` (pinheiros), ~38% pinheiros): cada `.glb` traz 5 variantes; `extractVariants()` separa cada variante (assando `matrixWorld` e recentrando) e `buildInstanced()` cria um `InstancedMesh` por (variante × material) — instancing é crítico pro FPS no Quest. A escala é normalizada pra uma altura alvo (folhosas ~6.5 m, pinheiros ~8.5 m). Posicionadas na altura do terreno (heightAt), fora do lago e da clareira de spawn, com "sombra blob" (círculo escuro) sob cada uma. A IBL (sky.hdr) ilumina automaticamente.
- ~22 pedras (`models/rocks.glb`, 5 variantes, mesmo esquema de instancing, altura ~1.4 m) e ~11 AVES voando (procedurais: corpo fino e alongado, cabeça, bico, cauda e 2 asas compridas que batem; voam em círculos, orientadas com `lookAt`).
- COLISÃO: árvores e pedras são obstáculos — o array `obstacles` (montado das posições de `broad`/`pine`/`rockPlace`, com raio pequeno = tronco/base) empurra o jogador pra fora no loop, junto com os limites de mundo e do lago. (Não usa o veado — esse foi removido.)
- O jogador SEGUE o relevo: a cada frame `dolly.position.y = heightAt(x,z)`. Colisões: não sai do mundo (raio WORLD_R≈178) e não entra na água (empurra na margem do lago).
- ÁUDIO procedural (WebAudio), iniciado num gesto do usuário (clique em "Começar a passear") e no sessionstart do VR: vento (ruído filtrado), canto de pássaros (chirps agendados) e PASSOS na grama (crunch curto, disparado a cada ~1,7 m andados).
- Estrutura de câmera: um `dolly` (Group) contém a `camera`. Fora do VR, a câmera fica a 1.6m (altura dos olhos) e o yaw/pitch vêm do mouse/arraste; no VR a câmera vai a 0 (local-floor) e o headset cuida da cabeça. Locomoção sempre relativa à direção que se está olhando (`camera.getWorldDirection` projetado no plano).
- Tela inicial em PT-BR explicando os 3 modos de controle.

### Limitações/observações

- Sem shadow maps (só "sombras blob" sob as árvores) pra manter FPS no Quest. Instancing nas árvores. pixelRatio limitado a 2.
- VR de verdade só dá pra testar abrindo a URL publicada no navegador do próprio Meta Quest e tocando em "Entrar no VR" (no PC/headless aparece "VR NOT SUPPORTED").
- O áudio só toca após um gesto do usuário (regra dos navegadores).

## Como continuar

- Para adicionar MODELOS 3D externos (ex.: árvores/animais de packs CC0 como Kenney "Nature Kit" ou Quaternius — vêm em .zip), coloque os `.glb` em `games/bosque-vr/models/` e carregue com GLTFLoader (`three/addons/loaders/GLTFLoader.js`).
- Mantenha tudo CC0/sem-créditos-obrigatórios, sem build, e PT-BR pro jogador.
- Sempre teste a sintaxe do módulo e que o Three.js carrega sem erros antes de finalizar; só faça commit/push quando pedirem.

Tarefa: [DESCREVA AQUI o que você quer que a outra IA faça no Bosque VR].
