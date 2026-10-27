import * as THREE from 'three';
import { rng } from './util';

// Every texture in the city is painted procedurally on a canvas, so the site ships no image assets.

function canvas(w: number, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function tex(c: HTMLCanvasElement, srgb: boolean, aniso: number) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shade(hex: string, f: number) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, f);
  return `#${c.getHexString()}`;
}

function grain(x: CanvasRenderingContext2D, w: number, h: number, n: number, alpha: number, r: () => number) {
  for (let i = 0; i < n; i++) {
    x.fillStyle = r() < 0.5 ? `rgba(255,255,255,${alpha * r()})` : `rgba(0,0,0,${alpha * r()})`;
    const s = 1 + r() * 3;
    x.fillRect(r() * w, r() * h, s, s);
  }
}

export type FacadeSpec = {
  frame: string;
  glass: string;
  spandrel?: string;
  style: 'curtain' | 'punched' | 'brick' | 'ribbon';
  winW?: number;
  winH?: number;
  lit: number;
  seed: number;
};

export type FacadeMaps = { map: THREE.Texture; emissiveMap: THREE.Texture; rmMap: THREE.Texture };

/** Paints one 8 x 8 window tile: albedo, lit-window emission, and roughness/metalness (glTF G/B channels). */
export function makeFacade(spec: FacadeSpec, size: number, aniso: number): FacadeMaps {
  const r = rng(spec.seed);
  const [ac, a] = canvas(size);
  const [ec, e] = canvas(size);
  const [mc, m] = canvas(size);
  const cell = size / 8;

  a.fillStyle = spec.frame;
  a.fillRect(0, 0, size, size);
  e.fillStyle = '#000';
  e.fillRect(0, 0, size, size);
  m.fillStyle = spec.style === 'brick' ? 'rgb(0,235,0)' : 'rgb(0,200,10)';
  m.fillRect(0, 0, size, size);

  if (spec.style === 'brick') {
    const bh = cell / 9, bw = cell / 3.2;
    for (let y = 0; y < size; y += bh) {
      const off = (Math.round(y / bh) % 2) * bw * 0.5;
      for (let x = -bw; x < size + bw; x += bw) {
        a.fillStyle = shade(spec.frame, (r() - 0.5) * 0.08);
        a.fillRect(x + off + 1, y + 1, bw - 2, bh - 2);
      }
    }
  } else {
    grain(a, size, size, size * 6, 0.06, r);
  }

  const glassTop = shade(spec.glass, 0.12);
  for (let row = 0; row < 8; row++) {
    if (spec.style === 'curtain' && spec.spandrel) {
      a.fillStyle = spec.spandrel;
      a.fillRect(0, row * cell, size, cell * 0.24);
      m.fillStyle = 'rgb(0,60,150)';
      m.fillRect(0, row * cell, size, cell * 0.24);
    }
    for (let col = 0; col < 8; col++) {
      let x: number, y: number, w: number, h: number;
      if (spec.style === 'curtain') {
        const mull = cell * 0.05;
        x = col * cell + mull / 2; w = cell - mull;
        y = row * cell + (spec.spandrel ? cell * 0.24 : mull / 2); h = cell - (spec.spandrel ? cell * 0.24 : mull);
      } else if (spec.style === 'ribbon') {
        const mull = cell * 0.04;
        h = cell * (spec.winH ?? 0.5); y = row * cell + (cell - h) / 2;
        x = col * cell + mull / 2; w = cell - mull;
      } else {
        w = cell * (spec.winW ?? 0.55); h = cell * (spec.winH ?? 0.6);
        x = col * cell + (cell - w) / 2; y = row * cell + (cell - h) * 0.45;
      }

      const g = a.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, glassTop);
      g.addColorStop(1, spec.glass);
      a.fillStyle = g;
      a.fillRect(x, y, w, h);
      m.fillStyle = 'rgb(0,14,150)';
      m.fillRect(x, y, w, h);

      // Blinds and curtains so the windows do not look like a perfect grid.
      const blinds = r() < 0.1 ? 0.2 + r() * 0.5 : 0;
      if (blinds) {
        a.fillStyle = r() < 0.7 ? '#8f8c86' : '#7d7266';
        a.fillRect(x, y, w, h * blinds);
        a.fillStyle = 'rgba(0,0,0,0.12)';
        for (let s = y; s < y + h * blinds; s += 3) a.fillRect(x, s, w, 1);
        m.fillStyle = 'rgb(0,150,20)';
        m.fillRect(x, y, w, h * blinds);
      }

      if (r() < spec.lit) {
        const pick = r();
        const rgb = pick < 0.55 ? '255,196,120' : pick < 0.82 ? '255,232,196' : '205,222,255';
        const b = 0.45 + r() * 0.55;
        const eg = e.createLinearGradient(0, y, 0, y + h);
        eg.addColorStop(0, `rgba(${rgb},${b})`);
        eg.addColorStop(1, `rgba(${rgb},${b * 0.55})`);
        e.fillStyle = eg;
        e.fillRect(x, y, w, h);
        if (blinds) {
          e.fillStyle = 'rgba(0,0,0,0.6)';
          e.fillRect(x, y, w, h * blinds);
        }
        // Furniture and people silhouettes against the light.
        if (r() < 0.5) {
          e.fillStyle = 'rgba(0,0,0,0.55)';
          e.fillRect(x + r() * w * 0.6, y + h * 0.7, w * (0.2 + r() * 0.3), h * 0.3);
        }
      }
    }
  }

  return { map: tex(ac, true, aniso), emissiveMap: tex(ec, true, aniso), rmMap: tex(mc, false, aniso) };
}

