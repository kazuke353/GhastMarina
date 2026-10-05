import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonGradient } from '../gfx/Materials';
import { rng, rrange } from '../core/math';

export type HairStyle =
  | 'none' | 'short' | 'messy' | 'long' | 'ponytail' | 'buzz' | 'bun' | 'bob' | 'slick' | 'mohawk' | 'braid' | 'wild' | 'tied';
export type TopStyle = 'jacket' | 'coat' | 'labcoat' | 'hoodie' | 'vest' | 'tshirt' | 'suit' | 'jumpsuit' | 'poncho' | 'shawl' | 'tactical' | 'overalls' | 'uniform' | 'rags';
export type Hat = 'none' | 'fedora' | 'beanie' | 'cap' | 'goggles' | 'headphones' | 'captain' | 'helmet' | 'hood';
export type Mutation =
  | 'tumor' | 'shield' | 'pipes' | 'fins' | 'vines' | 'ice' | 'bigHead' | 'claws' | 'torch' | 'mask' | 'riotHelmet'
  | 'gills' | 'spores' | 'armor' | 'bloat' | 'hazmat' | 'lantern' | 'leaves' | 'brain' | 'hydraulic' | 'tanks' | 'trafficLight' | 'carDoor' | 'crystalSpine';

export interface Look {
  skin: number;
  hair: number;
  hairStyle: HairStyle;
  top: number;
  topStyle: TopStyle;
  under?: number; // shirt color under jacket
  bottom: number;
  shoes: number;
  accent?: number;
  height?: number;
  build?: number;
  female?: boolean;
  glasses?: number | null;
  beard?: boolean;
  hat?: Hat;
  hatColor?: number;
  extras?: string[];
  eye?: number;
  eyeGlow?: boolean;
  mutations?: Mutation[];
  band?: boolean; // GloomBand
  bandColor?: number;
  zombie?: boolean;
  glowColor?: number;
  seed?: number;
}

export const BONES = [
  'root', 'hips', 'spine', 'chest', 'neck', 'head',
  'shoulderL', 'upperArmL', 'foreArmL', 'handL',
  'shoulderR', 'upperArmR', 'foreArmR', 'handR',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR',
] as const;
export type BoneName = (typeof BONES)[number];

export interface CharacterModel {
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  bones: Record<BoneName, THREE.Bone>;
  rest: Record<BoneName, THREE.Vector3>;
  material: THREE.MeshToonMaterial;
  glowMaterial: THREE.MeshBasicMaterial | null;
  height: number;
  scale: number;
  look: Look;
}

interface Part {
  bone: number;
  geo: THREE.BufferGeometry;
  glow: boolean;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();

class PartBuilder {
  parts: Part[] = [];
  constructor(private boneWorld: Record<string, THREE.Vector3>, private boneIndex: Record<string, number>) {}
  add(
    bone: BoneName,
    g: THREE.BufferGeometry,
    color: number | THREE.Color,
    pos: [number, number, number] = [0, 0, 0],
    rot: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1],
    glow = false,
  ) {
    const geo = g.index ? g.toNonIndexed() : g.clone();
    tmpE.set(rot[0], rot[1], rot[2]);
    tmpQ.setFromEuler(tmpE);
    tmpS.set(scale[0], scale[1], scale[2]);
    const bw = this.boneWorld[bone];
    tmpP.set(pos[0] + bw.x, pos[1] + bw.y, pos[2] + bw.z);
    tmpM.compose(tmpP, tmpQ, tmpS);
    geo.applyMatrix4(tmpM);
    const n = geo.attributes.position.count;
    const c = new THREE.Color(color as any);
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const bi = this.boneIndex[bone];
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      si[i * 4] = bi;
      sw[i * 4] = 1;
    }
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv', 'color', 'skinIndex', 'skinWeight'].includes(k)) geo.deleteAttribute(k);
    this.parts.push({ bone: bi, geo, glow });
  }
}

// shared primitive geometries (low poly for toon look)
const G = {
  sphere: new THREE.SphereGeometry(1, 12, 9),
  sphereHi: new THREE.SphereGeometry(1, 16, 12),
  hemi: new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  capsule: new THREE.CapsuleGeometry(1, 1, 3, 10),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 6),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  torus: new THREE.TorusGeometry(1, 0.25, 6, 14),
};

const capCache = new Map<number, THREE.BufferGeometry>();
/** Unit-radius capsule whose total height is k radii. Scale by (rx, r, rz) to get height k*r. */
function capK(k: number) {
  const key = Math.round(k * 20) / 20;
  let g = capCache.get(key);
  if (!g) {
    g = new THREE.CapsuleGeometry(1, Math.max(0.001, key - 2), 3, 10);
    capCache.set(key, g);
  }
  return g;
}
/** Capsule part spec: total height h along local Y, radii rx/rz. Returns [geo, scale]. */
function cap(h: number, rx: number, rz = rx): [THREE.BufferGeometry, [number, number, number]] {
  const r = Math.min(rx, rz, h / 2);
  return [capK(h / r), [rx, r, rz]];
}

export function shade(c: number, k: number) {
  const col = new THREE.Color(c);
  col.multiplyScalar(k);
  return col;
}

