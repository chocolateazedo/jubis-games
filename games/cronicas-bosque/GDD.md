# Crônicas do Bosque — A Semente do Amanhã
### Documento de Design (GDD) — fatia vertical WebXR · PT-BR

> Blueprint de trabalho. Base de código: `/home/rafa/dev/jubis-games/games/bosque-vr/index.html` (já tem todos os sistemas citados: `heightAt`, `spawnActor`/`playClip`, `menuPlane`/`drawMenu`/`buildIcons`/`menuPick`/`menuSelect`/`menuPage`, `dlgPlane`/`drawDialogue`/`advanceTalk`, `buildAimRay`/`raycaster`/`readSticks`/`rightCtrl`/`leftCtrl`, `dolly`/`mixers`/`_aimTargets`, `LAKE`/`WORLD_R`, `startAudio`/`chirp`, `removeBox`, `buildInstanced`, `obstacles`, `joy`, `talkHint`).
>
> **Conflitos resolvidos (cânone):** o herói é **"você"** (NPCs te chamam de *broto*; sem nome fixo). **Vovô Carvalho** é o carvalho-portal que fala e o coração emocional (cortei a "Coruja Jaci" como segunda guia — falas dela foram para o Vovô). O **chefe é a MARIPOSA Murcha** (a traça que rói a seiva do Vovô nas 3 eras) — o Vovô é a vítima, não o chefe. Vitória do chefe = **Acalanto (cantar)**, não "regar". Companheiros = **Fagulha (raposa)** e **Toco (castor)** — o "Pirilampo" virou os vaga-lumes da **Lanterna**. Item-chave do portal = **Lanterna-Vagalume** (cortei o "Sino"). Stats seguem a tabela de progressão (HP 20→50), inimigos seguem a tabela de inimigos.

---

## 1. Conceito & nome final

**Nome:** **Crônicas do Bosque — A Semente do Amanhã.**

RPG single-player de **viagem no tempo**, infantil e gentil, em **WebXR (Meta Quest) + PC + celular**, sem build/npm (Three.js 0.160 via importmap CDN). O Bosque adoece de uma **Murcha** cinzenta; **Vovô Carvalho** (carvalho ancião que fala e cujas raízes tocam o ontem e o amanhã) te leva por **3 eras** — Semente (passado), Bosque (presente), Ermo (futuro murcho). Você descobre que uma **mariposa faminta** rói a seiva do Vovô através do tempo e por isso o futuro secou. **Curar o futuro mudando o passado.** Combate **ATB por turnos** fiel ao Chrono Trigger, **no próprio mapa, sem tela de batalha**. Sem violência: derrotar = bichinho boceja e some numa fumacinha. Tudo PT-BR, botão "← Voltar".

**Pilares:** (1) mesmo mundo, 3 peles — causalidade visível entre eras; (2) ATB tático por **essências**; (3) **"às vezes ganhar é cuidar"** (clímax = ninar, não bater). Duração: **~40–50 min**.

---

## 2. Loop de jogo da fatia

```
EXPLORAR (3 eras, mesmo terreno) ──► achar item-chave / NPC ──► destravar viagem/área
        │                                                              │
        ▼                                                              ▼
  ENCONTRO no mapa (aggro) ──► BATALHA ATB (essências) ──► XP/nível ──► fica mais forte
        │                                                              │
        ▼                                                              ▼
  MUDAR O PASSADO (plantar/limpar fonte) ──► flag de mundo ──► PRESENTE e ERMO mudam
                                                                       │
                                                                       ▼
                                          CHEFE no Ermo ──► ACALANTO ──► MOMENTO + escolha + epílogo
```

Micro-loop de batalha: barra ATB enche → menu por raio → **escolher essência certa (x2)** → mirar alvo → resolver → repetir até bichinhos sumirem → fanfarra + XP.

---

## 3. As 3 eras e o portal

**Princípio de render barato:** 1 topografia (mesma `heightAt`, mesmo `LAKE={x:34,z:-26,r:26}`, mesmo `WORLD_R=178`, mesmos `InstancedMesh` de árvores/pinheiros/pedras). Trocar de era = só material/cor/visibilidade/névoa/luz/trilha. Nada é reinstanciado → transição "flash" quase de graça.

`applyEra(e)` ajusta `scene.background`, `scene.environment` (intensity), `fog`, `sun`, hemisférica, `ground.material.color`, visibilidade de folhas/aves/cinzas/flores, cor de troncos, `lakeWater`/`lakeMud`, e `inimigos.visible`:

```js
ERAS = {
  bosque:  { bg:0x9ed0f2, useHDRI:true,  fog:[0xbfe0f5,60,230], sun:[0xfff4d6,1.4],
             ground:0xffffff, leaves:true,  trunk:0x6b4f2a, water:'azul',     extra:'aves'   },
  ermo:    { bg:0xcf9b5a, useHDRI:false, fog:[0xc98a4a,40,160], sun:[0xffb066,0.9],
             ground:0x9a7b4a, leaves:false, trunk:0x5a4a3a, water:'seco',     extra:'cinzas' },
  semente: { bg:0xffe0c0, useHDRI:false, fog:[0xffe6c8,70,260], sun:[0xffe6b0,1.2],
             ground:0x6fbf4a, leaves:true,  trunk:0x6b4f2a, water:'nascente', extra:'flores',
             treeScale:0.25, raioNevoa:70 } }
```

| Era | Clima | Lago | Árvores | Papel |
|---|---|---|---|---|
| 🌳 **Bosque** (presente) | visual atual (HDRI azul) | azul cheio | adultas | **HUB**, recrutas, NPCs, fase 1 do chefe |
| 🥀 **Ermo** (futuro) | ocre/sépia, névoa fechada, fagulhas de cinza, sem pássaros | leito de barro rachado | mortas (folha off, tronco cinza) | inimigos + **arena do chefe** |
| 🌱 **Semente** (passado) | amanhecer rosa-dourado, **área menor** (névoa fecha em raio ~70) | nascente turquesa | brotos (escala 0.25) | onde você **muda o passado** |

