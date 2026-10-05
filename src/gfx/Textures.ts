import * as THREE from 'three';
import { fbm, rng, tnoise, clamp } from '../core/math';

const cache = new Map<string, THREE.Texture>();

function canvas(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}
function toTex(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}
type RGB = [number, number, number];
function pix(size: number, fn: (x: number, y: number, u: number, v: number) => RGB) {
  const c = canvas(size);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const [r, g, b] = fn(x, y, x / size, y / size);
      const i = (y * size + x) * 4;
      d[i] = clamp(r, 0, 255);
      d[i + 1] = clamp(g, 0, 255);
      d[i + 2] = clamp(b, 0, 255);
      d[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a: RGB, s: number): RGB => [a[0] * s, a[1] * s, a[2] * s];

// tileable fbm in [0,1] for texture coords u,v
const tf = (u: number, v: number, scale: number, oct = 4, seed = 0) => fbm(u * scale, v * scale, oct, seed, scale);

const gens: Record<string, () => THREE.Texture> = {
  metal: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const n = tf(u, v, 8, 4, 1);
        const scratch = tnoise(u * 64, v * 4, 64, 3) > 0.82 ? 0.15 : 0;
        const seam = x % 128 < 2 || y % 128 < 2 ? 0.45 : 1;
        const rx = x % 128, ry = y % 128;
        const rivet = [8, 120].some((a) => [8, 120].some((b) => (rx - a) ** 2 + (ry - b) ** 2 < 10)) ? 1.5 : 1;
        const b = (0.45 + n * 0.35 + scratch) * seam * rivet;
        return mul([150, 158, 168], b);
      }),
    ),
  rust: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const n = tf(u, v, 6, 5, 2);
        const r = tf(u, v, 3, 3, 9);
        const base: RGB = mix([110, 112, 118], [120, 60, 30], clamp((r - 0.4) * 3, 0, 1));
        const seam = y % 64 < 2 ? 0.5 : 1;
        return mul(base, (0.6 + n * 0.6) * seam);
      }),
    ),
  grate: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const gx = x % 32, gy = y % 32;
        const bar = gx < 6 || gy < 6;
        const n = tf(u, v, 8, 3, 3);
        if (bar) return mul([130, 135, 140], 0.7 + n * 0.5);
        return mul([20, 22, 26], 0.6 + n * 0.6);
      }),
    ),
  plate: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        // diamond plate
        const n = tf(u, v, 8, 3, 4);
        const a = ((x + y) % 32) - 16, b = ((x - y + 256) % 32) - 16;
        const dia = Math.abs(a) < 3 && Math.abs(b) < 9 ? 1.25 : 1;
        return mul([125, 130, 138], (0.55 + n * 0.4) * dia);
      }),
    ),
  concrete: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const n = tf(u, v, 8, 5, 5);
        const s = tnoise(u * 128, v * 128, 128, 6);
        const crack = Math.abs(tf(u, v, 4, 4, 77) - 0.5) < 0.01 ? 0.5 : 1;
        return mul([128, 126, 122], (0.55 + n * 0.45 + s * 0.1) * crack);
      }),
    ),
  asphalt: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const n = tf(u, v, 16, 4, 6);
        const s = tnoise(u * 256, v * 256, 256, 7);
        const crack = Math.abs(tf(u, v, 3, 5, 78) - 0.5) < 0.012 ? 0.45 : 1;
        const lane = x > 122 && x < 134 && y % 128 < 70 ? 1 : 0;
        const base: RGB = lane ? [190, 170, 90] : [52, 54, 58];
        return mul(base, (0.7 + n * 0.4 + s * 0.15) * crack);
      }),
    ),
  sidewalk: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const n = tf(u, v, 8, 4, 8);
        const seam = x % 64 < 2 || y % 64 < 2 ? 0.55 : 1;
        return mul([118, 116, 112], (0.65 + n * 0.4) * seam);
      }),
    ),
  brick: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const row = Math.floor(y / 16);
        const off = row % 2 ? 16 : 0;
        const bx = (x + off) % 32, by = y % 16;
        const mortar = bx < 2 || by < 2;
        const n = tf(u, v, 16, 3, 9);
        const id = Math.floor((x + off) / 32) * 13 + row * 7;
        const tone = 0.75 + (Math.sin(id * 12.9898) * 0.5 + 0.5) * 0.35;
        if (mortar) return mul([90, 88, 84], 0.7 + n * 0.3);
        return mul([120, 58, 46], tone * (0.7 + n * 0.4));
      }),
    ),
  tile: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const g = x % 32 < 2 || y % 32 < 2;
        const n = tf(u, v, 8, 3, 10);
        const dirt = tf(u, v, 3, 4, 11);
        if (g) return mul([110, 120, 125], 0.8 + n * 0.2);
        return mul([210, 222, 228], 0.82 + n * 0.12 - Math.max(0, dirt - 0.6) * 0.8);
      }),
    ),
  ice: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const n = tf(u, v, 4, 5, 12);
        const c1 = Math.abs(tf(u, v, 3, 4, 13) - 0.5);
        const c2 = Math.abs(tf(u, v, 6, 3, 14) - 0.5);
        const crack = c1 < 0.012 || c2 < 0.008 ? 1 : 0;
        const base = mix([150, 185, 210], [210, 230, 245], n);
        return crack ? [235, 245, 255] : mul(base, 0.85 + n * 0.2);
      }),
    ),
  snow: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const n = tf(u, v, 8, 4, 15);
        return mul([215, 222, 232], 0.8 + n * 0.25);
      }),
    ),
  grass: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const n = tf(u, v, 8, 4, 16);
        const s = tnoise(u * 128, v * 128, 128, 17);
        return mix([38, 70, 34], [70, 110, 48], n * 0.8 + s * 0.3);
      }),
    ),
  soil: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const n = tf(u, v, 8, 5, 18);
        const row = Math.sin(v * Math.PI * 16) * 0.5 + 0.5;
        return mul([78, 58, 40], 0.6 + n * 0.5 + row * 0.15);
      }),
    ),
  wood: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const plank = Math.floor(x / 32);
        const n = tnoise(u * 4 + plank * 3.1, v * 64, 64, 19);
        const seam = x % 32 < 2 ? 0.45 : 1;
        return mul([112, 76, 48], (0.7 + n * 0.4) * seam);
      }),
    ),
  container: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const rib = Math.sin(u * Math.PI * 2 * 8);
        const n = tf(u, v, 6, 4, 20);
        const rust = clamp((tf(u, v, 3, 4, 21) - 0.55) * 3, 0, 1);
        const base = mix([150, 56, 40], [90, 48, 30], rust);
        return mul(base, 0.75 + rib * 0.18 + n * 0.25);
      }),
    ),
  facade: () => {
    const c = pix(256, (x, y, u, v) => {
      const n = tf(u, v, 4, 4, 22);
      const wx = x % 64, wy = y % 64;
      const win = wx > 12 && wx < 52 && wy > 14 && wy < 50;
      const frame = !win && wx > 8 && wx < 56 && wy > 10 && wy < 54;
      if (win) return mul([26, 32, 40], 0.7 + n * 0.5);
      if (frame) return mul([70, 72, 76], 0.8 + n * 0.3);
      return mul([96, 92, 88], 0.6 + n * 0.5);
    });
    return toTex(c);
  },
  facadeLit: () => {
    const r = rng(77);
    const lit = Array.from({ length: 16 }, () => r() < 0.18);
    const c = pix(256, (x, y) => {
      const wx = x % 64, wy = y % 64;
      const idx = Math.floor(x / 64) + Math.floor(y / 64) * 4;
      const win = wx > 12 && wx < 52 && wy > 14 && wy < 50;
      if (win && lit[idx]) return idx % 3 === 0 ? [255, 170, 80] : [90, 220, 255];
      return [0, 0, 0];
    });
    return toTex(c);
  },
  hazard: () =>
    toTex(
      pix(128, (x, y, u, v) => {
        const s = ((x + y) % 64) < 32;
        const n = tf(u, v, 4, 3, 23);
        return mul(s ? [220, 180, 30] : [25, 25, 25], 0.75 + n * 0.3);
      }),
    ),
  carpet: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const n = tf(u, v, 16, 3, 24);
        const cx = (x % 64) - 32, cy = (y % 64) - 32;
        const r = Math.abs(cx) + Math.abs(cy);
        const motif = r > 20 && r < 24 ? 1 : r < 6 ? 1 : 0;
        const border = x % 64 < 3 || y % 64 < 3;
        const base: RGB = motif || border ? [160, 120, 50] : [96, 18, 30];
        return mul(base, 0.75 + n * 0.3);
      }),
    ),
  marble: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const check = (Math.floor(x / 128) + Math.floor(y / 128)) % 2 === 0;
        const vein = Math.abs(Math.sin((u + tf(u, v, 4, 5, 25) * 0.8) * 14));
        const vv = vein < 0.08 ? 0.75 : 1;
        const base: RGB = check ? [220, 215, 205] : [30, 30, 36];
        return mul(base, vv * (0.9 + tf(u, v, 8, 3, 26) * 0.15));
      }),
    ),
  panel: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const n = tf(u, v, 8, 3, 27);
        const px = x % 128, py = y % 256;
        const seam = px < 2 || py < 2 || (py > 180 && py < 183);
        const strip = py > 200 && py < 208 && px > 16 && px < 112;
        if (strip) return [40, 60, 70];
        return mul([68, 74, 86], (seam ? 0.45 : 1) * (0.75 + n * 0.3));
      }),
    ),
  panelGlow: () =>
    toTex(
      pix(256, (x, y) => {
        const px = x % 128, py = y % 256;
        const strip = py > 200 && py < 208 && px > 16 && px < 112;
        return strip ? [60, 220, 255] : [0, 0, 0];
      }),
    ),
  labPanel: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const n = tf(u, v, 8, 3, 28);
        const px = x % 128, py = y % 128;
        const seam = px < 2 || py < 2;
        return mul([200, 208, 214], (seam ? 0.6 : 1) * (0.82 + n * 0.15));
      }),
    ),
  moss: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const n = tf(u, v, 8, 5, 29);
        return mix([30, 50, 26], [80, 110, 50], n);
      }),
    ),
  leaves: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const n = tf(u, v, 12, 4, 30);
        const s = tnoise(u * 64, v * 64, 64, 31);
        return mix([26, 60, 30], [90, 140, 60], n * 0.7 + s * 0.4);
      }),
    ),
  bark: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const n = tnoise(u * 16, v * 2, 16, 32);
        const m = tf(u, v, 8, 3, 33);
        return mul([80, 60, 44], 0.55 + n * 0.4 + m * 0.2);
      }),
    ),
  sand: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const n = tf(u, v, 8, 4, 34);
        return mul([150, 140, 110], 0.7 + n * 0.35);
      }),
    ),
  glassTile: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const n = tf(u, v, 8, 3, 35);
        const g = x % 64 < 3 || y % 64 < 3;
        return g ? [40, 46, 52] : mul([60, 90, 110], 0.8 + n * 0.3);
      }),
    ),
  frost: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const n = tf(u, v, 6, 5, 36);
        const f = tnoise(u * 64, v * 64, 64, 37);
        const seam = x % 128 < 2 || y % 128 < 2 ? 0.6 : 1;
        return mul(mix([120, 140, 160], [220, 235, 250], n * 0.7 + f * 0.3), seam);
      }),
    ),
  coral: () =>
    toTex(
      pix(256, (x, y, u, v) => {
        const n = tf(u, v, 10, 4, 38);
        return mix([30, 60, 70], [60, 110, 115], n);
      }),
    ),
};

export function tex(name: keyof typeof gens | string, repeat = 1): THREE.Texture {
  const key = name + '@' + repeat;
  let t = cache.get(key);
  if (t) return t;
  let base = cache.get(name + '@1');
  if (!base) {
    const g = gens[name];
    if (!g) throw new Error('No texture ' + name);
    base = g();
    cache.set(name + '@1', base);
  }
  if (repeat === 1) return base;
  t = base.clone();
  t.repeat.set(repeat, repeat);
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
}

/** Radial glow sprite texture */
export function glowTexture() {
  const k = 'glow';
  let t = cache.get(k);
  if (t) return t;
  const c = canvas(128);
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  t = toTex(c, false);
  cache.set(k, t);
  return t;
}

/** Text texture (signage) */
export function textTexture(text: string, opts: { w?: number; h?: number; color?: string; bg?: string; font?: string } = {}) {
  const w = opts.w ?? 512, h = opts.h ?? 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = opts.bg ?? 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = opts.color ?? '#fff';
  ctx.font = opts.font ?? `bold ${Math.floor(h * 0.55)}px "Chakra Petch", "Arial Narrow", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