export function buildHumanoid(look: Look): CharacterModel {
  const H = look.height ?? 1;
  const W = look.build ?? 1;
  const fem = !!look.female;
  const r = rng(look.seed ?? 1);
  const shoulderW = (fem ? 0.165 : 0.19) * W;
  const hipW = (fem ? 0.105 : 0.095) * W;
  // rest bone local offsets
  const local: Record<BoneName, [number, number, number]> = {
    root: [0, 0, 0],
    hips: [0, 0.95, 0],
    spine: [0, 0.1, 0],
    chest: [0, 0.18, 0],
    neck: [0, 0.22, 0],
    head: [0, 0.08, 0],
    shoulderL: [shoulderW, 0.17, 0],
    upperArmL: [0, 0, 0],
    foreArmL: [0, -0.28, 0],
    handL: [0, -0.25, 0],
    shoulderR: [-shoulderW, 0.17, 0],
    upperArmR: [0, 0, 0],
    foreArmR: [0, -0.28, 0],
    handR: [0, -0.25, 0],
    thighL: [hipW, -0.04, 0],
    shinL: [0, -0.43, 0],
    footL: [0, -0.42, 0],
    thighR: [-hipW, -0.04, 0],
    shinR: [0, -0.43, 0],
    footR: [0, -0.42, 0],
  };
  const parent: Partial<Record<BoneName, BoneName>> = {
    hips: 'root', spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck',
    shoulderL: 'chest', upperArmL: 'shoulderL', foreArmL: 'upperArmL', handL: 'foreArmL',
    shoulderR: 'chest', upperArmR: 'shoulderR', foreArmR: 'upperArmR', handR: 'foreArmR',
    thighL: 'hips', shinL: 'thighL', footL: 'shinL', thighR: 'hips', shinR: 'thighR', footR: 'shinR',
  };
  const bones = {} as Record<BoneName, THREE.Bone>;
  const world: Record<string, THREE.Vector3> = {};
  const index: Record<string, number> = {};
  const rest = {} as Record<BoneName, THREE.Vector3>;
  BONES.forEach((n, i) => {
    const b = new THREE.Bone();
    b.name = n;
    b.position.set(...local[n]);
    rest[n] = b.position.clone();
    bones[n] = b;
    index[n] = i;
    const p = parent[n];
    if (p) bones[p].add(b);
    const pw = p ? world[p] : new THREE.Vector3();
    world[n] = pw.clone().add(new THREE.Vector3(...local[n]));
  });

  const P = new PartBuilder(world, index);
  const skin = look.skin;
  const top = look.top;
  const under = look.under ?? 0xe8e8e8;
  const bottom = look.bottom;
  const shoes = look.shoes;
  const hairC = look.hair;
  const accent = look.accent ?? 0xc0c4cc;
  const zomb = !!look.zombie;
  const muts = new Set(look.mutations ?? []);
  const ex = new Set(look.extras ?? []);
  const eyeC = look.eye ?? 0x1a1a22;
  const glowC = look.glowColor ?? 0x9fff4a;
  const ts = look.topStyle;
  const longSleeve = !['tshirt', 'vest', 'rags'].includes(ts);
  const sleeveC = ts === 'vest' ? skin : longSleeve ? top : skin;
  const fullBody = ts === 'jumpsuit' || ts === 'overalls';

  // ---- torso ----
  const chestC = ts === 'jacket' || ts === 'suit' || ts === 'labcoat' || ts === 'coat' || ts === 'uniform' ? under : top;
  { const [g, sc] = cap(0.4 * W * (fem ? 0.85 : 1), 0.13, 0.11); P.add('chest', g, chestC, [0, 0.07, 0], [0, 0, Math.PI / 2], sc); }
  P.add('chest', G.sphere, chestC, [0, 0.12, 0], [0, 0, 0], [shoulderW * 1.05, 0.11, 0.115]);
  if (fem) {
    P.add('chest', G.sphere, chestC, [0.055, 0.05, 0.075], [0, 0, 0], [0.06, 0.055, 0.05]);
    P.add('chest', G.sphere, chestC, [-0.055, 0.05, 0.075], [0, 0, 0], [0.06, 0.055, 0.05]);
  }
  { const [g, sc] = cap(0.24, 0.13 * W * (fem ? 0.9 : 1.05), 0.1); P.add('spine', g, fullBody ? top : chestC, [0, 0.06, 0], [0, 0, 0], sc); }
  // pelvis
  { const [g, sc] = cap(0.34 * W * (fem ? 1.1 : 1.0), 0.1, 0.1); P.add('hips', g, fullBody ? top : bottom, [0, 0.0, 0], [0, 0, Math.PI / 2], sc); }
  // belt
  if (!['poncho', 'labcoat', 'coat'].includes(ts) || ex.has('belt')) P.add('hips', G.cyl, ts === 'overalls' ? 0x3a2a1a : 0x1c1c20, [0, 0.07, 0], [0, 0, 0], [0.135 * W * (fem ? 1.08 : 1.0), 0.035, 0.105]);

  // jacket / coat panels
  if (['jacket', 'suit', 'coat', 'labcoat', 'uniform'].includes(ts)) {
    const jc = top;
    // side panels over chest (open front)
    P.add('chest', G.box, jc, [shoulderW * 0.55, 0.08, 0.0], [0, 0, 0], [shoulderW * 0.75, 0.3, 0.24]);
    P.add('chest', G.box, jc, [-shoulderW * 0.55, 0.08, 0.0], [0, 0, 0], [shoulderW * 0.75, 0.3, 0.24]);
    P.add('chest', G.box, jc, [0, 0.08, -0.06], [0, 0, 0], [shoulderW * 1.9, 0.3, 0.12]);
    P.add('spine', G.box, jc, [0, 0.05, -0.01], [0, 0, 0], [0.27 * W, 0.16, 0.21]);
    // lapels
    P.add('chest', G.box, shade(jc, 0.8), [0.05, 0.15, 0.115], [0, 0, -0.35], [0.04, 0.16, 0.02]);
    P.add('chest', G.box, shade(jc, 0.8), [-0.05, 0.15, 0.115], [0, 0, 0.35], [0.04, 0.16, 0.02]);
    const tail = ts === 'coat' || ts === 'labcoat' ? 0.5 : ts === 'uniform' ? 0.36 : 0.18;
    P.add('hips', G.box, jc, [0.075 * W, -tail / 2 + 0.06, 0.02], [0, 0, 0.06], [0.13 * W, tail, 0.22]);
    P.add('hips', G.box, jc, [-0.075 * W, -tail / 2 + 0.06, 0.02], [0, 0, -0.06], [0.13 * W, tail, 0.22]);
    P.add('hips', G.box, jc, [0, -tail / 2 + 0.06, -0.08], [0.06, 0, 0], [0.28 * W, tail, 0.05]);
    if (ts === 'suit') P.add('chest', G.box, accent, [0, 0.1, 0.122], [0, 0, 0], [0.035, 0.2, 0.012]); // tie
    if (ts === 'uniform') {
      // epaulettes + buttons
      P.add('chest', G.box, 0xd4a640, [shoulderW * 0.95, 0.2, 0], [0, 0, 0], [0.09, 0.025, 0.1]);
      P.add('chest', G.box, 0xd4a640, [-shoulderW * 0.95, 0.2, 0], [0, 0, 0], [0.09, 0.025, 0.1]);
      for (let i = 0; i < 4; i++) P.add('chest', G.sphere, 0xd4a640, [0.03, 0.18 - i * 0.07, 0.125], [0, 0, 0], [0.012, 0.012, 0.012]);
    }
  }
  if (ts === 'hoodie') {
    P.add('chest', G.sphere, shade(top, 0.9), [0, 0.2, -0.1], [0, 0, 0], [0.12, 0.08, 0.07]);
    P.add('chest', G.box, shade(top, 0.85), [0, -0.02, 0.11], [0, 0, 0], [0.16, 0.08, 0.03]); // pocket
  }
  if (ts === 'vest' || ts === 'tactical') {
    const vc = ts === 'tactical' ? top : accent;
    P.add('chest', G.box, vc, [0, 0.07, 0], [0, 0, 0], [shoulderW * 1.85, 0.27, 0.25]);
    if (ts === 'tactical') {
      for (let i = -1; i <= 1; i++) P.add('chest', G.box, shade(vc, 0.8), [i * 0.08, 0.0, 0.13], [0, 0, 0], [0.065, 0.08, 0.04]);
      P.add('spine', G.box, vc, [0, 0.05, 0], [0, 0, 0], [0.26 * W, 0.14, 0.22]);
    }
  }
  if (ts === 'overalls') {
    P.add('chest', G.box, top, [0, 0.0, 0.1], [0, 0, 0], [0.18, 0.18, 0.04]);
    P.add('chest', G.box, top, [0.07, 0.12, 0.08], [0, 0, 0], [0.03, 0.22, 0.04]);
    P.add('chest', G.box, top, [-0.07, 0.12, 0.08], [0, 0, 0], [0.03, 0.22, 0.04]);
  }
  if (ts === 'poncho') {
    P.add('chest', G.cone, top, [0, 0.02, 0], [0, 0, 0], [shoulderW * 1.7, 0.42, 0.2]);
    P.add('chest', G.cone, shade(top, 0.85), [0, -0.02, 0], [0, Math.PI / 6, 0], [shoulderW * 1.55, 0.4, 0.21]);
  }
  if (ts === 'shawl') {
    P.add('chest', G.torus, top, [0, 0.19, 0], [Math.PI / 2, 0, 0], [0.16 * W, 0.13, 0.35]);
    P.add('chest', G.box, top, [0, 0.06, -0.06], [0.1, 0, 0], [shoulderW * 1.9, 0.28, 0.08]);
    P.add('hips', G.cone, bottom, [0, -0.35, 0], [Math.PI, 0, 0], [0.24 * W, 0.75, 0.2]); // skirt
  }
  if (ts === 'rags') {
    P.add('chest', G.box, shade(top, 0.8), [0.05, -0.02, 0.1], [0, 0, 0.3], [0.1, 0.12, 0.03]);
  }
  if (ex.has('furCollar')) P.add('chest', G.torus, 0xf2f2f2, [0, 0.21, 0], [Math.PI / 2, 0, 0], [0.12, 0.12, 0.6]);
  if (ex.has('choker')) {
    P.add('neck', G.cyl, 0x111114, [0, 0.03, 0], [0, 0, 0], [0.052, 0.025, 0.052]);
    P.add('neck', G.sphere, 0xd8dde4, [0, 0.0, 0.06], [0, 0, 0], [0.015, 0.02, 0.01]);
  }
  if (ex.has('chains')) {
    for (let i = 0; i < 5; i++) P.add('chest', G.torus, 0xd0d6de, [-0.06 + i * 0.03, 0.12 - Math.abs(i - 2) * 0.025, 0.125], [0, 0, 0], [0.012, 0.012, 0.4]);
    for (let i = 0; i < 4; i++) P.add('hips', G.torus, 0xd0d6de, [0.13 * W, 0.0 - i * 0.03, 0.04 - i * 0.01], [0, Math.PI / 2, 0], [0.015, 0.015, 0.45]);
  }
  if (ex.has('stethoscope')) P.add('chest', G.torus, 0x30343a, [0, 0.13, 0.08], [Math.PI / 2.3, 0, 0], [0.09, 0.11, 0.25]);
  if (ex.has('dogtags')) P.add('chest', G.box, 0xc8ccd2, [0, 0.12, 0.13], [0, 0, 0], [0.025, 0.04, 0.008]);
  if (ex.has('pendantJade')) P.add('chest', G.sphere, 0x2fd48a, [0, 0.12, 0.125], [0, 0, 0], [0.02, 0.025, 0.012]);
  if (ex.has('beads')) for (let i = 0; i < 7; i++) P.add('chest', G.sphere, i % 2 ? 0x7a8cff : 0xd8c070, [Math.cos(i * 0.45 - 1.35) * 0.1, 0.14 - Math.sin(i * 0.45) * 0.06, 0.12], [0, 0, 0], [0.014, 0.014, 0.014]);
  if (ex.has('scarfChess')) {
    for (let i = 0; i < 6; i++) P.add('chest', G.box, i % 2 ? 0xf0f0f0 : 0x16161a, [0.06, 0.12 - i * 0.05, 0.125], [0, 0, 0], [0.06, 0.05, 0.02]);
    P.add('chest', G.torus, 0x16161a, [0, 0.21, 0], [Math.PI / 2, 0, 0], [0.1, 0.1, 0.45]);
  }
  if (ex.has('toolbelt')) {
    P.add('hips', G.cyl, 0x5a3a1c, [0, 0.05, 0], [0, 0, 0], [0.145 * W, 0.045, 0.115]);
    P.add('hips', G.box, 0x6a4a24, [0.12, 0.0, 0.06], [0, 0, 0], [0.06, 0.08, 0.06]);
    P.add('hips', G.box, 0x6a4a24, [-0.12, 0.0, 0.06], [0, 0, 0], [0.06, 0.08, 0.06]);
    P.add('hips', G.cyl6, 0x9aa0a8, [-0.12, 0.08, 0.06], [0, 0, 0], [0.01, 0.1, 0.01]);
  }
  if (ex.has('backpack')) P.add('chest', G.box, accent, [0, 0.02, -0.17], [0, 0, 0], [0.24, 0.3, 0.12]);
  if (ex.has('holster')) P.add('hips', G.box, 0x1c1c1c, [-0.14 * W, -0.08, 0.02], [0, 0, 0], [0.04, 0.14, 0.08]);
  if (ex.has('ringGold')) P.add('handR', G.torus, 0xe0b040, [0, -0.06, 0], [Math.PI / 2, 0, 0], [0.025, 0.025, 0.5]);
  if (ex.has('badge')) P.add('chest', G.box, 0x4fd1c5, [0.07, 0.15, 0.125], [0, 0, 0], [0.05, 0.035, 0.01]);
  if (ex.has('cardPocket')) P.add('chest', G.box, 0xf0f0f0, [-0.07, 0.17, 0.125], [0, 0, 0.2], [0.035, 0.05, 0.005]);

  // ---- neck & head ----
  P.add('neck', G.cyl, skin, [0, 0.04, 0], [0, 0, 0], [0.05, 0.12, 0.05]);
  const headS = muts.has('bigHead') ? 1.45 : 1;
  P.add('head', G.sphereHi, skin, [0, 0.1 * headS, 0], [0, 0, 0], [0.105 * headS, 0.125 * headS, 0.115 * headS]);
  P.add('head', G.sphere, skin, [0, 0.04, 0.03], [0, 0, 0], [0.08, 0.06, 0.08]); // jaw
  // ears
  P.add('head', G.sphere, skin, [0.104, 0.09, 0], [0, 0, 0], [0.018, 0.03, 0.022]);
  P.add('head', G.sphere, skin, [-0.104, 0.09, 0], [0, 0, 0], [0.018, 0.03, 0.022]);
  // face
  const eyeGlow = !!look.eyeGlow;
  const eyeY = 0.115 * headS, eyeZ = 0.1 * headS;
  for (const s of [1, -1]) {
    if (!eyeGlow && !zomb) P.add('head', G.sphere, 0xf4f4f4, [0.038 * s * headS, eyeY, eyeZ - 0.004], [0, 0, 0], [0.022, 0.016, 0.01]);
    P.add('head', G.sphere, eyeGlow ? (look.eye ?? glowC) : eyeC, [0.038 * s * headS, eyeY, eyeZ], [0, 0, 0], eyeGlow ? [0.017, 0.012, 0.01] : [0.011, 0.014, 0.01], eyeGlow);
    // brow
    P.add('head', G.box, zomb ? shade(skin, 0.6) : hairC, [0.04 * s * headS, eyeY + 0.03, eyeZ + 0.003], [0, 0, s * 0.12], [0.04, 0.008, 0.012]);
  }
  P.add('head', G.box, shade(skin, 0.92), [0, 0.085, 0.112], [0.3, 0, 0], [0.018, 0.035, 0.02]); // nose
  P.add('head', G.box, zomb ? 0x3a1010 : shade(skin, 0.55), [0, 0.042, 0.105], [0, 0, 0], [zomb ? 0.05 : 0.035, zomb ? 0.018 : 0.006, 0.01]); // mouth
  if (look.beard) {
    P.add('head', G.sphere, hairC, [0, 0.03, 0.04], [0, 0, 0], [0.085, 0.06, 0.075]);
    P.add('head', G.box, hairC, [0, 0.055, 0.1], [0, 0, 0], [0.06, 0.015, 0.02]);
  }
  if (look.glasses != null) {
    const gc = look.glasses;
    for (const s of [1, -1]) {
      P.add('head', G.box, gc, [0.04 * s, eyeY, eyeZ + 0.012], [0, 0, 0], [0.05, 0.03, 0.006]);
      P.add('head', G.box, gc, [0.095 * s, eyeY + 0.005, 0.05], [0, 0, 0], [0.006, 0.008, 0.1]);
    }
    P.add('head', G.box, gc, [0, eyeY + 0.005, eyeZ + 0.012], [0, 0, 0], [0.03, 0.007, 0.006]);
  }
  // hair
  const hs = look.hairStyle;
  const hy = 0.1 * headS;
  if (hs !== 'none') {
    const capS: [number, number, number] = hs === 'buzz' ? [0.109, 0.128, 0.119] : [0.117, 0.135, 0.127];
    P.add('head', G.hemi, hairC, [0, hy + 0.0, -0.005], [-0.25, 0, 0], capS);
    if (hs !== 'buzz') {
      P.add('head', G.sphere, hairC, [0, hy + 0.02, -0.03], [0, 0, 0], [0.115, 0.115, 0.11]); // back
      // fringe
      P.add('head', G.box, hairC, [0, hy + 0.075, 0.07], [0.5, 0, 0], [0.18, 0.04, 0.06]);
    }
    if (hs === 'messy' || hs === 'wild') {
      const n = hs === 'wild' ? 12 : 9;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const len = rrange(r, 0.07, 0.12);
        P.add('head', G.cone4, hairC, [Math.cos(a) * 0.09, hy + 0.06 + rrange(r, -0.02, 0.04), Math.sin(a) * 0.085 - 0.01], [Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2], [0.04, len, 0.04]);
      }
      // side locks past the ears
      P.add('head', G.box, hairC, [0.1, hy - 0.04, -0.01], [0, 0, 0.15], [0.03, 0.12, 0.09]);
      P.add('head', G.box, hairC, [-0.1, hy - 0.04, -0.01], [0, 0, -0.15], [0.03, 0.12, 0.09]);
      P.add('head', G.cone4, hairC, [0.03, hy + 0.06, 0.1], [1.1, 0, 0.3], [0.04, 0.1, 0.03]);
      P.add('head', G.cone4, hairC, [-0.04, hy + 0.06, 0.1], [1.2, 0, -0.2], [0.04, 0.09, 0.03]);
    }
    if (hs === 'long' || hs === 'tied') {
      P.add('head', G.box, hairC, [0, hy - 0.12, -0.07], [0.1, 0, 0], [0.22, 0.3, 0.08]);
      P.add('head', G.box, hairC, [0.1, hy - 0.06, 0.0], [0, 0, 0.05], [0.04, 0.2, 0.1]);
      P.add('head', G.box, hairC, [-0.1, hy - 0.06, 0.0], [0, 0, -0.05], [0.04, 0.2, 0.1]);
    }
    if (hs === 'ponytail' || hs === 'tied') {
      P.add('head', G.sphere, accent, [0, hy + 0.0, -0.13], [0, 0, 0], [0.025, 0.025, 0.025]);
      { const [g, sc] = cap(0.26, 0.036); P.add('head', g, hairC, [0, hy - 0.11, -0.155], [0.25, 0, 0], sc); }
    }
    if (hs === 'bun') P.add('head', G.sphere, hairC, [0, hy + 0.07, -0.11], [0, 0, 0], [0.06, 0.06, 0.06]);
    if (hs === 'bob') {
      P.add('head', G.box, hairC, [0.095, hy - 0.04, -0.01], [0, 0, 0.08], [0.04, 0.15, 0.17]);
      P.add('head', G.box, hairC, [-0.095, hy - 0.04, -0.01], [0, 0, -0.08], [0.04, 0.15, 0.17]);
      P.add('head', G.box, hairC, [0, hy - 0.04, -0.085], [0, 0, 0], [0.2, 0.15, 0.05]);
      if (ex.has('streaks')) P.add('head', G.box, accent, [0.06, hy + 0.06, 0.09], [0.5, 0, 0], [0.04, 0.04, 0.03]);
    }
    if (hs === 'slick') P.add('head', G.box, hairC, [0, hy + 0.1, -0.02], [0.2, 0, 0], [0.19, 0.04, 0.2]);
    if (hs === 'mohawk') for (let i = 0; i < 5; i++) P.add('head', G.cone4, hairC, [0, hy + 0.12, 0.08 - i * 0.05], [0, 0, 0], [0.025, 0.08, 0.04]);
    if (hs === 'braid') for (let i = 0; i < 6; i++) P.add('head', G.sphere, hairC, [0, hy - 0.06 - i * 0.055, -0.13 - i * 0.008], [0, 0, 0], [0.032, 0.035, 0.032]);
  }
  // hats
  const hat = look.hat ?? 'none';
  const hatC = look.hatColor ?? 0x222226;
  if (hat === 'fedora') {
    P.add('head', G.cyl, hatC, [0, hy + 0.1, 0], [0, 0, 0], [0.19, 0.012, 0.19]);
    P.add('head', G.cyl, hatC, [0, hy + 0.15, 0], [0, 0, 0], [0.12, 0.09, 0.12]);
    P.add('head', G.cyl, accent, [0, hy + 0.115, 0], [0, 0, 0], [0.122, 0.02, 0.122]);
  } else if (hat === 'beanie') {
    P.add('head', G.hemi, hatC, [0, hy + 0.03, -0.005], [-0.15, 0, 0], [0.124, 0.15, 0.13]);
    P.add('head', G.cyl, shade(hatC, 0.85), [0, hy + 0.04, 0], [-0.15, 0, 0], [0.126, 0.035, 0.132]);
  } else if (hat === 'cap') {
    P.add('head', G.hemi, hatC, [0, hy + 0.04, 0], [0, 0, 0], [0.12, 0.1, 0.125]);
    P.add('head', G.box, hatC, [0, hy + 0.045, 0.14], [0.1, 0, 0], [0.16, 0.01, 0.1]);
  } else if (hat === 'captain') {
    P.add('head', G.cyl, hatC, [0, hy + 0.1, 0], [0.05, 0, 0], [0.135, 0.07, 0.14]);
    P.add('head', G.cyl, hatC, [0, hy + 0.15, 0.01], [0.1, 0, 0], [0.16, 0.035, 0.17]);
    P.add('head', G.box, 0x0c0c0e, [0, hy + 0.07, 0.13], [0.3, 0, 0], [0.18, 0.012, 0.08]);
    P.add('head', G.box, 0xd4a640, [0, hy + 0.12, 0.14], [0, 0, 0], [0.04, 0.03, 0.01], true);
  } else if (hat === 'goggles') {
    P.add('head', G.cyl, 0x2a2a2a, [0, hy + 0.06, 0], [0.25, 0, 0], [0.12, 0.025, 0.128]);
    for (const s of [1, -1]) P.add('head', G.cyl, 0x8a6a3a, [0.045 * s, hy + 0.08, 0.11], [Math.PI / 2 - 0.4, 0, 0], [0.035, 0.03, 0.035]);
    for (const s of [1, -1]) P.add('head', G.cyl, 0x60c8ff, [0.045 * s, hy + 0.085, 0.125], [Math.PI / 2 - 0.4, 0, 0], [0.026, 0.01, 0.026], true);
  } else if (hat === 'headphones') {
    P.add('neck', G.torus, 0x1a1a1e, [0, -0.01, 0.02], [Math.PI / 2 + 0.3, 0, 0], [0.095, 0.095, 0.5]);
    for (const s of [1, -1]) P.add('neck', G.cyl, accent, [0.09 * s, -0.01, 0.04], [0, 0, Math.PI / 2], [0.04, 0.03, 0.04]);
  } else if (hat === 'helmet') {
    P.add('head', G.hemi, hatC, [0, hy + 0.01, 0], [0, 0, 0], [0.135, 0.14, 0.14]);
  } else if (hat === 'hood') {
    P.add('head', G.hemi, hatC, [0, hy - 0.02, -0.02], [-0.3, 0, 0], [0.135, 0.17, 0.14]);
    P.add('head', G.box, hatC, [0, hy - 0.08, -0.08], [0, 0, 0], [0.24, 0.14, 0.1]);
  }

  // ---- arms ----
  for (const side of ['L', 'R'] as const) {
    const sg = side === 'L' ? 1 : -1;
    const ua = `upperArm${side}` as BoneName, fa = `foreArm${side}` as BoneName, hd = `hand${side}` as BoneName, sh = `shoulder${side}` as BoneName;
    P.add(sh, G.sphere, ts === 'tshirt' || ts === 'rags' ? top : sleeveC === skin ? (ts === 'vest' ? accent : skin) : sleeveC, [0, -0.01, 0], [0, 0, 0], [0.065 * W, 0.065, 0.065]);
    { const [g, sc] = cap(0.31, 0.052 * W); P.add(ua, g, ts === 'tshirt' ? top : sleeveC, [0, -0.14, 0], [0, 0, 0], sc); }
    if (ts === 'tshirt') { const [g, sc] = cap(0.16, 0.046 * W); P.add(ua, g, skin, [0, -0.2, 0], [0, 0, 0], sc); }
    const faC = longSleeve ? sleeveC : skin;
    { const [g, sc] = cap(0.27, 0.045 * W); P.add(fa, g, faC, [0, -0.12, 0], [0, 0, 0], sc); }
    if (longSleeve) P.add(fa, G.cyl, shade(faC, 0.85), [0, -0.22, 0], [0, 0, 0], [0.05 * W, 0.03, 0.05 * W]);
    const claw = muts.has('claws');
    P.add(hd, G.box, skin, [0, -0.05, 0.005], [0, 0, 0], [0.06, claw ? 0.13 : 0.085, 0.035]);
    P.add(hd, G.box, skin, [0.03 * sg, -0.035, 0.02], [0, 0, 0.3 * sg], [0.02, 0.05, 0.02]); // thumb
    if (claw) for (let i = 0; i < 3; i++) P.add(hd, G.cone4, 0xe8e0c8, [-0.02 + i * 0.02, -0.15, 0.01], [Math.PI, 0, 0], [0.01, 0.06, 0.01]);
    // GloomBand on left wrist
    if (side === 'L' && look.band !== false) {
      P.add(fa, G.cyl, 0x0c0e12, [0, -0.2, 0], [0, 0, 0], [0.052, 0.05, 0.052]);
      P.add(fa, G.box, look.bandColor ?? 0x3ef0ff, [0.0, -0.2, 0.05], [0, 0, 0], [0.04, 0.03, 0.006], true);
    }
  }
  // ---- legs ----
  for (const side of ['L', 'R'] as const) {
    const th = `thigh${side}` as BoneName, sn = `shin${side}` as BoneName, ft = `foot${side}` as BoneName;
    const legC = fullBody ? top : bottom;
    { const [g, sc] = cap(0.48, 0.07 * W * (fem ? 1.05 : 1), 0.075 * W); P.add(th, g, legC, [0, -0.2, 0], [0, 0, 0], sc); }
    { const [g, sc] = cap(0.46, 0.058 * W, 0.06 * W); P.add(sn, g, legC, [0, -0.2, 0], [0, 0, 0], sc); }
    const boot = ex.has('boots');
    if (boot) P.add(sn, G.cyl, shoes, [0, -0.33, 0], [0, 0, 0], [0.065 * W, 0.16, 0.068 * W]);
    P.add(ft, G.box, shoes, [0, -0.03, 0.045], [0, 0, 0], [0.085, 0.07, 0.21]);
    P.add(ft, G.box, shade(shoes, 0.6), [0, -0.062, 0.045], [0, 0, 0], [0.09, 0.012, 0.215]);
    if (ex.has('buckles')) P.add(sn, G.box, 0xd0d6de, [0.0, -0.33, 0.065], [0, 0, 0], [0.04, 0.02, 0.01]);
    if (ex.has('sneakers')) P.add(ft, G.box, 0xf4f4f4, [0, -0.045, 0.06], [0, 0, 0], [0.09, 0.02, 0.17]);
  }
  if (ex.has('kneepads')) {
    P.add('shinL', G.box, 0x2a2a2a, [0, 0.0, 0.05], [0, 0, 0], [0.08, 0.08, 0.04]);
    P.add('shinR', G.box, 0x2a2a2a, [0, 0.0, 0.05], [0, 0, 0], [0.08, 0.08, 0.04]);
  }

  // ---- mutations ----
  if (muts.size) {
    if (muts.has('tumor')) {
      for (let i = 0; i < 5; i++) P.add('chest', G.sphere, glowC, [rrange(r, -0.12, 0.12), rrange(r, 0, 0.2), -0.12 - rrange(r, 0, 0.04)], [0, 0, 0], [0.04 + i * 0.006, 0.04 + i * 0.006, 0.04], true);
      P.add('shoulderL', G.sphere, shade(skin, 0.8), [0.03, 0.04, 0], [0, 0, 0], [0.1, 0.09, 0.1]);
    }
    if (muts.has('shield') || muts.has('carDoor')) {
      const sc = muts.has('carDoor') ? 0x8a2a24 : 0x2a3040;
      P.add('foreArmL', G.box, sc, [0.06, -0.12, 0.12], [0, 0.2, 0], [0.04, 0.55, 0.4]);
      if (muts.has('carDoor')) P.add('foreArmL', G.box, 0x6aa0c0, [0.085, -0.02, 0.12], [0, 0.2, 0], [0.01, 0.2, 0.3]);
      else P.add('foreArmL', G.box, 0xd0d8e0, [0.085, -0.02, 0.12], [0, 0.2, 0], [0.01, 0.12, 0.3]);
    }
    if (muts.has('riotHelmet')) {
      P.add('head', G.hemi, 0x1a1e28, [0, hy + 0.0, 0], [-0.1, 0, 0], [0.135, 0.15, 0.145]);
      P.add('head', G.box, 0x6a8aa0, [0, hy - 0.0, 0.11], [0.15, 0, 0], [0.2, 0.09, 0.02]);
    }
    if (muts.has('pipes')) for (let i = 0; i < 3; i++) P.add('chest', G.cyl, 0x6a5a4a, [-0.08 + i * 0.08, 0.2, -0.14], [-0.5, 0, (i - 1) * 0.3], [0.025, 0.35, 0.025]);
    if (muts.has('hydraulic')) {
      P.add('upperArmR', G.cyl, 0xd0a020, [0, -0.14, 0], [0, 0, 0], [0.09, 0.3, 0.09]);
      P.add('foreArmR', G.cyl, 0x6a6a70, [0, -0.16, 0], [0, 0, 0], [0.11, 0.34, 0.11]);
      P.add('handR', G.box, 0x4a4a50, [0, -0.12, 0], [0, 0, 0], [0.26, 0.2, 0.26]);
      P.add('foreArmR', G.cyl, 0xff4020, [0, -0.33, 0.08], [0, 0, 0], [0.02, 0.06, 0.02], true);
    }
    if (muts.has('tanks')) for (const s of [1, -1]) {
      { const [g, sc] = cap(0.36, 0.07); P.add('chest', g, 0xb03a20, [0.08 * s, 0.08, -0.18], [0, 0, 0], sc); }
      P.add('chest', G.sphere, 0xffa040, [0.08 * s, 0.26, -0.18], [0, 0, 0], [0.035, 0.035, 0.035], true);
    }
    if (muts.has('torch')) {
      P.add('handR', G.cyl, 0x404448, [0, -0.12, 0], [0, 0, 0], [0.025, 0.16, 0.025]);
      P.add('handR', G.cone, 0xff8a30, [0, -0.22, 0], [Math.PI, 0, 0], [0.03, 0.08, 0.03], true);
    }
    if (muts.has('mask') || muts.has('hazmat')) {
      P.add('head', G.cyl, 0x2a2e2a, [0, 0.07, 0.1], [Math.PI / 2, 0, 0], [0.045, 0.06, 0.045]);
      for (const s of [1, -1]) P.add('head', G.cyl, 0xa0e060, [0.04 * s, 0.12, 0.105], [Math.PI / 2, 0, 0], [0.022, 0.01, 0.022], true);
    }
    if (muts.has('fins') || muts.has('gills')) {
      P.add('chest', G.cone4, 0x2a7a8a, [0, 0.12, -0.13], [-0.3, 0, 0], [0.02, 0.28, 0.12]);
      P.add('foreArmL', G.cone4, 0x2a7a8a, [0.05, -0.12, 0], [0, 0, -0.2], [0.01, 0.18, 0.06]);
      P.add('foreArmR', G.cone4, 0x2a7a8a, [-0.05, -0.12, 0], [0, 0, 0.2], [0.01, 0.18, 0.06]);
      for (const s of [1, -1]) for (let i = 0; i < 3; i++) P.add('neck', G.box, 0xc03040, [0.05 * s, 0.03 - i * 0.02, 0.0], [0, 0, 0], [0.005, 0.008, 0.04], true);
    }
    if (muts.has('lantern')) {
      P.add('head', G.cyl, shade(skin, 0.7), [0, hy + 0.18, 0.08], [0.6, 0, 0], [0.008, 0.18, 0.008]);
      P.add('head', G.sphere, 0x60ffd0, [0, hy + 0.25, 0.17], [0, 0, 0], [0.04, 0.04, 0.04], true);
    }
    if (muts.has('vines') || muts.has('leaves')) {
      for (const b of ['upperArmL', 'upperArmR', 'thighL', 'thighR', 'chest', 'foreArmL', 'foreArmR'] as BoneName[])
        P.add(b, G.torus, 0x2a5a24, [0, b === 'chest' ? 0.08 : -0.12, 0], [Math.PI / 2 + rrange(r, -0.4, 0.4), 0, 0], [0.08, 0.08, 0.35]);
      if (muts.has('leaves')) for (let i = 0; i < 8; i++) P.add(i < 4 ? 'chest' : 'head', G.cone4, 0x3a8a2a, [rrange(r, -0.14, 0.14), rrange(r, 0.0, 0.25), rrange(r, -0.14, 0.05)], [rrange(r, -1, 1), rrange(r, 0, 3), rrange(r, -1, 1)], [0.06, 0.16, 0.02]);
    }
    if (muts.has('spores')) for (let i = 0; i < 7; i++) P.add(i < 4 ? 'chest' : i < 6 ? 'head' : 'upperArmL', G.sphere, 0xd0ff60, [rrange(r, -0.12, 0.12), rrange(r, 0.0, 0.2), rrange(r, -0.14, 0.12)], [0, 0, 0], [0.03, 0.03, 0.03], true);
    if (muts.has('ice') || muts.has('crystalSpine')) {
      for (let i = 0; i < 6; i++) P.add(i < 4 ? 'chest' : i === 4 ? 'shoulderL' : 'shoulderR', G.cone4, 0xa0e8ff, [rrange(r, -0.14, 0.14), rrange(r, 0.05, 0.25), -0.1 - rrange(r, 0, 0.05)], [rrange(r, -1.2, -0.4), 0, rrange(r, -0.6, 0.6)], [0.04, rrange(r, 0.12, 0.26), 0.04], true);
    }
    if (muts.has('armor')) {
      P.add('chest', G.box, 0x90b8d8, [0, 0.08, 0.02], [0, 0, 0], [shoulderW * 2.1, 0.34, 0.3]);
      P.add('shoulderL', G.sphere, 0x90b8d8, [0.02, 0.03, 0], [0, 0, 0], [0.11, 0.09, 0.11]);
      P.add('shoulderR', G.sphere, 0x90b8d8, [-0.02, 0.03, 0], [0, 0, 0], [0.11, 0.09, 0.11]);
      P.add('foreArmL', G.cyl, 0x90b8d8, [0, -0.12, 0], [0, 0, 0], [0.07, 0.2, 0.07]);
      P.add('foreArmR', G.cyl, 0x90b8d8, [0, -0.12, 0], [0, 0, 0], [0.07, 0.2, 0.07]);
    }
    if (muts.has('bloat')) {
      P.add('spine', G.sphereHi, shade(skin, 0.9), [0, 0.04, 0.06], [0, 0, 0], [0.22 * W, 0.22, 0.22]);
      for (let i = 0; i < 4; i++) P.add('spine', G.sphere, glowC, [rrange(r, -0.15, 0.15), rrange(r, -0.05, 0.15), 0.2 + rrange(r, 0, 0.06)], [0, 0, 0], [0.035, 0.035, 0.035], true);
    }
    if (muts.has('brain')) P.add('head', G.sphere, 0xff70c0, [0, hy + 0.1 * headS, 0], [0, 0, 0], [0.09 * headS, 0.07 * headS, 0.1 * headS], true);
    if (muts.has('trafficLight')) {
      P.add('handR', G.cyl, 0x3a3e44, [0, -0.5, 0], [0, 0, 0], [0.03, 1.1, 0.03]);
      P.add('handR', G.box, 0x1a1c20, [0, -1.05, 0], [0, 0, 0], [0.14, 0.34, 0.12]);
      P.add('handR', G.sphere, 0xff2020, [0, -0.95, 0.065], [0, 0, 0], [0.04, 0.04, 0.02], true);
      P.add('handR', G.sphere, 0xffb020, [0, -1.05, 0.065], [0, 0, 0], [0.04, 0.04, 0.02], true);
      P.add('handR', G.sphere, 0x30ff60, [0, -1.15, 0.065], [0, 0, 0], [0.04, 0.04, 0.02], true);
    }
  }

  // ---- merge ----
  const normal = P.parts.filter((p) => !p.glow).map((p) => p.geo);
  const glowParts = P.parts.filter((p) => p.glow).map((p) => p.geo);
  const geoA = mergeGeometries(normal, false)!;
  let geo: THREE.BufferGeometry;
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
  let glowMat: THREE.MeshBasicMaterial | null = null;
  let materials: THREE.Material | THREE.Material[] = mat;
  if (glowParts.length) {
    const geoB = mergeGeometries(glowParts, false)!;
    geo = mergeGeometries([geoA, geoB], true)!;
    glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(3, 3, 3) });
    materials = [mat, glowMat];
  } else geo = geoA;
  geo.computeBoundingSphere();
  if (geo.boundingSphere) geo.boundingSphere.radius *= 1.8;
  for (const p of P.parts) p.geo.dispose();

  const mesh = new THREE.SkinnedMesh(geo, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  const root = new THREE.Group();
  mesh.add(bones.root);
  root.add(mesh);
  root.scale.setScalar(H);
  mesh.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(BONES.map((n) => bones[n]));
  mesh.bind(skeleton);
  return { root, mesh, bones, rest, material: mat, glowMaterial: glowMat, height: 1.75 * H, scale: H, look };
}