**Mapa (mesmas coordenadas nas 3 eras):**
```
        ◎ ARENA DO CARVALHO (20,-110)  ← chefe (Ermo)
            ~~~ LAGO (34,-26) ~~~       ← fonte/seco/cheio
  ⛰ Mirante(-60,-10)   🌳 VOVÔ CARVALHO (6,22) = PORTAL
  ⛺ Vila(-30,50)        ★ CLAREIRA DO DESPERTAR (10,64) = SPAWN
```

**Portal = Vovô Carvalho** `(6,22)` (reescala `models/trees.glb` ~3× + carinha billboard). Anel de luz girando na base. Aproximar → menu **"As Eras"** (3 botões grandes: 🌱 Semente · 🌳 Bosque · 🥀 Ermo). Transição = clarão branco (fade rápido) + `applyEra()` no meio + crossfade de trilha. Spawn e portal na mesma coordenada → "atravessa o tempo sem se teletransportar no espaço" (pilar do Chrono).

**Gating suave:** Semente só destrava após a **Lanterna-Vagalume** (acende o oco escuro do carvalho). Ermo destrava quando o Vovô te manda olhar o futuro (1º diálogo).

---

## 4. Questline (beats) + o Momento

**Causalidade (3 alavancas → flags → re-render condicional das eras):**
- `lanterna=true` → abre o oco → viagem destravada.
- `fonteLimpa=true` (Toco tira a pedra da nascente no passado) → **presente:** lago transborda; **Ermo:** leito enche de água, lava o cinza e **abre o caminho** até a arena do chefe.
- `sementePlantada=true` (planta a Semente-do-Amanhã no passado) → **presente:** Vovô ganha galho novo, mancha cinza encolhe; **Ermo:** cresce uma **árvore-ponte**, Vovô-futuro reverdece o bastante pra te apontar o ninho da mariposa.

**Os 8 beats:**

1. **O Bosque doente (tutorial).** Acorda na Clareira `(10,64)`; manchas cinzas no chão. Fala com **Seu Cogu**. **1ª batalha fácil** (1 Brotoca) ensina a barra ATB e a essência ☀️. Chega ao **Vovô**, que (sonolento) sente o cinza nas raízes. **Recruta Fagulha** (presa em espinhos secos — "Ajudar").
2. **O Ermo (setup do golpe no peito).** Lanterna na mão → Vovô abre o oco e te leva ao futuro. Mundo **todo cinza**, lago é poeira, silêncio, trilha esparsa. Acha **Vovô Carvalho murcho**, quase apagado, e o **ninho vazio com uma única folha verde teimosa**. Ele te dá a **Semente-do-Amanhã** (murcha aqui) e aponta o passado. *(O MOMENTO de virada — ver beat 6 para o clímax.)*
3. **A Semente (passado).** Tudo jovem e colorido; Vovô é um **broto** num vaso. NPC **Broto** pede ajuda. Explora e acha as **2 causas**: (a) a nascente **entupida por uma pedra**; (b) a covinha onde plantar. Combate com Brotoca + Abelhão. **Recruta Toco** (leva 3 gravetos → ele fecha a represa).
4. **Causa→Efeito #1 (semente).** Planta a **Semente-do-Amanhã** ao lado do broto e rega. Volta ao presente: mancha cinza **encolhe**, Vovô ganha galho novo. 1ª prova de que mexer no ontem muda o agora.
5. **Causa→Efeito #2 (água).** Com Toco, **tira a pedra da nascente**. Presente: lago transborda. **Ermo:** o leito seco **enche de água**, lava o cinza e **revela o caminho** à arena do chefe.
6. **O coração da Murcha (chefe, no Ermo) — O MOMENTO.** Na copa→tronco→raiz do Vovô-futuro está a **mariposa Murcha**, de frio e sozinha, roendo a seiva. Luta ATB em 3 fases; a 3ª vira **"🎵 Cantar"** (Acalanto): você ninja a mariposa em vez de bater. Ela boceja, encolhe numa **tracinha minúscula** que cabe no colo, e o Vovô **floresce** — o **Ermo reverdece em tempo real** (paleta/IBL + brotos instanciados surgindo). *Esse é o Momento marcante: "às vezes ganhar é cuidar".*
7. **A escolha (consequência, semeia Chrono Cross).** A mariposa adormecida deixa uma **última semente limpa**. Duas opções, o jogo lembra a flag `escolha`:
   - **(A) Plantar no Ermo agora** → futuro murcho **renasce na sua frente**; Vovô-futuro **lembra de você** ("Obrigado por voltar pra mim"). Final caloroso, **remendado**. Flor-souvenir **dourada** no hub.
   - **(B) Levar à Semente e enterrar fundo** → a Murcha **nunca chega a existir**; o Ermo que você viu **deixa de acontecer**, vira era nova exuberante — mas o Vovô-murcho **não te conhece**. Final agridoce, **tempo limpo**. Flor-souvenir **prateada**.
8. **Epílogo.** Presente: cinza sumiu, Vovô saudável, **fanfarra**. Brilho novo no tronco: *"Outras eras te esperam, broto…"* — gancho.

---

## 5. Combate ATB no VR (regras concretas)

**Onde:** no próprio mapa. Cada grupo inimigo é ator vivo (`spawnActor`) com `userData.battle={aggro:6}`. No `frame()`: se `dist(dolly,grupo)<aggro` e `!inBattle` → `startBattle(grupo)`: trava locomoção (`inBattle` zera input do `dolly`), desenha **anel-arena** (`RingGeometry` no `heightAt`), crossfade pro **tema de batalha**. Fim → tudo volta.

**Arranjo:** herói **"você"** em 1ª pessoa (HP/MP no **bracelete de pulso**, plane filho do `leftCtrl`). Até **2 companheiros** (`spawnActor`) flanqueando a ±1.2 m, com **barra HP billboard**. **Inimigos** num arco a ~5–9 m, `lookAt(dolly)`, barra HP billboard.

**Barra ATB:** `atb` 0→1, `vel = 0.28 + AGI/200` (cheia ~3–4 s). **Modo Calmo (default, kids):** ao abrir o menu o tempo **pausa**; fora do menu corre. (Toggle "Ativo" nas Opções.)

