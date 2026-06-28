# PROMPT DE DESENVOLVIMENTO — Crônicas do Bosque 2.0 (Campanha Completa)

> **Para o agente desenvolvedor:** você já entregou uma *fatia vertical* jogável e bonita de
> **Crônicas do Bosque** (~8 min, 8 capítulos). O briefing dela é **verdade-base** e está anexo.
> Agora o objetivo é **transformar essa fatia em uma campanha de pelo menos 2 horas de roteiro
> jogável**, mantendo TUDO que já funciona e **marcando claramente o que é expansão** (`[NOVO]`)
> versus o que já existe (`[EXISTE]`).
>
> **Inspiração-alvo (qualidade):** Chrono Trigger (causalidade temporal, combos de técnicas,
> múltiplos finais), Chrono Cross (tom melancólico-doce, dimensões), Zelda (exploração com
> chaves/áreas que se abrem). **Não copie conteúdo** — capture a *sensação*.
>
> **A grande virada de design que o cliente pediu:** *mexer no passado deve causar mudanças
> perigosas e inesperadas no presente e no futuro*. Isso deixa de ser "sabor" e vira o **núcleo
> jogável** (a "Teia de Causalidade", seção 4). Cada conserto tem um custo; o jogo é sobre
> **equilíbrio**, não sobre apertar um botão e tudo melhorar.

---

## 0. Regras de ouro — NÃO QUEBRAR

Preserve rigorosamente, porque são a identidade do jogo e as restrições técnicas:

1. **Tom infanto-juvenil, gentil, sem violência nem morte.** Inimigos "viram fumacinha".
   Chefes se resolvem por **compreensão**, não por força. A regra de ouro continua sendo:
   **cuidar costuma valer mais que bater.**
2. **Tudo em PT-BR**, linguagem simples e carinhosa, reticências e diminutivos no tom do Vovô
   ("Ô, broto… chega mais, sem medo."). O herói é sempre "broto".
3. **Single-file `index.html`**, **Three.js via CDN** (sem build/npm), **WebXR** pra VR.
   Roda em **VR (Meta Quest), PC e celular**; **celular é prioridade de performance**
   (resolução adaptativa, poucos draw calls, UI em HTML por cima do 3D).
4. **Assets só CC0** (Kenney, Quaternius) + **áudio 100% procedural** (WebAudio). Vovô,
   transportes, casas, pista e qualquer geometria nova feitos no código.
5. **Não regredir nada** que já existe: combate ATB, Roda das Essências, transportes, Frutos de
   Luz, Loja, Diário de Missões, o Acalanto da Murcha. Tudo segue funcionando.

> **Entrega incremental:** trabalhe por **Atos** (seção 6). Ao fim de cada Ato o jogo deve estar
> **jogável de ponta a ponta até ali** e não quebrado. Comece pela espinha narrativa (seção 3)
> e pela Teia de Causalidade (seção 4) — são o coração; o resto é músculo em volta.

---

## 1. Visão da expansão (de 8 min → 2h+)

| Eixo | Hoje `[EXISTE]` | Meta 2.0 `[NOVO]` |
|---|---|---|
| Duração | ~8 min, linear | **2h+**, com exploração e backtracking entre eras |
| Eras | 3 (Semente / Bosque / Ermo) | **5 camadas de tempo** (+ Raiz e Renascer) |
| Causalidade | 1 evento (plantar a semente) | **Teia de 7 laços causais**, com consequências perigosas |
| Party | Herói + Fagulha | **4 companheiros**, um por estação/essência |
| Técnicas | 5 solo | + **Técnicas-Duplas/Triplas** (combos) |
| Chefes | 1 (Murcha) | **5 "chefes-coração"** + mini-chefes |
| Vila | Ambientação | **6 sidequests** reais pagas em Frutos de Luz |
| Final | Único | **3 finais** + 1 cena secreta |
| Save | Nenhum | **3 slots** + autosave por capítulo (localStorage) |
| Perigo dinâmico | — | **Fendas Temporais** que vazam inimigos quando o tempo desequilibra |

