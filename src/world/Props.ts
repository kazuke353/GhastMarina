import * as THREE from 'three';
import { toon } from '../gfx/Materials';
import { textTexture } from '../gfx/Textures';
import { rng, rrange, rpick, RNG } from '../core/math';

// ---------- shared materials ----------
let _pm: ReturnType<typeof makePM> | null = null;
function makePM() {
  const glowV = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(3, 3, 3) });
  const glowSoft = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.6, 1.6, 1.6) });
  return {
    paint: toon({ vertexColors: true, key: 'pm-paint' }),
    metal: toon({ map: 'metal', vertexColors: true, key: 'pm-metal' }),
    rust: toon({ map: 'rust', vertexColors: true, key: 'pm-rust' }),
    plate: toon({ map: 'plate', vertexColors: true, key: 'pm-plate' }),
    wood: toon({ map: 'wood', vertexColors: true, key: 'pm-wood' }),
    concrete: toon({ map: 'concrete', vertexColors: true, key: 'pm-concrete' }),
    container: toon({ map: 'container', vertexColors: true, key: 'pm-container' }),
    leaves: toon({ map: 'leaves', vertexColors: true, key: 'pm-leaves' }),
    bark: toon({ map: 'bark', vertexColors: true, key: 'pm-bark' }),
    frost: toon({ map: 'frost', vertexColors: true, key: 'pm-frost' }),
    hazard: toon({ map: 'hazard', vertexColors: true, key: 'pm-hazard' }),
    lab: toon({ map: 'labPanel', vertexColors: true, key: 'pm-lab' }),
    glowV,
    glowSoft,
    glass: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.5, 0.6), transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }),
    liquid: new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.4, 1.4, 1.4), transparent: true, opacity: 0.55, depthWrite: false }),
    iceGlass: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.85, 1.1), transparent: true, opacity: 0.35, depthWrite: false }),
  };
}
export function PM() {
  if (!_pm) _pm = makePM();
  return _pm;
}

const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  sphere: new THREE.SphereGeometry(1, 12, 8),
  hemi: new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  cone: new THREE.ConeGeometry(1, 1, 8),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  torus: new THREE.TorusGeometry(1, 0.15, 6, 16),
  plane: new THREE.PlaneGeometry(1, 1),
  ico: new THREE.IcosahedronGeometry(1, 0),
  dodeca: new THREE.DodecahedronGeometry(1, 0),
};

export function part(g: THREE.BufferGeometry, mat: THREE.Material, color: number | THREE.Color, pos: [number, number, number], scale: [number, number, number] = [1, 1, 1], rot: [number, number, number] = [0, 0, 0]) {
  const m = new THREE.Mesh(g, mat);
  m.position.set(...pos);
  m.scale.set(...scale);
  m.rotation.set(...rot);
  m.userData.color = color;
  return m;
}

export interface PropOut {
  obj: THREE.Object3D;
  boxes?: { x: number; z: number; w: number; d: number; h: number; block?: boolean }[]; // local, axis aligned (before yaw)
  circles?: { x: number; z: number; r: number }[];
  lights?: { x: number; y: number; z: number; color: number; intensity: number; range: number; flicker?: number }[];
  dynamic?: boolean; // do not batch
  shadow?: boolean;
}

type PropFn = (r: RNG, o: any) => PropOut;

function group(...children: THREE.Object3D[]) {
  const g = new THREE.Group();
  for (const c of children) g.add(c);
  return g;
}

