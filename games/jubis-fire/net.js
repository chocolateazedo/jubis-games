// Jubis Fire — rede. Duas partes:
//  1) Lobby via PHP (api.php): agrupa até 4 jogadores numa sala, elege um host
//     e distribui os PeerJS IDs de todo mundo.
//  2) WebRTC (PeerJS) em estrela: todos conectam no host. O host é a autoridade
//     da partida (zona, vida, eliminações) e transmite o "mundo" para todos.

const API = 'api.php';

export async function lobby(action, body = {}) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  });
  return r.json();
}

export class Net {
  // peer: objeto PeerJS já aberto. roster: [{peerId,name,char}] em ordem de slot.
  constructor(peer, myPeerId, isHost, hostPeerId, roster) {
    this.peer = peer;
    this.myPeerId = myPeerId;
    this.isHost = isHost;
    this.hostPeerId = hostPeerId;
    this.roster = roster;
    this.conns = new Map();   // host: peerId -> DataConnection
    this.hostConn = null;     // cliente: conexão com o host
    this.handlers = { world: () => {}, input: () => {}, hit: () => {}, pickup: () => {}, transform: () => {}, close: () => {} };
  }

  on(evt, cb) { this.handlers[evt] = cb; return this; }

  start() {
    if (this.isHost) {
      this.peer.on('connection', (c) => this._wireHostConn(c));
    } else {
      this._connectToHost();
    }
  }

  _wireHostConn(c) {
    c.on('open', () => this.conns.set(c.peer, c));
    c.on('data', (d) => {
      if (!d) return;
      if (d.t === 'st') this.handlers.input(c.peer, d);
      else if (d.t === 'hit') this.handlers.hit(c.peer, d);
      else if (d.t === 'pk') this.handlers.pickup(c.peer, d);
      else if (d.t === 'tf') this.handlers.transform(c.peer, d);
    });
    c.on('close', () => { this.conns.delete(c.peer); this.handlers.close(c.peer); });
    c.on('error', () => {});
  }

  _connectToHost(attempt = 0) {
    const conn = this.peer.connect(this.hostPeerId, { reliable: true, serialization: 'json' });
    let opened = false;
    conn.on('open', () => { opened = true; this.hostConn = conn; });
    conn.on('data', (d) => { if (d && d.t === 'w') this.handlers.world(d); });
    conn.on('close', () => this.handlers.close(this.hostPeerId));
    conn.on('error', () => {
      if (!opened && attempt < 5) setTimeout(() => this._connectToHost(attempt + 1), 600);
    });
    // fallback: se não abrir em 4s, tenta de novo
    setTimeout(() => { if (!opened && attempt < 5) this._connectToHost(attempt + 1); }, 4000);
  }

  // cliente -> host
  sendInput(obj) { if (this.hostConn && this.hostConn.open) this.hostConn.send({ t: 'st', ...obj }); }
  sendHit(targetPeerId, dmg) { if (this.hostConn && this.hostConn.open) this.hostConn.send({ t: 'hit', tgt: targetPeerId, d: dmg }); }
  sendPickup(id) { if (this.hostConn && this.hostConn.open) this.hostConn.send({ t: 'pk', id }); }
  sendTransform(tgt, ft, dur, dmg) { if (this.hostConn && this.hostConn.open) this.hostConn.send({ t: 'tf', tgt, ft, dur, dmg }); }

  // host -> todos
  broadcast(world) {
    const msg = { t: 'w', ...world };
    for (const c of this.conns.values()) if (c.open) c.send(msg);
  }

  destroy() {
    for (const c of this.conns.values()) { try { c.close(); } catch {} }
    if (this.hostConn) { try { this.hostConn.close(); } catch {} }
  }
}
