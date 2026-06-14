# Assets do Jubis Fire

Hoje os 10 personagens e o mapa são **gerados por código** (não precisam de
arquivos). Esta pasta existe para uma evolução futura: trocar os bonecos blocky
por modelos 3D de verdade.

## Para usar modelos próprios depois
- Formato **`.glb`** (glTF binário, arquivo único), Y-up, leve (< ~5 MB, < ~50k triângulos — roda no celular).
- Personagem ideal: **riggado com animações** nomeadas (ex.: `Idle`, `Run`, `Jump`) — padrão Mixamo funciona bem.
- Onde plugar no código: `characters.js` → função `buildBody()`. Carregue o GLTF com
  `GLTFLoader`, clone `gltf.scene` por jogador e troque a animação por código por um
  `THREE.AnimationMixer` tocando os clipes. A interface (`entity.body`, `animateBody`)
  já foi pensada para essa troca.
