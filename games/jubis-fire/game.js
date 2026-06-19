// Jubis Fire — battle royale-lite 3D para até 4 jogadores (terceira pessoa).
// Host-autoritativo via WebRTC: cada cliente simula seu próprio boneco e manda a
// posição; o host decide zona, vida e eliminações e transmite o "mundo".

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CONFIG, ZONE_DAMAGE, computeZone, clamp, lerp } from './shared.js?v=4';
import { CHARACTERS, getCharacter, buildBody, animateBody } from './characters.js?v=4';
import { buildArena, resolveCollisions } from './arena.js?v=4';
import { lobby, Net } from './net.js?v=4';
import * as Sound from './sounds.js?v=4';

const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// ---------- estado ----------
let peer = null, myPeerId = null, myName = '', selectedChar = 'm1', selectedMap = 'backrooms';
let roomId = null, isHost = false, roomPoll = null;
let net = null;
let scene, renderer, camera, clock;
let colliders = [], spawns = [];
let zoneMesh = null;
let groundAt = (x, z, y) => 0; // preenchido por buildArena
let elevator = null, onElevator = false;
let occluders = [], faded = []; // malhas que tapam a câmera / atualmente translúcidas
const grenades = [], fx = []; // granadas em voo e efeitos de explosão
let grenadeCd = 0;
let meleeCd = 0;                          // cooldown do golpe de marreta
let ammoR = CONFIG.AMMO_START, ammoL = 0;        // balas por arma (direita / esquerda)
let maxR = CONFIG.AMMO_MAX, maxL = 0, packTotal = CONFIG.AMMO_PACK; // loadout do personagem
let pickups = [];                         // pacotes de bala {id, pos}
const pickupMeshes = new Map();           // id -> mesh
const entities = new Map();   // peerId -> entity
let me = null;
let status = 'lobby';         // 'lobby' | 'playing' | 'ended'
let winner = null;
let training = false;         // modo treino offline contra bots
const BOT_SPEED = CONFIG.MOVE_SPEED * 0.8;
const BOT_NAMES = ['Robô Zé', 'Bot Tina', 'CPU Rex', 'Dummy', 'Bot Max', 'Robô Lia'];

// câmera / input
let yaw = 0, pitch = 0.35;
let camMode = 'third'; // 'third' | 'first'
const input = { mx: 0, my: 0, jump: false, firing: false };
const keys = {};
let fireCooldown = 0;

// host
const host = { startTime: 0, lastNet: 0, zoneR: CONFIG.ZONE.startR, zoneDps: 0, dmgAccum: new Map(), pendingHits: [] };
let sendAccum = 0;

const raycaster = new THREE.Raycaster();
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

// ---------- chat de texto ----------
let chatOpen = false;

// ---------- chat de voz (malha PeerJS, reusa o mesmo `peer`) ----------
let micStream = null;            // MediaStream do microfone
let voiceState = 'off';          // 'off' | 'connecting' | 'on' | 'muted'
let voiceMuted = false;
const voiceCalls = new Map();    // peerId remoto -> { call, audioEl }
let voiceMeshTimer = null;       // re-tenta a malha de voz enquanto a voz está ligada

// ============================================================
// BOOT — cria o Peer (PeerJS) e prepara o lobby
// ============================================================
function boot() {
  buildCharGrid();
  if (isTouch) $('pcHint').classList.add('hidden'); // no celular usa o botão 👁 Visão
  $('pname').value = localStorage.getItem('jubis-fire-name') || '';
  lobbyMsg('Conectando…');
  // STUN + TURN (grátis) pra voz/dados atravessarem firewalls/NAT na maioria das redes
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ];
  peer = new window.Peer(undefined, { debug: 1, config: { iceServers } });
  peer.on('open', (id) => { myPeerId = id; lobbyMsg(''); enableLobby(true); });
  peer.on('error', (e) => lobbyMsg('Erro de conexão: ' + e.type + ' — recarregue a página.', true));
  peer.on('disconnected', () => { try { peer.reconnect(); } catch {} });
}

function enableLobby(on) {
  for (const b of ['btnQuick', 'btnCreate', 'btnJoin']) $(b).disabled = !on;
}
function lobbyMsg(t, err = false) { const e = $('lobbyMsg'); e.textContent = t || ''; e.classList.toggle('error', !!err); }

// ---------- seleção de personagem (cards CSS) ----------
function buildCharGrid() {
  const grid = $('charGrid');
  grid.innerHTML = '';
  for (const c of CHARACTERS) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'char' + (c.id === selectedChar ? ' sel' : '');
    card.dataset.id = c.id;
    const hex = (n) => '#' + n.toString(16).padStart(6, '0');
    card.innerHTML =
      `<span class="ava" style="background:${hex(c.shirt)}">
         <span class="hair" style="background:${hex(c.hairColor)}"></span>
         <span class="face" style="background:${hex(c.skin)}"></span>
       </span>
       <span class="cname">${c.name}</span>
       <span class="cg">${c.gender === 'm' ? '♂' : '♀'}</span>`;
    card.addEventListener('click', () => {
      selectedChar = c.id;
      [...grid.children].forEach((el) => el.classList.toggle('sel', el.dataset.id === c.id));
    });
    grid.appendChild(card);
  }
}

// ============================================================
// LOBBY / SALA
// ============================================================
function selectMap(m) {
  selectedMap = m;
  $('mapBackrooms').classList.toggle('sel', m === 'backrooms');
  $('mapBosque').classList.toggle('sel', m === 'bosque');
}

function getName() {
  const n = $('pname').value.trim().slice(0, 16);
  if (!n) { lobbyMsg('Escreva seu nome.', true); return null; }
  localStorage.setItem('jubis-fire-name', n);
  myName = n; return n;
}

async function quickJoin() {
  const n = getName(); if (!n || !myPeerId) return;
  lobbyMsg('');
  const r = await lobby('quick_join', { name: n, peerId: myPeerId, char: selectedChar, map: selectedMap });
  if (r.error) return lobbyMsg(r.error, true);
  enterRoom(r.roomId, r.isHost, null);
}
async function createPrivate() {
  const n = getName(); if (!n || !myPeerId) return;
  const r = await lobby('create_room', { name: n, peerId: myPeerId, char: selectedChar, map: selectedMap });
  if (r.error) return lobbyMsg(r.error, true);
  enterRoom(r.roomId, true, r.code);
}
async function joinPrivate() {
  const n = getName(); if (!n || !myPeerId) return;
  const code = $('joinCode').value.trim();
  if (code.length !== 6) return lobbyMsg('A senha tem 6 caracteres.', true);
  const r = await lobby('join_room', { name: n, peerId: myPeerId, char: selectedChar, code });
  if (r.error) return lobbyMsg(r.error, true);
  enterRoom(r.roomId, false, code);
}

function enterRoom(id, host_, code) {
  roomId = id; isHost = host_;
  $('joinPanel').classList.add('hidden');
  $('roomBox').classList.remove('hidden');
  $('roomCode').textContent = code ? `Senha da sala: ${code}` : 'Sala aleatória';
  $('btnStart').classList.toggle('hidden', !isHost);
  pollRoom();
}

function pollRoom() {
  clearTimeout(roomPoll);
  roomPoll = setTimeout(async () => {
    if (!roomId) return;
    const r = await lobby('room', { roomId, peerId: myPeerId });
    if (r.error) { lobbyMsg(r.error, true); return leaveRoom(); }
    renderRoster(r);
    if (r.status === 'started') return startMatch(r);
    pollRoom();
  }, 1500);
}

function renderRoster(r) {
  $('roomPlayers').innerHTML = r.players
    .map((p, i) => `<li>${i === 0 ? '👑 ' : ''}${escapeHtml(p.name)} <small>(${getCharacter(p.char).name})</small></li>`)
    .join('');
  $('roomStatus').textContent = r.players.length < 2
    ? 'Esperando mais jogadores…'
    : (isHost ? 'Pode começar quando quiser!' : 'Esperando o host iniciar…');
  $('btnStart').disabled = r.players.length < 2;
}

async function leaveRoom() {
  clearTimeout(roomPoll); roomPoll = null;
  if (roomId) await lobby('leave', { roomId, peerId: myPeerId });
  roomId = null;
  $('roomBox').classList.add('hidden');
  $('joinPanel').classList.remove('hidden');
}

