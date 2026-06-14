// Jubis Fire — prédio de 3 andares. Gerado por código (determinístico).
//
// Movimento vertical sem física pesada: o mundo é descrito por "superfícies"
// caminháveis (lajes planas e rampas) + o elevador. groundAt(x,z,feetY) devolve
// a altura do chão sob o jogador. Paredes continuam como caixas (colisão XZ).
//
// occluders = malhas que podem tapar a câmera (paredes/lajes/caixas). Cada uma
// recebe material próprio (clone) para poder ficar translúcida individualmente.

import * as THREE from 'three';
import { CONFIG, clamp } from './shared.js?v=3';
import * as TX from './textures.js?v=3';

export function buildArena(scene) {
  const colliders = [];   // {min:{x,z}, max:{x,z}, top} — paredes (push-out XZ)
  const surfaces = [];    // chão caminhável
  const occluders = [];   // malhas que podem tapar a visão
  const F = CONFIG.FLOORS; // [0,8,16]
  const BX0 = -30, BX1 = 30, BZ0 = -20, BZ1 = 20, WTOP = 26;

  scene.background = new THREE.Color(0xaad4ff);
  scene.fog = new THREE.Fog(0xaad4ff, 90, 260);

  scene.add(new THREE.HemisphereLight(0xeaf2ff, 0x4a4636, 0.55));
  const sun = new THREE.DirectionalLight(0xfff2e0, 2.6);
  sun.position.set(40, 85, 30); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
  const sc = sun.shadow.camera; sc.left = -50; sc.right = 50; sc.top = 50; sc.bottom = -50; sc.near = 1; sc.far = 240;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbcd0ff, 0.5); fill.position.set(-30, 45, -25); scene.add(fill);

  // texturas geradas por código + relevo (normal map)
  const cConc = TX.concrete(), cTile = TX.tiles(), cTile2 = TX.tiles('#868fa3'), cWood = TX.wood(), cMetal = TX.metal();
  const nConc = TX.normalFromCanvas(cConc), nTile = TX.normalFromCanvas(cTile), nWood = TX.normalFromCanvas(cWood), nMetal = TX.normalFromCanvas(cMetal);
  const NS = () => new THREE.Vector2(0.7, 0.7);
  const matFloor = new THREE.MeshStandardMaterial({ map: TX.toTex(cTile), normalMap: nTile, normalScale: NS(), roughness: 0.85, metalness: 0.05 });
  const matFloor2 = new THREE.MeshStandardMaterial({ map: TX.toTex(cTile2), normalMap: nTile, normalScale: NS(), roughness: 0.85, metalness: 0.05 });
  const matWall = new THREE.MeshStandardMaterial({ map: TX.toTex(cConc), normalMap: nConc, normalScale: NS(), roughness: 0.92, metalness: 0.04 });
  const matStep = new THREE.MeshStandardMaterial({ map: TX.toTex(cConc), normalMap: nConc, normalScale: NS(), roughness: 0.9 });
  const matRamp = new THREE.MeshStandardMaterial({ map: TX.toTex(cMetal), normalMap: nMetal, normalScale: NS(), roughness: 0.55, metalness: 0.55 });
  const matCrate = new THREE.MeshStandardMaterial({ map: TX.toTex(cWood), normalMap: nWood, normalScale: NS(), roughness: 0.8 });
  const matGlass = new THREE.MeshStandardMaterial({ color: 0x9fd6ff, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.3 });

  // terreno externo (grama)
  const cGrass = TX.grass();
  const terrain = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.ARENA, CONFIG.ARENA),
    new THREE.MeshStandardMaterial({ map: TX.toTex(cGrass), normalMap: TX.normalFromCanvas(cGrass, 1.2), normalScale: NS(), roughness: 1 }));
  terrain.rotation.x = -Math.PI / 2; terrain.receiveShadow = true; scene.add(terrain);
  TX.tileMaps(terrain, 6);

  // chão do térreo
  surfaces.push({ kind: 'flat', x0: BX0, x1: BX1, z0: BZ0, z1: BZ1, y: F[0] });
  const slab0 = new THREE.Mesh(new THREE.BoxGeometry(BX1 - BX0, 0.4, BZ1 - BZ0), matFloor);
  slab0.position.set(0, -0.2, 0); slab0.receiveShadow = true; scene.add(slab0); pushOcc(slab0, 6);

  // vãos nos andares
  const SHAFT = { x0: -30, x1: -22, z0: -5, z1: 5 };
  const STAIR_NE = { x0: 18, x1: 30, z0: 8, z1: 20 };
  const RAMP_SE = { x0: 18, x1: 30, z0: -20, z1: -8 };

  // lajes dos andares superiores (com vãos)
  tileFloor(scene, surfaces, occluders, BX0, BX1, BZ0, BZ1, F[1], [SHAFT, STAIR_NE], matFloor2);
  tileFloor(scene, surfaces, occluders, BX0, BX1, BZ0, BZ1, F[2], [SHAFT, RAMP_SE], matFloor);

  // paredes externas + janelas
  wall(0, BZ1, BX1 - BX0, 1); wall(0, BZ0, BX1 - BX0, 1);
  wallV(BX0, 0, BZ1 - BZ0, 1); wallV(BX1, 0, BZ1 - BZ0, 1);
  addWindows();

  // paredes do poço do elevador (entra-se pelo leste, x=-22)
  solidBox(SHAFT.x0 + 4, WTOP / 2, SHAFT.z1, 8, WTOP, 0.6, matWall);
  solidBox(SHAFT.x0 + 4, WTOP / 2, SHAFT.z0, 8, WTOP, 0.6, matWall);

  // escada 0->1 (degraus) e rampa 1->2
  buildStairs(STAIR_NE.x0, STAIR_NE.x1, 20, F[0], 8, F[1], 16, matStep);
  surfaces.push({ kind: 'ramp', x0: STAIR_NE.x0, x1: STAIR_NE.x1, z0: 8, z1: 20, zA: 20, yA: F[0], zB: 8, yB: F[1] });
  buildRamp(RAMP_SE.x0, RAMP_SE.x1, -20, F[1], -8, F[2], matRamp);
  surfaces.push({ kind: 'ramp', x0: RAMP_SE.x0, x1: RAMP_SE.x1, z0: -20, z1: -8, zA: -20, yA: F[1], zB: -8, yB: F[2] });

  // caixas de cobertura por andar
  for (const [x, z, y] of [
    [-10, 6, F[0]], [8, -6, F[0]], [-16, -12, F[0]],
    [6, 10, F[1]], [-12, -4, F[1]], [14, 2, F[1]],
    [-6, 8, F[2]], [10, -10, F[2]], [0, 0, F[2]],
  ]) crate(x, z, y);

  // elevador
  const elevator = { x0: -29, x1: -22, z0: -4, z1: 4, y: F[0], target: null, floors: F.slice() };
  const car = new THREE.Group();
  const matCar = new THREE.MeshStandardMaterial({ map: TX.toTex(cMetal), normalMap: nMetal, normalScale: NS(), roughness: 0.5, metalness: 0.6 });
  const carFloor = new THREE.Mesh(new THREE.BoxGeometry(7, 0.3, 8), matCar);
  carFloor.position.y = -0.15; car.add(carFloor); TX.tileMaps(carFloor, 4);
  const carBack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 8), matCar.clone());
  carBack.position.set(-3.4, 1.7, 0); car.add(carBack); TX.tileMaps(carBack, 4);
  car.position.set((elevator.x0 + elevator.x1) / 2, elevator.y, (elevator.z0 + elevator.z1) / 2);
  car.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(car); elevator.mesh = car;

  const spawns = [
    new THREE.Vector3(-14, 0, -10), new THREE.Vector3(14, 0, -10),
    new THREE.Vector3(-14, 0, 10), new THREE.Vector3(14, 0, 10),
  ];

  function groundAt(x, z, feetY) {
    let best = -Infinity;
    for (const s of surfaces) {
      if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
      let sy;
      if (s.kind === 'flat') sy = s.y;
      else sy = s.yA + (s.yB - s.yA) * clamp((z - s.zA) / (s.zB - s.zA), 0, 1);
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
    pushOcc(m, wpt);
    return m;
  }
  function wall(cx, cz, len, t) { solidBox(cx, WTOP / 2, cz, len, WTOP, t, matWall, 8); }
  function wallV(cx, cz, len, t) { solidBox(cx, WTOP / 2, cz, t, WTOP, len, matWall, 8); }
  function crate(x, z, y) {
    const s = 3;
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), matCrate);
    m.position.set(x, y + s / 2, z); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    colliders.push({ min: { x: x - s / 2, z: z - s / 2 }, max: { x: x + s / 2, z: z + s / 2 }, top: y + s });
    pushOcc(m, 3);
  }
  function buildStairs(x0, x1, zStart, yStart, zEnd, yEnd, n, mat) {
    const dz = (zEnd - zStart) / n;
    for (let k = 1; k <= n; k++) {
      const top = yStart + (yEnd - yStart) * (k / n);
      const zc = zStart + dz * (k - 0.5);
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, top + 0.2, Math.abs(dz)), mat);
      m.position.set((x0 + x1) / 2, (top - 0.2) / 2, zc); m.castShadow = true; m.receiveShadow = true; scene.add(m);
      pushOcc(m, 4);
    }
  }
  function buildRamp(x0, x1, zA, yA, zB, yB, mat) {
    const dz = zB - zA, dy = yB - yA, len = Math.hypot(dz, dy);
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.4, len), mat);
    m.position.set((x0 + x1) / 2, (yA + yB) / 2, (zA + zB) / 2);
    m.rotation.x = -Math.atan2(dy, dz);
    m.castShadow = true; m.receiveShadow = true; scene.add(m);
    pushOcc(m, 4);
  }
  function addWindows() {
    for (const y of [F[1], F[2]]) {
      for (let x = BX0 + 8; x < BX1; x += 12) { pane(x, y + 1.8, BZ1, 4, 2.6, true); pane(x, y + 1.8, BZ0, 4, 2.6, true); }
      for (let z = BZ0 + 8; z < BZ1; z += 12) pane(BX1, y + 1.8, z, 4, 2.6, false);
    }
  }
  function pane(x, y, z, w, h, alongX) {
    const geo = alongX ? new THREE.BoxGeometry(w, h, 0.15) : new THREE.BoxGeometry(0.15, h, w);
    const m = new THREE.Mesh(geo, matGlass); m.position.set(x, y, z); scene.add(m);
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
      const m = new THREE.Mesh(new THREE.BoxGeometry(cx1 - cx0, 0.4, cz1 - cz0), mat);
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
