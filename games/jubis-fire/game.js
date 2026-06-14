// Jubis Fire — battle royale-lite 3D para até 4 jogadores (terceira pessoa).
// Host-autoritativo via WebRTC: cada cliente simula seu próprio boneco e manda a
// posição; o host decide zona, vida e eliminações e transmite o "mundo".

import * as THREE from 'three';
import { CONFIG, ZONE_DAMAGE, computeZone, clamp, lerp } from './shared.js?v=3';
import { CHARACTERS, getCharacter, buildBody, animateBody } from './characters.js?v=3';
import { buildArena, resolveCollisions } from './arena.js?v=3';
import { lobby, Net } from './net.js?v=3';

const $ = (id) => document.getElementById(id);
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// ---------- estado ----------
let peer = null, myPeerId = null, myName = '', selectedChar = 'm1';
let roomId = null, isHost = false, roomPoll = null;
let net = null;
let scene, renderer, camera, clock;
let colliders = [], spawns = [];
let zoneMesh = null;
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

// ============================================================
// BOOT — cria o Peer (PeerJS) e prepara o lobby
// ============================================================
function boot() {
  buildCharGrid();
  if (isTouch) $('pcHint').classList.add('hidden'); // no celular usa o botão 👁 Visão
  $('pname').value = localStorage.getItem('jubis-fire-name') || '';
  lobbyMsg('Conectando…');
  peer = new window.Peer(undefined, { debug: 1 });
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
function getName() {
  const n = $('pname').value.trim().slice(0, 16);
  if (!n) { lobbyMsg('Escreva seu nome.', true); return null; }
  localStorage.setItem('jubis-fire-name', n);
  myName = n; return n;
}

async function quickJoin() {
  const n = getName(); if (!n || !myPeerId) return;
  lobbyMsg('');
  const r = await lobby('quick_join', { name: n, peerId: myPeerId, char: selectedChar });
  if (r.error) return lobbyMsg(r.error, true);
  enterRoom(r.roomId, r.isHost, null);
}
async function createPrivate() {
  const n = getName(); if (!n || !myPeerId) return;
  const r = await lobby('create_room', { name: n, peerId: myPeerId, char: selectedChar });
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
  const built = buildArena(scene);
  colliders = built.colliders; spawns = built.spawns;
  buildZoneMesh();

  entities.clear();
  roster.forEach((p, i) => createEntity(p, i, p.peerId === myPeerId));
  me = entities.get(myPeerId);

  net = new Net(peer, myPeerId, isHost, hostPeerId, roster);
  net.on('world', onWorld).on('input', onClientInput).on('hit', onClientHit).on('close', onPeerClose);
  net.start();

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
  const built = buildArena(scene);
  colliders = built.colliders; spawns = built.spawns;
  buildZoneMesh();

  const myId = myPeerId || 'me-local';
  const roster = [{ peerId: myId, name: myName || $('pname').value.trim() || 'Você', char: selectedChar }];
  const pool = CHARACTERS.map((c) => c.id).filter((id) => id !== selectedChar);
  for (let i = 0; i < 3; i++) roster.push({ peerId: 'bot-' + i, name: BOT_NAMES[i], char: pool[(i * 3 + 1) % pool.length], bot: true });

  entities.clear();
  roster.forEach((p, i) => {
    const e = createEntity(p, i, p.peerId === myId);
    if (p.bot) { e.isBot = true; e.ai = { fireCd: 1 + Math.random() * 2, dir: Math.random() * Math.PI * 2, dirCd: 0 }; }
  });
  me = entities.get(myId);

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
    const ai = e.ai;
    // alvo vivo mais próximo
    let target = null, td = Infinity;
    for (const o of entities.values()) { if (o === e || !o.alive) continue; const d = dist2(e.pos, o.pos); if (d < td) { td = d; target = o; } }
    const cx = e.pos.x, cz = e.pos.z;
    const distC = Math.hypot(cx, cz);
    let dx, dz;
    if (distC > safeR - 3) { dx = -cx; dz = -cz; }            // volta pra dentro da zona
    else {
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
    e.pos.x += dx * BOT_SPEED * dt; e.pos.z += dz * BOT_SPEED * dt; e.pos.y = 0;
    resolveCollisions(e.pos, CONFIG.PLAYER_R, colliders);
    const aimT = target && Math.sqrt(td) < 45;
    e.ry = aimT ? Math.atan2(target.pos.x - cx, target.pos.z - cz) : Math.atan2(dx, dz);
    e.anim = 'run';
    e.group.position.copy(e.pos); e.group.rotation.y = e.ry;
    // tiro com imprecisão
    ai.fireCd -= dt;
    if (aimT && ai.fireCd <= 0) {
      ai.fireCd = 0.8 + Math.random() * 1.4;
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
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  $('glmount').appendChild(renderer.domElement);
  scene = new THREE.Scene();
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
  const e = {
    peerId: p.peerId, name: p.name, charId: p.char, body, group: body.group,
    pos: sp.clone(), ry: 0, vy: 0, grounded: true, anim: 'idle',
    hp: CONFIG.MAX_HP, alive: true, isLocal: local, slot, aimTimer: 0, hitFlash: 0,
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
  spr.scale.set(2.6, 1.0, 1);
  spr.position.y = 2.55;
  e.group.add(spr);
  e.tag = spr; e.tagCanvas = canvas; e.tagCtx = canvas.getContext('2d'); e.tagTex = tex; e.lastDrawnHp = -1;
  drawNameplate(e);
}

function drawNameplate(e) {
  const c = e.tagCtx; const W = 256;
  c.clearRect(0, 0, W, 96);
  // nome
  c.font = 'bold 26px Arial'; c.textAlign = 'center';
  c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(28, 2, 200, 34);
  c.fillStyle = '#fff'; c.fillText(e.name, 128, 28);
  // barra de vida
  const bx = 28, by = 46, bw = 200, bh = 20;
  const frac = Math.max(0, Math.min(1, e.hp / CONFIG.MAX_HP));
  c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(bx - 3, by - 3, bw + 6, bh + 6);
  c.fillStyle = frac > 0.5 ? '#69f0ae' : frac > 0.25 ? '#ffd54f' : '#ff5252';
  c.fillRect(bx, by, bw * frac, bh);
  c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2; c.strokeRect(bx, by, bw, bh);
  e.tagTex.needsUpdate = true;
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
    if (s.hp < e.hp) e.hitFlash = 0.18; // levou dano desde o último estado -> pisca
    e.hp = s.hp; e.alive = s.alive;
    if (pid === myPeerId) continue;              // minha posição é local
    e.targetPos.set(s.p[0], s.p[1], s.p[2]);
    e.targetRy = s.ry; e.anim = s.a;
    e.aimTimer = s.aim ? 0.3 : 0;
  }
  host.zoneR = d.zone.r; host.zoneDps = d.zone.dps;
  if (d.status === 'ended' && status === 'playing') { status = 'ended'; winner = d.winner; showEnd(); }
}
function onClientInput(pid, d) { // host recebe input de um cliente
  if (!isHost) return;
  const e = entities.get(pid); if (!e) return;
  e.targetPos.set(d.p[0], d.p[1], d.p[2]); e.targetRy = d.ry; e.anim = d.a;
  e.aimTimer = d.aim ? 0.3 : 0;
}
function onClientHit(pid, d) {   // host recebe alegação de acerto
  if (!isHost) return;
  host.pendingHits.push({ tgt: d.tgt, dmg: d.d });
}
function onPeerClose(pid) {
  const e = entities.get(pid);
  if (e && isHost) { e.alive = false; e.hp = 0; }
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
  }
  updateCamera();
  updateZoneVisual();
  for (const e of entities.values()) {
    if (e.aimTimer > 0) e.aimTimer -= dt;
    animateBody(e.body, e.anim, dt, 1, e.aimTimer > 0);
    if (e.hitFlash > 0) e.hitFlash -= dt;
    setEntityFlash(e, e.hitFlash > 0);
    if (e.hp !== e.lastDrawnHp) { drawNameplate(e); e.lastDrawnHp = e.hp; }
    e.group.visible = e.alive || e === me; // eliminados somem
  }
  // 1ª pessoa: do meu corpo mostro só o braço direito + o revólver (viewmodel)
  if (me) setLocalFirstPerson(camMode === 'first');
  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

function updateLocal(dt) {
  if (!me || !me.alive) { me && (me.anim = 'idle'); return; }
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

  // pulo / gravidade
  if (input.jump && me.grounded) { me.vy = CONFIG.JUMP_V; me.grounded = false; }
  input.jump = false;
  me.vy -= CONFIG.GRAVITY * dt;
  me.pos.y += me.vy * dt;
  if (me.pos.y <= 0) { me.pos.y = 0; me.vy = 0; me.grounded = true; }

  resolveCollisions(me.pos, CONFIG.PLAYER_R, colliders);
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
  host.lastNet += dt;
  if (host.lastNet >= 1 / CONFIG.NET_HZ) { host.lastNet = 0; broadcastWorld(); }
}

function damage(e, amount) {
  e.hp = Math.max(0, e.hp - amount);
  e.hitFlash = 0.18; // reação visual ao acerto
  if (e.hp <= 0 && e.alive) { e.alive = false; }
}

function broadcastWorld() {
  if (!net) return; // modo treino: não há rede
  const players = {};
  for (const e of entities.values()) {
    players[e.peerId] = { p: [e.pos.x, e.pos.y, e.pos.z], ry: e.ry, a: e.anim, hp: e.hp, alive: e.alive, aim: e.aimTimer > 0 };
  }
  net.broadcast({ players, zone: { r: host.zoneR, dps: host.zoneDps }, status, winner });
}

function sendInput() {
  if (!me || !net) return;
  net.sendInput({ p: [me.pos.x, me.pos.y, me.pos.z], ry: me.ry, a: me.anim, aim: me.aimTimer > 0 });
}

// ---------- tiro ----------
function handleFire(dt) {
  fireCooldown -= dt;
  if (!input.firing || fireCooldown > 0 || !me || !me.alive) return;
  fireCooldown = CONFIG.FIRE_COOLDOWN;
  fire();
}
// ponta do cano no espaço local do braço direito (mão + arma estendida)
const MUZZLE_LOCAL = new THREE.Vector3(0, -0.98, 0.08);

function fire() {
  // tiro reto, na horizontal, na direção para onde o boneco está virado
  const dir = new THREE.Vector3(Math.sin(me.ry), 0, Math.cos(me.ry));
  // levanta o braço já agora e lê a posição real da ponta do revólver
  const armR = me.body.parts.armR;
  armR.rotation.x = -Math.PI / 2; armR.rotation.z = 0;
  armR.updateWorldMatrix(true, false);
  const origin = MUZZLE_LOCAL.clone().applyMatrix4(armR.matrixWorld);
  let best = null, bestT = CONFIG.RANGE;
  for (const e of entities.values()) {
    if (e === me || !e.alive) continue;
    const center = tmp.copy(e.pos); center.y += 1.3;
    const oc = tmp2.copy(center).sub(origin);
    const tca = oc.dot(dir);
    if (tca < 0 || tca > bestT) continue;
    const d2 = oc.lengthSq() - tca * tca;
    if (d2 > 0.9 * 0.9) continue; // raio de acerto
    best = e; bestT = tca;
  }
  const end = origin.clone().add(dir.clone().multiplyScalar(best ? bestT : CONFIG.RANGE));
  tracer(origin, end);
  me.aimTimer = 0.3; // levanta o braço/arma
  if (best) {
    if (isHost) damage(best, CONFIG.BULLET_DMG);
    else net.sendHit(best.peerId, CONFIG.BULLET_DMG);
  }
}
function tracer(a, b) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xfff176 }));
  scene.add(line);
  setTimeout(() => { scene.remove(line); geo.dispose(); }, 60);
}