async function startGameAsHost() {
  if (!isHost || !roomId) return;
  await lobby('start', { roomId, peerId: myPeerId });
}

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ============================================================
// PARTIDA
// ============================================================
function startMatch(room) {
  clearTimeout(roomPoll); roomPoll = null;
  status = 'playing'; winner = null;
  const roster = room.players;
  const hostPeerId = roster[0].peerId;
  isHost = (hostPeerId === myPeerId);

  setupThree();
  scene.clear(); // remove o mapa/objetos da partida anterior (evita sobreposição)
  const built = buildArena(scene, room.map || 'backrooms');
  colliders = built.colliders; spawns = built.spawns; groundAt = built.groundAt; elevator = built.elevator; occluders = built.occluders; faded = [];
  resetGrenades();
  resetAmmoPickups();
  buildZoneMesh();

  entities.clear();
  roster.forEach((p, i) => createEntity(p, i, p.peerId === myPeerId));
  me = entities.get(myPeerId);
  $('btnMelee').classList.toggle('hidden', !(isTouch && me && me.canMelee));
  configureLoadout();
  if (me && me.canMelee) $('btnMelee').textContent = ({ hammer: '🔨', sword: '🗡', spray: '💧', ice: '❄', dualgun: '🔫' })[me.meleeType] || '🔨';

  net = new Net(peer, myPeerId, isHost, hostPeerId, roster);
  net.on('world', onWorld).on('input', onClientInput).on('hit', onClientHit).on('pickup', onClientPickup).on('transform', onClientTransform).on('chat', onChat).on('close', onPeerClose);
  net.start();
  resetChat();
  setupVoiceAnswer();

  host.startTime = nowS();
  host.dmgAccum = new Map();

  $('screen-lobby').classList.add('hidden');
  $('screen-game').classList.remove('hidden');
  $('touchControls').classList.toggle('hidden', !isTouch);
  $('endBox').classList.add('hidden');

  clock = new THREE.Clock();
  requestAnimationFrame(loop);
}

// ---- MODO TREINO (offline contra bots) ----
function startTraining() {
  training = true; isHost = true; net = null;
  status = 'playing'; winner = null;

  setupThree();
  scene.clear(); // remove o mapa/objetos da partida anterior (evita sobreposição)
  const built = buildArena(scene, selectedMap);
  colliders = built.colliders; spawns = built.spawns; groundAt = built.groundAt; elevator = built.elevator; occluders = built.occluders; faded = [];
  resetGrenades();
  resetAmmoPickups();
  buildZoneMesh();

  const myId = myPeerId || 'me-local';
  const roster = [{ peerId: myId, name: myName || $('pname').value.trim() || 'Você', char: selectedChar }];
  // bots usam personagens com arma de fogo (a IA só sabe atirar)
  let pool = CHARACTERS.filter((c) => !c.noGun && c.id !== selectedChar).map((c) => c.id);
  if (!pool.length) pool = CHARACTERS.map((c) => c.id);
  for (let i = 0; i < 3; i++) roster.push({ peerId: 'bot-' + i, name: BOT_NAMES[i], char: pool[(i * 3 + 1) % pool.length], bot: true });

  entities.clear();
  roster.forEach((p, i) => {
    const e = createEntity(p, i, p.peerId === myId);
    if (p.bot) { e.isBot = true; e.ai = { fireCd: 1 + Math.random() * 2, dir: Math.random() * Math.PI * 2, dirCd: 0, ammo: CONFIG.AMMO_START }; }
  });
  me = entities.get(myId);
  $('btnMelee').classList.toggle('hidden', !(isTouch && me && me.canMelee));
  configureLoadout();
  if (me && me.canMelee) $('btnMelee').textContent = ({ hammer: '🔨', sword: '🗡', spray: '💧', ice: '❄', dualgun: '🔫' })[me.meleeType] || '🔨';

  host.startTime = nowS(); host.dmgAccum = new Map(); host.lastNet = 0;

  $('screen-lobby').classList.add('hidden');
  $('screen-game').classList.remove('hidden');
  $('touchControls').classList.toggle('hidden', !isTouch);
  $('endBox').classList.add('hidden');

  clock = new THREE.Clock();
  requestAnimationFrame(loop);
}

function updateBots(dt) {
  const safeR = host.zoneR;
  for (const e of entities.values()) {
    if (!e.isBot || !e.alive) continue;
    if (e.frozen) { e.anim = 'idle'; e.group.position.copy(e.pos); continue; } // árvore/gelo: parado
    const ai = e.ai;
    const cx = e.pos.x, cz = e.pos.z;

    // coletar pacotes perto (bala precisa de arma; vida só se machucado)
    for (const p of pickups) {
      const pdx = cx - p.pos.x, pdz = cz - p.pos.z;
      if (pdx * pdx + pdz * pdz >= CONFIG.PICKUP_R * CONFIG.PICKUP_R || Math.abs(e.pos.y - p.pos.y) >= 2.2) continue;
      if (p.kind === 'health') { if (e.hp >= e.maxHp) continue; heal(e, CONFIG.HEAL); }
      else { if (!e.hasGun) continue; ai.ammo = Math.min(CONFIG.AMMO_MAX, ai.ammo + CONFIG.AMMO_PACK); }
      pickups = pickups.filter((q) => q.id !== p.id);
      break;
    }
    // sem balas? procura o pacote mais próximo
    let seek = null;
    if (ai.ammo <= 0 && pickups.length) { let pd = Infinity; for (const p of pickups) { const d = dist2(e.pos, p.pos); if (d < pd) { pd = d; seek = p; } } }

    // alvo vivo mais próximo
    let target = null, td = Infinity;
    for (const o of entities.values()) { if (o === e || !o.alive) continue; const d = dist2(e.pos, o.pos); if (d < td) { td = d; target = o; } }
    const distC = Math.hypot(cx, cz);
    let dx, dz;
    if (distC > safeR - 3) { dx = -cx; dz = -cz; }            // volta pra dentro da zona
    else if (seek) {                                          // vai buscar munição
      const ax = seek.pos.x - cx, az = seek.pos.z - cz, al = Math.hypot(ax, az) || 1;
      dx = ax / al; dz = az / al;
    } else {
      ai.dirCd -= dt;
      if (ai.dirCd <= 0) { ai.dir += (Math.random() - 0.5) * 1.5; ai.dirCd = 0.6 + Math.random() * 1.2; }
      dx = Math.sin(ai.dir); dz = Math.cos(ai.dir);
      if (target && Math.sqrt(td) < 26) {                      // aproxima + dá uma circulada no alvo
        const ax = target.pos.x - cx, az = target.pos.z - cz, al = Math.hypot(ax, az) || 1;
        dx = (ax / al) * 0.7 + (-az / al) * 0.5;
        dz = (az / al) * 0.7 + (ax / al) * 0.5;
      }
    }
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    e.pos.x += dx * BOT_SPEED * dt; e.pos.z += dz * BOT_SPEED * dt;
    resolveCollisions(e.pos, CONFIG.PLAYER_R, colliders);
    e.pos.y = groundAt(e.pos.x, e.pos.z, e.pos.y); // acompanha o piso/rampa
    const aimT = e.hasGun && ai.ammo > 0 && target && Math.sqrt(td) < 45;
    e.ry = aimT ? Math.atan2(target.pos.x - cx, target.pos.z - cz) : Math.atan2(dx, dz);
    e.anim = 'run';
    e.group.position.copy(e.pos); e.group.rotation.y = e.ry;
    // tiro com imprecisão (gasta bala)
    ai.fireCd -= dt;
    if (aimT && ai.fireCd <= 0) {
      ai.fireCd = 0.8 + Math.random() * 1.4;
      ai.ammo--;
      e.aimTimer = 0.3; // levanta a arma
      const armR = e.body.parts.armR;
      armR.rotation.x = -Math.PI / 2; armR.rotation.z = 0;
      armR.updateWorldMatrix(true, false);
      const from = MUZZLE_LOCAL.clone().applyMatrix4(armR.matrixWorld);
      const to = target.pos.clone(); to.y += 1.3;
      tracer(from, to);
      if (Math.random() < 0.45) damage(target, CONFIG.BULLET_DMG);
    }
  }
}
const dist2 = (a, b) => { const dx = a.x - b.x, dz = a.z - b.z; return dx * dx + dz * dz; };

function setupThree() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1 : 2)); // tablet/celular: render bem mais leve
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = !isTouch; // sombras desligadas no touch (maior ganho de FPS)
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  $('glmount').appendChild(renderer.domElement);
  scene = new THREE.Scene();
  // iluminação por ambiente (IBL) — deixa os materiais bem mais bonitos
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 400);
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

