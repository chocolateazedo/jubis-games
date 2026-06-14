// Jubis Fire — 10 personagens iniciais (5 masculinos, 5 femininos), construídos
// por código com formas simples (estilo blocky) e animados sem esqueleto:
// os braços e pernas são grupos com pivô no ombro/quadril, então basta girar.
//
// Trocar por modelos .glb depois: carregue um GLTF e substitua buildBody() por
// um clone do gltf.scene + AnimationMixer. A interface (entity.parts/anim) foi
// pensada pra facilitar essa troca.

import * as THREE from 'three';

// id, nome, gênero, e cores. hair: 'short' | 'long' | 'bun' | 'cap' | 'spiky'
export const CHARACTERS = [
  { id: 'm1', name: 'Bombadão', gender: 'm', skin: 0xf1c27d, shirt: 0xe53935, pants: 0x263238, hairColor: 0x3b2417, hair: 'short', big: true },
  { id: 'm2', name: 'Caio',  gender: 'm', skin: 0xffdbac, shirt: 0x1e88e5, pants: 0x37474f, hairColor: 0x111111, hair: 'spiky' },
  { id: 'm3', name: 'Theo',  gender: 'm', skin: 0x8d5524, shirt: 0x43a047, pants: 0x212121, hairColor: 0x000000, hair: 'short' },
  { id: 'm4', name: 'Davi',  gender: 'm', skin: 0xe0ac69, shirt: 0xfb8c00, pants: 0x3e2723, hairColor: 0x5d4037, hair: 'cap' },
  { id: 'm5', name: 'Bento', gender: 'm', skin: 0xc68642, shirt: 0x8e24aa, pants: 0x1a237e, hairColor: 0x2b1b12, hair: 'spiky' },
  { id: 'f1', name: 'Mia',   gender: 'f', skin: 0xffdbac, shirt: 0xec407a, pants: 0x4a148c, hairColor: 0x4e342e, hair: 'long' },
  { id: 'f2', name: 'Lara',  gender: 'f', skin: 0xf1c27d, shirt: 0x00897b, pants: 0x263238, hairColor: 0x1b1b1b, hair: 'bun' },
  { id: 'f3', name: 'Sofia', gender: 'f', skin: 0x8d5524, shirt: 0xfdd835, pants: 0x311b92, hairColor: 0x101010, hair: 'long' },
  { id: 'f4', name: 'Cici',  gender: 'f', skin: 0xe0ac69, shirt: 0xd81b60, pants: 0x006064, hairColor: 0x6a1b9a, hair: 'bun' },
  { id: 'f5', name: 'Bia',   gender: 'f', skin: 0xc68642, shirt: 0x00acc1, pants: 0x880e4f, hairColor: 0x3e2723, hair: 'long' },
];

export const getCharacter = (id) => CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];

const box = (w, h, d, color) =>
  new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));

// Cria um membro (braço/perna) com pivô no topo, para girar como pêndulo.
function limb(w, h, d, color) {
  const pivot = new THREE.Group();
  const mesh = box(w, h, d, color);
  mesh.position.y = -h / 2;
  mesh.castShadow = true;
  pivot.add(mesh);
  return pivot;
}

// Monta o boneco. Pés no y=0; altura total ~1.8 (×2.2 se for "grandão").
export function buildBody(preset) {
  const g = new THREE.Group();
  const female = preset.gender === 'f';
  const big = !!preset.big;                 // Bombadão: maior e musculoso
  const torsoW = big ? 0.98 : (female ? 0.62 : 0.72);
  const torsoD = big ? 0.5 : 0.36;
  const armW = big ? 0.32 : 0.2, armH = 0.66, armD = big ? 0.32 : 0.22;
  const legW = big ? 0.36 : 0.26, legH = 0.8, legD = big ? 0.36 : 0.28;
  const legColor = preset.pants;

  // pernas (pivô no quadril, y ~0.8)
  const legL = limb(legW, legH, legD, legColor); legL.position.set(-0.18, 0.8, 0);
  const legR = limb(legW, legH, legD, legColor); legR.position.set(0.18, 0.8, 0);

  // torso
  const torso = box(torsoW, 0.72, torsoD, preset.shirt);
  torso.position.y = 1.15; torso.castShadow = true;

  // braços (pivô no ombro, y ~1.45)
  const armL = limb(armW, armH, armD, preset.shirt); armL.position.set(-(torsoW / 2 + 0.12), 1.45, 0);
  const armR = limb(armW, armH, armD, preset.shirt); armR.position.set(torsoW / 2 + 0.12, 1.45, 0);
  armL.add(box(armW, 0.18, armD, preset.skin).translateY(-armH + 0.09));
  armR.add(box(armW, 0.18, armD, preset.skin).translateY(-armH + 0.09));

  // revólver na mão direita (cano no -Y do braço)
  const gun = buildGun();
  gun.position.set(0, -0.62, 0.08);
  armR.add(gun);

  // cabeça
  const head = box(0.42, 0.42, 0.42, preset.skin);
  head.position.y = 1.75; head.castShadow = true;
  const hair = buildHair(preset);
  if (hair) head.add(hair);

  const parts = { legL, legR, armL, armR, torso, head, gun };

  // marreta na mão esquerda (só o grandão)
  if (big) { const hammer = buildHammer(); armL.add(hammer); parts.hammer = hammer; }

  g.add(legL, legR, torso, armL, armR, head);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  if (big) g.scale.setScalar(2.2);

  return { group: g, parts, t: 0 };
}