---

## 2. A nova espinha narrativa — *A Canção das Quatro Folhas*

O briefing atual explica o cinza como "futuro murcho vazando pela raiz". Mantenha isso, mas dê
a ele uma **causa-raiz emocional** que sustenta 2 horas:

> Há eras, na **Raiz** (o passado mais fundo, antes do Vovô crescer), os brotos faziam as
> estações girarem **cantando** a *Canção das Quatro Folhas* — um verso pra Primavera 🍃, um pro
> Verão ☀️, um pras Chuvas 💧 e um pro Inverno 🩶. Quando a última cantora ficou **sozinha**, ela
> não teve coragem de cantar o verso do Inverno (porque cantá-lo significava deixar a estação
> mais quietinha chegar, e ela tinha medo do silêncio). O **Inverno parou no tempo**. Sem
> passar, ele começou a **vazar como "cinza"** por todas as eras. A **Murcha, a Mariposa** é o
> **eco** dessa última cantora — não uma vilã, mas a saudade dela, com frio, presa no galho mais
> alto há tempo demais.

**A missão do broto:** reaprender a Canção viajando pelo tempo, recuperando uma **Folha**
(verso) em cada Ato — cada uma guardada por um **chefe-coração** e por um **companheiro** que se
junta. No clímax, cantar a **Canção das Quatro Folhas completa** não *derrota* o Inverno: dá a
ele **permissão de descansar e passar**, virando Primavera de novo em todas as eras.

Isso transforma o Acalanto atual (cantar 3×) no **movimento final** de algo muito maior, e
mantém intacta a regra de ouro.

---

## 3. As 5 camadas de tempo `[NOVO: +2 eras]`

Reskins do mesmo terreno (como já é feito), liberados pela história. **Nova regra importante
que o cliente quer:** **a Vila, a pista e os transportes agora também devem ganhar variação
visual** entre Raiz/Semente/Ermo (hoje só o terreno reskina) — pelo menos casas em construção
na Raiz, casas novas no Semente, casas rachadas no Ermo. Isso vende a viagem no tempo.

1. **🌰 Raiz — o passado profundo** `[NOVO]`. Antes do Vovô crescer. Névoa dourada antiga,
   cogumelos gigantes que fazem luz, um **Constructo de Pedra** guardião, ruínas dos primeiros
   brotos. É onde mora a verdade da Última Cantora.
2. **🌱 Semente — o passado** `[EXISTE]`. Vovô pequenininho. Onde você **planta** coisas que
   florescem adiante.
3. **🌳 Bosque — o presente** `[EXISTE]`. Onde a aventura começa e onde as consequências
   **aparecem**.
4. **🥀 Ermo — o futuro murcho** `[EXISTE]`. O amanhã doente, onde mora a Murcha.
5. **🌸 Renascer — o futuro curado** `[NOVO]`. Só acessível depois de equilibrar a Teia. O
   amanhã que VOCÊ plantou: céu azul, lago cheio, cinzas viraram vaga-lumes. Tem conteúdo
   próprio (sidequest do epílogo, cena secreta).

> **Causalidade visível:** ao consertar algo no passado, o jogador deve **ver a mudança
> acontecer** ao voltar (animação de crescimento/secagem, igual o broto que cresce hoje).
> Mudanças boas E ruins.

---

## 4. A TEIA DE CAUSALIDADE — o coração do jogo `[NOVO]`

Esta é a parte mais importante. O cliente quer: **"mudanças no passado causam mudanças perigosas
e inesperadas no presente e no futuro."** Implemente como uma **rede de laços causais**: cada
intervenção no passado dispara uma consequência **boa** (abre caminho/recompensa) E uma
**inesperada/perigosa** (cria um novo problema ou área de perigo). O jogador precisa
**equilibrar**, não só "consertar".

