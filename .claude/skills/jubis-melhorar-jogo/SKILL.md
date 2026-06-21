---
name: jubis-melhorar-jogo
description: Melhorar/iterar um jogo JÁ EXISTENTE do Jubis Games (jubis-games.cloud) de forma rápida — localizar o jogo, editar, VERIFICAR visualmente (inclusive jogos 3D/WebXR via screenshot headless) e commitar. Use quando o usuário pedir para mudar, corrigir, melhorar, evoluir, ajustar visual/jogabilidade ou debugar um jogo que já está em games/. Para criar um jogo do zero, use a skill jubis-novo-jogo.
---

# Melhorar um jogo existente no Jubis Games

Esta skill é o **loop de iteração rápida** para mexer em jogos que já existem em `games/<slug>/`.
O objetivo é cortar o tempo perdido em (a) achar o que editar, (b) **verificar de verdade** que a
mudança funcionou (principalmente em 3D/WebXR, onde "parece que está certo" engana muito) e (c)
publicar sem quebrar as regras do projeto.

Leia também a skill `jubis-novo-jogo` para as **regras invioláveis** (PT-BR, sem build/npm, botão
"← Voltar", responsivo, CDN/importmap, cache). Elas continuam valendo aqui.

## Loop padrão (rápido)

1. **Suba o dev** uma vez: `./dev.sh up` → http://localhost:8095 (o jogo fica em
   `/games/<slug>/`). `./dev.sh logs` acompanha, `./dev.sh stop` derruba. Sem Docker:
   `php -S localhost:8095` na raiz.
2. **Ache o que editar** (seção "Localizar rápido"). A maioria dos jogos é **single-file**
   `index.html`; alguns grandes têm `game.js`/`style.css`.
3. **Edite** o arquivo. Recarregar o navegador reflete na hora (HTML/PHP não são cacheados).
4. **VERIFIQUE** (seção "Verificar de verdade"). Não confie em ler o código — tire screenshot
   ou cheque o console.
5. **Atualize docs** quando a mudança for estrutural (`README.md`, e o `HANDOFF.md` do jogo se
   existir).
6. **Só commite/pushe quando o usuário pedir.** Antes de commitar: `git pull --rebase --autostash`
   (há OUTRA IA mexendo no mesmo repo — nunca clobber os commits dela), remova arquivos
   temporários de teste, valide a sintaxe. Mensagem de commit em PT-BR.

## Localizar rápido

- Lista de jogos e descrições: `README.md` (seção "Jogos publicados") e cada `games/<slug>/game.json`.
- Dentro do jogo: `grep -n` pelo texto/rótulo que aparece na tela, pela função, ou pela constante.
  Em jogos 3D procure por `scene.add`, `new THREE.`, `function frame`/`animate`, `heightAt`,
  `InstancedMesh`. Em 2D procure pelo `draw`/`update`/`requestAnimationFrame`.
- Estado/recorde costuma estar em `localStorage` com chave `'<slug>-...'`.

## Verificar de verdade (o que mais economiza tempo)

Ler o diff NÃO prova que funcionou. Verifique conforme o tipo:

### Sintaxe do JS de um single-file (sempre faça antes de commitar)

```bash
python3 - <<'PY'
import re
h=open('games/<slug>/index.html').read()
m=re.search(r'<script type="module">(.*?)</script>', h, re.S) or re.search(r'<script>(.*?)</script>', h, re.S)
open('/tmp/mod.mjs','w').write(m.group(1)); print(len(m.group(1)),'bytes')
PY
node --check /tmp/mod.mjs && echo "SYNTAX OK"
```

### Screenshot headless de um jogo 2D/3D (Chrome + swiftshader)

Funciona em ambiente sem GPU. O `--enable-unsafe-swiftshader` é necessário.

```bash
google-chrome-stable --headless=new --no-sandbox --disable-gpu \
  --use-gl=swiftshader --enable-unsafe-swiftshader \
  --window-size=600,450 --screenshot=/tmp/shot.png \
  "http://localhost:8095/games/<slug>/" 2>/dev/null
```

Depois **leia a imagem** (`Read /tmp/shot.png`). Para inspecionar um ponto, recorte/amplie com PIL:

```bash
python3 - <<'PY'
from PIL import Image
im=Image.open('/tmp/shot.png'); w,h=im.size
im.crop((int(w*.3),int(h*.3),int(w*.7),int(h*.8))).resize((480,440)).save('/tmp/crop.png')
PY
```

### REGRAS DE OURO do screenshot headless (aprendidas na marra)

- **Assets assíncronos (GLB, HDRI, texturas, `fetch`) NÃO carregam a tempo no `--screenshot`
  simples** → você fotografa a cena vazia (só o que é síncrono aparece). Use
  **`--virtual-time-budget=12000`** junto com `--screenshot`: o Chrome espera a rede ficar ociosa
  (executa os callbacks de `GLTFLoader`/`RGBELoader`) e SÓ ENTÃO fotografa. Sem isso você debuga um
  fantasma. Comece a investigação por aqui antes de "consertar" o que não está quebrado.
- **`--virtual-time-budget` PAUSA `setTimeout`/`requestAnimationFrame` enquanto há rede pendente.**
  Logo: callbacks de `load()` disparam (são da rede), mas timers só disparam se o budget for maior
  que o atraso. Para um log que depende de timer, dê budget folgado (ex.: timer 800ms → budget
  ≥ 8000).
- **Overlays/intro tapam a cena.** Se o jogo tem tela inicial ("Começar"), o loop 3D já roda atrás
  dela, mas a foto pega o overlay. Para testar a cena, copie o `index.html` para um
  `__t.html` temporário e injete antes de `</body>`:
  `<script>setTimeout(()=>{var i=document.getElementById('intro');if(i)i.classList.add('hidden');},800);</script>`
  (ou dispare o `.click()` do botão; cuidado que iniciar áudio sem gesto pode lançar erro).