export function makeRoof(aniso: number) {
  const r = rng(7);
  const [c, x] = canvas(512);
  x.fillStyle = '#5b5d61';
  x.fillRect(0, 0, 512, 512);
  grain(x, 512, 512, 22000, 0.18, r);
  for (let i = 0; i < 14; i++) {
    x.fillStyle = `rgba(${r() < 0.5 ? '30,30,30' : '200,200,200'},0.07)`;
    x.beginPath();
    x.ellipse(r() * 512, r() * 512, 20 + r() * 80, 20 + r() * 60, r() * 3, 0, Math.PI * 2);
    x.fill();
  }
  return tex(c, true, aniso);
}

export function makeAsphalt(aniso: number, base = '#2c2e32') {
  const r = rng(3);
  const [c, x] = canvas(512);
  x.fillStyle = base;
  x.fillRect(0, 0, 512, 512);
  grain(x, 512, 512, 30000, 0.12, r);
  x.strokeStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < 6; i++) {
    x.beginPath();
    let px = r() * 512, py = r() * 512;
    x.moveTo(px, py);
    for (let k = 0; k < 8; k++) { px += (r() - 0.5) * 60; py += (r() - 0.5) * 60; x.lineTo(px, py); }
    x.stroke();
  }
  return tex(c, true, aniso);
}

/** Queens Quay: two traffic lanes each way and a central streetcar right-of-way. 20 units long, 5.2 wide. */
export function makeRoad(aniso: number) {
  const r = rng(5);
  const W = 1024, H = 266, ppu = H / 5.2;
  const [c, x] = canvas(W, H);
  x.fillStyle = '#2b2d31';
  x.fillRect(0, 0, W, H);
  grain(x, W, H, 40000, 0.12, r);
  const zy = (z: number) => (z + 2.6) * ppu;
  x.fillStyle = '#5f5d58';
  x.fillRect(0, zy(-0.875), W, 1.75 * ppu);
  grain(x, W, H, 6000, 0.1, r);
  x.fillStyle = '#d9b43a';
  for (const z of [-0.9, 0.9]) x.fillRect(0, zy(z) - 1.5, W, 3);
  x.fillStyle = '#e8e8e2';
  for (const z of [-2.48, 2.48]) x.fillRect(0, zy(z) - 1.5, W, 3);
  for (const z of [-1.69, 1.69]) for (let s = 0; s < W; s += 128) x.fillRect(s, zy(z) - 1.5, 64, 3);
  for (const t of [-0.44, 0.44]) for (const off of [-0.187, 0.187]) {
    x.fillStyle = '#26272a'; x.fillRect(0, zy(t + off) - 3, W, 6);
    x.fillStyle = '#a5a7ab'; x.fillRect(0, zy(t + off) - 1, W, 2);
  }
  return tex(c, true, aniso);
}

