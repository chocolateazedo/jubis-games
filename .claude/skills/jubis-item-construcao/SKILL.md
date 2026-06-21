---
name: jubis-item-construcao
description: Adicionar peças/itens novos ao inventário de construção do Bosque VR (ou de outro jogo de construção do Jubis Games) de forma que encaixem certo no grid — sem buracos e sem desalinhar. Use quando o usuário pedir pra incluir novas peças no menu de construir, importar um pack de building/kit novo, ou quando peças aparecerem espaçadas/desencaixadas. Garante encaixe pelo tamanho real da peça, anti-sobreposição por AABB, ícone 3D no menu e nome em PT-BR.
---

# Adicionar itens ao inventário de construção (encaixe correto)

No Bosque VR (`games/bosque-vr/index.html`) o jogador constrói com peças CC0 do
**Kenney Building Kit** (`games/bosque-vr/build/*.glb`, textura única em
`build/Textures/colormap.png`). Esta skill garante que **qualquer peça nova**
entre no inventário **encaixando bem** — o erro clássico é a peça aparecer
espaçada/“perdida” porque o grid era uma célula fixa e a peça é menor que ela.

Leia também `jubis-melhorar-jogo` (loop de iteração e verificação headless).

## A regra de ouro: o passo do grid é o TAMANHO da peça, não uma célula fixa

Peças do Kenney têm tamanhos diferentes (parede/piso/porta = módulo **2.0**;
cerca/barricada ≈ **1.26**; coluna 0.5; escada 4.0; etc.). Se o grid for uma
célula fixa (ex.: 4,8 m), as peças menores ficam com buracos entre elas.

A solução implementada e que deve ser mantida:

- **Snap pelo footprint da peça.** O passo em X/Z = o tamanho real da peça (com a
  rotação). Peças do mesmo tipo encaixam coladas (cerca de 3,02 m → espaçadas de
  3,02 m → conectam). Como a “família estrutural” (parede, porta, janela, piso,
  beirada) é toda módulo 2.0, todas compartilham o mesmo passo (4,8 m) e seguem
  **alinhadas entre si**. Funções: `footprintOf()`, `stepFor(foot, ry)`,
  `snapPlacement(rawx, rawz, level, foot, ry)`.
- **Altura por nível = altura da própria peça** (`level * foot.fh`).
- **Anti-sobreposição por AABB**, não por célula: `boxAt()` + `overlapsAny()`
  (com folga de ~0,2 m pra encostar sem contar como sobrepor). Cada peça colocada
  guarda sua caixa em `placedBoxes`.
- O **fantasma** fica vermelho (`ghostMat.color`) quando a caixa sobrepõe outra.

Não volte a usar “célula fixa” (constante GX/GY única) pra o snap — foi exatamente
o que causava os buracos.

## Passo a passo pra adicionar peças novas

1. **Baixar o asset (CC0 obrigatório).** Pegue os `.glb` (e a textura) de um pack
   CC0 — Kenney/Quaternius. Confirme a licença CC0 (sem crédito obrigatório;
   CC-BY é proibido). Veja a fonte do zip na página do pack:
   ```bash
   curl -s https://kenney.nl/assets/<pack> | grep -oE 'https://[^"]+\.zip' | head -1
   ```
   Coloque os `.glb` em `games/bosque-vr/build/` e a textura em
   `build/Textures/` (os GLB do Kenney referenciam `Textures/colormap.png` por
   caminho relativo — preserve a pasta). Guarde a `License.txt`.

2. **Medir o tamanho nativo das peças** (pra entender o módulo e conferir o
   encaixe). Lê o min/max do accessor POSITION direto do GLB:
   ```bash
   python3 - <<'PY'
   import struct,json,glob,os
   def gj(p):
       with open(p,'rb') as f:
           f.read(12); clen,_=struct.unpack('<II',f.read(8)); return json.loads(f.read(clen))
   for fp in sorted(glob.glob("games/bosque-vr/build/*.glb")):
       j=gj(fp); mn=[1e9]*3; mx=[-1e9]*3; idx=set()
       for m in j.get('meshes',[]):
           for pr in m.get('primitives',[]):
               ai=pr.get('attributes',{}).get('POSITION'); idx.add(ai) if ai is not None else None
       for ai in idx:
           a=j['accessors'][ai]
           if 'min' in a:
               for k in range(3): mn[k]=min(mn[k],a['min'][k]); mx[k]=max(mx[k],a['max'][k])
       print(os.path.basename(fp)[:-4], 'w×h×d=', round(mx[0]-mn[0],2), round(mx[1]-mn[1],2), round(mx[2]-mn[2],2))
   PY
   ```
   Como o snap usa o footprint automaticamente, **não precisa redimensionar** a
   peça pra ela encaixar consigo mesma. Só repare: pra peças NOVAS alinharem com
   as estruturais, o ideal é que o tamanho seja múltiplo do módulo 2.0 (ou um
   divisor limpo). Se não for, ela ainda encaixa consigo mesma — só não co-alinha
   com a parede.

3. **Registrar a peça no código** (`games/bosque-vr/index.html`):
   - Adicione o nome do arquivo (sem `.glb`) no array **`BUILD_PIECES`**.
   - Adicione a tradução em **`BUILD_PT`** (`'nome-interno': 'Nome em Português'`).
     O nome interno/arquivo fica em inglês (é o que salva no banco); só o rótulo
     é traduzido. Use `piecePT(name)` pra exibir.
   - **Não precisa mexer em mais nada**: o menu (DOM e o 3D do VR), o ícone 3D
     (mini-modelo real girando), o snap pelo footprint, a colisão e a
     persistência já funcionam pra qualquer item de `BUILD_PIECES`.

4. **Persistência:** as construções salvam no PostgreSQL (schema `jubis`, tabela
   `buildings`) via `games/bosque-vr/buildings.php`. O nome da peça é validado com
   `[^a-z0-9\-]` — mantenha os nomes de arquivo em minúsculas/kebab-case.

## Verificar (sem precisar do óculos)

- **Sintaxe:** extraia o `<script type="module">` e rode `node --check` (veja
  `jubis-melhorar-jogo`).
- **Lógica de encaixe** (o que mais quebra): teste isolado em Node replicando
  `footprintOf/stepFor/snapPlacement/boxAt/overlapsAny`. Cheque:
  1. uma fileira da peça nova encaixa com espaçamento == comprimento da peça
     (conecta, sem buraco);
  2. duas no mesmo lugar → `overlapsAny` bloqueia;
  3. a peça nova e a parede têm o mesmo passo quando o módulo é igual (alinham).
- **Headless:** screenshot do menu 3D (force `openMenu3D()` num `__t.html`
  temporário) pra ver o ícone e o nome PT da peça nova. Lembre das regras de
  ouro do screenshot headless (virtual-time pros GLB, esconder intro) da skill
  `jubis-melhorar-jogo`.

## Regras do projeto (sempre)

- Só assets **CC0** (sem crédito obrigatório). Sem build/npm (CDN/importmap).
- Tudo em **PT-BR** pro jogador. `pixelRatio ≤ 2`, sem shadow maps.
- Só commitar/pushar quando o usuário pedir. Mensagem de commit em PT-BR.