function createEntity(p, slot, local) {
  const preset = getCharacter(p.char);
  const body = buildBody(preset);
  const sp = spawns[slot % spawns.length];
  body.group.position.copy(sp);
  scene.add(body.group);
  const scale = preset.scale || 1;
  const maxHp = preset.hp || CONFIG.MAX_HP;
  const weapon = preset.weapon || null;
  const dualGun = !!preset.dualGun;
  const e = {
    peerId: p.peerId, name: p.name, charId: p.char, body, group: body.group,
    pos: sp.clone(), ry: 0, vy: 0, grounded: true, anim: 'idle',
    hp: maxHp, maxHp, alive: true, isLocal: local, slot, aimTimer: 0, hitFlash: 0,
    scale, eye: CONFIG.EYE * scale, meleeTimer: 0,
    canMelee: !!weapon || dualGun, meleeType: weapon || (dualGun ? 'dualgun' : null), dualGun,
    hasGun: !preset.noGun, growsOnHit: !!preset.growsOnHit, growth: 1, baseScale: scale,
    frozen: false, frozenType: null, frozenTimer: 0, frozenMesh: null, npKey: '',
    targetPos: sp.clone(), targetRy: 0,
  };
  entities.set(p.peerId, e);
  createNameplate(e); // nome + barra de vida flutuante
  return e;
}

// plaquinha (sprite) com nome e barra de vida, sempre virada pra câmera
function createNameplate(e) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 96;
  const tex = new THREE.CanvasTexture(canvas);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  const s = e.scale || 1; // compensa a escala do corpo (placa fica do mesmo tamanho)
  spr.scale.set(2.6 / s, 1.0 / s, 1);
  spr.position.y = 2.55;
  e.group.add(spr);
  e.tag = spr; e.tagCanvas = canvas; e.tagCtx = canvas.getContext('2d'); e.tagTex = tex;
  drawNameplate(e);
}

function drawNameplate(e) {
  const c = e.tagCtx; const W = 256;
  c.clearRect(0, 0, W, 96);
  // nome
  c.font = 'bold 26px Arial'; c.textAlign = 'center';
  c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(28, 2, 200, 34);
  c.fillStyle = e.frozen ? (e.frozenType === 'ice' ? '#86e7ff' : '#7CFC6A') : '#fff';
  c.fillText(e.frozen ? `${e.frozenType === 'ice' ? '🧊' : '🌳'} ${e.name} ${Math.ceil(e.frozenTimer)}s` : e.name, 128, 28);
  // barra de vida
  const bx = 28, by = 46, bw = 200, bh = 20;
  const frac = Math.max(0, Math.min(1, e.hp / (e.maxHp || CONFIG.MAX_HP)));
  c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(bx - 3, by - 3, bw + 6, bh + 6);
  c.fillStyle = frac > 0.5 ? '#69f0ae' : frac > 0.25 ? '#ffd54f' : '#ff5252';
  c.fillRect(bx, by, bw * frac, bh);
  c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2; c.strokeRect(bx, by, bw, bh);
  e.tagTex.needsUpdate = true;
}

function makeFrozenMesh(type) {
  const g = new THREE.Group();
  if (type === 'ice') {
    const ice = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 1.5),
      new THREE.MeshStandardMaterial({ color: 0xbfeeff, transparent: true, opacity: 0.62, roughness: 0.08, metalness: 0.1, emissive: 0x2aa8ff, emissiveIntensity: 0.35 }));
    ice.position.y = 1.25; g.add(ice);
  } else {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.6, 7), new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.95 }));
    trunk.position.y = 0.8; g.add(trunk);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 0), new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.9 }));
    leaves.position.y = 2.0; g.add(leaves);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function setEntityFlash(e, on) {
  const hex = on ? 0xcc0000 : 0x000000; // emissive vermelho no acerto
  e.group.traverse((o) => { if (o.isMesh && o.material && o.material.emissive) o.material.emissive.setHex(hex); });
}

function buildZoneMesh() {
  if (!ZONE_DAMAGE) { zoneMesh = null; return; } // zona desativada: sem círculo
  const geo = new THREE.CylinderGeometry(1, 1, CONFIG.WALL_H * 3, 48, 1, true);
  const mat = new THREE.MeshBasicMaterial({ color: 0x4fc3ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide });
  zoneMesh = new THREE.Mesh(geo, mat);
  zoneMesh.position.y = CONFIG.WALL_H;
  scene.add(zoneMesh);
}

// ---------- netcode handlers ----------
function onWorld(d) {           // cliente recebe estado do host
  if (isHost) return;
  for (const pid in d.players) {
    const e = entities.get(pid); if (!e) continue;
    const s = d.players[pid];
    if (s.hp < e.hp) { e.hitFlash = 0.18; if (pid === myPeerId) Sound.playPain(); } // tomou dano
    if (e.alive && !s.alive) Sound.playDeath(); // morreu
    e.hp = s.hp; e.alive = s.alive;
    e.frozen = !!s.fz; e.frozenType = s.fzt || null; e.frozenTimer = s.fzr || 0;
    if (pid === myPeerId) continue;              // minha posição é local
    e.targetPos.set(s.p[0], s.p[1], s.p[2]);
    e.targetRy = s.ry; e.anim = s.a;
    e.aimTimer = s.aim ? 0.3 : 0;
    if (s.ml && e.meleeTimer <= 0) e.meleeTimer = CONFIG.MELEE.dur;
  }
  host.zoneR = d.zone.r; host.zoneDps = d.zone.dps;
  if (d.pickups) pickups = d.pickups.map((p) => ({ id: p.id, pos: new THREE.Vector3(p.p[0], p.p[1], p.p[2]) }));
  if (d.status === 'ended' && status === 'playing') { status = 'ended'; winner = d.winner; showEnd(); }
}
function onClientInput(pid, d) { // host recebe input de um cliente
  if (!isHost) return;
  const e = entities.get(pid); if (!e) return;
  e.targetPos.set(d.p[0], d.p[1], d.p[2]); e.targetRy = d.ry; e.anim = d.a;
  e.aimTimer = d.aim ? 0.3 : 0;
  if (d.ml && e.meleeTimer <= 0) e.meleeTimer = CONFIG.MELEE.dur;
}
function onClientHit(pid, d) {   // host recebe alegação de acerto
  if (!isHost) return;
  host.pendingHits.push({ tgt: d.tgt, dmg: d.d });
}
function onPeerClose(pid) {
  const e = entities.get(pid);
  if (e && isHost) { e.alive = false; e.hp = 0; }
  removeVoiceCall(pid); // limpa o <audio>/chamada de voz de quem saiu
  if (pid === net?.hostPeerId && !isHost && status === 'playing') {
    status = 'ended'; winner = null; showEnd('O host saiu da partida.');
  }
}