export const PROPS: Record<string, PropFn> = {
  crate: (r, o) => {
    const P = PM();
    const s = o.size ?? rrange(r, 0.9, 1.3);
    const c = o.color ?? rpick(r, [0x8a6a44, 0x7a5a3a, 0x6a6a5a]);
    const g = group(part(geo.box, P.wood, c, [0, s / 2, 0], [s, s, s]));
    g.add(part(geo.box, P.paint, 0x3a2a1a, [0, s / 2, s / 2 + 0.01], [s * 0.95, 0.08, 0.02], [0, 0, Math.PI / 4]));
    return { obj: g, boxes: [{ x: 0, z: 0, w: s, d: s, h: s }], shadow: true };
  },
  crateStack: (r) => {
    const P = PM();
    const g = new THREE.Group();
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const s = rrange(r, 0.9, 1.2);
      const y = i < 2 ? s / 2 : 1.1 + s / 2;
      g.add(part(geo.box, P.wood, rpick(r, [0x8a6a44, 0x7a5a3a]), [i < 2 ? (i - 0.5) * 1.2 : rrange(r, -0.3, 0.3), y, rrange(r, -0.2, 0.2)], [s, s, s], [0, rrange(r, -0.3, 0.3), 0]));
    }
    return { obj: g, boxes: [{ x: 0, z: 0, w: 2.4, d: 1.3, h: 2 }], shadow: true };
  },
  gtCrate: () => {
    // GloomTech supply crate (static variant)
    const P = PM();
    const g = group(part(geo.box, P.metal, 0x22262e, [0, 0.4, 0], [1.2, 0.8, 0.8]));
    g.add(part(geo.box, P.glowV, 0x3ef0ff, [0, 0.55, 0.41], [0.9, 0.05, 0.01]));
    return { obj: g, boxes: [{ x: 0, z: 0, w: 1.2, d: 0.8, h: 0.8 }] };
  },
  barrel: (r, o) => {
    const P = PM();
    const c = o.color ?? rpick(r, [0x2a4a6a, 0x8a2a1a, 0x4a5a2a, 0xb08a20]);
    const g = group(part(geo.cyl, P.rust, c, [0, 0.45, 0], [0.33, 0.9, 0.33]));
    g.add(part(geo.torus, P.metal, 0x404040, [0, 0.25, 0], [0.34, 0.34, 0.5], [Math.PI / 2, 0, 0]));
    g.add(part(geo.torus, P.metal, 0x404040, [0, 0.68, 0], [0.34, 0.34, 0.5], [Math.PI / 2, 0, 0]));
    if (o.toxic) g.add(part(geo.cyl, P.glowV, 0x80ff40, [0, 0.91, 0], [0.28, 0.02, 0.28]));
    return { obj: g, circles: [{ x: 0, z: 0, r: 0.38 }], shadow: true };
  },
  barrelFire: () => {
    const P = PM();
    const g = group(part(geo.cyl, P.rust, 0x5a3a2a, [0, 0.45, 0], [0.33, 0.9, 0.33]));
    g.add(part(geo.cone, P.glowV, 0xff7a20, [0, 1.05, 0], [0.25, 0.4, 0.25]));
    g.add(part(geo.cone, P.glowV, 0xffd040, [0, 0.98, 0], [0.15, 0.25, 0.15]));
    return { obj: g, circles: [{ x: 0, z: 0, r: 0.4 }], lights: [{ x: 0, y: 1.4, z: 0, color: 0xff8a3a, intensity: 14, range: 9, flicker: 0.4 }], dynamic: false };
  },
  car: (r, o) => {
    const P = PM();
    const c = o.color ?? rpick(r, [0x7a2a24, 0x2a4a6a, 0x5a5a5a, 0xd0d0c8, 0x2a5a3a, 0xb08a30]);
    const g = new THREE.Group();
    g.add(part(geo.box, P.rust, c, [0, 0.6, 0], [1.9, 0.7, 4.2]));
    g.add(part(geo.box, P.rust, c, [0, 1.15, -0.2], [1.7, 0.5, 2.2]));
    g.add(part(geo.box, P.paint, 0x1a242c, [0, 1.15, -0.2], [1.72, 0.38, 1.9]));
    for (const [x, z] of [[-0.85, 1.3], [0.85, 1.3], [-0.85, -1.3], [0.85, -1.3]]) g.add(part(geo.cyl, P.paint, 0x141414, [x, 0.35, z], [0.35, 0.25, 0.35], [0, 0, Math.PI / 2]));
    g.add(part(geo.box, P.glowV, o.lights ? 0xffe0a0 : 0x302820, [0.6, 0.65, 2.11], [0.3, 0.12, 0.02]));
    g.add(part(geo.box, P.glowV, o.lights ? 0xffe0a0 : 0x302820, [-0.6, 0.65, 2.11], [0.3, 0.12, 0.02]));
    if (r() < 0.5) g.add(part(geo.torus, P.leaves, 0x3a6a2a, [0, 1.4, 0], [0.9, 0.9, 1.2], [Math.PI / 2, 0, 0]));
    g.rotation.z = rrange(r, -0.05, 0.05);
    return { obj: g, boxes: [{ x: 0, z: 0, w: 1.9, d: 4.2, h: 1.5, block: true }], shadow: true };
  },
  bus: (r) => {
    const P = PM();
    const g = new THREE.Group();
    g.add(part(geo.box, P.rust, 0xb08a20, [0, 1.5, 0], [2.6, 2.4, 10]));
    for (let i = 0; i < 7; i++) g.add(part(geo.box, P.paint, 0x141c24, [1.31, 1.9, -4 + i * 1.3], [0.02, 0.8, 1.0]));
    for (let i = 0; i < 7; i++) g.add(part(geo.box, P.paint, 0x141c24, [-1.31, 1.9, -4 + i * 1.3], [0.02, 0.8, 1.0]));
    g.add(part(geo.box, P.leaves, 0x3a6a2a, [0, 2.8, 1], [2.4, 0.4, 6]));
    g.rotation.z = rrange(r, -0.08, 0.08);
    return { obj: g, boxes: [{ x: 0, z: 0, w: 2.6, d: 10, h: 2.8, block: true }], shadow: true };
  },
  streetlamp: (r, o) => {
    const P = PM();
    const on = o.on ?? r() < 0.7;
    const col = o.lightColor ?? 0xffb060;
    const g = group(part(geo.cyl, P.metal, 0x2a2e34, [0, 2.5, 0], [0.08, 5, 0.08]));
    g.add(part(geo.box, P.metal, 0x2a2e34, [0, 4.95, 0.5], [0.12, 0.1, 1.1]));
    g.add(part(geo.box, on ? P.glowV : P.paint, on ? col : 0x404040, [0, 4.85, 0.95], [0.35, 0.08, 0.5]));
    return { obj: g, circles: [{ x: 0, z: 0, r: 0.15 }], lights: on ? [{ x: 0, y: 4.5, z: 0.95, color: col, intensity: 22, range: 14, flicker: o.flicker ?? (r() < 0.3 ? 0.6 : 0) }] : [] };
  },
  trafficLight: () => {
    const P = PM();
    const g = group(part(geo.cyl, P.metal, 0x2a2e34, [0, 2, 0], [0.08, 4, 0.08]));
    g.add(part(geo.box, P.paint, 0x16181c, [0, 3.7, 0.15], [0.35, 0.95, 0.3]));
    g.add(part(geo.sphere, P.glowV, 0xff2020, [0, 4.0, 0.31], [0.1, 0.1, 0.03]));
    g.add(part(geo.sphere, P.paint, 0x3a3010, [0, 3.7, 0.31], [0.1, 0.1, 0.03]));
    g.add(part(geo.sphere, P.paint, 0x103a10, [0, 3.4, 0.31], [0.1, 0.1, 0.03]));
    return { obj: g, circles: [{ x: 0, z: 0, r: 0.12 }] };
  },
  bench: () => {
    const P = PM();
    const g = group(part(geo.box, P.wood, 0x6a4a2a, [0, 0.45, 0], [1.8, 0.08, 0.5]));
    g.add(part(geo.box, P.wood, 0x6a4a2a, [0, 0.8, -0.22], [1.8, 0.4, 0.06]));
    g.add(part(geo.box, P.metal, 0x2a2a2a, [-0.8, 0.22, 0], [0.06, 0.45, 0.45]));
    g.add(part(geo.box, P.metal, 0x2a2a2a, [0.8, 0.22, 0], [0.06, 0.45, 0.45]));
    return { obj: g, boxes: [{ x: 0, z: 0, w: 1.8, d: 0.5, h: 0.9 }] };
  },
  trash: (r) => {
    const P = PM();
    const g = group(part(geo.cyl, P.metal, 0x3a4a3a, [0, 0.45, 0], [0.3, 0.9, 0.3]));
    for (let i = 0; i < 3; i++) g.add(part(geo.dodeca, P.paint, 0x1a1a1c, [rrange(r, -0.6, 0.6), 0.25, rrange(r, -0.6, 0.6)], [0.3, 0.25, 0.3]));
    return { obj: g, circles: [{ x: 0, z: 0, r: 0.35 }] };
  },
  debris: (r) => {
    const P = PM();
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) g.add(part(geo.dodeca, P.concrete, rpick(r, [0x6a6a6a, 0x5a5a58, 0x7a7670]), [rrange(r, -0.8, 0.8), rrange(r, 0.1, 0.4), rrange(r, -0.8, 0.8)], [rrange(r, 0.3, 0.6), rrange(r, 0.2, 0.5), rrange(r, 0.3, 0.6)], [r(), r(), r()]));
    g.add(part(geo.cyl, P.rust, 0x5a4a3a, [0, 0.3, 0], [0.04, 1.6, 0.04], [0.3, 0, 1.3]));
    return { obj: g, boxes: [{ x: 0, z: 0, w: 1.8, d: 1.8, h: 0.8 }] };
  },
  tree: (r, o) => {
    const P = PM();
    const h = o.h ?? rrange(r, 4, 7);
    const g = group(part(geo.cyl8, P.bark, 0x8a6a4a, [0, h / 2, 0], [0.25, h, 0.25]));
    const lc = o.leaf ?? rpick(r, [0x3a7a3a, 0x4a8a2a, 0x2a6a3a]);
    for (let i = 0; i < 4; i++) g.add(part(geo.ico, P.leaves, lc, [rrange(r, -0.8, 0.8), h + rrange(r, -0.5, 0.8), rrange(r, -0.8, 0.8)], [rrange(r, 1.2, 2), rrange(r, 1, 1.6), rrange(r, 1.2, 2)], [r(), r(), r()]));
    return { obj: g, circles: [{ x: 0, z: 0, r: 0.35 }], shadow: true };
  },
  bush: (r, o) => {
    const P = PM();
    const g = new THREE.Group();
    const lc = o.leaf ?? rpick(r, [0x3a6a2a, 0x2a5a2a, 0x4a7a3a]);
    for (let i = 0; i < 3; i++) g.add(part(geo.ico, P.leaves, lc, [rrange(r, -0.4, 0.4), 0.5, rrange(r, -0.4, 0.4)], [rrange(r, 0.6, 0.9), rrange(r, 0.5, 0.8), rrange(r, 0.6, 0.9)], [r(), r(), r()]));
    return { obj: g };
  },
  crops: (r) => {
    const P = PM();
    const g = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const x = -1.2 + (i % 4) * 0.8, z = i < 4 ? -0.6 : 0.6;
      const h = rrange(r, 0.8, 1.6);
      g.add(part(geo.cyl6, P.paint, 0x5a7a2a, [x, h / 2, z], [0.04, h, 0.04]));
      g.add(part(geo.cone4, P.leaves, 0x6a9a3a, [x, h * 0.7, z], [0.25, 0.5, 0.08], [0, r() * 3, 0.4]));
      g.add(part(geo.sphere, P.paint, rpick(r, [0xc8a030, 0xb04020, 0x80a030]), [x, h, z], [0.12, 0.18, 0.12]));
    }
    return { obj: g };
  },
  giantFlower: (r, o) => {
    const P = PM();
    const g = group(part(geo.cyl8, P.paint, 0x3a6a2a, [0, 1.5, 0], [0.15, 3, 0.15]));
    const pc = o.color ?? rpick(r, [0xc04080, 0x8040c0, 0xe0a040]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.add(part(geo.sphere, P.paint, pc, [Math.cos(a) * 0.5, 3.0, Math.sin(a) * 0.5], [0.45, 0.08, 0.25], [0, -a, 0.3]));
    }
    g.add(part(geo.sphere, P.glowV, 0xffe060, [0, 3.05, 0], [0.22, 0.15, 0.22]));
    return { obj: g, circles: [{ x: 0, z: 0, r: 0.25 }], lights: [{ x: 0, y: 3, z: 0, color: 0xffd060, intensity: 4, range: 6 }] };
  },
  planter: (r) => {
    const P = PM();
    const g = group(part(geo.box, P.concrete, 0x6a6a64, [0, 0.4, 0], [2.6, 0.8, 1.2]));
    g.add(part(geo.box, P.paint, 0x3a2a1a, [0, 0.79, 0], [2.4, 0.04, 1.0]));
    for (let i = 0; i < 5; i++) g.add(part(geo.ico, P.leaves, 0x4a8a3a, [-1 + i * 0.5, 1.0, rrange(r, -0.2, 0.2)], [0.3, 0.35, 0.3]));
    return { obj: g, boxes: [{ x: 0, z: 0, w: 2.6, d: 1.2, h: 0.8 }] };
  },
  vinesHang: (r) => {
    const P = PM();
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const h = rrange(r, 1.5, 4);
      g.add(part(geo.box, P.leaves, 0x2a5a24, [rrange(r, -1.2, 1.2), 5 - h / 2, 0], [0.12, h, 0.06]));
    }
    return { obj: g };
  },
  tank: (r, o) => {
    const P = PM();
    const R = o.r ?? 1.3;
    const h = o.h ?? 4;
    const g = group(part(geo.cyl, P.rust, o.color ?? 0x6a5040, [0, h / 2, 0], [R, h, R]));
    g.add(part(geo.hemi, P.rust, o.color ?? 0x6a5040, [0, h, 0], [R, R * 0.5, R]));
    g.add(part(geo.torus, P.metal, 0x3a3a3a, [0, h * 0.3, 0], [R * 1.02, R * 1.02, 0.6], [Math.PI / 2, 0, 0]));
    g.add(part(geo.box, P.hazard, 0xffffff, [0, h * 0.55, R + 0.01], [R * 1.1, 0.3, 0.02]));
    return { obj: g, circles: [{ x: 0, z: 0, r: R + 0.05 }], shadow: true };
  },
  machine: (r, o) => {
    const P = PM();
    const w = o.w ?? 2.2, d = o.d ?? 1.6, h = o.h ?? 2.2;
    const g = group(part(geo.box, P.metal, o.color ?? rpick(r, [0x5a6070, 0x6a5a40, 0x4a5a5a]), [0, h / 2, 0], [w, h, d]));
    g.add(part(geo.box, P.paint, 0x1a1c20, [0, h * 0.65, d / 2 + 0.01], [w * 0.5, h * 0.3, 0.02]));
    for (let i = 0; i < 3; i++) g.add(part(geo.box, P.glowV, rpick(r, [0x40ff60, 0xff4020, 0xffc040, 0x40c0ff]), [-w * 0.3 + i * 0.25, h * 0.35, d / 2 + 0.02], [0.08, 0.08, 0.02]));
    g.add(part(geo.cyl, P.metal, 0x3a3a3a, [w * 0.3, h + 0.4, 0], [0.12, 0.8, 0.12]));
    return { obj: g, boxes: [{ x: 0, z: 0, w, d, h, block: w > 2 }], shadow: true };
  },
  generator: (r, o) => {
    const P = PM();
    const g = group(part(geo.box, P.metal, 0xb08a20, [0, 0.8, 0], [2.4, 1.6, 1.4]));
    g.add(part(geo.cyl, P.metal, 0x3a3a3a, [0.8, 1.9, 0], [0.18, 0.7, 0.18]));
    g.add(part(geo.box, P.paint, 0x1a1a1a, [0, 1.0, 0.71], [1.6, 0.8, 0.02]));
    g.add(part(geo.box, o.on ? P.glowV : P.paint, o.on ? 0x40ff60 : 0x501010, [0.6, 1.2, 0.73], [0.2, 0.12, 0.02]));
    return { obj: g, boxes: [{ x: 0, z: 0, w: 2.4, d: 1.4, h: 1.6, block: true }], shadow: true };
  },
  pipesV: (r) => {
    const P = PM();
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) g.add(part(geo.cyl, P.rust, rpick(r, [0x6a5040, 0x5a6a6a]), [-0.5 + i * 0.5, 3, 0], [0.12, 6, 0.12]));
    return { obj: g };
  },
  console: (r, o) => {
    const P = PM();
    const sc = o.screen ?? 0x30d0ff;
    const g = group(part(geo.box, P.metal, 0x3a4048, [0, 0.5, 0], [1.4, 1.0, 0.7]));
    g.add(part(geo.box, P.metal, 0x3a4048, [0, 1.05, -0.15], [1.4, 0.2, 0.5], [0.5, 0, 0]));
    g.add(part(geo.box, P.metal, 0x2a2e34, [0, 1.5, -0.3], [1.2, 0.8, 0.08], [-0.15, 0, 0]));
    g.add(part(geo.box, P.glowSoft, sc, [0, 1.5, -0.25], [1.05, 0.65, 0.02], [-0.15, 0, 0]));
    for (let i = 0; i < 4; i++) g.add(part(geo.box, P.glowV, rpick(r, [0xff4040, 0x40ff80, 0xffd040]), [-0.45 + i * 0.3, 1.1, 0.08], [0.06, 0.03, 0.06], [0.5, 0, 0]));
    return { obj: g, boxes: [{ x: 0, z: 0, w: 1.4, d: 0.8, h: 1.2 }], lights: [{ x: 0, y: 1.6, z: 0.3, color: sc, intensity: 5, range: 5 }] };
  },
  serverRack: (r) => {
    const P = PM();
    const g = group(part(geo.box, P.metal, 0x1e2228, [0, 1.1, 0], [0.9, 2.2, 0.9]));
    for (let i = 0; i < 10; i++) g.add(part(geo.box, P.glowV, rpick(r, [0x40ff80, 0x30c0ff, 0xff4040]), [rrange(r, -0.3, 0.3), 0.3 + i * 0.19, 0.46], [0.05, 0.03, 0.01]));
    return { obj: g, boxes: [{ x: 0, z: 0, w: 0.9, d: 0.9, h: 2.2 }] };
  },
  labTable: (r) => {
    const P = PM();
    const g = group(part(geo.box, P.lab, 0xe0e4e8, [0, 0.9, 0], [2.2, 0.08, 0.9]));
    for (const [x, z] of [[-1, -0.4], [1, -0.4], [-1, 0.4], [1, 0.4]]) g.add(part(geo.box, P.metal, 0x8a9098, [x, 0.45, z], [0.06, 0.9, 0.06]));
    for (let i = 0; i < 4; i++) {
      const c = rpick(r, [0x40ff80, 0xff40c0, 0x40c0ff, 0xffd040]);
      g.add(part(geo.cyl, P.glass === undefined ? P.paint : P.paint, 0xd0e0e8, [-0.7 + i * 0.45, 1.05, rrange(r, -0.2, 0.2)], [0.07, 0.22, 0.07]));
      g.add(part(geo.cyl, P.glowV, c, [-0.7 + i * 0.45, 1.0, 0], [0.06, 0.1, 0.06]));
    }
    return { obj: g, boxes: [{ x: 0, z: 0, w: 2.2, d: 0.9, h: 1 }] };
  },
  specimen: (r, o) => {
    const P = PM();
    const lc = o.color ?? rpick(r, [0x30ff90, 0x30c0ff, 0xff50a0]);
    const g = group(part(geo.cyl, P.metal, 0x3a4048, [0, 0.25, 0], [0.75, 0.5, 0.75]));
    g.add(part(geo.cyl, P.metal, 0x3a4048, [0, 3.0, 0], [0.75, 0.3, 0.75]));
    g.add(part(geo.cyl, P.liquid, lc, [0, 1.6, 0], [0.65, 2.3, 0.65]));
    // floating figure silhouette
    g.add(part(geo.sphere, P.paint, 0x2a3a30, [0, 2.0, 0], [0.13, 0.15, 0.13]));
    g.add(part(geo.box, P.paint, 0x2a3a30, [0, 1.5, 0], [0.25, 0.6, 0.14]));
    g.add(part(geo.box, P.paint, 0x2a3a30, [0.08, 0.9, 0], [0.08, 0.6, 0.08], [0, 0, 0.1]));
    g.add(part(geo.box, P.paint, 0x2a3a30, [-0.08, 0.9, 0], [0.08, 0.6, 0.08], [0, 0, -0.1]));
    return { obj: g, circles: [{ x: 0, z: 0, r: 0.8 }], lights: [{ x: 0, y: 1.6, z: 0, color: lc, intensity: 8, range: 6, flicker: 0.1 }] };
  },
  aquarium: (r, o) => {
    const P = PM();
    const w = o.w ?? 4, h = o.h ?? 3, d = o.d ?? 1.2;
    const g = group(part(geo.box, P.metal, 0x24343c, [0, 0.2, 0], [w + 0.2, 0.4, d + 0.2]));
    g.add(part(geo.box, P.metal, 0x24343c, [0, h + 0.2, 0], [w + 0.2, 0.3, d + 0.2]));
    g.add(part(geo.box, P.liquid, 0x1a7a9a, [0, h / 2 + 0.3, 0], [w, h - 0.2, d]));
    for (let i = 0; i < 6; i++) g.add(part(geo.cone4, P.glowV, rpick(r, [0xff8040, 0x40ffd0, 0xffe060]), [rrange(r, -w / 2 + 0.4, w / 2 - 0.4), rrange(r, 0.8, h - 0.2), rrange(r, -0.3, 0.3)], [0.08, 0.25, 0.05], [0, 0, Math.PI / 2]));
    for (let i = 0; i < 4; i++) g.add(part(geo.cone, P.paint, rpick(r, [0xc04060, 0x40a0a0, 0xe08040]), [rrange(r, -w / 2 + 0.4, w / 2 - 0.4), 0.7, rrange(r, -0.3, 0.3)], [0.15, rrange(r, 0.4, 0.9), 0.15]));
    return { obj: g, boxes: [{ x: 0, z: 0, w: w + 0.2, d: d + 0.2, h: h + 0.4, block: true }], lights: [{ x: 0, y: h * 0.7, z: d / 2 + 0.5, color: 0x30c0ff, intensity: 10, range: 8, flicker: 0.05 }] };
  },
  coral: (r) => {
    const P = PM();
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) g.add(part(geo.cone, P.paint, rpick(r, [0xd04a6a, 0xe08a40, 0x4ab0a0, 0x9a4ad0]), [rrange(r, -0.6, 0.6), 0.4, rrange(r, -0.6, 0.6)], [0.15, rrange(r, 0.6, 1.4), 0.15], [rrange(r, -0.3, 0.3), 0, rrange(r, -0.3, 0.3)]));
    g.add(part(geo.sphere, P.glowV, 0x40ffd0, [0, 0.3, 0], [0.12, 0.12, 0.12]));
    return { obj: g, lights: [{ x: 0, y: 0.8, z: 0, color: 0x40ffd0, intensity: 3, range: 4 }] };
  },
  kelp: (r) => {
    const P = PM();
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const h = rrange(r, 1.5, 3.5);
      g.add(part(geo.box, P.leaves, 0x2a6a4a, [rrange(r, -0.5, 0.5), h / 2, rrange(r, -0.5, 0.5)], [0.15, h, 0.04], [0, r() * 3, rrange(r, -0.15, 0.15)]));
    }
    return { obj: g };
  },
  cryoPod: (r, o) => {
    const P = PM();
    const g = group(part(geo.box, P.metal, 0x8a9aa8, [0, 0.15, 0], [1.1, 0.3, 1.1]));
    g.add(part(geo.cyl, P.metal, 0x8a9aa8, [0, 2.45, 0], [0.55, 0.3, 0.55]));
    g.add(part(geo.cyl, P.iceGlass, 0xffffff, [0, 1.3, 0], [0.5, 2.0, 0.5]));
    // frozen occupant
    if (o.empty !== true) {
      g.add(part(geo.sphere, P.frost, 0xc8d8e8, [0, 1.85, 0], [0.12, 0.14, 0.12]));
      g.add(part(geo.box, P.frost, 0xa8b8c8, [0, 1.3, 0], [0.3, 0.75, 0.18]));
      g.add(part(geo.box, P.frost, 0xa8b8c8, [0, 0.65, 0], [0.26, 0.6, 0.15]));
    }
    g.add(part(geo.box, P.glowV, o.broken ? 0xff3030 : 0x60d0ff, [0, 0.31, 0.56], [0.6, 0.06, 0.02]));
    return { obj: g, circles: [{ x: 0, z: 0, r: 0.6 }], lights: [{ x: 0, y: 1.2, z: 0.6, color: o.broken ? 0xff4040 : 0x80d8ff, intensity: 4, range: 5, flicker: o.broken ? 0.5 : 0 }] };
  },
  iceBlock: (r) => {
    const P = PM();
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) g.add(part(geo.ico, P.frost, 0xc8e4f8, [rrange(r, -0.6, 0.6), rrange(r, 0.4, 0.9), rrange(r, -0.6, 0.6)], [rrange(r, 0.5, 0.9), rrange(r, 0.6, 1.2), rrange(r, 0.5, 0.9)], [r(), r(), r()]));
    return { obj: g, circles: [{ x: 0, z: 0, r: 0.9 }] };
  },
  icicles: (r) => {
    const P = PM();
    const g = new THREE.Group();
    for (let i = 0; i < 8; i++) g.add(part(geo.cone, P.iceGlass, 0xffffff, [rrange(r, -1.3, 1.3), 4.4 - 0.5, rrange(r, -0.2, 0.2)], [0.08, rrange(r, 0.5, 1.3), 0.08], [Math.PI, 0, 0]));
    return { obj: g };
  },
  bed: () => {
    const P = PM();
    const g = group(part(geo.box, P.metal, 0x5a6068, [0, 0.25, 0], [1.1, 0.5, 2.1]));
    g.add(part(geo.box, P.paint, 0xd0d4dc, [0, 0.55, 0], [1.0, 0.15, 2.0]));
    g.add(part(geo.box, P.paint, 0xf0f0f4, [0, 0.66, -0.75], [0.7, 0.12, 0.4]));
    g.add(part(geo.box, P.paint, 0x3a4a6a, [0, 0.64, 0.3], [1.02, 0.08, 1.3]));
    return { obj: g, boxes: [{ x: 0, z: 0, w: 1.1, d: 2.1, h: 0.7 }] };
  },
  desk: (r) => {
    const P = PM();
    const g = group(part(geo.box, P.wood, 0x5a4030, [0, 0.75, 0], [1.6, 0.06, 0.8]));
    for (const [x, z] of [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]]) g.add(part(geo.box, P.metal, 0x3a3a3a, [x, 0.37, z], [0.05, 0.75, 0.05]));
    g.add(part(geo.box, P.paint, 0xe8e0d0, [rrange(r, -0.4, 0.4), 0.79, 0], [0.3, 0.02, 0.4], [0, r(), 0]));
    return { obj: g, boxes: [{ x: 0, z: 0, w: 1.6, d: 0.8, h: 0.8 }] };
  },
  table: (r) => {
    const P = PM();
    const g = group(part(geo.cyl, P.wood, 0x6a4a30, [0, 0.75, 0], [0.7, 0.06, 0.7]));
    g.add(part(geo.cyl, P.metal, 0x2a2a2a, [0, 0.37, 0], [0.06, 0.75, 0.06]));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + r();
      g.add(part(geo.box, P.metal, 0x3a3a40, [Math.cos(a) * 1.0, 0.45, Math.sin(a) * 1.0], [0.45, 0.06, 0.45]));
    }
    return { obj: g, circles: [{ x: 0, z: 0, r: 0.75 }] };
  },
  locker: () => {
    const P = PM();
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      g.add(part(geo.box, P.metal, 0x4a5a6a, [-0.6 + i * 0.6, 1.0, 0], [0.56, 2.0, 0.5]));
      g.add(part(geo.box, P.paint, 0x2a3440, [-0.6 + i * 0.6, 1.7, 0.26], [0.3, 0.05, 0.01]));
    }
    return { obj: g, boxes: [{ x: 0, z: 0, w: 1.8, d: 0.5, h: 2 }] };
  },
  sofa: () => {
    const P = PM();
    const g = group(part(geo.box, P.paint, 0x5a2a2a, [0, 0.3, 0], [2, 0.6, 0.9]));
    g.add(part(geo.box, P.paint, 0x5a2a2a, [0, 0.75, -0.35], [2, 0.6, 0.2]));
    return { obj: g, boxes: [{ x: 0, z: 0, w: 2, d: 0.9, h: 1 }] };
  },
  chandelier: (r, o) => {
    const P = PM();
    const y = o.y ?? 7;
    const g = group(part(geo.cyl, P.metal, 0xb09040, [0, y + 1.5, 0], [0.03, 3, 0.03]));
    g.add(part(geo.torus, P.metal, 0xb09040, [0, y, 0], [1.2, 1.2, 1], [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.add(part(geo.sphere, P.glowV, 0xffd8a0, [Math.cos(a) * 1.2, y + 0.15, Math.sin(a) * 1.2], [0.08, 0.12, 0.08]));
    }
    g.add(part(geo.cone, P.glowV, 0xffe8c0, [0, y - 0.4, 0], [0.4, 0.8, 0.4], [Math.PI, 0, 0]));
    return { obj: g, lights: [{ x: 0, y: y - 0.5, z: 0, color: 0xffc890, intensity: 30, range: 16, flicker: 0.05 }] };
  },
  podium: (r, o) => {
    const P = PM();
    const c = o.color ?? 0x5a2030;
    const g = group(part(geo.cyl8, P.wood, 0x3a2418, [0, 0.55, 0], [0.55, 1.1, 0.55]));
    g.add(part(geo.cyl8, P.paint, c, [0, 1.12, 0], [0.62, 0.06, 0.62]));
    g.add(part(geo.box, P.glowV, o.glow ?? 0xff3060, [0, 0.9, 0.52], [0.5, 0.04, 0.02]));
    return { obj: g };
  },
  shippingContainer: (r, o) => {
    const P = PM();
    const c = o.color ?? rpick(r, [0xa03a28, 0x2a5a8a, 0x3a7a4a, 0xc08a20, 0x6a6a72]);
    const g = new THREE.Group();
    const L = 6.1, W = 2.45, H = 2.6;
    g.add(part(geo.box, P.container, c, [0, H / 2, 0], [W, H, L]));
    g.add(part(geo.box, P.metal, 0x2a2a2a, [0, H, 0], [W + 0.05, 0.08, L + 0.05]));
    g.add(part(geo.box, P.metal, 0x2a2a2a, [0, 0.04, 0], [W + 0.05, 0.08, L + 0.05]));
    return { obj: g, boxes: [{ x: 0, z: 0, w: W, d: L, h: H, block: true }], shadow: true };
  },
  pallet: () => {
    const P = PM();
    const g = group(part(geo.box, P.wood, 0x8a7050, [0, 0.07, 0], [1.2, 0.14, 1.0]));
    g.add(part(geo.box, P.paint, 0x9a9a9a, [0, 0.45, 0], [1.1, 0.6, 0.9]));
    return { obj: g, boxes: [{ x: 0, z: 0, w: 1.2, d: 1.0, h: 0.75 }] };
  },
  sandbags: () => {
    const P = PM();
    const g = new THREE.Group();
    for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) g.add(part(geo.sphere, P.paint, 0x8a7a5a, [-0.9 + i * 0.6 + row * 0.3, 0.15 + row * 0.25, 0], [0.32, 0.15, 0.25]));
    return { obj: g, boxes: [{ x: 0, z: 0, w: 2.4, d: 0.6, h: 0.8 }] };
  },
  sign: (r, o) => {
    const text = o.text ?? 'GLOOMTECH';
    const col = o.color ?? '#3ef0ff';
    const w = o.w ?? 3, h = o.h ?? 0.75;
    const tex = textTexture(text, { w: 512, h: 128, color: col, bg: 'rgba(6,10,16,0.85)' });
    const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(o.bright ?? 2.2, o.bright ?? 2.2, o.bright ?? 2.2), transparent: true });
    const mesh = new THREE.Mesh(geo.plane, m);
    mesh.scale.set(w, h, 1);
    mesh.position.y = o.y ?? 3.2;
    const g = group(mesh);
    const c = new THREE.Color(col);
    return { obj: g, dynamic: true, lights: o.light === false ? [] : [{ x: 0, y: o.y ?? 3.2, z: 0.8, color: c.getHex(), intensity: 4, range: 6 }] };
  },
  poster: (r, o) => {
    const ads = [
      ['EVOLUTION ENHANCER™', '#ff5fd2'],
      ['GLOOMTECH · POWERING TOMORROW', '#3ef0ff'],
      ['GEOTHERMAL UTOPIA NOW', '#ffd84a'],
      ['TRUST THE GLOW', '#9dff5a'],
      ['YOU ARE BEING ENTERTAINED', '#ff5a5a'],
      ['GLOOMY SAYS: SMILE!', '#b06cff'],
    ];
    const [t, c] = o.text ? [o.text, o.color ?? '#3ef0ff'] : rpick(r, ads);
    return PROPS.sign(r, { text: t, color: c, w: 2.4, h: 0.6, y: o.y ?? 2.6, light: false, bright: 1.6 });
  },
  gloomyCluster: (r, o) => {
    const P = PM();
    const g = new THREE.Group();
    const n = o.n ?? 4;
    for (let i = 0; i < n; i++) {
      const s = rrange(r, 0.6, 1.3) * (o.scale ?? 1);
      const x = rrange(r, -0.5, 0.5), z = rrange(r, -0.5, 0.5);
      const cc = rpick(r, [0x30c8ff, 0x8a5aff, 0xff5ad0]);
      g.add(part(geo.cyl8, P.glowSoft, 0x9ab8d0, [x, 0.15 * s, z], [0.04 * s, 0.3 * s, 0.04 * s]));
      g.add(part(geo.hemi, P.glowV, cc, [x, 0.3 * s, z], [0.15 * s, 0.1 * s, 0.15 * s]));
    }
    return { obj: g, lights: [{ x: 0, y: 0.6, z: 0, color: 0x50a0ff, intensity: 5, range: 6 }] };
  },
  workbench: () => {
    const P = PM();
    const g = group(part(geo.box, P.wood, 0x6a5038, [0, 0.9, 0], [2.4, 0.1, 1.0]));
    for (const [x, z] of [[-1.1, -0.4], [1.1, -0.4], [-1.1, 0.4], [1.1, 0.4]]) g.add(part(geo.box, P.metal, 0x3a3a3a, [x, 0.45, z], [0.08, 0.9, 0.08]));
    g.add(part(geo.box, P.metal, 0x4a4a50, [0, 1.6, -0.45], [2.4, 1.3, 0.06]));
    for (let i = 0; i < 6; i++) g.add(part(geo.box, P.metal, 0x8a8a90, [-1 + i * 0.4, 1.7, -0.4], [0.05, 0.4, 0.03], [0, 0, 0.2]));
    g.add(part(geo.box, P.paint, 0xd0a020, [0.6, 1.05, 0.1], [0.5, 0.2, 0.3]));
    g.add(part(geo.box, P.glowV, 0x3fa7ff, [-0.6, 1.0, 0.1], [0.3, 0.02, 0.3]));
    return { obj: g, boxes: [{ x: 0, z: 0, w: 2.4, d: 1.0, h: 1 }], lights: [{ x: 0, y: 2.2, z: 0.6, color: 0xffd8a0, intensity: 8, range: 6 }] };
  },
  vendor: () => {
    const P = PM();
    const g = group(part(geo.box, P.metal, 0x16121e, [0, 1.15, 0], [1.4, 2.3, 0.9]));
    g.add(part(geo.box, P.glowSoft, 0x3a1a5a, [-0.15, 1.3, 0.46], [0.9, 1.5, 0.02]));
    for (let i = 0; i < 12; i++) g.add(part(geo.box, P.glowV, [0xff5fd2, 0x3ef0ff, 0xffd84a, 0x9dff5a][i % 4], [-0.45 + (i % 3) * 0.3, 0.75 + Math.floor(i / 3) * 0.35, 0.47], [0.18, 0.18, 0.02]));
    g.add(part(geo.box, P.glowV, 0xff5fd2, [0, 2.2, 0.46], [1.3, 0.12, 0.02]));
    g.add(part(geo.box, P.glowV, 0x3ef0ff, [0.5, 1.2, 0.46], [0.18, 0.4, 0.02]));
    return { obj: g, boxes: [{ x: 0, z: 0, w: 1.4, d: 0.9, h: 2.3 }], lights: [{ x: 0, y: 1.5, z: 1, color: 0xff5fd2, intensity: 6, range: 6 }] };
  },
  medbed: () => {
    const P = PM();
    const g = group(part(geo.box, P.lab, 0xe8ecf0, [0, 0.45, 0], [1.0, 0.9, 2.1]));
    g.add(part(geo.box, P.paint, 0x2a9a98, [0, 0.95, 0], [0.95, 0.1, 2.0]));
    g.add(part(geo.cyl, P.metal, 0xb0b8c0, [0.7, 1.0, -0.8], [0.03, 2, 0.03]));
    g.add(part(geo.box, P.glowV, 0x40ff80, [0.7, 1.9, -0.8], [0.3, 0.25, 0.04]));
    return { obj: g, boxes: [{ x: 0, z: 0, w: 1.0, d: 2.1, h: 1 }], lights: [{ x: 0, y: 2.6, z: 0, color: 0xc0fff0, intensity: 6, range: 6 }] };
  },
  holoPillar: () => {
    const P = PM();
    const g = group(part(geo.cyl8, P.metal, 0x1a1e26, [0, 0.4, 0], [1.4, 0.8, 1.4]));
    g.add(part(geo.cyl8, P.glowV, 0xff2a4a, [0, 0.82, 0], [1.2, 0.04, 1.2]));
    g.add(part(geo.torus, P.glowV, 0xff2a4a, [0, 0.3, 0], [1.42, 1.42, 1], [Math.PI / 2, 0, 0]));
    return { obj: g, circles: [{ x: 0, z: 0, r: 1.4 }], lights: [{ x: 0, y: 2, z: 0, color: 0xff3050, intensity: 10, range: 9 }] };
  },
  coreWindow: () => {
    // view into the Polaris Core
    const P = PM();
    const g = group(part(geo.box, P.metal, 0x22262e, [0, 2.5, 0], [6, 5, 0.4]));
    g.add(part(geo.box, P.glowV, 0x80e8ff, [0, 2.6, 0.21], [4.8, 3.4, 0.02]));
    g.add(part(geo.sphere, P.glowV, 0xffffff, [0, 2.6, 0.25], [0.9, 0.9, 0.05]));
    return { obj: g, lights: [{ x: 0, y: 2.6, z: 1.5, color: 0x80e8ff, intensity: 20, range: 12, flicker: 0.05 }] };
  },
  antenna: (r) => {
    const P = PM();
    const g = group(part(geo.cyl6, P.metal, 0x4a4e56, [0, 4, 0], [0.12, 8, 0.12]));
    for (let i = 0; i < 4; i++) g.add(part(geo.box, P.metal, 0x4a4e56, [0, 3 + i * 1.2, 0], [1.2 - i * 0.2, 0.05, 0.05], [0, i * 0.7, 0]));
    g.add(part(geo.sphere, P.glowV, 0xff3030, [0, 8.1, 0], [0.12, 0.12, 0.12]));
    return { obj: g, circles: [{ x: 0, z: 0, r: 0.2 }] };
  },
  crane: () => {
    const P = PM();
    const g = group(part(geo.box, P.metal, 0xc08a20, [0, 6, 0], [1.2, 12, 1.2]));
    g.add(part(geo.box, P.metal, 0xc08a20, [0, 12, 5], [1, 1, 12]));
    g.add(part(geo.cyl, P.metal, 0x2a2a2a, [0, 9, 10.5], [0.03, 6, 0.03]));
    g.add(part(geo.box, P.metal, 0x2a2a2a, [0, 6, 10.5], [1.5, 0.3, 0.6]));
    g.add(part(geo.box, P.glowV, 0xff3030, [0, 12.6, 10.8], [0.2, 0.2, 0.2]));
    return { obj: g, boxes: [{ x: 0, z: 0, w: 1.4, d: 1.4, h: 12 }], shadow: true };
  },
  railing: () => {
    const P = PM();
    const g = group(part(geo.box, P.metal, 0x3a3e46, [0, 1.05, 0], [3, 0.06, 0.06]));
    g.add(part(geo.box, P.metal, 0x3a3e46, [0, 0.55, 0], [3, 0.04, 0.04]));
    for (let i = 0; i < 3; i++) g.add(part(geo.box, P.metal, 0x3a3e46, [-1.5 + i * 1.5, 0.53, 0], [0.06, 1.06, 0.06]));
    return { obj: g };
  },
  lifeboat: () => {
    const P = PM();
    // enclosed survival craft: orange hull with a wedge bow, domed canopy, lit portholes
    const g = group(part(geo.box, P.paint, 0xff6a20, [0, 0.95, -0.3], [2.4, 1.3, 5.0]));
    g.add(part(geo.box, P.paint, 0xff6a20, [0, 0.95, 2.2], [1.7, 1.3, 1.7], [0, Math.PI / 4, 0]));
    g.add(part(geo.box, P.paint, 0x2a2a2a, [0, 0.25, 0], [2.3, 0.3, 5.6]));
    g.add(part(geo.hemi, P.paint, 0xff7a30, [0, 1.6, -0.4], [1.15, 0.95, 2.5]));
    g.add(part(geo.box, P.paint, 0xffffff, [1.21, 1.35, -0.3], [0.02, 0.18, 4.8]));
    g.add(part(geo.box, P.paint, 0xffffff, [-1.21, 1.35, -0.3], [0.02, 0.18, 4.8]));
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) g.add(part(geo.box, P.glowV, 0xffd890, [sx * 1.02, 1.95, -1.9 + i * 0.95], [0.06, 0.2, 0.42]));
    g.add(part(geo.box, P.paint, 0x1a1a1a, [0, 2.45, -0.4], [0.5, 0.25, 0.9]));
    g.add(part(geo.box, P.glowV, 0xff3030, [0, 2.65, -0.4], [0.12, 0.12, 0.12]));
    return { obj: g, boxes: [{ x: 0, z: 0, w: 2.4, d: 6, h: 2.5, block: true }], shadow: true };
  },
  pipeRun: (r, o) => {
    const P = PM();
    const L = o.len ?? 3;
    const g = new THREE.Group();
    for (let i = 0; i < 2; i++) g.add(part(geo.cyl, P.rust, rpick(r, [0x5a4a3a, 0x4a5a5a]), [0, o.y ?? 3.4 + i * 0.4, 0], [0.13, L, 0.13], [0, 0, Math.PI / 2]));
    return { obj: g };
  },
  bones: (r) => {
    const P = PM();
    const g = new THREE.Group();
    g.add(part(geo.sphere, P.paint, 0xd8d0b8, [0, 0.12, 0], [0.12, 0.12, 0.13]));
    for (let i = 0; i < 4; i++) g.add(part(geo.cyl6, P.paint, 0xd8d0b8, [rrange(r, -0.5, 0.5), 0.04, rrange(r, -0.5, 0.5)], [0.03, rrange(r, 0.3, 0.5), 0.03], [Math.PI / 2, r() * 3, 0]));
    return { obj: g };
  },
  puddle: (r, o) => {
    const P = PM();
    const g = group(part(geo.cyl, P.glowSoft, o.color ?? 0x2a5a2a, [0, 0.02, 0], [rrange(r, 0.6, 1.2), 0.01, rrange(r, 0.6, 1.2)]));
    return { obj: g };
  },
  throne: () => {
    // Captain's screen in the ballroom
    const P = PM();
    const g = group(part(geo.box, P.metal, 0x14161c, [0, 6, 0], [7, 4.2, 0.4]));
    g.add(part(geo.box, P.glowSoft, 0x2a0810, [0, 6, 0.21], [6.4, 3.6, 0.02]));
    g.add(part(geo.box, P.glowV, 0xff2a4a, [0, 3.85, 0.22], [7, 0.08, 0.02]));
    g.add(part(geo.box, P.glowV, 0xff2a4a, [0, 8.15, 0.22], [7, 0.08, 0.02]));
    g.add(part(geo.cyl, P.metal, 0x14161c, [-2.5, 2, 0], [0.2, 4, 0.2]));
    g.add(part(geo.cyl, P.metal, 0x14161c, [2.5, 2, 0], [0.2, 4, 0.2]));
    return { obj: g, lights: [{ x: 0, y: 6, z: 2, color: 0xff2a4a, intensity: 18, range: 14 }] };
  },
  reactor: () => {
    const P = PM();
    const g = group(part(geo.cyl8, P.metal, 0x22262e, [0, 1, 0], [5, 2, 5]));
    g.add(part(geo.cyl8, P.glowV, 0x60e0ff, [0, 2.05, 0], [3.6, 0.1, 3.6]));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(part(geo.box, P.metal, 0x3a3e48, [Math.cos(a) * 4.4, 4, Math.sin(a) * 4.4], [0.6, 6, 0.6]));
      g.add(part(geo.box, P.glowV, 0x60e0ff, [Math.cos(a) * 4.1, 4, Math.sin(a) * 4.1], [0.1, 5, 0.1]));
    }
    return { obj: g, circles: [{ x: 0, z: 0, r: 5 }], lights: [{ x: 0, y: 3, z: 0, color: 0x60e0ff, intensity: 40, range: 22, flicker: 0.1 }] };
  },
  lampCage: (r, o) => {
    const P = PM();
    const col = o.color ?? 0xffa050;
    const y = o.y ?? 5.6;
    const g = group(part(geo.cyl, P.metal, 0x2a2a2a, [0, y + 0.6, 0], [0.02, 1.2, 0.02]));
    g.add(part(geo.cone, P.metal, 0x3a3a3a, [0, y + 0.1, 0], [0.4, 0.3, 0.4]));
    g.add(part(geo.sphere, P.glowV, col, [0, y - 0.05, 0], [0.15, 0.15, 0.15]));
    return { obj: g, lights: [{ x: 0, y: y - 0.3, z: 0, color: col, intensity: 20, range: 13, flicker: o.flicker ?? (r() < 0.25 ? 0.7 : 0.05) }] };
  },
  ceilingLamp: (r, o) => {
    const P = PM();
    const col = o.color ?? 0xd0f8ff;
    const y = o.y ?? 4.4;
    const g = group(part(geo.box, P.metal, 0x3a3e44, [0, y, 0], [1.6, 0.1, 0.4]));
    g.add(part(geo.box, P.glowV, col, [0, y - 0.06, 0], [1.4, 0.03, 0.25]));
    return { obj: g, lights: [{ x: 0, y: y - 0.4, z: 0, color: col, intensity: 16, range: 11, flicker: o.flicker ?? (r() < 0.2 ? 0.8 : 0) }] };
  },
  uvLamp: (r, o) => {
    const P = PM();
    const col = o.color ?? 0xb070ff;
    const g = group(part(geo.cyl, P.metal, 0x2a2e34, [0, 2, 0], [0.06, 4, 0.06]));
    g.add(part(geo.box, P.metal, 0x2a2e34, [0, 4, 0], [1.4, 0.12, 0.3]));
    g.add(part(geo.box, P.glowV, col, [0, 3.92, 0], [1.3, 0.05, 0.2]));
    return { obj: g, circles: [{ x: 0, z: 0, r: 0.12 }], lights: [{ x: 0, y: 3.6, z: 0, color: col, intensity: 16, range: 12 }] };
  },
  porthole: (r) => {
    const P = PM();
    const g = group(part(geo.torus, P.metal, 0x8a9aa0, [0, 2.4, 0.02], [0.6, 0.6, 1.2]));
    g.add(part(geo.cyl, P.glowSoft, 0x0a3a5a, [0, 2.4, 0], [0.55, 0.02, 0.55], [Math.PI / 2, 0, 0]));
    g.add(part(geo.cone4, P.glowV, 0x40ffd0, [rrange(r, -0.2, 0.2), 2.4 + rrange(r, -0.2, 0.2), 0.0], [0.04, 0.12, 0.02], [0, 0, Math.PI / 2]));
    return { obj: g };
  },
  monitor: (r) => {
    const P = PM();
    const c = rpick(r, [0x30d0ff, 0x40ff80, 0xff4060]);
    const g = group(part(geo.box, P.metal, 0x22262c, [0, 2.2, 0.06], [1.4, 0.9, 0.12]));
    g.add(part(geo.box, P.glowSoft, c, [0, 2.2, 0.13], [1.25, 0.75, 0.02]));
    return { obj: g };
  },
  aquariumSmall: (r) => PROPS.aquarium(r, { w: 2, h: 2, d: 1 }),
};

export function buildProp(kind: string, seed: number, opts: any = {}): PropOut {
  const f = PROPS[kind];
  if (!f) throw new Error('Unknown prop ' + kind);
  return f(rng(seed), opts);
}