### 4.1 Medidor de Harmonia (0–100) `[NOVO]`
HUD ganha um medidor de **Harmonia do Tempo**. Resolver um laço de forma equilibrada sobe;
deixar uma consequência perigosa em aberto desce. **Não é punitivo** — é o que decide o final
(seção 9) e quantas Fendas Temporais aparecem.

### 4.2 Fendas Temporais `[NOVO]`
Quando a Harmonia cai abaixo de limiares, abrem-se **fendas roxo-cinza no presente** por onde
**vazam inimigos do Ermo** para o Bosque (áreas de perigo dinâmicas, novas a cada partida
conforme as escolhas). Equilibrar os laços **fecha** as fendas. Isso é o "perigoso e inesperado"
que o cliente pediu, em forma de gameplay.

### 4.3 Os 7 laços causais (cadeias prontas pra implementar)

Cada laço: **AÇÃO no passado → BÔNUS → CONSEQUÊNCIA inesperada → COMO EQUILIBRAR.**

1. **O Riacho Represado.** Pra alcançar a Folha da Primavera, o broto move uma pedra que
   represa um riacho na Semente. **Bônus:** abre passagem pra Folha. **Consequência:** no
   presente, **o lago do centro secou** e os peixinhos estão encalhados; uma fenda abre ali.
   **Equilíbrio:** cavar um novo curso na Semente (ou ensinar a Gota, companheira de Água, a
   redirecionar a nascente) — devolve a água ao presente.

2. **O Corvo Espantado.** O broto espanta o Corvo Cinza que assustava os brotinhos na Semente.
   **Bônus:** os brotinhos crescem felizes; recompensa em Frutos. **Consequência:** sem o
   corvo, no presente os **besouros-da-folha** se multiplicam e devoram árvores (nova praga
   inimiga). **Equilíbrio:** ensinar um **canto de pássaro** (procedural, WebAudio) que afasta
   os besouros sem precisar do predador — gentileza > violência.

3. **A Muda Curada Demais.** O broto cura uma muda doente na Semente. **Bônus:** muda vira
   árvore frondosa. **Consequência:** ela cresce **demais**, tapa o sol, e no presente as
   florzinhas embaixo morreram — vira uma **Mata Emaranhada** de espinhos vivos (nova área
   perigosa). **Equilíbrio:** plantar a muda num descampado na Semente (replantio gentil), ou
   abrir uma clareira de luz — a Mata vira pomar.

4. **O Lampião Aceso.** O broto acende o **primeiro lampião** da Vila na Semente. **Bônus:** a
   Vila ganha luz, os moradores perdem o medo do escuro, sidequests abrem. **Consequência:** a
   luz **atrai a Murcha** (mariposa!) cedo demais, criando um "mini-Ermo" vazando na Vila do
   presente. **Equilíbrio:** este laço **conecta ao clímax** — ensine a Vila a cantar o
   primeiro verso pra confortar a mariposa em vez de afugentá-la.

5. **A Ponte de Cipó.** O broto ensina o **Mestre Cipó** (jovem, na Semente) a tecer uma ponte.
   **Bônus puro (sem consequência ruim):** no presente a ponte existe e abre uma ilha nova no
   lago com Frutos e uma sidequest. *(Inclua pelo menos um laço sem custo, pra ensinar que nem
   toda mudança é perigosa — dá esperança e evita que o jogador fique paralisado.)*

6. **A Semente-do-Amanhã.** `[EXISTE, expandido]` O plantio original vira parte da Teia: plantar
   cedo demais cria a Mata Emaranhada (cruza com o laço 3); plantar no **momento certo** (depois
   de equilibrar 1–4) faz nascer o carvalhinho são.

7. **O Constructo Acordado** (na Raiz). O broto acorda o **Constructo de Pedra** guardião.
   **Bônus:** ele abre a câmara da Última Cantora (Folha das Chuvas). **Consequência:** o
   Constructo, sozinho há eras, **te segue chorando pedrinhas** e bloqueia passagens por
   carência. **Equilíbrio:** dar a ele um **companheiro** (plantar uma semente de musgo que
   cresce nele) — chefe-coração nº 4, resolvido por afeto.