// ============================================================
// LOOP
// ============================================================
function loop() {
  if (status !== 'playing' && status !== 'ended') return;
  const dt = Math.min(clock.getDelta(), 0.05);
  if (status === 'playing') {
    updateLocal(dt);
    if (training) updateBots(dt);
    if (isHost) hostStep(dt); else { sendAccum += dt; if (sendAccum >= 1 / CONFIG.NET_HZ) { sendInput(); sendAccum = 0; } }
    updateRemotes(dt);
    handleFire(dt);
    updateElevator(dt);
    grenadeCd -= dt; meleeCd -= dt;
    updateGrenades(dt);
    syncPickups(dt);
    checkPickups();
  }
  updateFx(dt);
  updateCamera();
  updateOcclusion();
  updateZoneVisual();
  for (const e of entities.values()) {
    if (e.aimTimer > 0) e.aimTimer -= dt;
    if (e.meleeTimer > 0) e.meleeTimer -= dt;
    const meleeP = e.meleeTimer > 0 ? 1 - e.meleeTimer / CONFIG.MELEE.dur : -1;
    animateBody(e.body, e.anim, dt, 1, e.aimTimer > 0, meleeP);
    if (e.hitFlash > 0) e.hitFlash -= dt;
    setEntityFlash(e, e.hitFlash > 0);

    const frozen = e.frozen && e.alive;
    // árvore/gelo: cria/atualiza a malha do efeito
    if (frozen && (!e.frozenMesh || e.frozenMesh.userData.type !== e.frozenType)) {
      if (e.frozenMesh) scene.remove(e.frozenMesh);
      e.frozenMesh = makeFrozenMesh(e.frozenType);
      e.frozenMesh.userData.type = e.frozenType;
      e.frozenMesh.scale.setScalar(e.scale || 1);
      scene.add(e.frozenMesh);
    }
    if (e.frozenMesh) { e.frozenMesh.visible = frozen; e.frozenMesh.position.copy(e.pos); }

    // visibilidade do grupo (pra mostrar a plaquinha) e das partes do corpo
    e.group.visible = e.alive || e === me;
    const fpLocal = (e === me && camMode === 'first');
    const showBody = !frozen;
    const p = e.body.parts;
    p.head.visible = showBody && !fpLocal;
    p.torso.visible = showBody && !fpLocal;
    p.legL.visible = showBody && !fpLocal;
    p.legR.visible = showBody && !fpLocal;
    p.armR.visible = showBody;
    p.armL.visible = showBody && (!fpLocal || !!e.canMelee);
    if (e.tag) e.tag.visible = !(fpLocal && !frozen);

    const npKey = e.hp + '|' + (frozen ? e.frozenType + Math.ceil(e.frozenTimer) : '');
    if (npKey !== e.npKey) { e.npKey = npKey; drawNameplate(e); }
  }
  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function updateLocal(dt) {
  if (!me || !me.alive) { me && (me.anim = 'idle'); return; }
  if (me.frozen) { // virou árvore/gelo: parado no lugar
    me.anim = 'idle'; me.vy = 0; me.grounded = true;
    me.pos.y = groundAt(me.pos.x, me.pos.z, me.pos.y);
    me.group.position.copy(me.pos);
    return;
  }
  // base de movimento a partir do yaw (right = forward × up, senão A/D invertem)
  const fwd = tmp.set(Math.sin(yaw), 0, Math.cos(yaw));
  const right = tmp2.set(-Math.cos(yaw), 0, Math.sin(yaw));
  let mvx = fwd.x * input.my + right.x * input.mx;
  let mvz = fwd.z * input.my + right.z * input.mx;
  const len = Math.hypot(mvx, mvz);
  const moving = len > 0.05;
  if (moving) { mvx /= len; mvz /= len; }
  me.pos.x += mvx * CONFIG.MOVE_SPEED * dt;
  me.pos.z += mvz * CONFIG.MOVE_SPEED * dt;
  resolveCollisions(me.pos, CONFIG.PLAYER_R * (me.scale || 1), colliders);

  // chão sob o jogador (andares / escadas / rampa / elevador)
  const gy = groundAt(me.pos.x, me.pos.z, me.pos.y);
  onElevator = elevator && me.pos.x >= elevator.x0 && me.pos.x <= elevator.x1 &&
    me.pos.z >= elevator.z0 && me.pos.z <= elevator.z1 && Math.abs(gy - elevator.y) < 0.2;
  if (input.jump && me.grounded) { me.vy = CONFIG.JUMP_V; me.grounded = false; }
  input.jump = false;
  me.vy -= CONFIG.GRAVITY * dt;
  me.pos.y += me.vy * dt;
  if (me.pos.y <= gy) { me.pos.y = gy; me.vy = 0; me.grounded = true; } else me.grounded = false;
  if (camMode === 'first') {
    // 1ª pessoa: o corpo encara para onde você olha (mira pela câmera)
    me.ry = yaw;
  } else if (moving) {
    // 3ª pessoa: vira o boneco para a direção em que ele se move (frente=0°,
    // trás=180°, lados=90°/270°, diagonais=45°/...). Parado, mantém a direção.
    const targetRy = Math.atan2(mvx, mvz);
    me.ry = lerpAngle(me.ry, targetRy, Math.min(1, dt * 16));
  }
  me.anim = !me.grounded ? 'jump' : (moving ? 'run' : 'idle');
  me.group.position.copy(me.pos);
  me.group.rotation.y = me.ry;
}

function updateRemotes(dt) {
  for (const e of entities.values()) {
    if (e === me || e.isBot) continue; // bots são movidos pela IA, não pela rede
    e.pos.lerp(e.targetPos, Math.min(1, dt * 12));
    e.ry = lerpAngle(e.ry, e.targetRy, Math.min(1, dt * 12));
    e.group.position.copy(e.pos);
    e.group.rotation.y = e.ry;
  }
}

function hostStep(dt) {
  // posição do próprio host já foi atualizada em updateLocal (me.pos)
  // zona
  if (ZONE_DAMAGE) {
    const elapsed = nowS() - host.startTime;
    const z = computeZone(elapsed);
    host.zoneR = z.r; host.zoneDps = z.dps;
    for (const e of entities.values()) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x, e.pos.z);
      if (d > host.zoneR) {
        const acc = (host.dmgAccum.get(e.peerId) || 0) + z.dps * dt;
        const whole = Math.floor(acc);
        host.dmgAccum.set(e.peerId, acc - whole);
        if (whole > 0) damage(e, whole);
      }
    }
  } else {
    host.zoneR = 9999; host.zoneDps = 0; // sem zona: ninguém fica "fora"
  }
  // acertos de tiro reportados
  for (const h of host.pendingHits) {
    const e = entities.get(h.tgt);
    if (e && e.alive) damage(e, h.dmg);
  }
  host.pendingHits.length = 0;

  // vitória
  const alive = [...entities.values()].filter((e) => e.alive);
  if (status === 'playing' && entities.size >= 2 && alive.length <= 1) {
    status = 'ended'; winner = alive[0] ? alive[0].peerId : null;
    broadcastWorld(); showEnd();
  }

  // transmissão periódica
  // contagem regressiva do efeito (árvore/gelo)
  for (const e of entities.values()) {
    if (e.frozen) { e.frozenTimer -= dt; if (e.frozenTimer <= 0) { e.frozen = false; e.frozenTimer = 0; } }
  }

  // regeneração de vida automática (a cada 1 segundo)
  host.regenT = (host.regenT || 0) + dt;
  if (host.regenT >= 1) { host.regenT -= 1; for (const e of entities.values()) if (e.alive && e.hp < e.maxHp) heal(e, CONFIG.REGEN); }

  // pacotes de bala surgem a cada 30s
  host.pickupTimer -= dt;
  if (host.pickupTimer <= 0) { host.pickupTimer = CONFIG.PICKUP_EVERY; if (pickups.length < CONFIG.PICKUP_MAX) spawnPickup(); }

  host.lastNet += dt;
  if (host.lastNet >= 1 / CONFIG.NET_HZ) { host.lastNet = 0; broadcastWorld(); }
}

function damage(e, amount) {
  e.hp = Math.max(0, e.hp - amount);
  e.hitFlash = 0.18; // reação visual ao acerto
  if (e === me) Sound.playPain();
  if (e.hp <= 0 && e.alive) { e.alive = false; Sound.playDeath(); }
}

function broadcastWorld() {
  if (!net) return; // modo treino: não há rede
  const players = {};
  for (const e of entities.values()) {
    players[e.peerId] = { p: [e.pos.x, e.pos.y, e.pos.z], ry: e.ry, a: e.anim, hp: e.hp, alive: e.alive, aim: e.aimTimer > 0, ml: e.meleeTimer > 0, fz: e.frozen, fzt: e.frozenType, fzr: e.frozenTimer };
  }
  const pk = pickups.map((p) => ({ id: p.id, p: [p.pos.x, p.pos.y, p.pos.z] }));
  net.broadcast({ players, zone: { r: host.zoneR, dps: host.zoneDps }, status, winner, pickups: pk });
}

function sendInput() {
  if (!me || !net) return;
  net.sendInput({ p: [me.pos.x, me.pos.y, me.pos.z], ry: me.ry, a: me.anim, aim: me.aimTimer > 0, ml: me.meleeTimer > 0 });
}

// configura a munição conforme o personagem (chamado quando 'me' é criado)
function configureLoadout() {
  if (!me) return;
  const c = getCharacter(me.charId);
  const total = c.ammoStart || CONFIG.AMMO_START;
  const max = c.ammoMax || CONFIG.AMMO_MAX;
  packTotal = c.ammoPack || CONFIG.AMMO_PACK;
  if (me.dualGun) { maxR = Math.floor(max / 2); maxL = max - maxR; ammoR = Math.floor(total / 2); ammoL = total - ammoR; }
  else { maxR = max; maxL = 0; ammoR = total; ammoL = 0; }
}

// ---------- tiro ----------
function handleFire(dt) {
  fireCooldown -= dt;
  if (!input.firing || fireCooldown > 0 || !me || !me.alive || !me.hasGun || me.frozen) return;
  if (ammoR <= 0) { fireCooldown = 0.3; Sound.playEmpty(); return; } // sem balas
  fireCooldown = CONFIG.FIRE_COOLDOWN;
  fireFrom('R');
}
function fire() { fireFrom('R'); }
// ponta do cano no espaço local do braço (mão + arma estendida)
const MUZZLE_LOCAL = new THREE.Vector3(0, -0.98, 0.08);