// ---------- câmera / zona visual ----------
function updateCamera() {
  if (!me) return;
  const head = tmp.copy(me.pos); head.y += CONFIG.EYE;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  if (camMode === 'first') {
    camera.position.copy(head);
    camera.lookAt(head.x + Math.sin(yaw) * cp, head.y - sp, head.z + Math.cos(yaw) * cp);
  } else {
    camera.position.set(
      head.x - Math.sin(yaw) * cp * CONFIG.CAM_DIST,
      head.y + sp * CONFIG.CAM_DIST + CONFIG.CAM_HEIGHT,
      head.z - Math.cos(yaw) * cp * CONFIG.CAM_DIST
    );
    camera.lookAt(head);
  }
}

function toggleCamMode() {
  camMode = camMode === 'third' ? 'first' : 'third';
}

// em 1ª pessoa, esconde do próprio corpo tudo menos o braço direito + arma
function setLocalFirstPerson(fp) {
  const p = me.body.parts;
  p.head.visible = !fp; p.torso.visible = !fp;
  p.legL.visible = !fp; p.legR.visible = !fp; p.armL.visible = !fp;
  if (me.tag) me.tag.visible = !fp;
}
function updateZoneVisual() {
  if (!zoneMesh) return;
  const r = Math.max(0.5, host.zoneR);
  zoneMesh.scale.set(r, 1, r);
}

