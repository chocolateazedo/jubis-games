---
name: jubis-personagem-meshy
description: Gerar um personagem/NPC 3D via API da Meshy (Image-to-3D a partir de uma ficha da Bíblia de Personagens) e integrar no jogo como GLB, incluindo correção de paleta de cor e rosto procedural. Use quando o usuário pedir para criar/recriar um personagem "usando a API da Meshy" ou "gerar o modelo 3D" a partir de uma ficha/imagem de referência. Para pedir a um agente externo (Blender etc.) que prepare o asset manualmente, veja a seção "Prompt para agente externo" — ela reaproveita o mesmo checklist.
---

# Gerar personagem 3D via Meshy API

Fluxo aprendido gerando o **Vovô Carvalho** (Crônicas do Bosque) a partir da ficha da Bíblia de
Personagens. Cobre: chamar a API, o que costuma dar errado (paleta de cor, custo, verificação
headless) e como corrigir cada coisa sem gastar créditos à toa.

Leia também `jubis-melhorar-jogo` (loop de edição/verificação geral).

## 0. Pré-requisito: a chave da API

A chave fica em `~/.config/meshy/api_key` (fora do repositório, `chmod 600`). **Nunca** commite a
chave nem a exiba de volta inteira na conversa. Se o usuário mandar uma chave nova no chat, salve
assim:

```bash
mkdir -p ~/.config/meshy && umask 177
printf '%s' 'msy_...' > ~/.config/meshy/api_key && chmod 600 ~/.config/meshy/api_key
```

Teste com o endpoint de saldo (também serve pra conferir quanto foi gasto depois de cada geração):

```bash
KEY=$(cat ~/.config/meshy/api_key)
curl -s https://api.meshy.ai/openapi/v1/balance -H "Authorization: Bearer ${KEY}"
```

## 1. Orçamento — pergunte/confirme antes de gerar

Preços (checar `https://docs.meshy.ai/en/api/pricing` se mudar):

| Operação | `ai_model: meshy-5` (barato) | `meshy-6`/`latest` ou `model_type: lowpoly` |
|---|---|---|
| Image-to-3D **sem** textura | 5 créditos | 20 créditos |
| Image-to-3D **com** textura | **15 créditos** | 30 créditos |
| Text-to-3D preview | 5 créditos | 20 créditos |
| Text-to-3D refine (textura) | 10 créditos | 10 créditos |

Pra ficar barato: **`ai_model: "meshy-5"`, `model_type: "standard"`** (não `"lowpoly"` — isso também
sobe pro tier caro). Se o usuário der um teto de créditos, planeje ~2-4 tentativas dentro dele antes
de começar (a paleta de cor raramente sai perfeita na primeira, veja seção 3).

Campos que **só existem no meshy-6** e dão erro 400 se mandados com `meshy-5`: `remove_lighting`,
`image_enhancement`. Não inclua esses campos ao usar `meshy-5`.

## 2. Prepare a imagem de referência (recorte a ficha)

A ficha da Bíblia de Personagens tem texto, bordas tracejadas e paleta de cores ao lado — **recorte
só a ilustração do personagem** antes de mandar pra API (texto/UI ao redor confunde o Image-to-3D).
Use PIL, ajuste a caixa de recorte olhando o resultado:

```python
from PIL import Image
im = Image.open('ficha.png'); w, h = im.size
crop = im.crop((int(w*0.045), int(h*0.235), int(w*0.275), int(h*0.635)))  # ajuste por olho
crop = crop.resize((crop.width*2, crop.height*2), Image.LANCZOS)
crop.save('ref_recortada.png')
```

Depois converta pra base64 e mande como `data:image/png;base64,...` no campo `image_url` — não
precisa hospedar a imagem em lugar nenhum público, a API aceita data URI direto.

## 3. Chame Image-to-3D com os parâmetros certos