**Comando por raio (VR):** ATB cheia → `chirp` + brilho no controle + anim `emote-yes`. **Gatilho direito** abre o `menuPlane` à frente (anel de 4 pétalas no `mCanvas`):

```
        ⚔ Atacar
   ✨ Técnica      🎒 Item
        🛡 Defender / 🏃 Fugir
```

Raio mira → célula acende (`menuPick`/hover) → **gatilho** confirma (`menuSelect`). Técnica/Item abrem lista no mesmo `menuPlane` (`menuPage`). **Grip = Voltar**. **Alvo:** `_aimTargets` recebe inimigos (ou aliados p/ cura); alvo sob o raio pulsa (emissive) + anel verde no chão (reusa `removeBox`→`targetRing`). Magia de área não pede alvo.

**Roda das Essências (miolo tático):**
- ☀️ **SOL** > 🍃 Folha e dissipa 🌫️ Cinza · 💧 **ÁGUA** > ☀️ Sol e amolece 🌫️ Cinza · 🍃 **FOLHA** > 💧 Água · 🌫️ **CINZA** > 🍃 Folha (essência da praga).
- Acerto na fraqueza = **dano ×2** + faísca colorida. Ícone da essência flutua sobre o bicho (criança lê fácil).

**Fórmulas:**
```
Físico:  dano = max(1, round((ATK*2 - DEF) * rand(0.9,1.1)))   // crít 1/16 → ×1.5
Magia:   dano = max(1, round((PODER + MAG - DEF/2) * rand(0.9,1.1)))
Cura:    cura = round(PODER + MAG)
Fraqueza de essência → resultado ×2 ; resiste → ×0.5 ; imune → 0
```

**Defender:** dano recebido ×0.5 até agir de novo; ATB enche +30%. **Fugir:** `chance=clamp(0.4+(AGI_grupo−AGI_inim)/40,0.25,0.95)`; falhou 2× → foge garantido (não trava criança).

**Feedback (sem violência):** acerto = flash branco 1 frame + recuo + número subindo. Derrota = `scale→0` + **fumacinha** (Points/sprite) + som fofo. Cura = brilho verde subindo. Ataque do herói 1ª pessoa = arco de cajado preso à câmera + flash na borda.

**Vitória:** fanfarra procedural + "Você venceu! Ganhou X de experiência!"; cruza limiar → "Você subiu pro nível N!" (cura tudo). Drop ocasional. **Derrota (sem game-over):** tela escurece suave, *"Você cochilou no Bosque…"*, acorda no spawn `(10,heightAt,64)`, HP/MP cheios, inimigos resetados.

---

## 6. Inimigos & chefe

**Atributos:** HP, MP, ATK, DEF, MAG, AGI. Mesmo GLB recolorido por era via `material.color`; mesmo tipo = `InstancedMesh`.

| Inimigo | Era | Essência | HP | ATK | DEF | AGI | Fraqueza ×2 | Resiste/Imune | XP | Modelo (reuso) |
|---|---|---|---|---|---|---|---|---|---|---|
| **Brotoca** | Semente | 🍃 Folha | 12 | 3 | 2 | 6 | ☀️ Sol | — | 3 | `animal-caterpillar.glb` recolor verde |
| **Abelhão Zonzo** | Semente/Bosque | ☀️ Sol | 18 | 4 | 2 | 11 | 💧 Água | resiste 🍃 | 4 | `animal-bee.glb` |
| **Lobinho de Musgo** | Bosque | 🍃 Folha | 24 | 6 | 4 | 12 | ☀️ Sol | resiste 💧 | 6 | `animal-dog.glb` recolor musgo |
| **Cinzela** | Ermo | 🌫️ Cinza | 20 | 5 | 3 | 8 | 💧 Água, ☀️ Sol | **imune 🍃** | 5 | `animal-caterpillar.glb` recolor cinza (ponte visual) |

- **Brotoca** (tutorial): *Cabeçadinha* (boing); raro *Soneca de Folha* (+2 cura, baixa a guarda 1 turno).
- **Abelhão Zonzo** (mexe com o tempo): *Ferroadinha* (fraca, ATB enche cedo); *Zumbido* (ATB de 1 herói +lento por 2 turnos; Água cancela).
- **Lobinho de Musgo** (rápido, em dupla): *Mordidinha*; *Uivinho* (se sozinho, chama +1, 1×/luta; golpe ☀️ silencia).
- **Cinzela** (prévia da praga): *Baforada* (−ATK de 1 herói, 2 turnos); *Murchar* (drena 3 HP, cura-se; Água a vira barro → some). Também **invocada pelo chefe**.

### CHEFE — MURCHA, a Mariposa-do-Fim
Traça grande, asas empoeiradas cinza-lilás, olhos sonolentos e tristes (as Cinzelas são escamas dela). Está com **frio e sozinha**, roendo a seiva do Vovô nas 3 eras. **Não é vilã** — vencer = **acalentar**. Modelo: `animal-bee.glb` escalado ×2.5, recolor cinza-lilás + **Points** de pó (instanced, sem shadow).

| Fase | Local | HP | ATK | Essência / Fraqueza | Mecânica |
|---|---|---|---|---|---|
| **1 — Esvoaça** | copa (Bosque) | 60 | 8 | 🌫️ / **☀️ Sol** | *Vendaval de Pó* (área, −ATK 1 herói); *Chuva de Escamas* (invoca 2 Cinzelas). Sol limpa o pó → "tossindo" (turno aberto). Cada golpe ☀️ deixa a copa mais verde. |
| **2 — Casulo** | tronco | 50 (+escudo) | 7 | escudo cede a **💧/☀️** | Enrola-se e **suga seiva** (barrinha enche; cheia → cura 10). *Gota-Seca* (drena HP p/ encher mais rápido). Sequência: **abrir escudo → bater**. Pressão de tempo (puro ATB). |
| **3 — Acalanto** | raiz | — (sem barra) | 4 | — (**Cantar**) | Casulo abre, ela só **treme de frio**. Surge **"🎵 Cantar"**: 3 turnos, cada herói toca uma nota (mini-ATB) da **canção de ninar**. A cada nota ela se acalma; na última, **boceja e adormece** → vira tracinha no colo. Vovô floresce → **Ermo reverdece em tempo real**. |