function fireFrom(side) {
  const left = side === 'L';
  if ((left ? ammoL : ammoR) <= 0) { Sound.playEmpty(); return; }
  const arm = me.body.parts[left ? 'armL' : 'armR'];
  arm.rotation.x = -Math.PI / 2; arm.rotation.z = 0;
  arm.updateWorldMatrix(true, false);
  const muzzle = MUZZLE_LOCAL.clone().applyMatrix4(arm.matrixWorld);

  // 1ª pessoa: mira pela câmera. 3ª pessoa: reto na frente do boneco.
  let origin, dir;
  if (camMode === 'first') { origin = camera.position.clone(); dir = camera.getWorldDirection(new THREE.Vector3()); }
  else { origin = muzzle.clone(); dir = new THREE.Vector3(Math.sin(me.ry), 0, Math.cos(me.ry)); }

  let best = null, bestT = CONFIG.RANGE;
  for (const e of entities.values()) {
    if (e === me || !e.alive) continue;
    const sc = e.scale || 1;
    const center = tmp.copy(e.pos); center.y += 1.3 * sc;
    const oc = tmp2.copy(center).sub(origin);
    const tca = oc.dot(dir);
    if (tca < 0 || tca > bestT) continue;
    const d2 = oc.lengthSq() - tca * tca;
    const hr = 0.9 * sc;
    if (d2 > hr * hr) continue;
    best = e; bestT = tca;
  }
  const end = origin.clone().add(dir.clone().multiplyScalar(best ? bestT : CONFIG.RANGE));
  tracer(muzzle, end);
  me.aimTimer = 0.3;
  if (left) ammoL--; else ammoR--;
  Sound.playShoot();
  if (best) {
    const dmg = Math.round(CONFIG.BULLET_DMG * (me.growth || 1)); // Morgadinho: dano cresce
    if (isHost) damage(best, dmg); else net.sendHit(best.peerId, dmg);
    if (me.growsOnHit) growMe();
  }
}
function growMe() {
  me.growth = Math.min(3, me.growth * 1.1); // +10% de tamanho e força por acerto (até 3x)
  me.scale = me.baseScale * me.growth;
  me.body.group.scale.setScalar(me.scale);
  me.eye = CONFIG.EYE * me.scale;
  if (me.tag) me.tag.scale.set(2.6 / me.scale, 1 / me.scale, 1); // mantém a plaquinha do mesmo tamanho
}
function tracer(a, b, color = 0xfff176, ms = 60) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
  scene.add(line);
  setTimeout(() => { scene.remove(line); geo.dispose(); }, ms);
}

// ---------- câmera / zona visual ----------
function updateCamera() {
  if (!me) return;
  const sc = me.scale || 1;
  const head = tmp.copy(me.pos); head.y += me.eye || CONFIG.EYE;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const dist = CONFIG.CAM_DIST * sc, camH = CONFIG.CAM_HEIGHT * sc;
  if (camMode === 'first') {
    camera.position.copy(head);
    camera.lookAt(head.x + Math.sin(yaw) * cp, head.y - sp, head.z + Math.cos(yaw) * cp);
  } else {
    camera.position.set(
      head.x - Math.sin(yaw) * cp * dist,
      head.y + sp * dist + camH,
      head.z - Math.cos(yaw) * cp * dist
    );
    camera.lookAt(head);
  }
}

function toggleCamMode() {
  camMode = camMode === 'third' ? 'first' : 'third';
}

// deixa translúcido o que estiver entre a câmera e o jogador (só 3ª pessoa)
function updateOcclusion() {
  for (const m of faded) { m.material.opacity = 1; m.material.transparent = false; m.material.depthWrite = true; }
  faded.length = 0;
  if (camMode !== 'third' || !me) return;
  const head = tmp.set(me.pos.x, me.pos.y + (me.eye || CONFIG.EYE), me.pos.z);
  const dir = tmp2.copy(head).sub(camera.position);
  const dist = dir.length(); if (dist < 0.1) return;
  dir.divideScalar(dist);
  raycaster.set(camera.position, dir);
  raycaster.near = 0.05; raycaster.far = dist - 0.1; // pega até paredes coladas no jogador
  for (const h of raycaster.intersectObjects(occluders, false)) {
    const mat = h.object.material;
    mat.transparent = true; mat.opacity = 0.16; mat.depthWrite = false; // não tapa o personagem
    faded.push(h.object);
  }
}

// em 1ª pessoa, esconde do próprio corpo tudo menos o braço direito + arma
function setLocalFirstPerson(fp) {
  const p = me.body.parts;
  p.head.visible = !fp; p.torso.visible = !fp;
  p.legL.visible = !fp; p.legR.visible = !fp;
  p.armL.visible = !fp || !!me.canMelee; // em 1ª pessoa mostra o braço da arma de mão
  if (me.tag) me.tag.visible = !fp;
}
function updateZoneVisual() {
  if (!zoneMesh) return;
  const r = Math.max(0.5, host.zoneR);
  zoneMesh.scale.set(r, 1, r);
}

// ---------- elevador ----------
function updateElevator(dt) {
  if (!elevator) { $('elevatorUI').classList.add('hidden'); return; }
  if (elevator.target !== null) {
    const dir = Math.sign(elevator.target - elevator.y);
    elevator.y += dir * CONFIG.ELEV_SPEED * dt;
    if (dir === 0 || (dir > 0 && elevator.y >= elevator.target) || (dir < 0 && elevator.y <= elevator.target)) {
      elevator.y = elevator.target; elevator.target = null;
    }
    elevator.mesh.position.y = elevator.y;
  }
  const show = onElevator && elevator.target === null && me && me.alive;
  $('elevatorUI').classList.toggle('hidden', !show);
}
function pickFloor(i) {
  if (!elevator || elevator.target !== null) return;
  elevator.target = elevator.floors[i];
  $('elevatorUI').classList.add('hidden');
}

// ---------- granadas ----------
function resetGrenades() {
  if (scene) { for (const g of grenades) scene.remove(g.mesh); for (const e of fx) scene.remove(e.mesh); }
  grenades.length = 0; fx.length = 0; grenadeCd = 0;
}
function throwGrenade() {
  if (!me || !me.alive || me.frozen || grenadeCd > 0 || status !== 'playing') return;
  grenadeCd = CONFIG.GRENADE.cooldown;
  const dir = new THREE.Vector3(Math.sin(me.ry), 0, Math.cos(me.ry)); // pra frente (em 1ª pessoa = pra onde olha)
  const pos = me.pos.clone(); pos.y += 1.4; pos.add(dir.clone().multiplyScalar(0.6));
  const vel = dir.multiplyScalar(CONFIG.GRENADE.speed); vel.y = CONFIG.GRENADE.up; // arco
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2f7d32, roughness: 0.6 }));
  mesh.position.copy(pos); mesh.castShadow = true; scene.add(mesh);
  Sound.playGrenade();
  grenades.push({ mesh, pos, vel, fuse: CONFIG.GRENADE.fuse, landed: false });
}
function updateGrenades(dt) {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.vel.y -= CONFIG.GRENADE.gravity * dt;
    g.pos.addScaledVector(g.vel, dt);
    resolveCollisions(g.pos, 0.22, colliders);
    const gy = groundAt(g.pos.x, g.pos.z, g.pos.y) + 0.22;
    if (g.pos.y <= gy) {
      g.pos.y = gy;
      if (g.vel.y < -2) { g.vel.y = -g.vel.y * CONFIG.GRENADE.bounce; g.vel.x *= 0.6; g.vel.z *= 0.6; }
      else g.vel.set(0, 0, 0);
      g.landed = true; // o pavio só começa ao tocar o chão
    }
    if (g.landed) { g.fuse -= dt; if (g.fuse <= 0) { explode(g.pos.clone()); scene.remove(g.mesh); grenades.splice(i, 1); continue; } }
    g.mesh.position.copy(g.pos);
  }
}
function explode(at) {
  Sound.playExplosion();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 12), new THREE.MeshBasicMaterial({ color: 0xff8a1e, transparent: true, opacity: 0.85 }));
  mesh.position.copy(at); scene.add(mesh);
  fx.push({ mesh, life: 0.45, max: 0.45 });
  if (isHost) { // dano em área só o host/treino aplica
    const R = CONFIG.GRENADE.radius;
    for (const e of entities.values()) {
      if (!e.alive) continue;
      const c = new THREE.Vector3(e.pos.x, e.pos.y + 1.0, e.pos.z);
      const d = c.distanceTo(at);
      if (d < R) { const dmg = Math.round(CONFIG.GRENADE.dmg * (1 - d / R)); if (dmg > 0) damage(e, dmg); }
    }
  }
}
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const e = fx[i]; e.life -= dt;
    const k = 1 - e.life / e.max;
    e.mesh.scale.setScalar(0.5 + k * CONFIG.GRENADE.radius);
    e.mesh.material.opacity = 0.85 * (1 - k);
    if (e.life <= 0) { scene.remove(e.mesh); fx.splice(i, 1); }
  }
}