```python
body = {
    "image_url": "data:image/png;base64,...",
    "model_type": "standard",
    "ai_model": "meshy-5",
    "should_texture": True,
    "enable_pbr": False,        # mapas extra = mais custo/peso; base color já basta
    "hd_texture": False,        # nunca peça 4K — vira textura gigante
    "texture_prompt": "...",    # ver abaixo
    "negative_prompt": "...",   # ver abaixo (aceito mesmo não documentado p/ meshy-5)
    "should_remesh": True,
    "topology": "triangle",
    "target_polycount": 14000,  # 8-20k é de sobra pro estilo do jogo
    "target_formats": ["glb"],
    "auto_size": False,
}
```

Poll em `GET /openapi/v1/image-to-3d/{id}` até `status: SUCCEEDED` (a cada ~5s); pegue
`model_urls.glb` e `thumbnail_url` (baixe a thumbnail primeiro — é rápido e já mostra se valeu a
pena baixar o `.glb` de verdade).

### O problema recorrente: a IA ignora a paleta de cor pedida em texto

Em 3 tentativas gerando o Vovô Carvalho, a cor do tronco/copa **nunca bateu** com os hex pedidos no
`texture_prompt` (saiu tom de pele/tan, ou oliva/amarelado, mesmo repetindo os hex várias vezes e
usando `negative_prompt`). A malha/silhueta geralmente sai boa; a **cor** é o ponto fraco. Duas
lições:

1. **Não fique reiterando geração só por causa de cor** — cada tentativa custa crédito e o resultado
   é instável. Prefira gerar 2-3 vezes olhando a **malha/rosto** (isso sim melhora com o prompt), e
   corrigir a cor depois por código (seção 4).
2. `texture_prompt`/`negative_prompt` aceitos mesmo sem estarem 100% documentados pro Image-to-3D —
   teste, o pior caso é a API ignorar silenciosamente o campo.