> **Implementação:** cada laço é uma máquina de estados pequena (`pendente → consequência_ativa
> → equilibrado`) que escreve no estado global do tempo e altera o reskin/spawns das eras.
> Persistir no save.

---

## 5. Party, essências e Técnicas-Duplas `[NOVO]`

### 5.1 Companheiros (party de até 3 ativos, estilo Chrono Trigger)
Cada um amarrado a uma estação/essência e a um Ato:

- **Fagulha** 🦊 ☀️ **Sol/Verão** `[EXISTE]` — faísca de Sol; tem o insight que vira o Acalanto.
- **Folho** 🐛→🦋 🍃 **Folha/Primavera** `[NOVO]` — um brotinho-lagarta tímido da Semente;
  cura e ataques de área. Junta-se no Ato I.
- **Gota** 🐢 💧 **Água/Chuvas** `[NOVO]` — tartaruguinha do riacho; redireciona água (chave do
  laço 1), tanque defensivo. Junta-se no Ato II.
- **Brisa** 🦋 🩶 **Cinza/Inverno** `[NOVO]` — a **Murcha redimida**, vira companheira no
  epílogo; "neve gentil" que adormece (não mata).

### 5.2 Técnicas-Duplas/Triplas (combos)
Quando dois companheiros estão com a barra ATB cheia, surge a opção de **combo** (gasta MP dos
dois). Espelha as Dual Techs de Chrono Trigger. Pelo menos:

- **Broto + Fagulha → "Clarão"** ☀️ (Sol em área)
- **Fagulha + Gota → "Arco-da-Chuva"** ☀️💧 (dano + cura no grupo)
- **Folho + Gota → "Brotação"** 🍃💧 (cura forte + reviver)
- **Broto + Folho → "Mata Amiga"** 🍃 (raízes prendem o turno do inimigo)
- **TRIPLA: Broto + Fagulha + Gota → "Estação Cheia"** (golpe das três essências; cinemática)
- **Com Brisa (fim): "Acalanto em Coro"** 🩶 (versão multiplicada do Acalanto)

### 5.3 Progressão estendida
Suba o teto de **Nível 1 → ~12**. Novas técnicas solo intercaladas (ex.: **Reboto** revive,
**Chuvisco** cura em área, **Solzão Duplo**, **Folha-Navalha** de área). Manter: subir de nível
cura tudo e ensina técnica. Manter Roda das Essências como está; adicionar status leves e
**gentis** (ex.: "Sonolência" = perde turno, nunca veneno/sangramento).

---

## 6. Estrutura de Atos e roteiro capítulo a capítulo `[NOVO]`

~21 capítulos, ~5–7 min cada com exploração/combate = **2h+**. Para cada capítulo dou: **era,
objetivo, beats e uma fala-semente** no tom (o agente escreve os diálogos completos seguindo o
sabor). Atualize o Diário de Missões 📜 para refletir os Atos.

### ATO I — A Folha da Primavera 🍃 *(Bosque & Vila; primeiro laço causal)*
- **Cap 1 — O Bosque Doente** `[EXISTE]`. Acordar; falar com **Seu Cogu** 🍄; libertar
  **Fagulha** dos espinhos. *Mantido.*
- **Cap 2 — O Caminho da Vila** `[EXISTE, expandido]`. Cavalo → mini-chefe **Lobão Cinza
  (Alfa)** → Amuleto. *Mantido, com mais combates de aquecimento no caminho.*
- **Cap 3 — A Vovó Samambaia** `[NOVO]`. Lore expandida: ela revela a **Canção das Quatro
  Folhas** e que o cinza é o **Inverno que não passou**. *Semente:* "Antigamente, broto, a gente
  cantava pras estações virarem. Quatro versinhos. Mas uma cantora ficou sozinha… e engoliu o
  último verso. Desde então o frio não vai embora."
