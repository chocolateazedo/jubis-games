// Jubis Fire — prédio de 3 andares no estilo "Backrooms": papel de parede
// amarelo, carpete amarelo, forro com luminárias e pilares creme.
//
// Movimento vertical via "superfícies" caminháveis + elevador (groundAt).
// occluders = malhas que podem tapar a câmera (ficam translúcidas).

import * as THREE from 'three';
import { CONFIG, clamp } from './shared.js?v=3';
import * as TX from './textures.js?v=3';

const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

export function buildArena(scene) {
  const colliders = [];
  const surfaces = [];
  const occluders = [];
  const F = CONFIG.FLOORS;          // [0, 8, 16]
  const BX0 = -30, BX1 = 30, BZ0 = -20, BZ1 = 20, WTOP = 26, CH = 7.4; // CH = pé-direito

  scene.background = new THREE.Color(0xcdbf7e);
  scene.fog = new THREE.Fog(0xcdbf7e, 80, 240);

  // luz quente e bem espalhada (clima fluorescente do Backrooms)
  scene.add(new THREE.HemisphereLight(0xfff3cf, 0x6b6238, 1.1));
  const sun = new THREE.DirectionalLight(0xffe7b8, 1.35);
  sun.position.set(40, 85, 30); sun.castShadow = true;
  sun.shadow.mapSize.set(IS_TOUCH ? 1024 : 2048, IS_TOUCH ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 5;
  const sc = sun.shadow.camera; sc.left = -50; sc.right = 50; sc.top = 50; sc.bottom = -50; sc.near = 1; sc.far = 240;
  scene.add(sun);

  // texturas + relevo
  const cWall = TX.wallpaper(), cCarpet = TX.carpet(), cCeil = TX.ceilingTile(), cPlaster = TX.plaster(), cMetal = TX.metal(), cGrass = TX.grass();
  const nWall = TX.normalFromCanvas(cWall, 1.3), nCarpet = TX.normalFromCanvas(cCarpet, 1.0), nCeil = TX.normalFromCanvas(cCeil, 1.4), nPlaster = TX.normalFromCanvas(cPlaster, 0.7), nMetal = TX.normalFromCanvas(cMetal);
  const NS = () => new THREE.Vector2(0.5, 0.5);
  const matFloor = () => new THREE.MeshStandardMaterial({ map: TX.toTex(cCarpet), normalMap: nCarpet, normalScale: NS(), roughness: 1 });
  const matWall = new THREE.MeshStandardMaterial({ map: TX.toTex(cWall), normalMap: nWall, normalScale: NS(), roughness: 0.95 });
  const matColumn = new THREE.MeshStandardMaterial({ map: TX.toTex(cPlaster), normalMap: nPlaster, normalScale: NS(), roughness: 0.9 });
  const matCeil = new THREE.MeshStandardMaterial({ map: TX.toTex(cCeil), normalMap: nCeil, normalScale: NS(), roughness: 0.95 });
  const matPanel = new THREE.MeshStandardMaterial({ color: 0xfff7e0, emissive: 0xfff0c0, emissiveIntensity: 1.7, roughness: 0.4 });
  const matRamp = new THREE.MeshStandardMaterial({ map: TX.toTex(cMetal), normalMap: nMetal, normalScale: NS(), roughness: 0.55, metalness: 0.55 });

  // terreno externo (grama)
  const terrain = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.ARENA, CONFIG.ARENA),
    new THREE.MeshStandardMaterial({ map: TX.toTex(cGrass), normalMap: TX.normalFromCanvas(cGrass, 1.0), normalScale: NS(), roughness: 1 }));
  terrain.rotation.x = -Math.PI / 2; terrain.position.y = -0.6; // abaixo do carpete (evita z-fighting)
  terrain.receiveShadow = true; scene.add(terrain); TX.tileMaps(terrain, 6);

  // chão do térreo (carpete)
  surfaces.push({ kind: 'flat', x0: BX0, x1: BX1, z0: BZ0, z1: BZ1, y: F[0] });
  const slab0 = new THREE.Mesh(new THREE.BoxGeometry(BX1 - BX0, 0.4, BZ1 - BZ0), matFloor());
  slab0.position.set(0, -0.2, 0); slab0.receiveShadow = true; scene.add(slab0); pushOcc(slab0, 6);

  // vãos
  const SHAFT = { x0: -30, x1: -22, z0: -5, z1: 5 };
  // escada/rampa recuadas das paredes (piso em volta)
  const STAIR_NE = { x0: 20, x1: 28, z0: 8, z1: 18 };
  const RAMP_SE = { x0: 20, x1: 28, z0: -18, z1: -8 };

  // lajes (carpete) com vãos
  tileFloor(scene, surfaces, occluders, BX0, BX1, BZ0, BZ1, F[1], [SHAFT, STAIR_NE], matFloor());
  tileFloor(scene, surfaces, occluders, BX0, BX1, BZ0, BZ1, F[2], [SHAFT, RAMP_SE], matFloor());

  // forros + luminárias em cada andar
  for (const y of F) buildCeiling(y + CH);

  // paredes externas (papel de parede) + rodapés claros
  wall(0, BZ1, BX1 - BX0, 1); wall(0, BZ0, BX1 - BX0, 1);
  wallV(BX0, 0, BZ1 - BZ0, 1); wallV(BX1, 0, BZ1 - BZ0, 1);
  for (const y of F) baseboards(y);

  // poço do elevador
  solidBox(SHAFT.x0 + 4, WTOP / 2, SHAFT.z1, 8, WTOP, 0.6, matWall);
  solidBox(SHAFT.x0 + 4, WTOP / 2, SHAFT.z0, 8, WTOP, 0.6, matWall);

  // escada 0->1 e rampa 1->2
  buildStairs(STAIR_NE.x0, STAIR_NE.x1, 18, F[0], 8, F[1], 14, matColumn);
  surfaces.push({ kind: 'ramp', x0: STAIR_NE.x0, x1: STAIR_NE.x1, z0: 8, z1: 18, zA: 18, yA: F[0], zB: 8, yB: F[1] });
  buildRamp(RAMP_SE.x0, RAMP_SE.x1, -18, F[1], -8, F[2], matRamp);
  surfaces.push({ kind: 'ramp', x0: RAMP_SE.x0, x1: RAMP_SE.x1, z0: -18, z1: -8, zA: -18, yA: F[1], zB: -8, yB: F[2] });

  // pilares (no lugar dos blocos) — vão do piso ao forro em todos os andares
  for (const y of F) for (const px of [-14, 14]) for (const pz of [-8, 8]) pillar(px, pz, y, CH);

  // elevador
  const elevator = { x0: -29, x1: -22, z0: -4, z1: 4, y: F[0], target: null, floors: F.slice() };
  const car = new THREE.Group();
  const matCar = new THREE.MeshStandardMaterial({ map: TX.toTex(cMetal), normalMap: nMetal, normalScale: NS(), roughness: 0.5, metalness: 0.6 });
  const carFloor = new THREE.Mesh(new THREE.BoxGeometry(7, 0.3, 8), matCar);
  carFloor.position.y = -0.09; car.add(carFloor); TX.tileMaps(carFloor, 4); // levanta ~6cm p/ não brigar com o carpete
  const carBack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 8), matCar.clone());
  carBack.position.set(-3.4, 1.7, 0); car.add(carBack); TX.tileMaps(carBack, 4);
  car.position.set((elevator.x0 + elevator.x1) / 2, elevator.y, (elevator.z0 + elevator.z1) / 2);
  car.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(car); elevator.mesh = car;

  const spawns = [
    new THREE.Vector3(-14, 0, 12), new THREE.Vector3(14, 0, 12),
    new THREE.Vector3(-6, 0, -12), new THREE.Vector3(6, 0, -12),
  ];

  function groundAt(x, z, feetY) {
    let best = -Infinity;
    for (const s of surfaces) {
      if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
      const sy = s.kind === 'flat' ? s.y : s.yA + (s.yB - s.yA) * clamp((z - s.zA) / (s.zB - s.zA), 0, 1);
      if (sy <= feetY + CONFIG.STEP_UP && sy > best) best = sy;
    }
    if (x >= elevator.x0 && x <= elevator.x1 && z >= elevator.z0 && z <= elevator.z1) {
      if (elevator.y <= feetY + CONFIG.STEP_UP && elevator.y > best) best = elevator.y;
    }
    return best === -Infinity ? 0 : best;
  }

  return { colliders, surfaces, occluders, spawns, elevator, groundAt };

  // ---------- helpers ----------
  function pushOcc(m, wpt = 6) { TX.tileMaps(m, wpt); occluders.push(m); }
  function solidBox(cx, cy, cz, w, h, d, mat, wpt = 8) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(cx, cy, cz); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    colliders.push({ min: { x: cx - w / 2, z: cz - d / 2 }, max: { x: cx + w / 2, z: cz + d / 2 }, top: cy + h / 2 });
    pushOcc(m, wpt); return m;
  }
  function wall(cx, cz, len, t) { solidBox(cx, WTOP / 2, cz, len, WTOP, t, matWall, 8); }
  function wallV(cx, cz, len, t) { solidBox(cx, WTOP / 2, cz, t, WTOP, len, matWall, 8); }
  function pillar(x, z, y, h) {
    const w = 2.4;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), matColumn);
    shaft.position.set(x, y + h / 2, z); shaft.castShadow = true; shaft.receiveShadow = true; scene.add(shaft);
    colliders.push({ min: { x: x - w / 2, z: z - w / 2 }, max: { x: x + w / 2, z: z + w / 2 }, top: y + h });
    pushOcc(shaft, 4);
    for (const [yy, hh] of [[y + 0.25, 0.5], [y + h - 0.2, 0.4]]) { // base e capitel
      const t = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, hh, w + 0.5), matColumn);
      t.position.set(x, yy, z); t.castShadow = true; t.receiveShadow = true; scene.add(t); pushOcc(t, 4);
    }
  }
  function buildCeiling(cy) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(BX1 - BX0, 0.3, BZ1 - BZ0), matCeil);
    m.position.set(0, cy, 0); m.receiveShadow = true; scene.add(m); pushOcc(m, 2);
    for (let x = BX0 + 9; x < BX1; x += 14) {
      for (let z = BZ0 + 8; z < BZ1; z += 13) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 1.4), matPanel);
        p.position.set(x, cy - 0.22, z); scene.add(p);
      }
    }
  }
  function baseboards(y) {
    const h = 0.6, t = 0.3;
    const strip = (cx, cz, w, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matColumn); m.position.set(cx, y + h / 2, cz); scene.add(m); };
    strip(0, BZ1 - 0.6, BX1 - BX0, t); strip(0, BZ0 + 0.6, BX1 - BX0, t);
    strip(BX1 - 0.6, 0, t, BZ1 - BZ0); strip(BX0 + 0.6, 0, t, BZ1 - BZ0);
  }
  function buildStairs(x0, x1, zStart, yStart, zEnd, yEnd, n, mat) {
    const dz = (zEnd - zStart) / n;
    for (let k = 1; k <= n; k++) {
      const top = yStart + (yEnd - yStart) * (k / n);
      const zc = zStart + dz * (k - 0.5);
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, top + 0.2, Math.abs(dz)), mat);
      m.position.set((x0 + x1) / 2, (top - 0.2) / 2, zc); m.castShadow = true; m.receiveShadow = true; scene.add(m); pushOcc(m, 4);
    }
  }
  function buildRamp(x0, x1, zA, yA, zB, yB, mat) {
    const dz = zB - zA, dy = yB - yA, len = Math.hypot(dz, dy);
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.4, len), mat);
    m.position.set((x0 + x1) / 2, (yA + yB) / 2, (zA + zB) / 2);
    m.rotation.x = -Math.atan2(dy, dz); m.castShadow = true; m.receiveShadow = true; scene.add(m); pushOcc(m, 4);
  }
}