export function makePavers(aniso: number, base = '#8f8b84') {
  const r = rng(9);
  const [c, x] = canvas(512);
  x.fillStyle = base;
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    x.fillStyle = shade(base, (r() - 0.5) * 0.06);
    x.fillRect(i * 128 + 2, j * 128 + 2, 124, 124);
  }
  grain(x, 512, 512, 14000, 0.1, r);
  return tex(c, true, aniso);
}

export function makeWood(aniso: number) {
  const r = rng(11);
  const [c, x] = canvas(512);
  for (let i = 0; i < 16; i++) {
    x.fillStyle = shade('#7a5a3e', (r() - 0.5) * 0.1);
    x.fillRect(0, i * 32, 512, 30);
    x.fillStyle = 'rgba(0,0,0,0.5)';
    x.fillRect(0, i * 32 + 30, 512, 2);
  }
  grain(x, 512, 512, 12000, 0.12, r);
  return tex(c, true, aniso);
}

/** Wet lane: low roughness puddles in the G channel. */
export function makeWetRoughness(aniso: number) {
  const r = rng(13);
  const [c, x] = canvas(512);
  x.fillStyle = 'rgb(0,170,0)';
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26; i++) {
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgb(0,25,0)');
    g.addColorStop(1, 'rgba(0,170,0,0)');
    x.save();
    x.translate(r() * 512, r() * 512);
    x.scale(20 + r() * 70, 10 + r() * 40);
    x.fillStyle = g;
    x.beginPath();
    x.arc(0, 0, 1, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }
  return tex(c, false, aniso);
}

