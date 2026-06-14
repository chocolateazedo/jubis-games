// Jubis Fire — texturas geradas por código (sem arquivos externos).
// Cada função desenha num <canvas> e devolve { map, canvas }. A partir do
// canvas dá pra gerar um normal map (relevo) para a luz pegar melhor.

import * as THREE from 'three';

const SIZE = 256;

function canvas() { const c = document.createElement('canvas'); c.width = c.height = SIZE; return c; }

export function toTex(canvasEl, srgb = true) {
  const t = new THREE.CanvasTexture(canvasEl);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

function speckle(x, n, alpha) {
  for (let i = 0; i < n; i++) {
    const g = Math.floor(Math.random() * 80);
    x.fillStyle = `rgba(${g},${g},${g},${alpha})`;
    const s = Math.random() * 2 + 0.5;
    x.fillRect(Math.random() * SIZE, Math.random() * SIZE, s, s);
  }
}

export function concrete(base = '#bdc4d0') {
  const c = canvas(), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 26; i++) { // manchas suaves
    x.globalAlpha = 0.05; x.fillStyle = Math.random() < 0.5 ? '#000' : '#fff';
    x.beginPath(); x.arc(Math.random() * SIZE, Math.random() * SIZE, 12 + Math.random() * 36, 0, 7); x.fill();
  }
  x.globalAlpha = 1; speckle(x, 2600, 0.06);
  return c;
}

export function tiles(base = '#9aa3b2', line = '#5f6878') {
  const c = canvas(), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, SIZE, SIZE);
  speckle(x, 1800, 0.05);
  x.strokeStyle = line; x.lineWidth = 3;
  const n = 4, step = SIZE / n;
  for (let i = 0; i <= n; i++) {
    x.beginPath(); x.moveTo(i * step, 0); x.lineTo(i * step, SIZE);
    x.moveTo(0, i * step); x.lineTo(SIZE, i * step); x.stroke();
  }
  return c;
}

export function wood(base = '#9c6b3f') {
  const c = canvas(), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, SIZE, SIZE);
  for (let i = 1; i < 5; i++) { x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(i * SIZE / 5, 0, 2, SIZE); } // tábuas
  for (let i = 0; i < 220; i++) { // veios
    x.strokeStyle = `rgba(${60 + Math.random() * 40},${30 + Math.random() * 25},10,0.12)`;
    const y = Math.random() * SIZE; x.beginPath(); x.moveTo(0, y);
    x.bezierCurveTo(SIZE / 3, y + (Math.random() * 8 - 4), 2 * SIZE / 3, y + (Math.random() * 8 - 4), SIZE, y); x.stroke();
  }
  return c;
}

export function metal(base = '#5a6479') {
  const c = canvas(), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 1500; i++) { x.strokeStyle = 'rgba(255,255,255,0.03)'; const y = Math.random() * SIZE; x.beginPath(); x.moveTo(0, y); x.lineTo(SIZE, y); x.stroke(); }
  x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 4; x.strokeRect(6, 6, SIZE - 12, SIZE - 12);
  return c;
}

export function grass(base = '#4f8f46') {
  const c = canvas(), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 6000; i++) {
    x.fillStyle = Math.random() < 0.5 ? 'rgba(40,90,35,0.5)' : 'rgba(120,170,80,0.4)';
    x.fillRect(Math.random() * SIZE, Math.random() * SIZE, 2, 3);
  }
  return c;
}

// ---- estilo Backrooms ----
export function wallpaper(base = '#c2c06f', motif = '#a7ac56', light = '#d4d28a') {
  const c = canvas(), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, SIZE, SIZE);
  const cols = 6, cw = SIZE / cols;
  for (let i = 0; i < cols; i++) {
    const cx = i * cw + cw / 2;
    x.globalAlpha = 0.3; x.fillStyle = light; x.fillRect(i * cw + cw * 0.42, 0, cw * 0.16, SIZE); x.globalAlpha = 1;
    x.strokeStyle = motif; x.lineWidth = 2; x.fillStyle = motif;
    for (let y = 6; y < SIZE; y += 20) {
      x.beginPath(); x.moveTo(cx - cw * 0.32, y + 9); x.lineTo(cx, y); x.lineTo(cx + cw * 0.32, y + 9); x.stroke();
      x.beginPath(); x.arc(cx, y + 13, 2.4, 0, 7); x.fill();
    }
  }
  return c;
}

export function carpet(base = '#d2b24a') {
  const c = canvas(), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 9000; i++) {
    x.fillStyle = Math.random() < 0.5 ? 'rgba(150,120,40,0.35)' : 'rgba(225,200,120,0.3)';
    x.fillRect(Math.random() * SIZE, Math.random() * SIZE, 2, 2);
  }
  return c;
}

export function ceilingTile(base = '#dbd492') {
  const c = canvas(), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 5000; i++) { x.fillStyle = 'rgba(120,115,70,0.22)'; x.fillRect(Math.random() * SIZE, Math.random() * SIZE, 1.5, 1.5); }
  x.strokeStyle = 'rgba(95,90,52,0.65)'; x.lineWidth = 5; x.strokeRect(0, 0, SIZE, SIZE);
  return c;
}

export function plaster(base = '#ece3c8') {
  const c = canvas(), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, SIZE, SIZE);
  speckle(x, 1400, 0.03);
  for (let i = 0; i < 10; i++) { x.globalAlpha = 0.03; x.fillStyle = '#000'; x.beginPath(); x.arc(Math.random() * SIZE, Math.random() * SIZE, 20 + Math.random() * 28, 0, 7); x.fill(); }
  x.globalAlpha = 1; return c;
}

// gera um normal map a partir do brilho do canvas de cor (relevo)
export function normalFromCanvas(srcCanvas, strength = 2.2) {
  const s = SIZE;
  const src = srcCanvas.getContext('2d').getImageData(0, 0, s, s).data;
  const out = canvas(), octx = out.getContext('2d');
  const img = octx.createImageData(s, s), o = img.data;
  const lum = (px) => (src[px] * 0.299 + src[px + 1] * 0.587 + src[px + 2] * 0.114) / 255;
  const at = (x, y) => (((y + s) % s) * s + ((x + s) % s)) * 4;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = (lum(at(x - 1, y)) - lum(at(x + 1, y))) * strength;
      const dy = (lum(at(x, y - 1)) - lum(at(x, y + 1))) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * s + x) * 4;
      o[i] = (dx / len * 0.5 + 0.5) * 255;
      o[i + 1] = (dy / len * 0.5 + 0.5) * 255;
      o[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      o[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return toTex(out, false);
}

// ajusta a repetição das texturas de uma malha conforme o tamanho dela
export function tileMaps(mesh, worldPerTile) {
  const g = mesh.geometry.parameters || {};
  const dims = [g.width || 1, g.height || 1, g.depth || 1].sort((a, b) => b - a);
  const mat = mesh.material.clone();
  for (const k of ['map', 'normalMap', 'roughnessMap']) {
    if (mat[k]) {
      const t = mat[k].clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(dims[0] / worldPerTile, dims[1] / worldPerTile);
      t.needsUpdate = true;
      mat[k] = t;
    }
  }
  mesh.material = mat;
}