- **Cap 4 — A Lanterna e a Primeira Viagem** `[EXISTE+]`. Pegar a Lanterna-Vagalume; tocar o
  Vovô; primeira viagem à **Semente**.
- **Cap 5 — O Riacho e a Folha Verde** `[NOVO]`. Na Semente: mover a pedra (dispara **laço 1**),
  alcançar e cantar a **Folha da Primavera**; **Folho** se junta. *Semente:* "Pra te ajudar?
  Eu? Mas eu sou só um brotinho medroso… ah, tá bom. Mas só se a gente for juntinho."
- **Cap 6 — A Consequência** `[NOVO]`. Voltar ao presente: **o lago secou**, peixinhos
  encalhados, **primeira Fenda Temporal** abre. Choque do "mexi no passado e quebrei o agora".

### ATO II — A Folha do Verão ☀️ *(o lago, ecologia, sidequests)*
- **Cap 7 — O Lago Encalhado** `[NOVO]`. Equilibrar o laço 1 (Gota redireciona a nascente);
  **Gota** se junta; lago volta; fenda fecha; Harmonia sobe pela 1ª vez.
- **Cap 8 — O Corvo do Passado** `[NOVO]`. Espantar o Corvo (laço 2) → praga de besouros no
  presente (nova área de perigo).
- **Cap 9 — O Canto que Acalma** `[NOVO]`. Resolver a praga com o **canto de pássaro** (sem
  violência); cantar a **Folha do Verão**. *Semente:* "Não precisa expulsar ninguém, broto. Às
  vezes basta lembrar o bosque de uma música velha."
- **Cap 10 — A Vila Desperta** `[NOVO]`. Acender o lampião (laço 4) abre **6 sidequests** dos
  moradores (seção 7). A luz atrai sombra da Murcha à Vila — gancho do clímax.

### ATO III — A Folha das Chuvas 💧 *(a Raiz; a verdade)*
- **Cap 11 — A Raiz Antiga** `[NOVO]`. Nova era **Raiz** liberada. Cogumelos-lâmpada, ruínas,
  o **Constructo de Pedra** adormecido.
- **Cap 12 — A Mata Emaranhada** `[NOVO]`. Lidar com o laço 3 (muda curada demais → espinhos
  vivos); aprender o replantio gentil.
- **Cap 13 — O Constructo Solitário** `[NOVO]`. **Chefe-coração:** o guardião não quer brigar,
  quer companhia (laço 7); resolvido plantando musgo-amigo nele. *Semente:* "…fica? Ninguém
  ficou. Faz tanto tempo que eu esqueci o som de outra voz."
- **Cap 14 — A Última Cantora** `[NOVO]`. A câmara revela a verdade do Inverno Esquecido;
  cantar a **Folha das Chuvas**. Reviravolta: a Murcha é o **eco dela**.

### ATO IV — A Folha do Inverno 🩶 *(o Ermo, a Murcha, o clímax)*
- **Cap 15 — A Semente do Amanhã** `[EXISTE+]`. Plantio integrado à Teia (laço 6); plantar no
  momento certo agora importa.
- **Cap 16 — O Amanhã Plantado** `[EXISTE+]`. Cascata de consequências; se a Harmonia estiver
  baixa, **muitas fendas**; o jogo te empurra a equilibrar antes do fim.
- **Cap 17 — A Mariposa de Frio** `[EXISTE+]`. Encontro com a **Murcha**; o Acalanto começa.
- **Cap 18 — O Coração da Murcha** `[EXISTE+]`. Insight da Fagulha (mantido) + revelação de que
  ela é a Última Cantora. *Semente (mantida):* "Ela não tá brava. Ela tá com FRIO e sozinha faz
  tempo demais."
- **Cap 19 — A Canção das Quatro Folhas** `[NOVO — clímax]`. Em vez de cantar 3× genérico, o
  jogador **encadeia os 4 versos** (Primavera→Verão→Chuvas→Inverno) num mini-ritmo gentil; cada
  verso reverdece uma camada do tempo ao fundo.