3. Peça explicitamente **um rosto só, no lugar certo** ("ONLY ONE face, located on the upper trunk
   ... the lower belly area is PLAIN, no second face") — sem isso a IA às vezes desenha um segundo
   rosto acidental numa região com formas que lembram olhos/boca.

## 4. Corrija a paleta por código (PIL, sem numpy)

Baixe a textura (`texture_urls[0].base_color`), identifique as faixas de matiz reais amostrando a
imagem (histograma de matiz onde saturação é alta, pra achar os clusters de cor de verdade em vez de
chutar):

```python
from PIL import Image
from collections import Counter
small = Image.open('tex.png').resize((160,160)).convert('HSV')
buckets = Counter()
for h, s, v in small.getdata():
    if s > 60 and v > 40: buckets[h//8*8] += 1
print(sorted(buckets.items(), key=lambda x: -x[1])[:10])  # hue dominante em 0-255
```

Depois remapeie por faixa de matiz (PIL tem `.convert('HSV')` nativo, não precisa de numpy):

```python
hsv = im.convert('RGB').convert('HSV'); H, S, V = hsv.split()
def lut_range(lo, hi): return [255 if lo <= i <= hi else 0 for i in range(256)]
mask = H.point(lut_range(0, 44))                      # faixa "errada" (ex.: tan)
H2 = Image.composite(Image.new('L', im.size, 20), H, mask)      # 20 = matiz alvo (bark ~23°)
S2 = Image.composite(Image.blend(S, Image.new('L', im.size, 158), 0.65), S, mask)
V2 = Image.composite(V.point(lambda x: int(x*0.60)), V, mask)   # escurece (tan costuma sair pastel demais)
out = Image.merge('HSV', (H2, S2, V2)).convert('RGB')
```

Repita `mask`/`H2`/`S2`/`V2` pra cada faixa de cor errada (ex.: tronco tan→marrom, copa oliva→verde).
Redimensione o resultado pra **≤1024px** nesse passo mesmo (`out.resize((1024,1024))`) — já cumpre a
regra de textura leve.

### 4b. Quando duas partes têm a MESMA cor errada (matiz não resolve — use geometria)

Na Vovó Samambaia, o rosto (pele, correto) e o corpo (devia ser verde, saiu com a MESMA cor de pele)
tinham o mesmo matiz/saturação — um `mask` por matiz recoloriria os dois juntos (incluindo o rosto
que já estava certo). Nesse caso, corrija por **posição 3D do vértice**, não por cor do pixel:

```python
import struct, json, array
# leia POSITION, TEXCOORD_0 e os índices do primitive (ver seção 5 pra como ler um accessor cru)
pos = read_accessor(POSITION_IDX)   # lista de (x,y,z)
uv  = read_accessor(TEXCOORD_IDX)   # lista de (u,v)
idx = read_accessor(INDICES_IDX)    # lista de índices (uint16/32)

miny, maxy = min(p[1] for p in pos), max(p[1] for p in pos)
THRESH = miny + 0.62 * (maxy - miny)   # ajuste pela proporção real corpo/cabeça do preview

from PIL import Image, ImageDraw
W, H = im.size
mask = Image.new('L', (W, H), 0); draw = ImageDraw.Draw(mask)
for t in range(len(idx) // 3):
    i0, i1, i2 = idx[t*3], idx[t*3+1], idx[t*3+2]
    if sum(pos[i][1] < THRESH for i in (i0, i1, i2)) >= 2:   # maioria do triângulo é "corpo"
        draw.polygon([(uv[i][0]*W, uv[i][1]*H) for i in (i0, i1, i2)], fill=255)
```

Isso rasteriza, no espaço da textura, exatamente os triângulos que ficam abaixo do "pescoço" — mesmo
que o atlas UV espalhe cabeça/corpo intercalados pela imagem toda (comum em auto-unwrap; não dá pra
supor que corpo e cabeça ocupam metades separadas da textura). Use essa `mask` no lugar da `mask` por
matiz da seção 4 (mesmo `Image.composite` de H/S/V). Funciona bem mesmo sem `numpy` — só
`struct`+`array`+`PIL.ImageDraw`.

Regra prática: **matiz** quando a cor errada é *diferente* da cor certa em algum outro lugar do
modelo (ex.: tronco tan mas nada mais no modelo é dessa cor); **geometria** quando a cor errada
*coincide* com uma cor que também está certa em outra parte (pele do rosto vs. pele do corpo).

## 5. Reconstrua o `.glb` com a textura corrigida (sem depender de libs externas)

Não há `pygltflib`/`trimesh` disponíveis por padrão — não tem problema, um `.glb` é só
`header(12B) + chunk JSON + chunk BIN`, e dá pra editar via `struct`+`json` puro. Receita (funciona
quando a imagem é o **último** bufferView do BIN, o caso comum de export single-mesh):

```python
import struct, json
f = open('modelo.glb', 'rb')
magic, version, total = struct.unpack('<4sII', f.read(12))
jlen, jtype = struct.unpack('<I4s', f.read(8)); j = json.loads(f.read(jlen))
blen, btype = struct.unpack('<I4s', f.read(8)); bin_data = f.read(blen)

bv = j['bufferViews'][IMG_INDEX]  # ache o índice certo em j['images']/j['textures']
end = bv['byteOffset'] + bv['byteLength']
assert len(bin_data) - end < 4, 'imagem não é o final do buffer'  # < 4, não ==: o chunk BIN tem até
                                                                    # 3 bytes de padding de alinhamento
head = bin_data[:bv['byteOffset']]
png = open('tex_corrigida.png', 'rb').read()
pad = (-len(png)) % 4
new_bin = head + png + b'\x00'*pad

j['images'][0]['mimeType'] = 'image/png'
j['bufferViews'][IMG_INDEX]['byteLength'] = len(png)
j['buffers'][0]['byteLength'] = len(new_bin)
jb = json.dumps(j, separators=(',', ':')).encode(); jb += b' ' * ((-len(jb)) % 4)

out = struct.pack('<4sII', b'glTF', 2, 0)
out += struct.pack('<I4s', len(jb), b'JSON') + jb
out += struct.pack('<I4s', len(new_bin), b'BIN\x00') + new_bin
out = struct.pack('<4sII', b'glTF', 2, len(out)) + out[12:]
open('modelo-final.glb', 'wb').write(out)
```

Pra ler POSITION/TEXCOORD_0/índices crus (necessário na técnica de geometria da seção 4b), sem
biblioteca nenhuma além de `array` (built-in):

```python
def read_accessor(j, bin_data, idx):
    a = j['accessors'][idx]; bv = j['bufferViews'][a['bufferView']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    comp = {5126: ('f', 4), 5125: ('I', 4), 5123: ('H', 2)}[a['componentType']]  # float/uint32/uint16
    dim = {'VEC2': 2, 'VEC3': 3, 'SCALAR': 1}[a['type']]
    arr = array.array(comp[0]); arr.frombytes(bin_data[off: off + a['count']*dim*comp[1]])
    return [arr[i*dim:(i+1)*dim] for i in range(a['count'])] if dim > 1 else list(arr)
```

`j['meshes'][0]['primitives'][0]['attributes']` dá os índices de `POSITION`/`TEXCOORD_0`/`NORMAL`; o
campo `indices` do primitive é o accessor dos índices (`SCALAR`, geralmente `componentType` 5125).

Isso troca a textura (geralmente JPEG 2048px pesado) por uma PNG corrigida e menor — o arquivo final
costuma ficar **menor** que o original (no caso do Vovô: 2.9MB → 1.5MB).

## 6. Rosto/olhos procedurais por cima (garante o "brilho mágico" sem depender da IA)

Como a bake de rosto da IA é instável, **não dependa dela pro traço mais importante** (olhos
brilhantes/expressivos). Depois de carregar o modelo, adicione esferas emissivas pequenas
posicionadas pela bounding box do próprio modelo carregado (não hardcode posição absoluta — cada
geração pode sair com proporção um pouco diferente):

```js
const bb = new THREE.Box3().setFromObject(model), size = bb.getSize(new THREE.Vector3());
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x4a3414, emissive: 0xF8A92E, emissiveIntensity: 1.6 });
for (const sx of [-1, 1]) {
  const e = new THREE.Mesh(new THREE.SphereGeometry(size.x * 0.07, 16, 12), eyeMat);
  e.position.set(sx * size.x * 0.18, size.y * 0.62, size.z * 0.42);  // terço superior, frente (+Z)
  body.add(e);
}
```

Isso também garante que o pulso de brilho (`material.emissiveIntensity = ...` no loop de frame) tem
sempre um alvo certo, independente de como a textura saiu.

## 7. Integração no `index.html` — armadilha do TDZ

`getGLB`/`_glbCache` costumam ser declarados **no meio do arquivo** (perto de onde os pets/GLBs já
existentes são carregados), não no topo. Se o código do personagem novo estiver posicionado ANTES
dessa declaração (ex.: um bloco de setup que já existia lá em cima, tipo o antigo NPC procedural que
você está substituindo), a chamada a `getGLB(...)` no load ASSÍNCRONO ainda executa na hora certa,
mas se você tentar chamar `getGLB` de dentro de um bloco **síncrono** que roda antes da declaração
`const _glbCache = {}`, dá `ReferenceError: Cannot access '_glbCache' before initialization` (erro
real que aconteceu gerando o Vovô). Solução: **separe** — deixe no lugar antigo só o que não precisa
de `getGLB` (luzes, anéis, posição do grupo), e mova o `getGLB(...).then(...)` pra logo depois da
definição de `getGLB` mais abaixo no arquivo (onde os outros GLBs já são pré-aquecidos).

Padrão de carregamento (normaliza altura/pivô igual o `spawnActor` do jogo já faz pros pets):

```js
getGLB('models/<slug>.glb').then(g => {
  const model = g.scene, bb0 = new THREE.Box3().setFromObject(model);
  const s = targetH / ((bb0.max.y - bb0.min.y) || 1); model.scale.setScalar(s);
  const bb1 = new THREE.Box3().setFromObject(model);
  model.position.y -= bb1.min.y; model.position.x -= (bb1.min.x+bb1.max.x)/2; model.position.z -= (bb1.min.z+bb1.max.z)/2;
  // ... adiciona ao grupo, olhos procedurais (seção 6), guarda referências em userData
}).catch(() => { /* fallback pro modelo procedural antigo, se existir */ });
```

Guarde `userData.body` (o grupo escalado) pra poder aplicar respiração:

```js
// no loop de frame, junto de outras animações idle:
if (thing.userData.body) {
  const breathe = 1 + Math.sin(t * 0.0011) * 0.018, bs = thing.userData.bodyBaseScale;
  thing.userData.body.scale.set(bs.x * (1 - (breathe-1)*0.5), bs.y * breathe, bs.z * (1 - (breathe-1)*0.5));
}
```

## 8. Verificação — headless pode travar de forma genérica (não é seu bug)

Além dos avisos já conhecidos (`jubis-melhorar-jogo`), aconteceu isto gerando o Vovô: o
`GLTFLoader.load()` **travou indefinidamente** (nem `onLoad` nem `onError` disparavam) no ambiente
headless, mesmo pro `.glb` novo E pra um GLB **já usado em produção** (`animal-fox.glb`) testado como
controle. Ou seja: às vezes o próprio Chrome headless/swiftshader fica instável pra qualquer
`GLTFLoader`, não é o asset que está quebrado.

Antes de desconfiar do seu código/asset, faça o teste de controle: carregue via `GLTFLoader` um GLB
que **já funciona em produção** no mesmo harness. Se ele também travar, é o ambiente (tente
`pkill -9 chrome` pra limpar processos acumulados e rodar de novo uma vez; se persistir, não vale a
pena insistir mais que isso). Nesse caso, valide por outros meios antes de commitar:

1. **Estrutura do `.glb`** direto em Python (`struct`+`json`, seção 5) — confirma que é um glTF
   binário válido, com buffers/bufferViews consistentes.
2. **A imagem embutida** abre com PIL (`Image.open(...).load()`) sem erro.
3. **O padrão de código** é idêntico ao usado em outros `getGLB(...).then(...)` que já funcionam no
   mesmo arquivo (mesma normalização de bbox, mesmo `scene.add`).
4. `node --check` no módulo extraído do `<script type="module">` (sempre, de qualquer forma).

Isso não substitui ver o resultado de verdade no navegador — se puder, peça pro usuário abrir o jogo
publicado e conferir visualmente; mas não trave o trabalho tentando forçar um screenshot headless que
está falhando por instabilidade do ambiente, não por erro seu.

## Prompt para agente externo (quando NÃO for gerar direto pela API)

Se o usuário preferir preparar o asset em outra ferramenta (Blender, outro agente) em vez de chamar a
Meshy diretamente, use/adapte `games/cronicas-bosque/prompts/broto.md` como checklist — cobre os
mesmos requisitos técnicos do carregador do jogo (formato `.glb` sem Draco, textura ≤1024px, sem
rig/animação, origem nos pés, malha única). Copie esse arquivo pra outro nome
(`prompts/<personagem>.md`) e ajuste o que for específico do personagem.

## Checklist antes de integrar

- [ ] Saldo de créditos conferido antes e depois (orçamento combinado com o usuário respeitado)
- [ ] Textura final ≤1024px, paleta corrigida (ou aceita como está, se já bateu)
- [ ] `.glb` reconstruído/validado estruturalmente em Python
- [ ] Olhos/rosto procedurais adicionados por cima (não depende só da textura da IA)
- [ ] `getGLB(...)` chamado DEPOIS da declaração de `_glbCache`/`getGLB` (sem TDZ)
- [ ] Fallback (`catch`) pro modelo procedural antigo, se existir um
- [ ] `node --check` no módulo
- [ ] `__t.html`/harnesses de teste apagados antes de commitar
