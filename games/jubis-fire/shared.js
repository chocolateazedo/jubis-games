// Jubis Fire — constantes e helpers compartilhados por todos os módulos.
// Tudo aqui é determinístico: como cada navegador roda o mesmo código, o mapa,
// os spawns e as fases da zona ficam idênticos em todos os jogadores (P2P sem
// precisar sincronizar o mundo inteiro — só a zona e os jogadores).

// Liga/desliga a zona que encolhe e dá dano. false = sem zona de dano.
export const ZONE_DAMAGE = false;

export const CONFIG = {
  ARENA: 120,          // largura total do mapa (x,z variam de -60 a 60)
  WALL_H: 7,
  GRAVITY: 24,
  MOVE_SPEED: 9,       // unidades/segundo
  JUMP_V: 9,
  PLAYER_H: 1.8,
  PLAYER_R: 0.5,
  EYE: 1.6,
  FIRE_COOLDOWN: 0.26, // segundos entre tiros
  BULLET_DMG: 18,
  RANGE: 90,
  MAX_HP: 100,
  NET_HZ: 15,          // pacotes de rede por segundo
  FLOORS: [0, 8, 16],  // alturas dos 3 andares (pé-direito alto)
  STEP_UP: 0.7,        // o quanto o jogador "sobe" automaticamente (degraus/rampas)
  ELEV_SPEED: 5,       // velocidade do elevador (u/s)
  GRENADE: { speed: 16, up: 7.5, gravity: 20, fuse: 3, radius: 7, dmg: 90, cooldown: 1.0, bounce: 0.4 },
  AMMO_START: 5, AMMO_MAX: 15, AMMO_PACK: 5, // munição e pacotes
  HEAL: 40, // caixinha de vida (+HP instantâneo)
  REGEN: 4, // vida que volta sozinha a cada 1 segundo
  PICKUP_EVERY: 30, PICKUP_MAX: 8, PICKUP_R: 1.8, // pacotes de bala surgem a cada 30s
  BIG_SCALE: 1.4, BIG_HP: 180, // personagem grandão (Bombadão)
  MELEE: { range: 5.5, dmg: 70, cooldown: 1.2, dur: 0.5 }, // golpe de marreta (X)
  SPRAY: { range: 9, cone: 0.4, cooldown: 4, dur: 5 }, // borrifador: vira árvore por 5s
  ICE: { range: 60, cooldown: 3, dur: 3, dmg: 25 }, // raio de gelo: congela 3s + dano
  CAM_DIST: 6.2,
  CAM_HEIGHT: 1.2,
  ZONE: {
    startR: 58,
    // cada fase: espera parada (wait), depois encolhe (shrink) até targetR.
    // dps = dano por segundo em quem estiver fora do círculo seguro.
    phases: [
      { wait: 18, shrink: 14, targetR: 40, dps: 2 },
      { wait: 14, shrink: 12, targetR: 26, dps: 4 },
      { wait: 12, shrink: 10, targetR: 14, dps: 6 },
      { wait: 10, shrink: 10, targetR: 6,  dps: 9 },
      { wait: 8,  shrink: 8,  targetR: 0,  dps: 14 },
    ],
  },
  // ponto de nascimento por slot (índice do jogador na sala)
  SPAWNS: [[-42, -42], [42, -42], [-42, 42], [42, 42]],
};

// Estado da zona (raio seguro + dano) em função do tempo decorrido da partida.
export function computeZone(elapsed) {
  let t = elapsed;
  let prevR = CONFIG.ZONE.startR;
  for (const ph of CONFIG.ZONE.phases) {
    if (t < ph.wait) return { r: prevR, dps: ph.dps, shrinking: false };
    t -= ph.wait;
    if (t < ph.shrink) {
      const k = t / ph.shrink;
      return { r: prevR + (ph.targetR - prevR) * k, dps: ph.dps, shrinking: true };
    }
    t -= ph.shrink;
    prevR = ph.targetR;
  }
  const last = CONFIG.ZONE.phases[CONFIG.ZONE.phases.length - 1];
  return { r: prevR, dps: last.dps, shrinking: false };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