export function makeGlow() {
  const [c, x] = canvas(256);
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Tileable lake normal map from integer-frequency sine waves. */
export function makeWaterNormals() {
  const S = 256;
  const r = rng(21);
  const waves = Array.from({ length: 28 }, () => {
    const kx = Math.round((r() - 0.5) * 20), ky = Math.round((r() - 0.5) * 20);
    const k = Math.hypot(kx, ky) || 1;
    return { kx, ky, a: 0.5 / k, p: r() * Math.PI * 2 };
  });
  const data = new Uint8Array(S * S * 4);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    let dx = 0, dy = 0;
    for (const w of waves) {
      const ph = 2 * Math.PI * (w.kx * i / S + w.ky * j / S) + w.p;
      const c = Math.cos(ph) * w.a * 2 * Math.PI;
      dx += c * w.kx;
      dy += c * w.ky;
    }
    const n = new THREE.Vector3(-dx * 0.05, -dy * 0.05, 1).normalize();
    const o = (j * S + i) * 4;
    data[o] = (n.x * 0.5 + 0.5) * 255;
    data[o + 1] = (n.y * 0.5 + 0.5) * 255;
    data[o + 2] = (n.z * 0.5 + 0.5) * 255;
    data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, S, S);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/** Building sign: bright letters on a dark panel, readable against any sky. */
export function makeSign(text: string, color: string, opts: { font?: string; sub?: string } = {}) {
  const font = opts.font ?? '700 120px "Space Grotesk", Inter, sans-serif';
  const [, mx] = canvas(8);
  mx.font = font;
  const tw = mx.measureText(text).width;
  const W = Math.ceil(tw + 140), H = opts.sub ? 250 : 190;
  const [c, x] = canvas(W, H);
  x.fillStyle = '#0a0d16';
  x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(255,255,255,0.08)';
  x.lineWidth = 4;
  x.strokeRect(2, 2, W - 4, H - 4);
  x.font = font;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.shadowColor = color;
  x.shadowBlur = 24;
  x.fillStyle = color;
  x.fillText(text, W / 2, opts.sub ? 100 : H / 2 + 6);
  x.shadowBlur = 0;
  x.fillStyle = '#ffffff';
  x.globalAlpha = 0.9;
  x.fillText(text, W / 2, opts.sub ? 100 : H / 2 + 6);
  if (opts.sub) {
    x.globalAlpha = 0.85;
    x.font = '500 48px "JetBrains Mono", monospace';
    x.fillStyle = color;
    x.fillText(opts.sub, W / 2, 195);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return { texture: t, aspect: W / H };
}

export type BillboardSpec = { kicker: string; title: string; body: string; chips: string[]; accent: string; icon: string; footer?: string };

function wrap(x: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (x.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(x: CanvasRenderingContext2D, px: number, py: number, w: number, h: number, rad: number) {
  x.beginPath();
  x.roundRect(px, py, w, h, rad);
}

/** A 16:9 project screen for Projects Lane. */
export function makeBillboard(b: BillboardSpec) {
  const W = 1600, H = 900;
  const [c, x] = canvas(W, H);
  const bg = x.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0b1022');
  bg.addColorStop(1, '#151a36');
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(1220, 420, 0, 1220, 420, 560);
  glow.addColorStop(0, b.accent + '55');
  glow.addColorStop(1, b.accent + '00');
  x.fillStyle = glow;
  x.fillRect(0, 0, W, H);

  x.fillStyle = b.accent;
  x.font = '500 36px "JetBrains Mono", monospace';
  x.fillText(b.kicker.toUpperCase(), 90, 130);

  x.fillStyle = '#ffffff';
  x.font = '700 92px "Space Grotesk", sans-serif';
  const tl = wrap(x, b.title, 820);
  tl.forEach((l, i) => x.fillText(l, 86, 240 + i * 100));
  let y = 240 + tl.length * 100 + 10;

  x.fillStyle = '#c9d0e8';
  x.font = '400 40px Inter, sans-serif';
  wrap(x, b.body, 820).slice(0, 3).forEach((l, i) => x.fillText(l, 90, y + i * 54));
  y += 3 * 54 + 40;

  x.font = '500 32px "JetBrains Mono", monospace';
  let cx = 90;
  for (const chip of b.chips) {
    const w = x.measureText(chip).width + 44;
    if (cx + w > 980) break;
    roundRect(x, cx, y, w, 60, 30);
    x.fillStyle = b.accent + '2a';
    x.fill();
    x.strokeStyle = b.accent;
    x.lineWidth = 2;
    x.stroke();
    x.fillStyle = '#ffffff';
    x.fillText(chip, cx + 22, y + 41);
    cx += w + 16;
  }

  if (b.footer) {
    x.fillStyle = '#8e97b8';
    x.font = '400 30px "JetBrains Mono", monospace';
    x.fillText(b.footer, 90, H - 70);
  }

  drawIcon(x, b.icon, 1230, 430, b.accent);

  x.strokeStyle = b.accent;
  x.lineWidth = 10;
  x.strokeRect(5, 5, W - 10, H - 10);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function drawIcon(x: CanvasRenderingContext2D, icon: string, cx: number, cy: number, accent: string) {
  x.save();
  x.translate(cx, cy);
  x.lineWidth = 8;
  x.strokeStyle = accent;
  x.fillStyle = accent + '33';
  const box = (px: number, py: number, w: number, h: number, r = 18) => { roundRect(x, px, py, w, h, r); x.fill(); x.stroke(); };
  if (icon === 'ecs') {
    // Load balancer feeding three containers, each with its own table.
    box(-90, -250, 180, 70);
    for (let i = -1; i <= 1; i++) {
      x.beginPath(); x.moveTo(0, -180); x.lineTo(i * 170, -90); x.stroke();
      box(i * 170 - 70, -90, 140, 110);
      x.beginPath(); x.moveTo(i * 170, 20); x.lineTo(i * 170, 80); x.stroke();
      x.beginPath(); x.ellipse(i * 170, 100, 60, 20, 0, 0, Math.PI * 2); x.fill(); x.stroke();
      x.beginPath(); x.moveTo(i * 170 - 60, 100); x.lineTo(i * 170 - 60, 170); x.ellipse(i * 170, 170, 60, 20, 0, Math.PI, 0, true); x.lineTo(i * 170 + 60, 100); x.stroke();
    }
    x.fillStyle = '#fff'; x.font = '600 30px "JetBrains Mono"'; x.textAlign = 'center';
    x.fillText('ALB', 0, -205);
    ['order', 'product', 'user'].forEach((s, i) => x.fillText(s, (i - 1) * 170, -25));
  } else if (icon === 'movie') {
    box(-230, -170, 460, 320, 24);
    for (let i = 0; i < 6; i++) { x.fillStyle = '#0b1022'; x.fillRect(-210 + i * 76, -160, 40, 26); x.fillRect(-210 + i * 76, 114, 40, 26); }
    x.fillStyle = accent; x.beginPath(); x.moveTo(-50, -70); x.lineTo(80, -10); x.lineTo(-50, 50); x.closePath(); x.fill();
    x.fillStyle = '#fff'; x.font = '600 34px "JetBrains Mono"'; x.textAlign = 'center'; x.fillText('+20% accuracy', 0, 230);
  } else if (icon === 'grocery') {
    box(-130, -260, 260, 500, 40);
    x.fillStyle = '#0b1022'; x.fillRect(-105, -210, 210, 390);
    x.strokeStyle = accent;
    for (let i = 0; i < 4; i++) { roundRect(x, -90, -190 + i * 90, 180, 70, 12); x.stroke(); }
    x.fillStyle = accent; x.beginPath(); x.arc(0, 215, 14, 0, Math.PI * 2); x.fill();
  } else if (icon === 'shop') {
    box(-260, -200, 520, 380, 20);
    x.fillStyle = '#0b1022'; x.fillRect(-240, -150, 480, 310);
    x.fillStyle = accent;
    [[-200, 60], [-120, 110], [-40, 30], [40, 150], [120, 90], [200, 190]].forEach(([px, ph]) => x.fillRect(px - 26, 140 - ph, 52, ph));
    x.fillStyle = '#fff'; [-230, -205, -180].forEach((px) => { x.beginPath(); x.arc(px, -175, 8, 0, Math.PI * 2); x.fill(); });
  } else if (icon === 'image') {
    box(-250, -200, 500, 360, 20);
    x.fillStyle = accent; x.beginPath(); x.moveTo(-220, 130); x.lineTo(-90, -40); x.lineTo(10, 70); x.lineTo(90, -10); x.lineTo(220, 130); x.closePath(); x.fill();
    x.fillStyle = '#ffd27a'; x.beginPath(); x.arc(130, -110, 40, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = 6;
    for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(-200, 210 + i * 30); x.lineTo(200, 210 + i * 30); x.stroke(); x.fillStyle = '#fff'; x.beginPath(); x.arc(-120 + i * 110, 210 + i * 30, 12, 0, Math.PI * 2); x.fill(); }
  }
  x.restore();
}

/** Side of a red-and-white streetcar; the window band doubles as the night emissive map. */
export function makeStreetcar() {
  const [c, x] = canvas(1024, 128);
  x.fillStyle = '#c8202f';
  x.fillRect(0, 0, 1024, 128);
  x.fillStyle = '#f2f2ee';
  x.fillRect(0, 92, 1024, 14);
  x.fillStyle = '#1b2026';
  for (let i = 0; i < 12; i++) x.fillRect(20 + i * 84, 22, 70, 52);
  const [ec, e] = canvas(1024, 128);
  e.fillStyle = '#000';
  e.fillRect(0, 0, 1024, 128);
  e.fillStyle = '#ffe2b0';
  for (let i = 0; i < 12; i++) e.fillRect(20 + i * 84, 22, 70, 52);
  const a = new THREE.CanvasTexture(c), b = new THREE.CanvasTexture(ec);
  a.colorSpace = b.colorSpace = THREE.SRGBColorSpace;
  return { map: a, emissiveMap: b };
}