- **Cap 20 — O Inverno que Descansa** `[NOVO]`. O Inverno **passa** (não é destruído).
  **Brisa** (Murcha redimida) se junta como companheira. *Semente (mantida/expandida):* "Ah…
  que sono bom… que fresquinho. …Obrigada por cantar pra mim. Agora posso ir, e voltar quando
  for a vez do inverno de novo."

### EPÍLOGO
- **Cap 21 — A Primavera de Todas as Eras** `[NOVO]`. Liberação da era **Renascer** 🌸. Final
  **ramificado** pela Harmonia + colecionáveis (seção 9). Cena secreta se 100%.

---

## 7. Sidequests da Vila `[NOVO]` (pagas/recompensadas em Frutos de Luz)

Dão volume, ritmo e usam a Loja/economia que já existem. Todas no tom gentil, **nenhuma
obrigatória**, todas mexendo na Teia quando possível:

1. **Dona Bromélia** — perdeu suas mudinhas na seca do lago; replante-as (cruza c/ laço 1).
2. **Tonico** — quer reacender todos os lampiões da Vila; minigame de luz.
3. **Mestre Cipó** — ensine-o no passado pra ganhar a ponte e a ilha nova (laço 5).
4. **Lojista Cará** — caça aos 16 Frutos vira "coleção premiada" com recompensas escalonadas.
5. **Os Brotinhos** — querem ouvir a Canção; cante os versos que já aprendeu (desbloqueia coros
   que ajudam na batalha final).
6. **Vovó Samambaia (final)** — só na era Renascer: ela te dá a cena secreta da Última Cantora.

---

## 8. Sistemas novos a implementar `[NOVO]`

- **Save/Load:** 3 slots em `localStorage`, autosave ao fim de cada capítulo; tela de
  continuar/novo jogo. Persistir: capítulo, party, níveis, inventário, Frutos, estado de cada
  laço causal, Harmonia, sidequests.
- **Plantio entre eras (crafting de tempo):** generalize a Semente-do-Amanhã para **4 sementes**
  plantáveis (musgo, riacho, luz, amanhã) que crescem ao avançar no tempo e abrem caminhos.
- **Fendas Temporais:** spawns dinâmicos de inimigos do Ermo no presente conforme Harmonia.
- **Diário 📜 reformulado:** abas por Ato, lista de laços causais (estado pendente/equilibrado),
  Folhas coletadas (0/4), Harmonia atual, sidequests.
- **Roda das Essências:** mantida; adicionar combos (seção 5.2) e status gentis.
- **Áudio:** trilha procedural ganha **4 motivos de estação** que se sobrepõem conforme as
  Folhas coletadas; a Canção final é a soma dos 4 motivos. Tudo WebAudio/CC0.
- **Acessibilidade do ritmo final:** o mini-ritmo do Cap 19 deve ter modo simplificado
  (toque/clique no tempo, sem exigência de precisão) pra funcionar em VR, PC e celular.

---

## 9. Finais ramificados `[NOVO]`

Decididos por **Harmonia + Folhas + colecionáveis** ao chegar no Cap 21:

- **🌸 Final Primavera (melhor):** Harmonia alta + 4 Folhas + Teia toda equilibrada → todas as
  eras florescem, Brisa vira borboleta livre, a Vila canta em coro. Era **Renascer** plena.
- **🍂 Final Sépia (bom/agridoce):** Canção completa mas laços deixados desequilibrados → o
  bosque cura **com cicatrizes**; algumas fendas viram "lembranças" no Renascer. Epílogo doce
  porém melancólico (tom Chrono Cross).
- **🌟 Cena Secreta:** 100% (16 Frutos + 6 sidequests + todos os chefes-coração resolvidos sem
  bater) → cena extra da **Última Cantora original** voltando pra cantar uma vez mais.

Nenhum final é "ruim/game over": fiel à regra de ouro, o pior caso ainda é gentil.

---

## 10. Chefes-coração (todos vencidos por compreensão) `[NOVO/EXISTE]`