> Se insistir em bater na Fase 3, ela só se esquiva e fica mais triste; o jogo empurra gentilmente pro Cantar. **Mensagem: às vezes ganhar é cuidar.**

---

## 7. Companheiros, itens & progressão

**Companheiros (2, recrutáveis; 1 ativo por vez no VR p/ FPS — troca na Bolsa).**

| Companheiro | Modelo | Perfil | Técnicas | Recruta (causalidade) |
|---|---|---|---|---|
| **Fagulha** (raposa) | `pets/animal-fox.glb` | Rápida (ATB +30%), frágil. Núcleo da fatia. | **Fagulha!** (☀️ área leve, 3 MP, PODER 4); **Vagalumes** (☀️ área forte, 4 MP, PODER 7, aprende Nv4) | Bosque: presa em espinhos secos (ação "Ajudar"). |
| **Toco** (castor) | `pets/animal-beaver.glb` | Lento, tanque (HP/DEF alto). Cobre 💧. | **Represa!** (reduz dano do grupo ×0.5 por 2 turnos, 4 MP); **Jato de Orvalho** (💧 dano, amolece Cinza, 3 MP, PODER 6) | Semente: leva 3 gravetos → fecha a represa → o lago passa a existir no presente. |

**Você (herói) — progressão (Nv1→5 cobre a fatia; XP só de batalha):**

| Nv | XP p/ subir | HP | MP | ATK | DEF | MAG | AGI | Aprende |
|---|---|---|---|---|---|---|---|---|
| 1 | 0 | 20 | 5 | 4 | 3 | 4 | 8 | Atacar |
| 2 | 8 | 26 | 7 | 5 | 4 | 5 | 9 | **Brotar** (cura 🍃, 3 MP, PODER 6) |
| 3 | 20 | 32 | 9 | 6 | 5 | 6 | 10 | **Casca-Escudo** (+DEF aliado 3 turnos, 3 MP) |
| 4 | 40 | 40 | 12 | 8 | 6 | 8 | 11 | **Sopro do Tempo** (enche ATB de aliado, 5 MP) |
| 5 | 70 | 50 | 15 | 10 | 7 | 10 | 12 | **Eco do Amanhã** (☀️ todos, finisher, 8 MP, PODER 14) |

Companheiros sobem na mesma tabela com valores um tico menores (sem microgerência). Subir de nível cura tudo + fanfarra.

**Itens-chave (destravam, estilo Zelda):**
- **Lanterna-Vagalume** — o Abelhão NPC te dá; acende o **oco escuro** do Vovô e **destrava a viagem no tempo**. Sem ela: *"Escuro demais… preciso de uma luz."* + colisor invisível.
- **Semente-do-Amanhã** — achada murcha no Ermo; plantada na Semente cura o futuro (flag `sementePlantada`; faz crescer a árvore-ponte no Ermo).

**Equipamentos (slots Arma + Amuleto, equipar instantâneo na Bolsa):**
- **Vara-Curva** (arma, +3 ATK) — baú no oco do carvalho. Troca o cajado na mão.
- **Amuleto-de-Folha** (amuleto, +8 HP máx) — recompensa por recrutar o Toco.

**Consumíveis (na batalha):** **Mel-do-Bosque** (cura 15 HP; 2 no início, dropa de inimigos) · **Orvalho** (cura 6 MP; raro).

**Save (`localStorage:'cronicas_save'`):**
```js
save = { nivel:1, xp:0, hp:20, hpMax:20, mp:5, mpMax:5,
  arma:null, amuleto:null, itens:{ mel:2, orvalho:0 },
  chaves:{ lanterna:false, semente:false },
  companheiros:{ fagulha:false, toco:false }, ativo:"fagulha",
  flags:{ lanterna:false, fonteLimpa:false, sementePlantada:false,
          bossDormiu:false, escolha:null /* 'remendo' | 'limpo' */ } }
```

---

## 8. Diálogos prontos (PT-BR)

**Vovô Carvalho** (portal; voz mansa, te chama de "broto"):
- *(Bosque, ao chegar perto)* "Ô, broto… chega mais, sem medo. Tem um cinza entrando nas minhas raízes… e minhas raízes tocam o ontem e o amanhã. Quer ver pra onde isso vai dar?"
- *(abrindo o oco)* "Pisa aqui no meu oco. A lanterninha acende o caminho. Lá na frente, muitas luas depois, o bosque vira **Ermo**: seco, cinza, dormindo. Mas o futuro é só um galho que dá pra entortar pro lado bonito."
- *(no Ermo, murcho)* "Você veio… tarde demais pra mim. Mas não pra ele. Pega essa semente, broto. Planta ela quando eu ainda era pequenininho. O que você conserta lá, floresce aqui."

**Seu Cogu** (cogumelo fofoqueiro, Bosque):
- "Psiu… chega pra cá. Reparou que o lago tá com gostinho de poeira? Não é normal, não. É o futuro vazando pra cá, pela raiz do carvalho."
- *(depois)* "Ahá! Eu sabia que você ia mexer com o tempo. Cuidado com o que você arranca lá atrás — toda folha que cai aqui caiu primeiro em outro lugar."

**Broto** (muda-criança, Semente):
- "Oi oi oi! Tá vendo essa covinha? Eu ia plantar o carvalhinho, mas os **bichos-da-soneca** ficam bocejando em cima da terra e a semente dorme antes de nascer! Faz eles pararem, vai?"
- *(área limpa)* "UAU, parou tudo! Agora rega aqui comigo… pronto. Esse carvalhinho vai virar o avô de todas as árvores. Cuida dele no teu tempo, tá?"

**Fagulha** (ao recrutar): "Ai, esses espinhos!… Ufa, obrigada. Você também sente o bosque ficando triste? Eu vou junto!" → **[Vem comigo, Fagulha!]**
**Toco** (ao fechar a represa): "Agora o bosque vai ter água pra sempre! Deixa eu ir com você." → **[Bola pra frente, Toco!]**

**A reviravolta** *(Fagulha, na Fase 2 do chefe)*: "Espera… esse jeito torto de asa, esse pó… ela não tá brava. Ela tá com **frio** e **sozinha** faz tempo demais. Não dá pra bater nela — dá pra **acalmar**."

