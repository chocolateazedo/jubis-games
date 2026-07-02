Você vai preparar o asset 3D de um personagem para o jogo "Crônicas do Bosque" (Three.js, WebGL/WebXR,
rodando direto no navegador — celular, PC e VR — sem build/servidor de assets pesado). Siga TODAS as
regras abaixo à risca; elas vêm de limitações reais do carregador usado no jogo.

## Formato de entrega
- Exportar como **glTF 2.0 binário (.glb)**, arquivo único, com as texturas EMBUTIDAS dentro do .glb
  (opção "Embed" / binary glTF no exportador — não usar .gltf + .bin + imagens separadas).
- NÃO usar compressão Draco nem Basis/KTX2. O carregador do jogo é um GLTFLoader puro, sem
  DracoLoader/KTX2Loader configurado — um .glb comprimido com Draco simplesmente falha ao carregar.
  Exportar sem nenhuma opção de compressão de geometria/textura ligada.

## Texturas
- Resolução máxima **1024×1024** para o personagem principal/protagonistas, **512×512** para
  NPCs secundários e inimigos menores. NUNCA 2048 ou 4096 — o jogo carrega vários personagens juntos
  no navegador (celular incluso) e texturas grandes deixam o carregamento pesado demais.
- Apenas os mapas essenciais: base color (albedo) e, se precisar de brilho (ex.: olhos, lanterna,
  partes que brilham), um emissive map. Evite normal map / roughness map / AO map separados a menos
  que agreguem muito — cada mapa extra é mais peso.
- O material precisa estar baseado em TEXTURAS DE IMAGEM já bakeadas (Principled BSDF simples
  com imagens conectadas). Nada de setups procedurais (nós de ruído, gradientes procedurais etc. sem
  bake) — o exportador glTF não consegue converter isso, e o resultado sai sem cor/textura.

## Malha (mesh)
- Um único mesh por personagem (não várias partes soltas), um único material.
- Orçamento de até ~15.000–20.000 triângulos (o Broto entregue tinha ~35.760 vértices sem índice —
  está dentro do aceitável, pode manter essa faixa).
- NÃO precisa de esqueleto/rig nem animações (armature, bones, action clips). O jogo anima os
  personagens só por posição (balanço idle + investida de ataque), sem esqueleto — um mesh estático
  funciona perfeitamente e é mais leve. Se já tiver rig pronto, pode remover antes de exportar pra
  simplificar (a menos que eu peça animações no futuro).

## Escala, origem e orientação
- Escala/unidades não importam de forma crítica — o jogo normaliza a altura de cada personagem
  automaticamente por código. Ainda assim, modele em proporções realistas (~1 unidade = 1 metro) pra
  facilitar comparação visual com a Bíblia de Personagens.
- Centralize o personagem no eixo X/Z (x=0, z=0) com os PÉS em y=0 (origem do objeto na base, não no
  centro do corpo) — evita ter que corrigir offset depois.
- O personagem deve estar modelado de frente para o eixo -Z (ou, se seu software usar outra
  convenção, deixe explícito qual eixo é a "frente") — isso importa porque o jogo gira o modelo
  programaticamente pra encarar quem ele olha.

## Nomenclatura
- Nome do arquivo: `<nome-do-personagem-em-kebab-case>.glb` (ex.: `broto.glb`, `fagulha.glb`,
  `caranguejo-casca-dura.glb`).

## Checklist final antes de entregar
- [ ] Exportado como .glb único, texturas embutidas
- [ ] Sem compressão Draco/KTX2
- [ ] Textura(s) em 512–1024px (nunca 2048/4096)
- [ ] Um mesh, um material, texturas bakeadas em imagem
- [ ] ~15–20k triângulos ou menos
- [ ] Sem armature/animação (a menos que seja pedido)
- [ ] Pés na origem (y=0), personagem centralizado em x=0,z=0
- [ ] Frente do personagem alinhada com um eixo conhecido (me diga qual)
- [ ] Aparência fiel à ficha de personagem (cores, proporções, acessórios)