1. **Lobão Cinza (Alfa)** `[EXISTE]` — mini-chefe do caminho; pode ganhar um beat de "só
   guardava o filhote" no replay.
2. **Caranguejo Casca-Dura** `[EXISTE→chefe-coração]` — parece tanque bravo, está protegendo
   ovos no lago seco; resolvido devolvendo a água (laço 1).
3. **A Mata Emaranhada** `[NOVO]` — não é bicho, é a muda solitária crescida demais; "vencida"
   abrindo luz pra ela.
4. **O Constructo de Pedra** `[NOVO]` — solidão de eras; resolvido com companhia (laço 7).
5. **Murcha → Brisa** `[EXISTE+]` — o clímax, agora com a Canção das Quatro Folhas.

---

## 11. O que NÃO mudar de jeito nenhum (anti-regressão)

- Combate ATB no próprio mapa; barra de AÇÃO; Atacar/Técnica/Item/Defender.
- Transportes como objetos físicos no mundo (cavalo/carro/moto/avião) com "Entrar/Descer";
  avião evita inimigos. *(Pode dar a eles variação visual por era — não troque a mecânica.)*
- Frutos de Luz (16) como colecionável + moeda da Loja; a Loja do Lojista Cará e seus itens.
- Perder luta é gentil ("cochila no Bosque", volta ao ponto inicial).
- Controles atuais de VR/PC/celular; UI HTML por cima do 3D no celular.
- CC0 + procedural + single-file + PT-BR + tom infantil.

---

## 12. Plano de entrega sugerido (incremental)

1. **Fundação:** save/load, Diário reformulado, Medidor de Harmonia, estado global do tempo
   (sem conteúdo novo ainda) — sobre o que já existe, sem quebrar nada.
2. **Ato I + laço 1 + Folho:** valida a Teia de Causalidade com 1 laço completo (riacho → seca →
   equilíbrio). *Marco: causalidade jogável de verdade.*
3. **Ato II:** Gota, laços 2 e 4, Fendas Temporais, sidequests, Técnicas-Duplas.
4. **Ato III:** era Raiz (incl. variação visual de Vila/transportes), Constructo, laços 3 e 7,
   Folha das Chuvas.
5. **Ato IV + Epílogo:** Canção das Quatro Folhas, Brisa, era Renascer, 3 finais + cena secreta.
6. **Polimento:** balanceamento (níveis 1–12, combos, economia de Frutos), performance no
   celular, áudio das 4 estações, acessibilidade do ritmo final.

> Ao entregar cada etapa, escreva um changelog curto marcando `[NOVO]`/`[ALTERADO]` e confirme
> que o jogo roda de ponta a ponta até o Ato concluído, em VR, PC e celular.

---

## 13. Checklist de aceitação (definição de "pronto")

- [ ] Campanha jogável de ponta a ponta em **≥ 2h** (com exploração/sidequests/combate).
- [ ] **7 laços causais** funcionando: cada um com bônus + consequência inesperada + equilíbrio.
- [ ] **Fendas Temporais** abrem/fecham conforme Harmonia.
- [ ] **5 camadas de tempo** acessíveis; Vila/transportes variam visualmente entre eras.
- [ ] **4 companheiros** + **Técnicas-Duplas/Triplas** + níveis até ~12.
- [ ] **5 chefes-coração** vencidos só por compreensão; zero violência/morte.
- [ ] **6 sidequests** + 16 Frutos + Loja integrados.
- [ ] **3 finais** + 1 cena secreta, decididos por Harmonia/colecionáveis.
- [ ] **Save** em 3 slots + autosave por capítulo.
- [ ] Single-file, Three.js CDN, CC0, áudio procedural, **PT-BR**, roda bem no **celular**.
- [ ] Nada do que já existia foi regredido.

---

*Regra de ouro acima de tudo: o jogo cresce em horas, em sistemas e em emoção — mas continua
ensinando que **cuidar costuma valer mais que bater**, e que mexer no tempo é uma
responsabilidade gentil.* 💚