// Jubis Fire — sons gerados por código (Web Audio, sem arquivos).
// initAudio() deve ser chamado num gesto do usuário (clique) para liberar o áudio.

let ctx = null;
let noiseBuf = null;

export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function noise(dur) {
  if (!noiseBuf) {
    const n = ctx.sampleRate * 1.0;
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  return src;
}

export function playShoot() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = noise();
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2200, t); lp.frequency.exponentialRampToValueAtTime(400, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  src.connect(lp); lp.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + 0.18);
}

export function playPain() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.25);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + 0.32);
}

export function playPickup() {
  if (!ctx) return;
  const t = ctx.currentTime;
  [660, 990].forEach((f, i) => {
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
    const g = ctx.createGain();
    const s = t + i * 0.08;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.18, s + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.09);
    o.connect(g); g.connect(ctx.destination);
    o.start(s); o.stop(s + 0.1);
  });
}

export function playGrenade() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = noise();
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(350, t); bp.frequency.exponentialRampToValueAtTime(1200, t + 0.2);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
  src.connect(bp); bp.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + 0.26);
}

export function playExplosion() {
  if (!ctx) return;
  const t = ctx.currentTime;
  // estouro: ruído grave decaindo
  const src = noise();
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1000, t); lp.frequency.exponentialRampToValueAtTime(120, t + 0.5);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  src.connect(lp); lp.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + 0.62);
  // baque grave (sine descendo)
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.4);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.55, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  o.connect(g2); g2.connect(ctx.destination);
  o.start(t); o.stop(t + 0.46);
}

export function playDeath() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(520, t);
  o.frequency.exponentialRampToValueAtTime(150, t + 0.65);
  // vibrato (grito trêmulo)
  const lfo = ctx.createOscillator(); lfo.frequency.value = 14;
  const lg = ctx.createGain(); lg.gain.value = 28; lfo.connect(lg); lg.connect(o.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.05);
  g.gain.setValueAtTime(0.3, t + 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);
  o.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + 0.74); lfo.start(t); lfo.stop(t + 0.74);
}

export function playSmash() {
  if (!ctx) return;
  const t = ctx.currentTime;
  // baque grave + estalo
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.32);
  const src = noise(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
  const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.4, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(lp); lp.connect(g2); g2.connect(ctx.destination); src.start(t); src.stop(t + 0.14);
}

export function playSlash() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = noise();
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.2;
  bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(3800, t + 0.12); // corte no ar (sobe)
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
  src.connect(bp); bp.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + 0.16);
}

export function playIce() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'triangle';
  o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.3);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.37);
  const src = noise(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
  const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.12, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  src.connect(hp); hp.connect(g2); g2.connect(ctx.destination); src.start(t); src.stop(t + 0.27);
}

export function playSpray() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = noise();
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2200; // chiado do spray
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.13, t + 0.03);
  g.gain.setValueAtTime(0.1, t + 0.28);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  src.connect(hp); hp.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + 0.44);
}

export function playHeal() {
  if (!ctx) return;
  const t = ctx.currentTime;
  [523, 659, 880].forEach((f, i) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain(); const s = t + i * 0.08;
    g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.18, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.2);
    o.connect(g); g.connect(ctx.destination); o.start(s); o.stop(s + 0.22);
  });
}

export function playEmpty() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 180;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  o.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + 0.07);
}