**MURCHA** (chefe):
- *(ao surgir)* "Quem… me acordou? Eu sou só o último galho que sobrou. Vai embora, brotinho. Aqui já não nasce mais nada."
- *(metade da vida)* "Por que você insiste? Ninguém me regou, ninguém lembrou de mim… então eu sequei."
- *(ao adormecer, no Acalanto)* "Ah… que sono bom… que fresquinho. …Obrigada por cantar pra mim."

**Final A — remendo** *(Vovô-futuro)*: "Eu lembro de você. Você é o broto que me plantou. Obrigado por voltar pra mim."
**Final B — tempo limpo** *(Vovô do novo futuro)*: "Que era bonita essa… mas eu não te conheço, broto. Que bom que você existe em algum lugar."

**O Momento marcante (texto no Ermo, balão branco, 1 linha por vez):**
> *Aqui foi o bosque.*
> *O lago virou pó. O céu esqueceu de ser azul.*
> *No galho mais alto, o ninho está vazio — frio faz muito tempo.*
> *Mas olha: uma folhinha verde, teimosa, ainda segura no galho.*
> *Uma folha é pouco. Uma folha é tudo o que o futuro precisa pra recomeçar.*
> → **[Pegar a folha]**

*Implementação:* reusa `dlgPlane`/`drawDialogue`/`advanceTalk`; falas longas quebradas em balões de 1–3 linhas; escolhas = 2 botões grandes máx.; gatilhos por proximidade + flags.

---

## 9. UX/menus & controles por aparelho

**Tudo é painel canvas→textura 3D** (mesmo código em VR/PC/celular). **Sem tela de batalha, câmera nunca corta.** Paleta: fundo `rgba(8,22,16,0.92)`, borda `rgba(160,230,180,0.6)`, texto `#eaffee`/`#bdf5c8`.

- **HUD bracelete (VR):** painel canvas filho do `leftCtrl`, ~35° voltado ao rosto. HP (verde), MP (azul), **selo de era** (cor tinge a borda), e mini-ATB em batalha. PC/celular: mesmas barras no canto inferior-esquerdo. Dano = **número flutuante** (sem barra de vida fixa em cada inimigo).
- **Menu de batalha:** `menuPlane` reciclado como **anel de 4 pétalas**; submenus no grid `menuPage`. Fica **fixo no mundo** ao abrir (não segue a cabeça).
- **Bolsa/Equipar (fora de batalha):** mesmo `menuPlane`, abas `🎒 Itens · ⚔ Equipar · 👫 Heróis · ✖`, ícones 3D (`buildIcons`). Stat sobe em verde ("Mais forte!"/"Mais rápido!").
- **Objetivo:** pilar de vaga-lume dourado (Sprite aditivo, sem shadow) no próximo alvo; seta na borda do bracelete quando fora de vista; texto curto da quest no topo.
- **Transições sem loading:** batalha = "varredura" (~0.8 s: anel de luz + stinger + crossfade). Era = "respiração do tempo" (~1.2 s: vaga-lumes + fog fecha/abre + `applyEra`).

| Ação | 🥽 Quest | 💻 PC | 📱 Celular |
|---|---|---|---|
| Andar | alavanca esq. | WASD | joystick (`joy`) |
| Girar/Olhar | alavanca dir. (snap) | mouse | arrastar |
| Confirmar/Atacar/Falar | gatilho dir. (`interact`) | E / clique | toque (`talkHint`) |
| Cancelar/Voltar | botão B / Grip | Q / Esc | botão ⬅ |
| Abrir menu | botão Y | Espaço/Enter | pétalas / 🎒 |
| Mover cursor / mirar alvo | raio do controle dir. | mouse / Tab | tocar no inimigo |
| Trocar herói | X/A | 1/2/3 | botão |
| Correr | gatilho esq. | Shift | — |

Botão **"← Voltar"** (`<a class="back" href="../../">`) fixo fora do VR.

---

## 10. Áudio procedural (100% CC0)

Reusa o `actx` de `startAudio()`. **Arquitetura única:** 1 compressor + 3 buses (`busMusic`/`busSfx`/`busAmb`) + 1 sequenciador lookahead (`setInterval(tick,40)`, "two clocks"). Voz = osc descartável com ADSR (`voz(freq,t,dur,opts)`), `m2f` MIDI→Hz. Áudio só inicia em gesto (`sessionstart` + `click/touch`→`actx.resume()`). Botão 🔊/🔇 rampa `master.gain`. Sem violência sonora.

**Temas (base em Ré — mesma melodia transformada = "mesmo bosque no tempo"):**

| Era | Tom | BPM | Timbres | Caráter |
|---|---|---|---|---|
| **Semente** | Ré maior pent. (1 oitava acima) | 96 | `sine` decay curto (caixinha) | inocente, saltitante |
| **Bosque** | Ré maior pent. | 76 | `triangle` lead + `sine` pad (D2/A2) | acolhedor, rubato leve |
| **Ermo** | Ré menor eólio | 56 | drone detune ±10c + lead em `lowpass 800` + delay/feedback | notas que caem, silêncios |
| **Batalha** | Ré menor heroico | 140 | kick pitch-drop + caixa/chimbal (ruído do vento) + baixo `square`→`lowpass` + riff | **riser** ligado ao % da ATB; "ping" na barra cheia |
| **Acalanto** (Fase 3) | tema Semente lento | ~52 | caixinha de música | canção de ninar (cada nota = 1 herói) |

**Crossfade** ao usar o portal (1.5 s) mascarado pelo SFX do portal; ambiente troca junto. **Fanfarra de vitória** (~3.5 s, não-loop): 3 stabs maiores ascendentes + nota final com trinado + faísca.

**SFX (procedurais, `busSfx`):** Golpe (ruído `lp1.2k` + `sine` 180→60); Magia (arpejo shimmer detune + sweep); Cura (tríade sino decay lento); Menu (blips `square`); Achado (jingle 4 notas); **Portal** (sweep 60→1200→60 + whoosh `bandpass` + shimmer no delay, ~2 s — o "momento"). **Ambiente por era:** Bosque (vento `lp420` + pássaros); Ermo (vento grave `lp260`, **sem pássaros**, rangidos/lamento); Semente (vento brilhante + pássaros + insetos). Reusa o buffer de ruído do vento p/ percussão/whoosh.