// Divide uma laje em retângulos cobrindo [x0,x1]x[z0,z1] menos os buracos.
function tileFloor(scene, surfaces, occluders, x0, x1, z0, z1, y, holes, mat) {
  const xs = new Set([x0, x1]), zs = new Set([z0, z1]);
  for (const h of holes) {
    if (h.x0 > x0 && h.x0 < x1) xs.add(h.x0);
    if (h.x1 > x0 && h.x1 < x1) xs.add(h.x1);
    if (h.z0 > z0 && h.z0 < z1) zs.add(h.z0);
    if (h.z1 > z0 && h.z1 < z1) zs.add(h.z1);
  }
  const X = [...xs].sort((a, b) => a - b), Z = [...zs].sort((a, b) => a - b);
  for (let i = 0; i < X.length - 1; i++) {
    for (let j = 0; j < Z.length - 1; j++) {
      const cx0 = X[i], cx1 = X[i + 1], cz0 = Z[j], cz1 = Z[j + 1];
      if (cx1 - cx0 < 0.1 || cz1 - cz0 < 0.1) continue;
      const mx = (cx0 + cx1) / 2, mz = (cz0 + cz1) / 2;
      if (holes.some((h) => mx > h.x0 && mx < h.x1 && mz > h.z0 && mz < h.z1)) continue;
      surfaces.push({ kind: 'flat', x0: cx0, x1: cx1, z0: cz0, z1: cz1, y });
      const m = new THREE.Mesh(new THREE.BoxGeometry(cx1 - cx0, 0.4, cz1 - cz0), mat.clone());
      m.position.set(mx, y - 0.2, mz); m.receiveShadow = true; m.castShadow = true; scene.add(m);
      TX.tileMaps(m, 6); occluders.push(m);
    }
  }
}

// Empurra uma posição (raio r) para fora das paredes (apenas no plano XZ).
export function resolveCollisions(pos, r, colliders) {
  for (const c of colliders) {
    const cx = Math.max(c.min.x, Math.min(pos.x, c.max.x));
    const cz = Math.max(c.min.z, Math.min(pos.z, c.max.z));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * r; pos.z = cz + (dz / d) * r;
      } else {
        const pxx = Math.min(pos.x - c.min.x, c.max.x - pos.x);
        const pzz = Math.min(pos.z - c.min.z, c.max.z - pos.z);
        if (pxx < pzz) pos.x += (pos.x - (c.min.x + c.max.x) / 2) > 0 ? pxx + r : -(pxx + r);
        else pos.z += (pos.z - (c.min.z + c.max.z) / 2) > 0 ? pzz + r : -(pzz + r);
      }
    }
  }
}