// ---------- munição e pacotes de bala ----------
function resetAmmoPickups() {
  ammoR = CONFIG.AMMO_START; ammoL = 0;
  for (const m of pickupMeshes.values()) if (scene) scene.remove(m);
  pickupMeshes.clear();
  pickups = [];
  host.pickupSeq = 1;
  if (status === 'playing' && isHost) { for (let i = 0; i < 5; i++) spawnPickup(); host.pickupTimer = CONFIG.PICKUP_EVERY; }
  else host.pickupTimer = 3;
}
function heal(e, amt) { e.hp = Math.min(e.maxHp, e.hp + amt); }
function makePickupMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'health') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x33dd55, emissiveIntensity: 0.7, roughness: 0.4 }));
    box.castShadow = true; g.add(box);
    const m = new THREE.MeshStandardMaterial({ color: 0x2ecc4b, emissive: 0x1faa3a, emissiveIntensity: 0.8 });
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.2, 0.2), m);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.2), m);
    g.add(a, b); // cruz de vida
  } else {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xffcc33, emissive: 0xff8400, emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.5 }));
    box.castShadow = true; g.add(box);
  }
  return g;
}
function blockedSpot(x, z) {
  for (const c of colliders) if (x > c.min.x - 0.6 && x < c.max.x + 0.6 && z > c.min.z - 0.6 && z < c.max.z + 0.6) return true;
  return false;
}
function spawnPickup() {
  for (let t = 0; t < 14; t++) {
    const x = (Math.random() * 2 - 1) * 26, z = (Math.random() * 2 - 1) * 16;
    if (blockedSpot(x, z)) continue;
    const fy = CONFIG.FLOORS[Math.floor(Math.random() * CONFIG.FLOORS.length)];
    const kind = Math.random() < 0.35 ? 'health' : 'ammo';
    pickups.push({ id: host.pickupSeq++, pos: new THREE.Vector3(x, groundAt(x, z, fy + 0.5), z), kind });
    return;
  }
}
function syncPickups(dt) {
  for (const [id, mesh] of pickupMeshes) if (!pickups.some((p) => p.id === id)) { scene.remove(mesh); pickupMeshes.delete(id); }
  const tt = nowS();
  for (const p of pickups) {
    let mesh = pickupMeshes.get(p.id);
    if (!mesh) { mesh = makePickupMesh(p.kind); scene.add(mesh); pickupMeshes.set(p.id, mesh); }
    mesh.position.set(p.pos.x, p.pos.y + 0.6 + Math.sin(tt * 2 + p.id) * 0.15, p.pos.z);
    mesh.rotation.y += dt * 2;
  }
}
function collectPickup(p) {
  if (p.kind === 'health') {
    if (isHost) heal(me, CONFIG.HEAL); // host cura direto; cliente é curado pelo host
    Sound.playHeal();
  } else {
    if (me.dualGun) { ammoR = Math.min(maxR, ammoR + Math.ceil(packTotal / 2)); ammoL = Math.min(maxL, ammoL + Math.floor(packTotal / 2)); }
    else ammoR = Math.min(maxR, ammoR + packTotal);
    Sound.playPickup();
  }
  pickups = pickups.filter((q) => q.id !== p.id);
  if (net) net.sendPickup(p.id);
}
function checkPickups() {
  if (!me || !me.alive) return;
  for (const p of pickups) {
    const dx = me.pos.x - p.pos.x, dz = me.pos.z - p.pos.z, dy = me.pos.y - p.pos.y;
    if (dx * dx + dz * dz < CONFIG.PICKUP_R * CONFIG.PICKUP_R && Math.abs(dy) < 2.2) {
      if (p.kind === 'health') { if (me.hp >= me.maxHp) continue; } // já com vida cheia: deixa pra outro
      else if (!me.hasGun) continue;                                // sem arma de fogo não pega bala
      collectPickup(p); break;
    }
  }
}
function onClientPickup(pid, d) {
  if (!isHost) return;
  const p = pickups.find((q) => q.id === d.id);
  if (p && p.kind === 'health') { const e = entities.get(pid); if (e && e.alive) heal(e, CONFIG.HEAL); }
  pickups = pickups.filter((q) => q.id !== d.id);
}

// ---------- golpe corpo-a-corpo (marreta / espada) ----------
function meleeStrike(dmg) {
  if (!me || !me.alive) return;
  me.meleeTimer = CONFIG.MELEE.dur; // (re)dispara o swing do braço
  const fwd = new THREE.Vector3(Math.sin(me.ry), 0, Math.cos(me.ry));
  const reach = CONFIG.MELEE.range * (me.scale || 1);
  for (const e of entities.values()) {
    if (e === me || !e.alive) continue;
    const v = new THREE.Vector3().subVectors(e.pos, me.pos);
    const d = v.length();
    if (d > reach || d < 0.01) continue;
    if (v.normalize().dot(fwd) < 0.2) continue; // só acerta quem está na frente
    if (isHost) damage(e, dmg);
    else net.sendHit(e.peerId, dmg);
  }
}
function doSpecial() {
  if (!me || !me.alive || !me.canMelee || meleeCd > 0 || status !== 'playing' || me.frozen) return;
  const w = me.meleeType;
  if (w === 'sword') {
    meleeCd = CONFIG.MELEE.cooldown;
    for (let i = 0; i < 3; i++) setTimeout(() => { if (status === 'playing' && me && me.alive) { Sound.playSlash(); meleeStrike(28); } }, i * 150);
  } else if (w === 'spray') {
    meleeCd = CONFIG.SPRAY.cooldown; me.meleeTimer = CONFIG.MELEE.dur; Sound.playSpray();
    transformInFront('tree', CONFIG.SPRAY.dur, CONFIG.SPRAY.range, 0);
  } else if (w === 'ice') {
    meleeCd = CONFIG.ICE.cooldown; me.meleeTimer = CONFIG.MELEE.dur; Sound.playIce();
    doIce();
  } else if (w === 'dualgun') {
    if (ammoL <= 0) { Sound.playEmpty(); meleeCd = 0.25; return; }
    meleeCd = CONFIG.FIRE_COOLDOWN; fireFrom('L'); // 2ª arma do Pistoleiro
  } else { // hammer
    meleeCd = CONFIG.MELEE.cooldown; Sound.playSmash(); meleeStrike(CONFIG.MELEE.dmg);
  }
}

// vira o alvo (à frente, num cone) em árvore/gelo por 'dur' segundos
function transformInFront(type, dur, range, dmg) {
  const fwd = new THREE.Vector3(Math.sin(me.ry), 0, Math.cos(me.ry));
  const reach = range * (me.scale || 1);
  let best = null, bd = Infinity;
  for (const e of entities.values()) {
    if (e === me || !e.alive) continue;
    const v = new THREE.Vector3().subVectors(e.pos, me.pos); const d = v.length();
    if (d > reach || d < 0.01) continue;
    if (v.normalize().dot(fwd) < 0.4) continue;
    if (d < bd) { bd = d; best = e; }
  }
  if (best) applyTransform(best, type, dur, dmg);
}

// raio de gelo: hitscan a partir da mão que brilha
function doIce() {
  const armL = me.body.parts.armL; armL.updateWorldMatrix(true, false);
  const muzzle = new THREE.Vector3(0, -0.78, 0.08).applyMatrix4(armL.matrixWorld);
  let origin, dir;
  if (camMode === 'first') { origin = camera.position.clone(); dir = camera.getWorldDirection(new THREE.Vector3()); }
  else { origin = muzzle.clone(); dir = new THREE.Vector3(Math.sin(me.ry), 0, Math.cos(me.ry)); }
  let best = null, bestT = CONFIG.ICE.range;
  for (const e of entities.values()) {
    if (e === me || !e.alive) continue;
    const sc = e.scale || 1;
    const center = tmp.copy(e.pos); center.y += 1.3 * sc;
    const oc = tmp2.copy(center).sub(origin);
    const tca = oc.dot(dir);
    if (tca < 0 || tca > bestT) continue;
    const d2 = oc.lengthSq() - tca * tca; const hr = 1.0 * sc;
    if (d2 > hr * hr) continue;
    best = e; bestT = tca;
  }
  const end = origin.clone().add(dir.clone().multiplyScalar(best ? bestT : CONFIG.ICE.range));
  tracer(muzzle, end, 0x66e8ff, 90); // feixe gelado
  if (best) applyTransform(best, 'ice', CONFIG.ICE.dur, CONFIG.ICE.dmg);
}

