import * as THREE from 'three';
import { tex } from './Textures';

let gradient: THREE.DataTexture | null = null;
export function toonGradient() {
  if (gradient) return gradient;
  // 4-band ramp, slightly lifted shadows so dark scenes still read
  const data = new Uint8Array([46, 46, 46, 255, 110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

const cache = new Map<string, THREE.Material>();

export interface ToonOpts {
  color?: number | THREE.Color;
  map?: string;
  repeat?: number;
  emissive?: number | THREE.Color;
  emissiveIntensity?: number;
  emissiveMap?: string;
  vertexColors?: boolean;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
  key?: string;
  depthWrite?: boolean;
}

export function toon(o: ToonOpts = {}): THREE.MeshToonMaterial {
  const key =
    o.key ??
    JSON.stringify([
      o.color instanceof THREE.Color ? o.color.getHex() : o.color,
      o.map, o.repeat, o.emissive instanceof THREE.Color ? o.emissive.getHex() : o.emissive,
      o.emissiveIntensity, o.emissiveMap, o.vertexColors, o.transparent, o.opacity, o.side, o.depthWrite,
    ]);
  const c = cache.get(key);
  if (c) return c as THREE.MeshToonMaterial;
  const m = new THREE.MeshToonMaterial({
    color: o.color ?? 0xffffff,
    gradientMap: toonGradient(),
    vertexColors: !!o.vertexColors,
    transparent: !!o.transparent,
    opacity: o.opacity ?? 1,
    side: o.side ?? THREE.FrontSide,
  });
  if (o.map) m.map = tex(o.map, o.repeat ?? 1);
  if (o.emissive !== undefined) {
    m.emissive = new THREE.Color(o.emissive as any);
    m.emissiveIntensity = o.emissiveIntensity ?? 1;
  }
  if (o.emissiveMap) {
    m.emissiveMap = tex(o.emissiveMap, o.repeat ?? 1);
    if (o.emissive === undefined) m.emissive = new THREE.Color(1, 1, 1);
    m.emissiveIntensity = o.emissiveIntensity ?? 2;
  }
  if (o.depthWrite === false) m.depthWrite = false;
  cache.set(key, m);
  return m;
}

/** Unlit HDR glow material (values >1 bloom). */
export function glow(color: number | THREE.Color, intensity = 3, opts: { transparent?: boolean; opacity?: number; additive?: boolean; vertexColors?: boolean; side?: THREE.Side } = {}) {
  const col = new THREE.Color(color as any);
  const key = 'glow:' + col.getHexString() + ':' + intensity + ':' + JSON.stringify(opts);
  const c = cache.get(key);
  if (c) return c as THREE.MeshBasicMaterial;
  const m = new THREE.MeshBasicMaterial({
    color: col.clone().multiplyScalar(intensity),
    transparent: !!opts.transparent || !!opts.additive,
    opacity: opts.opacity ?? 1,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: !(opts.additive || opts.transparent),
    vertexColors: !!opts.vertexColors,
    side: opts.side ?? THREE.FrontSide,
    fog: !opts.additive,
  });
  cache.set(key, m);
  return m;
}

/** Ensure geometry has position, normal, uv and color so it can be merged with others. */
export function normalizeGeo(g: THREE.BufferGeometry, color?: THREE.Color): THREE.BufferGeometry {
  let geo = g.index ? g.toNonIndexed() : g;
  if (geo === g) geo = g.clone();
  const n = geo.attributes.position.count;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  const c = color ?? new THREE.Color(1, 1, 1);
  const cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) geo.deleteAttribute(k);
  geo.morphAttributes = {};
  geo.clearGroups();
  return geo;
}