// ---------- HUD ----------
function updateHud() {
  if (!me) return;
  $('hpFill').style.width = clamp(me.hp, 0, 100) + '%';
  $('hpText').textContent = Math.ceil(me.hp);
  const alive = [...entities.values()].filter((e) => e.alive).length;
  $('aliveCount').textContent = `Vivos: ${alive}/${entities.size}`;
  $('zoneInfo').textContent = ZONE_DAMAGE ? (host.zoneDps ? `Zona · dano ${host.zoneDps}/s fora` : 'Zona') : 'Sem zona';
  $('deadTag').classList.toggle('hidden', me.alive);
}

function showEnd(customMsg) {
  status = 'ended';
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
  net?.destroy(); net = null;
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
  const FIRE_KEYS = new Set(['ControlLeft', 'ControlRight', 'Enter', 'NumpadEnter', 'KeyF']);
  addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') input.jump = true;
    if (e.code === 'KeyQ' && !e.repeat) toggleCamMode();
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
    if (status !== 'playing') return;
    if (document.pointerLockElement) { if (e.button === 0) input.firing = true; }
    else cv()?.requestPointerLock?.();
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) input.firing = false; });
  addEventListener('mousemove', (e) => {
    if (!document.pointerLockElement) return;
    yaw -= e.movementX * 0.0024;
    pitch = clamp(pitch + e.movementY * 0.0024, -0.5, 1.0);
  });

  // touch
  if (isTouch) bindTouch();

  // botões de UI
  // os botões de jogar disparam tela cheia (precisa ser no gesto do clique)
  $('btnQuick').addEventListener('click', () => { goFullscreen(); quickJoin(); });
  $('btnCreate').addEventListener('click', () => { goFullscreen(); createPrivate(); });
  $('btnJoin').addEventListener('click', () => { goFullscreen(); joinPrivate(); });
  $('btnTrain').addEventListener('click', () => { goFullscreen(); startTraining(); });
  $('btnStart').addEventListener('click', () => { goFullscreen(); startGameAsHost(); });
  $('btnLeaveRoom').addEventListener('click', leaveRoom);
  $('btnBackLobby').addEventListener('click', backToLobby);
  $('btnExit').addEventListener('click', backToLobby);
  $('btnView').addEventListener('click', toggleCamMode);
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