---

## 11. Lista de assets

**Reuso (já no repo, zero download, todos CC0):**
- **Inimigos/companheiros:** Kenney **Cube Pets** `pets/animal-*.glb` (license no repo). Usados: `fox`(Fagulha), `beaver`(Toco), `caterpillar`(Brotoca→Cinzela recolor), `bee`(Abelhão + **chefe** escalado ×2.5), `dog`(Lobinho recolor musgo).
- **NPCs:** Kenney **Blocky** `npcs/character-*.glb` (Seu Cogu, Broto — recolor).
- **Natureza:** Quaternius `models/trees.glb` (Vovô = ×3), `pines.glb`, `rocks.glb`.
- **Construção (gravetos do Toco / baú):** `build/*.glb`.
- **Passos:** Kenney RPG Audio `sounds/footstep0*.ogg` (CC0). **Terreno/céu:** `grass.jpg`, `sky.hdr`.

**Procedural (zero crédito):** TODA a trilha + SFX (WebAudio); barras ATB/HP/MP, números de dano/cura, reticle, **anel-arena**, flash de acerto, **fumacinha**, pó da mariposa, brilhos de magia (CanvasTexture/Points/Sprite); menus e ícones 3D; balões; carinha do Vovô; flores/cinzas instanciadas; **cajado 1ª pessoa** (cone+box).

**Download opcional (CC0, só se quiser visual melhor — NÃO bloqueia a fatia):** Quaternius *Ultimate/Animated Monsters* (poly.pizza) p/ slime/cogumelo/mariposa dedicados; Quaternius *Weapons* p/ a Vara-Curva. Fallback de SFX gravado: Kenney UI/RPG/Interface Audio (CC0).

---

## 12. Plano de build (milestones)

> **Primeiro jogável = fim da M3.** **Fatia completa = fim da M6.** Polimento = M7.

- **M0 — Setup single-player.** Fork do `bosque-vr`; desliga UI de construção/multiplayer; cria `save` em `localStorage`; mantém "← Voltar". *Entrega: andar no Bosque atual, sozinho.*
- **M1 — Eras + portal.** `applyEra('bosque'|'ermo'|'semente')` com a tabela `ERAS` (fog/sun/bg/IBL/ground/folhas/lago/troncos/aves-cinzas-flores); separar materiais tronco/folha; mesh do Vovô + anel + menu "As Eras" + fade. *Entrega: viajar entre as 3 peles, mesma colisão.*
- **M2 — Áudio em buses.** Refatora `startAudio` → compressor+3 buses+sequenciador; 3 temas de era + SFX do portal + crossfade + ambiente por era. *Entrega: cada era soa diferente, transição mascarada.*
- **M3 — Núcleo de combate (modelo único).** Máquina ATB (`atb`, `vel`, modo Calmo), stats, fórmulas físico/magia/cura, **essências ×2/×0.5/imune**; inimigo-ator com aggro→`startBattle` (lock locomoção, anel-arena, crossfade batalha); `menuPlane` em anel + raio + `_aimTargets`; billboards HP/ATB, números, fumacinha, fanfarra, XP/level-up; derrota gentil. *Entrega (PRIMEIRO JOGÁVEL): 1 luta contra Brotoca no Bosque, com menu por raio, vitória e XP.*
- **M4 — Inimigos + companheiros.** 4 tipos recoloridos dos Cube Pets + posicionamento por era (`InstancedMesh`); recruta Fagulha (espinhos) e Toco (gravetos/represa); fila ATB do grupo; técnicas dos companheiros (Fagulha!, Represa!, Jato de Orvalho). *Entrega: lutas com party e variedade tática.*
- **M5 — Questline + diálogos + causalidade.** Diálogos (Vovô, Seu Cogu, Broto, recrutas) no `dlgPlane`; gate da Lanterna; Semente-do-Amanhã; flags `fonteLimpa`/`sementePlantada` ligadas às variantes do `applyEra` (galho novo / mancha menor / lago no presente / água no Ermo / árvore-ponte); marcador de objetivo; Bolsa/Equipar. *Entrega: beats 1–5 jogáveis, causa→efeito visível.*
- **M6 — Chefe + Momento + escolha.** MURCHA 3 fases (Esvoaça/Casulo/Acalanto); mini-game Cantar; **Ermo reverdece em tempo real**; escolha A/B + flor-souvenir dourada/prateada; epílogo + fanfarra longa. *Entrega: FATIA VERTICAL completa, início-meio-fim + Momento.*
- **M7 — Polimento.** Paridade de overlay PC/celular; HUD bracelete; mapa por era; passe de performance (instancing, `pixelRatio<=2`, sem shadow maps pesados, polifonia limitada); balanceamento; save/load; testes em Quest. *Entrega: fatia polida, pronta pra crescer.*

---

# 🔎 CRÍTICA TÉCNICA / ESCOPO (corta o excesso, define o MVP)

# Crítica técnica — Crônicas do Bosque (fatia vertical WebXR)

## (a) Ambicioso demais para uma fatia vertical — cortar/adiar