// ------------------------------------------------------------------
// Quadruped (mutant hound)
export const HBONES = ['root', 'body', 'chest', 'neck', 'head', 'jaw', 'flU', 'flL', 'frU', 'frL', 'blU', 'blL', 'brU', 'brL', 'tail'] as const;
export type HBone = (typeof HBONES)[number];
export interface HoundModel {
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  bones: Record<HBone, THREE.Bone>;
  material: THREE.MeshToonMaterial;
  glowMaterial: THREE.MeshBasicMaterial | null;
  scale: number;
}
export function buildHound(o: { skin: number; glow: number; scale?: number; vines?: boolean; seed?: number }): HoundModel {
  const S = o.scale ?? 1;
  const local: Record<HBone, [number, number, number]> = {
    root: [0, 0, 0], body: [0, 0.62, -0.25], chest: [0, 0.02, 0.5], neck: [0, 0.08, 0.2], head: [0, 0.08, 0.12], jaw: [0, -0.04, 0.05],
    flU: [0.13, -0.05, 0.05], flL: [0, -0.3, 0], frU: [-0.13, -0.05, 0.05], frL: [0, -0.3, 0],
    blU: [0.13, 0, 0], blL: [0, -0.3, 0], brU: [-0.13, 0, 0], brL: [0, -0.3, 0], tail: [0, 0.05, -0.12],
  };
  const parent: Partial<Record<HBone, HBone>> = {
    body: 'root', chest: 'body', neck: 'chest', head: 'neck', jaw: 'head', flU: 'chest', flL: 'flU', frU: 'chest', frL: 'frU',
    blU: 'body', blL: 'blU', brU: 'body', brL: 'brU', tail: 'body',
  };
  const bones = {} as Record<HBone, THREE.Bone>;
  const world: Record<string, THREE.Vector3> = {};
  const index: Record<string, number> = {};
  HBONES.forEach((n, i) => {
    const b = new THREE.Bone();
    b.position.set(...local[n]);
    bones[n] = b;
    index[n] = i;
    const p = parent[n];
    if (p) bones[p].add(b);
    world[n] = (p ? world[p] : new THREE.Vector3()).clone().add(new THREE.Vector3(...local[n]));
  });
  const P = new PartBuilder(world, index);
  const sk = o.skin;
  const add = (b: HBone, g: THREE.BufferGeometry, c: number | THREE.Color, pos: [number, number, number], rot: [number, number, number], sc: [number, number, number], gl = false) =>
    P.add(b as any, g, c, pos, rot, sc, gl);
  { const [g, sc] = cap(0.75, 0.16, 0.15); add('body', g, sk, [0, 0, 0.1], [Math.PI / 2, 0, 0], sc); }
  add('chest', G.sphere, sk, [0, 0.02, 0], [0, 0, 0], [0.2, 0.2, 0.22]);
  // ribs / exposed spine
  for (let i = 0; i < 5; i++) add('body', G.box, 0xe0d4c0, [0, 0.15, -0.05 + i * 0.09], [0, 0, 0], [0.05, 0.04, 0.03]);
  { const [g, sc] = cap(0.26, 0.08); add('neck', g, sk, [0, 0.03, 0.06], [1.1, 0, 0], sc); }
  add('head', G.box, sk, [0, 0.02, 0.06], [0, 0, 0], [0.16, 0.13, 0.2]);
  add('head', G.box, shade(sk, 0.85), [0, -0.01, 0.2], [0, 0, 0], [0.1, 0.08, 0.14]);
  add('jaw', G.box, shade(sk, 0.75), [0, -0.03, 0.12], [0, 0, 0], [0.09, 0.03, 0.16]);
  for (let i = 0; i < 4; i++) add('jaw', G.cone4, 0xf0e8d0, [-0.03 + i * 0.02, 0.0, 0.18], [0, 0, 0], [0.008, 0.03, 0.008]);
  for (const s of [1, -1]) {
    add('head', G.sphere, o.glow, [0.05 * s, 0.05, 0.15], [0, 0, 0], [0.022, 0.018, 0.012], true);
    add('head', G.cone4, shade(sk, 0.8), [0.06 * s, 0.1, 0.0], [-0.3, 0, 0.3 * s], [0.03, 0.08, 0.03]);
  }
  for (const L of ['fl', 'fr', 'bl', 'br'] as const) {
    { const [g, sc] = cap(0.36, 0.055, 0.06); add(`${L}U` as HBone, g, sk, [0, -0.15, 0], [0, 0, 0], sc); }
    { const [g, sc] = cap(0.34, 0.04); add(`${L}L` as HBone, g, shade(sk, 0.85), [0, -0.15, 0], [0, 0, 0], sc); }
    add(`${L}L` as HBone, G.box, 0x2a2222, [0, -0.31, 0.03], [0, 0, 0], [0.07, 0.04, 0.1]);
  }
  add('tail', G.cone4, sk, [0, 0, -0.18], [-Math.PI / 2 - 0.4, 0, 0], [0.04, 0.35, 0.04]);
  if (o.vines) for (const b of ['body', 'chest', 'flU', 'brU'] as HBone[]) add(b, G.torus, 0x2a5a24, [0, 0, 0], [0, 0, 0], [0.16, 0.16, 0.3]);
  for (let i = 0; i < 3; i++) add('body', G.sphere, o.glow, [0.08 - i * 0.08, 0.12, 0.1 + i * 0.1], [0, 0, 0], [0.03, 0.03, 0.03], true);

  const normal = P.parts.filter((p) => !p.glow).map((p) => p.geo);
  const glowParts = P.parts.filter((p) => p.glow).map((p) => p.geo);
  const geo = mergeGeometries([mergeGeometries(normal, false)!, mergeGeometries(glowParts, false)!], true)!;
  geo.computeBoundingSphere();
  if (geo.boundingSphere) geo.boundingSphere.radius *= 1.8;
  const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(3, 3, 3) });
  const mesh = new THREE.SkinnedMesh(geo, [mat, glowMat]);
  mesh.castShadow = true;
  const root = new THREE.Group();
  mesh.add(bones.root);
  root.add(mesh);
  root.scale.setScalar(S);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(HBONES.map((n) => bones[n])));
  return { root, mesh, bones, material: mat, glowMaterial: glowMat, scale: S };
}