// aplica o efeito (host aplica direto; cliente avisa o host)
function applyTransform(target, type, dur, dmg) {
  if (isHost) { transform(target, type, dur); if (dmg > 0) damage(target, dmg); }
  else net.sendTransform(target.peerId, type, dur, dmg);
}
function transform(e, type, dur) { e.frozen = true; e.frozenType = type; e.frozenTimer = dur; }
function onClientTransform(pid, d) {
  if (!isHost) return;
  const e = entities.get(d.tgt);
  if (e && e.alive) { transform(e, d.ft, d.dur); if (d.dmg > 0) damage(e, d.dmg); }
}

// ============================================================
// CHAT DE TEXTO (via WebRTC: cliente -> host -> todos)
// ============================================================
function resetChat() {
  chatOpen = false;
  $('chatInputWrap').classList.remove('show');
  $('chatLog').innerHTML = '';
}

function openChat() {
  if (chatOpen || status !== 'playing') return;   // funciona solo também (mostra suas msgs)
  chatOpen = true;
  $('chatInputWrap').classList.add('show');
  const inp = $('chatText');
  inp.value = '';
  // solta as teclas de movimento pra o boneco não sair "grudado" andando
  for (const k in keys) keys[k] = false;
  input.mx = input.my = 0; input.firing = false;
  document.exitPointerLock?.();
  setTimeout(() => inp.focus(), 0);
}

function closeChat() {
  chatOpen = false;
  $('chatInputWrap').classList.remove('show');
  $('chatText').blur();
}

function sendChat() {
  const inp = $('chatText');
  const text = inp.value.trim().slice(0, 140);
  closeChat();
  if (!text) return;
  // mostra a própria mensagem na hora e envia pela rede (quando houver outros)
  onChat({ name: myName || 'Você', text });
  if (net) net.sendChat(myName || 'Você', text);
}

// recebe (host: dos clientes / re-transmite; cliente: do host) e mostra
function onChat(d) {
  if (!d || typeof d.text !== 'string') return;
  const name = String(d.name || '???').slice(0, 24);
  const text = String(d.text).slice(0, 140);
  const log = $('chatLog');
  const line = document.createElement('div');
  line.className = 'chat-line';
  line.innerHTML = `<b>${escapeHtml(name)}:</b> ${escapeHtml(text)}`;
  log.appendChild(line);
  while (log.children.length > 6) log.removeChild(log.firstChild);
}

// ============================================================
// CHAT DE VOZ (malha PeerJS — reusa o `peer` e o roster já existentes)
// ============================================================
// atende chamadas de mídia recebidas (com a voz ligada). Registrado 1x por partida.
let voiceAnswerWired = false;
function setupVoiceAnswer() {
  if (voiceAnswerWired || !peer) return;
  voiceAnswerWired = true;
  peer.on('call', (call) => {
    if (!micStream) { try { call.close(); } catch {} return; } // só atende com a voz ligada
    call.answer(micStream);
    wireVoiceCall(call);
  });
}

async function toggleVoice() {
  if (voiceState === 'off') { await enableVoice(); return; }
  // alterna mudo (liga/desliga a track, mantém a malha conectada)
  voiceMuted = !voiceMuted;
  if (micStream) micStream.getAudioTracks().forEach((t) => (t.enabled = !voiceMuted));
  voiceState = voiceMuted ? 'muted' : 'on';
  updateVoiceButton();
}

async function enableVoice() {
  if (!window.Peer || !peer) { return; }
  if (!myPeerId) { return; } // peer ainda abrindo
  voiceState = 'connecting'; updateVoiceButton();
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
  } catch (e) {
    voiceState = 'off'; updateVoiceButton();
    return;
  }
  voiceMuted = false;
  voiceState = 'on';
  updateVoiceButton();
  updateVoiceMesh();
  // re-tenta a malha a cada 1,5s: peers entram/saem e ligam a voz em momentos diferentes
  if (voiceMeshTimer) clearInterval(voiceMeshTimer);
  voiceMeshTimer = setInterval(() => {
    if ((voiceState === 'on' || voiceState === 'muted') && net) updateVoiceMesh();
  }, 1500);
}

function updateVoiceButton() {
  const btn = $('btnVoice');
  btn.classList.remove('on', 'muted', 'connecting');
  if (voiceState === 'connecting') { btn.classList.add('connecting'); btn.textContent = '🎤'; btn.title = 'Conectando voz…'; }
  else if (voiceState === 'on')     { btn.classList.add('on');        btn.textContent = '🎤'; btn.title = 'Voz ligada (toque pra mutar)'; }
  else if (voiceState === 'muted')  { btn.classList.add('muted');     btn.textContent = '🔇'; btn.title = 'Mutado (toque pra falar)'; }
  else                              { btn.textContent = '🎤'; btn.title = 'Chat de voz'; }
}

// liga com os peers do roster. Regra: só quem tem peerId MENOR inicia a chamada
// (o outro só atende), pra não ter ligação dupla.
function updateVoiceMesh() {
  if (!peer || !micStream || !net) return;
  const remote = net.remotePeerIds();
  const live = new Set(remote);
  for (const rp of remote) {
    if (voiceCalls.has(rp)) continue;
    if (myPeerId && myPeerId < rp) {
      try { const call = peer.call(rp, micStream); if (call) wireVoiceCall(call); } catch {}
    }
  }
  // limpa quem não está mais no roster
  for (const rp of [...voiceCalls.keys()]) if (!live.has(rp)) removeVoiceCall(rp);
}

function wireVoiceCall(call) {
  if (!voiceCalls.has(call.peer)) voiceCalls.set(call.peer, { call, audioEl: null });
  else voiceCalls.get(call.peer).call = call;
  call.on('stream', (remote) => attachRemoteAudio(call, remote));
  call.on('close', () => removeVoiceCall(call.peer));
  call.on('error', () => removeVoiceCall(call.peer));
}

function attachRemoteAudio(call, stream) {
  let entry = voiceCalls.get(call.peer);
  if (!entry) { entry = { call, audioEl: null }; voiceCalls.set(call.peer, entry); }
  if (!entry.audioEl) {
    const a = document.createElement('audio');
    a.autoplay = true; a.playsInline = true;
    $('voiceAudios').appendChild(a);
    entry.audioEl = a;
  }
  entry.audioEl.srcObject = stream;
  const pp = entry.audioEl.play && entry.audioEl.play();
  if (pp && pp.catch) pp.catch(() => {});
}

function removeVoiceCall(peerId) {
  const entry = voiceCalls.get(peerId);
  if (!entry) return;
  try { entry.call && entry.call.close(); } catch {}
  if (entry.audioEl) { try { entry.audioEl.srcObject = null; entry.audioEl.remove(); } catch {} }
  voiceCalls.delete(peerId);
}

function stopVoice() {
  if (voiceMeshTimer) { clearInterval(voiceMeshTimer); voiceMeshTimer = null; }
  for (const id of [...voiceCalls.keys()]) removeVoiceCall(id);
  if (micStream) { try { micStream.getTracks().forEach((t) => t.stop()); } catch {} }
  micStream = null;
  voiceState = 'off'; voiceMuted = false;
  updateVoiceButton();
}

// ---------- HUD ----------
function updateHud() {
  if (!me) return;
  $('hpFill').style.width = clamp((me.hp / (me.maxHp || 100)) * 100, 0, 100) + '%';
  $('hpText').textContent = Math.ceil(me.hp);
  const alive = [...entities.values()].filter((e) => e.alive).length;
  $('aliveCount').textContent = `Vivos: ${alive}/${entities.size}`;
  $('zoneInfo').textContent = ZONE_DAMAGE ? (host.zoneDps ? `Zona · dano ${host.zoneDps}/s fora` : 'Zona') : 'Sem zona';
  if (!me.hasGun) {
    $('ammo').textContent = me.meleeType === 'ice' ? '❄ raio gelado (X)' : '🗡 corpo a corpo (X)';
    $('ammo').style.color = '#9fd6ff';
  } else if (me.dualGun) {
    $('ammo').textContent = `🔫 D:${ammoR} | E:${ammoL}`;
    $('ammo').style.color = (ammoR + ammoL) > 0 ? '#fff' : '#ff6e8e';
  } else {
    $('ammo').textContent = ammoR > 0 ? `🔫 ${ammoR}/${maxR}` : '🔫 Sem balas! (pegue um pacote)';
    $('ammo').style.color = ammoR > 0 ? '#fff' : '#ff6e8e';
  }
  const tt = $('treeTag');
  if (me.frozen) { tt.classList.remove('hidden'); tt.textContent = (me.frozenType === 'ice' ? '🧊 Congelado!' : '🌳 Virou árvore!') + ' ' + Math.ceil(me.frozenTimer) + 's'; }
  else tt.classList.add('hidden');
  $('crosshair').classList.toggle('hidden', camMode !== 'first' || !me.hasGun); // mira só na 1ª pessoa
  $('deadTag').classList.toggle('hidden', me.alive);
}