- **As 3 eras com re-render condicional por flags.** Você não precisa de 3 peles + 3 variantes de cada uma (lago seco/cheio, galho novo, árvore-ponte, cinza que encolhe) para *provar* o jogo. Para a fatia: **Bosque + Ermo** bastam. Semente (passado) é a era mais cara em conteúdo (NPC novo, 2 causas, escala 0.25, névoa raio 70) e é a que pode ser adiada sem matar o pilar — desde que você prove "mexer no passado muda o presente" com **uma** alavanca, não três.
- **Causalidade com 3 alavancas** (`lanterna`, `fonteLimpa`, `sementePlantada`) e re-render condicional em 2 eras cada. Isso é uma teia de estados (3 flags × 3 eras = muitos casos visuais a testar). **Mantenha 1 alavanca** (`sementePlantada` ou `fonteLimpa`) como prova do pilar; o resto é M6+.
- **Chefe de 3 fases distintas + minigame de Cantar + "Ermo reverdece em tempo real".** Cada fase é praticamente um sistema de combate diferente (invocação, escudo+sugar-seiva, mini-ATB rítmico sem barra). O reverdecimento em tempo real (troca de IBL/paleta + brotos instanciados surgindo durante a luta) é polimento caro. Para a fatia: **1 fase de luta + a fase Acalanto**. Corte a fase Casulo.
- **2 companheiros recrutáveis com técnicas próprias + troca na bolsa.** 1 companheiro (Fagulha) prova o "party tático". Toco depende da Semente e da represa — adiar junto com a Semente.
- **4 tipos de inimigo + roda de 4 essências com ×2/×0.5/imune.** A roda completa (Sol/Água/Folha/Cinza com relações cruzadas) é muito para provar "essência certa = mais dano". **2 essências + 2 inimigos** já ensinam a mecânica. Lobinho (chama +1) e Abelhão (mexe ATB) são modificadores de IA que podem esperar.
- **2 finais (A/B) com flor-souvenir dourada/prateada + epílogo ramificado.** Bifurcação de final é a última coisa que prova um jogo. **Um final**. A escolha A/B é gancho de sequência, não fatia.
- **5 níveis de progressão com 5 magias do herói + equipamentos (2 slots) + 2 consumíveis.** Para a fatia: Nv1→3, 1 magia de cura + 1 de ataque. Equipamentos e amuleto são adiáveis.
- **HUD bracelete no `leftCtrl` a 35°.** Bonito, mas é fonte de náusea/legibilidade no Quest. Adiar para M7; começar com painel fixo simples.

## (b) Lacunas, contradições e risco técnico

- **Contradição de escopo no próprio doc:** §12 diz "Primeiro jogável = fim da M3" (1 luta de Brotoca), mas o cabeçalho e §1 vendem 40–50 min com 3 eras, chefe e 2 finais. O "primeiro jogável" do doc **já é** o MVP correto — só que o resto do GDD não está priorizado em torno dele.
- **ATB em tempo real no VR é risco de UX para público infantil.** O "Modo Calmo" (pausa ao abrir menu) é a decisão certa, mas **deveria ser o único modo da fatia**. ATB correndo + mirar alvo com raio + criança em pé com headset = frustração e enjoo. O modo "Ativo" é armadilha; não implemente agora.
- **Mirar alvo com raio do controle dentro de um combate por turnos** mistura dois paradigmas (point-and-click + turnos). Risco de oclusão (inimigo atrás de árvore), raio trêmulo, alvo errado. Falta especificar: o que acontece se o raio não está sobre nenhum alvo ao confirmar? Há auto-seleção do alvo único? Defina **target padrão automático** quando só há 1 inimigo válido.
- **Performance no Quest — pontos não endereçados concretamente:**
  - `lookAt(dolly)` por inimigo + billboards de HP/ATB por inimigo + números flutuantes + pó da mariposa (Points) + fumacinha + flores/cinzas instanciadas + 1ª pessoa cajado. Muitos `CanvasTexture` redesenhados por frame = **morte por draw calls / upload de textura**. Falta orçamento de frame (alvo: 72 fps, ~13 ms). Especifique: redesenhar canvas só on-change, não por frame.
  - "Ermo reverdece em tempo real" trocando IBL/`scene.environment` em runtime pode causar **recompilação de shaders / stutter** no Quest. Se mantido, pré-aqueça materiais.
  - HDRI `sky.hdr` (§11) no Bosque + trocar para cor sólida nas outras eras: confirmar custo do IBL no Quest 2. `useHDRI:true` só no Bosque é sensato, mas teste o pico de memória.
  - Sombras: o doc diz "sem shadow maps pesados" só em M7. Defina **sem sombras dinâmicas desde já** ou baked.
- **Assets CC0 — riscos reais de existência/qualidade:**
  - **Kenney Cube Pets** não têm rig/animação de combate típico (ataque, levar dano). O doc usa `playClip`/`mixers` e `emote-yes` — **confirme que esses clipes existem nesses GLBs**. Provavelmente só idle/walk. Plano B: animar por código (squash/scale/hop), não por mixer.
  - **Mariposa/traça CC0 dedicada não é garantida.** O fallback (`animal-bee.glb` ×2.5 recolor) é honesto, mas uma abelha esticada não lê como "mariposa triste". Risco de o **Momento emocional não funcionar visualmente**. Decida cedo: ou aceita a abelha, ou orça 1 download (Quaternius Animated Monsters — verificar se há mariposa/traça mesmo).
  - **Carinha do Vovô como billboard + reescala 3× de `trees.glb`:** reescalar uma árvore low-poly 3× revela faces grosseiras de perto em VR. Risco estético no NPC mais importante.
  - "Canção de ninar" procedural agradável é mais difícil do que soa; áudio procedural bonito consome tempo desproporcional. Não é bloqueante, mas não subestime M2.
- **Save/flags:** o `save` não versiona schema (`version`) — qualquer mudança de flags quebra saves de teste. Adicione `version` agora (barato).
- **Aggro por proximidade (`dist<6`) com locomoção livre em VR:** criança pode disparar batalha sem querer ao se aproximar, ou ficar presa em loop de aggro após fugir. Falta **cooldown pós-fuga / inimigo "dorme" temporariamente**. O doc tem "foge garantido após 2 falhas" mas não o cooldown de re-aggro.
- **Falta orçamento de polifonia de áudio** definido (só citado em M7). WebAudio no Quest com muitos osc descartáveis pode estourar. Defina teto de vozes simultâneas já no sequenciador.

## (c) PRIMEIRO JOGÁVEL MÍNIMO (o que prova o jogo) — máx. 8 itens