function buildHammer() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.45, metalness: 0.65 });
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.1, 0.11), wood); handle.position.y = -0.55; g.add(handle);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.36, 0.36), metal); head.position.y = -1.05; g.add(head);
  g.position.set(0, -0.5, 0.06); // junto da mão esquerda, apontando pra baixo
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function buildGun() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x26262b, roughness: 0.5, metalness: 0.35 });
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.36, 0.09), mat); barrel.position.y = -0.16; // cano (-Y)
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.14, 10), mat); drum.position.y = -0.02; // tambor
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.11), mat); grip.position.set(0, 0.07, 0.12); grip.rotation.x = 0.5; // cabo
  g.add(barrel, drum, grip);
  return g;
}

function buildHair(preset) {
  const mat = new THREE.MeshStandardMaterial({ color: preset.hairColor, roughness: 0.9 });
  const grp = new THREE.Group();
  const add = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); grp.add(m);
  };
  switch (preset.hair) {
    case 'short': add(0.46, 0.14, 0.46, 0, 0.26, 0); break;
    case 'spiky': add(0.46, 0.16, 0.46, 0, 0.27, 0); add(0.12, 0.16, 0.12, -0.12, 0.4, 0); add(0.12, 0.16, 0.12, 0.12, 0.4, 0); break;
    case 'cap':   add(0.5, 0.12, 0.5, 0, 0.28, 0); add(0.4, 0.06, 0.28, 0, 0.24, 0.32); break; // boné com aba
    case 'long':  add(0.48, 0.18, 0.48, 0, 0.24, 0); add(0.46, 0.5, 0.18, 0, -0.02, -0.24); break; // cabelo comprido nas costas
    case 'bun':   add(0.48, 0.16, 0.48, 0, 0.25, 0); add(0.22, 0.22, 0.22, 0, 0.42, -0.04); break; // coque
  }
  return grp;
}

// Anima o boneco. anim: 'idle' | 'run' | 'jump'. speed01 = 0..1 intensidade do passo.
export function animateBody(entity, anim, dt, speed01 = 1, aiming = false, meleeP = -1) {
  const p = entity.parts;
  entity.t += dt;
  const t = entity.t;
  if (anim === 'jump') {
    p.legL.rotation.x = -0.7; p.legR.rotation.x = 0.4;
    p.armL.rotation.x = -2.2; p.armR.rotation.x = -2.2;
    p.torso.rotation.x = 0.1;
  } else if (anim === 'run') {
    const s = Math.sin(t * 12) * 0.8 * Math.max(0.3, speed01);
    p.legL.rotation.x = s;  p.legR.rotation.x = -s;
    p.armL.rotation.x = -s; p.armR.rotation.x = s;
    p.torso.rotation.x = 0.08;
  } else {
    const b = Math.sin(t * 2.2) * 0.06;
    p.legL.rotation.x = 0; p.legR.rotation.x = 0;
    p.armL.rotation.x = b; p.armR.rotation.x = -b;
    p.torso.rotation.x = 0;
  }
  // mira: braço direito (com o revólver) apontando reto pra frente
  if (aiming) { p.armR.rotation.x = -Math.PI / 2; p.armR.rotation.z = 0; }
  // golpe de marreta: braço esquerdo sobe e desce (meleeP = 0..1 do swing)
  if (meleeP >= 0) p.armL.rotation.x = -2.3 + meleeP * 3.1;
}