function showEnd(customMsg) {
  status = 'ended';
  $('elevatorUI').classList.add('hidden');
  $('endBox').classList.remove('hidden');
  let txt = customMsg;
  if (!txt) {
    if (me && winner === me.peerId) txt = '🏆 Vitória Royale! Você foi o último de pé!';
    else if (winner) txt = `Fim de jogo! Vencedor: ${entities.get(winner)?.name || '???'}`;
    else txt = 'Fim de jogo!';
  }
  $('endText').textContent = txt;
  if (isTouch) $('touchControls').classList.add('hidden');
  document.exitPointerLock?.();
}

function backToLobby() {
  status = 'lobby'; training = false;
  stopVoice();
  closeChat();
  net?.destroy(); net = null;
  resetGrenades();
  resetAmmoPickups();
  $('elevatorUI').classList.add('hidden');
  for (const e of entities.values()) scene.remove(e.group);
  entities.clear(); me = null;
  $('screen-game').classList.add('hidden');
  $('endBox').classList.add('hidden');
  $('screen-lobby').classList.remove('hidden');
  leaveRoom();
}

// ============================================================
// INPUT
// ============================================================
function bindInput() {
  // teclado
  const FIRE_KEYS = new Set(['ControlLeft', 'ControlRight', 'KeyF']);
  addEventListener('keydown', (e) => {
    // chat aberto: deixa o campo de texto receber as teclas (Enter envia, Esc fecha)
    if (chatOpen) {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault(); sendChat(); }
      else if (e.code === 'Escape') { e.preventDefault(); closeChat(); }
      return;
    }
    // Enter abre o chat (fora da partida não faz nada)
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && status === 'playing') { e.preventDefault(); openChat(); return; }
    keys[e.code] = true;
    if (e.code === 'Space') input.jump = true;
    if (e.code === 'KeyQ' && !e.repeat) toggleCamMode();
    // Shift Lock (igual ao Salão): trava/destrava o mouse
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) {
      e.preventDefault();
      if (document.pointerLockElement) document.exitPointerLock();
      else if (status === 'playing') renderer?.domElement?.requestPointerLock?.();
    }
    if (e.code === 'KeyE' && !e.repeat) throwGrenade();
    if (e.code === 'KeyX' && !e.repeat) doSpecial();
    // elevador: escolher andar pelo teclado (1/2/3 ou numpad) quando estiver nele
    if (onElevator && !e.repeat) {
      if (e.code === 'Digit1' || e.code === 'Numpad1') pickFloor(0);
      else if (e.code === 'Digit2' || e.code === 'Numpad2') pickFloor(1);
      else if (e.code === 'Digit3' || e.code === 'Numpad3') pickFloor(2);
    }
    if (FIRE_KEYS.has(e.code)) { input.firing = true; if (status === 'playing') e.preventDefault(); }
    updateMoveFromKeys();
  });
  addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (FIRE_KEYS.has(e.code)) input.firing = false;
    updateMoveFromKeys();
  });

  // mouse (pointer lock)
  const cv = () => renderer?.domElement;
  document.addEventListener('mousedown', (e) => {
    if (status !== 'playing' || chatOpen) return;
    // não rouba o clique dos botões/campo da UI (chat, voz, sair…)
    if (e.target.closest && e.target.closest('button, input, #chatInputWrap')) return;
    if (document.pointerLockElement) { if (e.button === 0) input.firing = true; }
    else cv()?.requestPointerLock?.();
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) input.firing = false; });
  addEventListener('mousemove', (e) => {
    if (!document.pointerLockElement) return;
    yaw -= e.movementX * 0.0024;
    pitch = clamp(pitch + e.movementY * 0.0024, -0.5, 1.0);
  });

  // Shift Lock (igual ao Salão de Damas): selo "🔒 Shift Lock" enquanto o mouse está travado
  const lockBadge = document.createElement('div');
  lockBadge.textContent = '🔒 Shift Lock';
  lockBadge.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:60;background:rgba(0,0,0,.55);border:1px solid rgba(255,210,63,.5);color:#ffd23f;font-weight:800;font-size:12px;padding:6px 12px;border-radius:10px;display:none;pointer-events:none;font-family:Arial,sans-serif';
  document.body.appendChild(lockBadge);
  document.addEventListener('pointerlockchange', () => {
    lockBadge.style.display = document.pointerLockElement ? 'block' : 'none';
  });

  // touch
  if (isTouch) bindTouch();

  // botões de UI
  // os botões de jogar disparam tela cheia + liberam o áudio (gesto do clique)
  $('btnQuick').addEventListener('click', () => { goFullscreen(); Sound.initAudio(); quickJoin(); });
  $('btnCreate').addEventListener('click', () => { goFullscreen(); Sound.initAudio(); createPrivate(); });
  $('btnJoin').addEventListener('click', () => { goFullscreen(); Sound.initAudio(); joinPrivate(); });
  $('btnTrain').addEventListener('click', () => { goFullscreen(); Sound.initAudio(); startTraining(); });
  $('btnStart').addEventListener('click', () => { goFullscreen(); Sound.initAudio(); startGameAsHost(); });
  $('btnLeaveRoom').addEventListener('click', leaveRoom);
  $('btnBackLobby').addEventListener('click', backToLobby);
  $('btnExit').addEventListener('click', backToLobby);
  $('btnView').addEventListener('click', toggleCamMode);
  $('mapBackrooms').addEventListener('click', () => selectMap('backrooms'));
  $('mapBosque').addEventListener('click', () => selectMap('bosque'));
  $('btnGrenade').addEventListener('click', throwGrenade);
  $('btnMelee').addEventListener('click', doSpecial);
  // chat / voz
  $('btnChat').addEventListener('click', openChat);
  $('chatSend').addEventListener('click', sendChat);
  $('btnVoice').addEventListener('click', () => { Sound.initAudio?.(); toggleVoice(); });
  $('elv0').addEventListener('click', () => pickFloor(0));
  $('elv1').addEventListener('click', () => pickFloor(1));
  $('elv2').addEventListener('click', () => pickFloor(2));
}

function updateMoveFromKeys() {
  input.my = (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
  input.mx = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
}

function bindTouch() {
  const stick = $('stick'), base = $('joystick');
  let jid = null, cx = 0, cy = 0;
  let lookId = null, lookX = 0, lookY = 0; // arrastar na metade direita = olhar
  base.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0]; jid = t.identifier;
    const r = base.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    e.preventDefault();
  }, { passive: false });
  addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === jid) {
        const dx = clamp((t.clientX - cx) / 50, -1, 1), dy = clamp((t.clientY - cy) / 50, -1, 1);
        input.mx = dx; input.my = -dy;
        stick.style.transform = `translate(${dx * 30}px,${dy * 30}px)`;
      } else if (t.identifier === lookId) {
        yaw -= (t.clientX - lookX) * 0.005; pitch = clamp(pitch + (t.clientY - lookY) * 0.005, -0.5, 1.0);
        lookX = t.clientX; lookY = t.clientY;
      }
    }
  }, { passive: false });
  addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === jid) { jid = null; input.mx = input.my = 0; stick.style.transform = ''; }
      if (t.identifier === lookId) lookId = null;
    }
  });
  // olhar: arrastar na metade direita
  addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      if (t.clientX > innerWidth / 2 && lookId === null && t.target.id !== 'btnShoot' && t.target.id !== 'btnJump') {
        lookId = t.identifier; lookX = t.clientX; lookY = t.clientY;
      }
    }
  }, { passive: true });
  $('btnJump').addEventListener('touchstart', (e) => { input.jump = true; e.preventDefault(); }, { passive: false });
  $('btnShoot').addEventListener('touchstart', (e) => { input.firing = true; e.preventDefault(); }, { passive: false });
  $('btnShoot').addEventListener('touchend', () => { input.firing = false; });
}

// ---------- util ----------
function goFullscreen() {
  const el = document.documentElement;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (fn && !document.fullscreenElement) { try { fn.call(el); } catch {} }
}
const nowS = () => performance.now() / 1000;
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// start
bindInput();
boot();