1. **Andar no Bosque sozinho em VR + PC**, com "← Voltar" e save mínimo (`localStorage`, com `version`).
2. **Portal do Vovô alternando 2 eras** (Bosque ↔ Ermo) via `applyEra` (só material/fog/luz/visibilidade) — sem variantes condicionais por flag ainda.
3. **1 alavanca de causalidade visível:** uma ação no passado/presente muda **um** elemento do Ermo (ex.: leito enche → caminho abre). Prova o pilar "mudar X muda Y".
4. **ATB Modo Calmo (pausa no menu) com 2 essências**, menu em anel por raio, auto-target quando há 1 inimigo, números de dano, fumacinha de derrota, fanfarra + XP.
5. **2 inimigos** (Brotoca + 1 do Ermo) recoloridos do mesmo GLB, com aggro **+ cooldown de re-aggro**; derrota gentil sem game-over (acorda no spawn).
6. **1 companheiro (Fagulha)** recrutável com 1 técnica de ataque; herói com 1 cura + level-up até Nv3.
7. **Chefe em 2 fases: 1 luta curta + Acalanto (Cantar)** terminando em "boceja e dorme" — o **Momento** tem que estar de pé, é o coração do jogo.
8. **Diálogos no `dlgPlane`** dos 3 NPCs essenciais (Vovô, Seu Cogu, recruta) + marcador de objetivo, para o jogador nunca ficar perdido.

> Tudo que está fora desta lista (Semente/passado, Toco, 4ª essência, fase Casulo, equipamentos, 2 finais, HUD-bracelete, ATB Ativo) é **pós-prova**.

## (d) Riscos + mitigação concreta

1. **Enjoo/fadiga em VR (combate por turnos em pé, mirar com raio).** → Modo Calmo como único modo; **auto-target** do inimigo único; menu **fixo no mundo** (já previsto); permitir jogar sentado; sessões curtas. Teste com o público real (João) cedo.
2. **Stutter ao trocar de era (recompile de shader / troca de IBL).** → Pré-compilar materiais de todas as eras no load (`renderer.compile`); evitar trocar `scene.environment` em runtime durante combate; usar cor sólida + fog para Ermo/Semente em vez de novo HDRI. Medir com `Stats`/`spector` no Quest.
3. **Cube Pets sem clipes de animação de combate.** → Verificar GLBs no carregamento (logar `gltf.animations`); se faltar, fazer ataque/dano/derrota **por código** (hop, squash, `scale→0`), nunca depender de `playClip('emote-yes')`. Tratar isso como premissa a confirmar **no M0**, não no M4.
4. **Mariposa não existe como CC0 e a abelha-esticada não vende o Momento.** → Decisão no M0: testar 1 download CC0 dedicado (Quaternius) **antes** de comprometer o clímax; se não houver, redesenhar o chefe como "casulo/traça" com Points de pó + asas de plane com CanvasTexture (procedural), aceitando que não é GLB.
5. **Explosão de estados visuais (3 flags × 3 eras).** → Reduzir a 1 flag na fatia; tabela única `estadoVisual(era, flags)` determinística e testável; checklist de combinações. Não espalhar `if(flag)` por `applyEra`.
6. **Draw calls / uploads de canvas matando o frame rate.** → Orçamento explícito (alvo 72 fps); redesenhar `CanvasTexture` (HP/ATB/números) **só quando o valor muda**, com `texture.needsUpdate` pontual; instanciar billboards; teto de Points; **sem sombras dinâmicas**. Profilar no Quest a cada milestone, não só em M7.
7. **Escopo vs. tempo (GDD de jogo completo vendido como fatia).** → Congelar o MVP da seção (c) como definição de "fatia vertical"; mover Semente, Toco, fase Casulo, 2 finais e equipamentos para um backlog "pós-fatia" explícito no §12; M6 atual vira "fatia estendida".
8. **Loop de aggro / criança presa em batalha após fugir.** → Cooldown de re-aggro (inimigo "cochila" ~10 s e fica translúcido após fuga); raio de aggro menor (4 m) com indicador visual de perigo antes de disparar; fuga garantida já prevista — manter.

---

# 🎮 As 10 FASES (campanha completa)

O jogo é uma campanha de **10 fases** encadeadas (cada fase = um objetivo claro + a história
avança). Mostradas como "Fase N: <nome>" com o objetivo no topo. Mapeiam os beats do GDD:

| # | Fase | Era | O que acontece | Sistema/causalidade |
|---|---|---|---|---|
| 1 | **O Bosque Doente** | 🌳 Bosque | Acorda, fala com Seu Cogu, **1ª batalha** (Brotoca) ensina ATB + essência. Chega ao Vovô. | tutorial de combate |
| 2 | **A Lanterna-Vagalume** | 🌳 Bosque | Pega a **Lanterna** (acende o oco do Vovô = destrava a viagem). **Recruta Fagulha**. | item-chave + companheiro |
| 3 | **O Ermo** | 🥀 Ermo | 1ª viagem; **o MOMENTO** (futuro murcho, Vovô apagado, a folhinha teimosa). Ganha a **Semente-do-Amanhã**. | viagem no tempo |
| 4 | **A Semente** | 🌱 Semente | Chega ao passado (tudo jovem), conhece o **Broto**, explora as 2 causas. | nova era |
| 5 | **Os Bichos-da-Soneca** | 🌱 Semente | Limpa a covinha (batalhas Brotoca/Abelhão) pra poder plantar. | combate |
| 6 | **Plantar o Amanhã** | 🌱→🌳 | Planta a Semente. **Presente muda** (galho novo, mancha encolhe). **Recruta Toco**. | causa→efeito #1 |
| 7 | **A Nascente** | 🌱 Semente | Com Toco, tira a pedra da nascente. **Presente:** lago transborda; **Ermo:** leito enche e abre o caminho. | causa→efeito #2 |
| 8 | **O Caminho do Ermo** | 🥀 Ermo | Atravessa o Ermo (agora acessível) até a arena; combates mais duros (Lobinho, Cinzela). | combate/exploração |
| 9 | **A Mariposa Murcha** | 🥀 Ermo | **Chefe** em fases + o **Acalanto (cantar)** = o clímax. Ermo reverdece. | chefe + o momento |
| 10 | **A Escolha** | 🥀→🌳 | A escolha A/B (estilo Chrono Cross), **epílogo**, fanfarra, gancho. | final |

> **Engine primeiro, fases depois:** construo os sistemas (eras✓, portal✓, áudio, ATB, diálogo/quest,
> save) e então as 10 fases viram **dados** (`FASES[]`: objetivo, gatilhos, batalhas, diálogos) que
> ligam tudo. Ordem de build segue o §12 + a crítica (primeiro jogável = ATB de pé na Fase 1).