- **Capturar `console.log`**: adicione `--enable-logging=stderr --v=0` e redirecione `2>/tmp/log.txt`.
  Alternativa robusta que não depende de flag: escreva o valor em `document.title` e leia com
  `--dump-dom 2>/dev/null | grep -oE "<title>[^<]*</title>"`.
- **`GPU stall due to ReadPixels` no stderr é normal** (swiftshader lento), não é erro do jogo.
  Janelas menores (480–720px) e `run_in_background:true` + esperar o PNG existir evitam timeout.
- **Erros JS reais**: `grep -iE "error|uncaught" /tmp/log.txt` (ignore as linhas de `gl_utils`/
  `ReadPixels`/`gcm/engine`).
- **SEMPRE apague o `__t.html` e arquivos temporários antes de commitar** e confirme que nenhum
  código de teste (posições forçadas, materiais de debug, auto-hide) vazou para o `index.html`.

### O que o headless NÃO testa

- **WebXR/VR de verdade** só dá pra testar abrindo a URL publicada no navegador do próprio Meta
  Quest ("Entrar no VR"). No headless aparece "VR NOT SUPPORTED" — é esperado.
- **SwiftShader (GL por software) não renderiza alguns shaders** — em especial **SkinnedMesh
  (modelos animados com esqueleto) e morph targets podem não aparecer** mesmo com o código certo.
  Se a geometria estática some mas a animada não, suspeite do swiftshader, não do seu código:
  valide a posição/escala por dados (ex.: `Box3.setFromObject` no `document.title`) e confirme no
  hardware real (PC com GPU / Quest). Não fique horas "consertando" o que já está certo.

## Pega-ratões recorrentes

- **Cache de assets separados**: a raiz cacheia js/css/imagens ~7–30 dias. Se o jogo tem
  `game.js`/`style.css`/`cover.svg`, use `?v=N` na URL e incremente, OU crie um
  `games/<slug>/.htaccess` de no-cache (veja `defesa-zumbi-vip/.htaccess`). HTML single-file não
  precisa (não é cacheado).
- **Áudio (WebAudio) só toca após gesto do usuário** — inicie no clique de um botão e, em VR, no
  `sessionstart`.
- **Mobile**: teste no modo responsivo; jogos de ação precisam de controle por toque (joystick/
  botões), não só teclado. Para 3D/horizontal, considere forçar paisagem.
- **Performance 3D no celular/Quest**: `renderer.setPixelRatio(Math.min(devicePixelRatio,2))`,
  **InstancedMesh** para muitos objetos iguais, evite shadow maps (use "sombra blob"), limite a
  contagem de objetos e o tamanho dos `.glb`.
- **Não quebre a descoberta**: não mexa em `index.php`; mantenha `game.json` válido e o `entry`
  existente.

## Assets 3D externos (CC0 — obrigatório)

- **Só assets CC0** (domínio público, sem crédito obrigatório). CC-BY é proibido pela regra do
  projeto. Boas fontes: **Quaternius** (poly.pizza), **Poly Haven** (HDRIs e texturas),
  **Kenney**. Confirme a licença CC0 antes de baixar.
- Coloque os `.glb`/`.hdr`/`.jpg` em `games/<slug>/models/` (ou na pasta do jogo) e carregue por
  CDN/importmap: `GLTFLoader` (`three/addons/loaders/GLTFLoader.js`), `RGBELoader`
  (`three/addons/loaders/RGBELoader.js`). GLBs do Quaternius são não-comprimidos (sem DRACO).
- **Muitos objetos iguais → InstancedMesh.** Um `.glb` do Quaternius costuma trazer VÁRIAS
  variantes lado a lado dentro de um `RootNode`; separe cada variante (assando `matrixWorld` e
  recentrando pela posição de mundo), normalize a escala por uma altura alvo, e crie um
  `InstancedMesh` por (variante × material). Veja `games/bosque-vr/index.html`
  (`extractVariants()` + `buildInstanced()`) como referência pronta.
- **Modelo animado (SkinnedMesh)**: NÃO use instancing (é skinned). Use `AnimationMixer` +
  `mixer.clipAction(clip).play()` e `mixer.update(dt)` no loop. Para "andar no lugar", remova as
  tracks `.position` do clipe (root motion) e mova um `Group` pai. **Escale o `Group` pai, não o
  model** — escalar o root do SkinnedMesh costuma quebrar o skinning. Para clonar mantendo o
  esqueleto, use `clone` de `three/addons/utils/SkeletonUtils.js`. Lembre: pode não aparecer no
  headless (ver acima).
- **Iluminação**: `RGBELoader` → `PMREMGenerator` → `scene.environment` ilumina os modelos PBR
  automaticamente (IBL), sem precisar de muitas luzes.

## Antes de commitar (checklist)

- [ ] `git pull --rebase --autostash` (respeitar a outra IA no repo).
- [ ] Sintaxe do módulo validada (`node --check`).
- [ ] Verificado visualmente (screenshot) ou pelo console — não só "li o código".
- [ ] Temporários removidos (`__t.html`, screenshots em `/tmp` tudo bem deixar; nada de teste no
      `index.html`).
- [ ] Assets novos são CC0 e foram adicionados (`git add` da pasta de modelos).
- [ ] Docs atualizadas se a mudança foi estrutural (`README.md`, `HANDOFF.md`).
- [ ] Mensagem de commit em PT-BR. **Só commitar/pushar quando o usuário pedir.**
