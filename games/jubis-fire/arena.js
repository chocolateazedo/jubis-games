// Jubis Fire — mapa padrão. Gerado por código de forma determinística, então
// todos os jogadores veem exatamente a mesma arena sem precisar sincronizar.
// Retorna os colisores (caixas sólidas) para o jogador bater e os spawns.

import * as THREE from 'three';
import { CONFIG } from './shared.js';

export function buildArena(scene) {
  const H = CONFIG.ARENA / 2;
  const colliders = []; // {min:{x,z}, max:{x,z}, top:y} caixas alinhadas aos eixos

  scene.background = new THREE.Color(0x8fd3ff);
  scene.fog = new THREE.Fog(0x8fd3ff, 80, 180);

  // luz
  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x4a5a3a, 0.95));
  const sun = new THREE.DirectionalLight(0xffffff, 1.25);
  sun.position.set(40, 70, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera; sc.left = -H; sc.right = H; sc.top = H; sc.bottom = -H; sc.near = 1; sc.far = 200;
  scene.add(sun);

  // chão
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.ARENA, CONFIG.ARENA),
    new THREE.MeshStandardMaterial({ color: 0x5fa55a, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // grade decorativa no chão
  const grid = new THREE.GridHelper(CONFIG.ARENA, 24, 0x3f7a3c, 0x4c8a48);
  grid.position.y = 0.02; scene.add(grid);

  const matWall = new THREE.MeshStandardMaterial({ color: 0x7a8aa0, roughness: 0.9 });
  const matCrate = new THREE.MeshStandardMaterial({ color: 0xb07a43, roughness: 0.85 });
  const matRock = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 1 });

  // adiciona uma caixa sólida (com colisão)
  function solid(x, y, z, w, h, d, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    colliders.push({ min: { x: x - w / 2, z: z - d / 2 }, max: { x: x + w / 2, z: z + d / 2 }, top: y + h });
    return m;
  }

  // muros da borda
  const t = 2;
  solid(0, 0, -H, CONFIG.ARENA, CONFIG.WALL_H, t, matWall);
  solid(0, 0, H, CONFIG.ARENA, CONFIG.WALL_H, t, matWall);
  solid(-H, 0, 0, t, CONFIG.WALL_H, CONFIG.ARENA, matWall);
  solid(H, 0, 0, t, CONFIG.WALL_H, CONFIG.ARENA, matWall);

  // estrutura central
  solid(0, 0, 0, 10, 4, 10, matWall);
  solid(0, 4, 0, 12, 1, 12, matWall);

  // caixotes e pedras espalhados (posições fixas = iguais pra todos)
  const props = [
    [-20, -14, 3, 3, 3, matCrate], [22, -8, 3, 3, 3, matCrate],
    [12, 20, 4, 4, 4, matCrate], [-26, 24, 3, 3, 3, matCrate],
    [30, 28, 5, 5, 5, matRock], [-34, -30, 6, 4, 6, matRock],
    [8, -28, 3, 3, 3, matCrate], [-12, 8, 3, 6, 3, matWall],
    [18, -22, 5, 5, 5, matRock], [-30, 2, 4, 4, 4, matCrate],
    [26, 6, 3, 3, 3, matCrate], [-8, -38, 5, 4, 5, matRock],
    [36, -34, 4, 4, 4, matCrate], [-40, 34, 5, 5, 5, matRock],
  ];
  for (const [x, z, w, h, d, mat] of props) solid(x, 0, z, w, h, d, mat);

  const spawns = CONFIG.SPAWNS.map(([x, z]) => new THREE.Vector3(x, 0, z));
  return { colliders, spawns };
}

// Empurra uma posição (com raio r) para fora dos colisores (apenas no plano XZ).
export function resolveCollisions(pos, r, colliders) {
  for (const c of colliders) {
    const cx = Math.max(c.min.x, Math.min(pos.x, c.max.x));
    const cz = Math.max(c.min.z, Math.min(pos.z, c.max.z));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * r;
        pos.z = cz + (dz / d) * r;
      } else {
        // centro dentro da caixa: empurra pelo eixo de menor penetração
        const pxx = Math.min(pos.x - c.min.x, c.max.x - pos.x);
        const pzz = Math.min(pos.z - c.min.z, c.max.z - pos.z);
        if (pxx < pzz) pos.x += (pos.x - (c.min.x + c.max.x) / 2) > 0 ? pxx + r : -(pxx + r);
        else pos.z += (pos.z - (c.min.z + c.max.z) / 2) > 0 ? pzz + r : -(pzz + r);
      }
    }
  }
  const lim = CONFIG.ARENA / 2 - 2 - r;
  pos.x = Math.max(-lim, Math.min(lim, pos.x));
  pos.z = Math.max(-lim, Math.min(lim, pos.z));
}
