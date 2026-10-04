import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PM, part } from '../world/Props';
import type { ItemId } from '../world/LevelDef';
import type { WeaponId } from '../game/State';
import { normalizeGeo } from '../gfx/Materials';

const g = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  sphere: new THREE.SphereGeometry(1, 10, 8),
  cone: new THREE.ConeGeometry(1, 1, 8),
  torus: new THREE.TorusGeometry(1, 0.2, 6, 14),
  ico: new THREE.IcosahedronGeometry(1, 0),
};

/** Merge a group's meshes per material into a compact object (keeps it cheap to render). */
export function compact(src: THREE.Object3D): THREE.Group {
  src.updateMatrixWorld(true);
  const by = new Map<THREE.Material, THREE.BufferGeometry[]>();
  src.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.Material;
    const geo = normalizeGeo(m.geometry, m.userData.color !== undefined ? new THREE.Color(m.userData.color) : undefined);
    geo.applyMatrix4(m.matrixWorld);
    let arr = by.get(mat);
    if (!arr) by.set(mat, (arr = []));
    arr.push(geo);
  });
  const out = new THREE.Group();
  for (const [mat, geos] of by) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    out.add(mesh);
    geos.forEach((x) => x.dispose());
  }
  return out;
}

/** Weapon model in "gun space": barrel along +Z, top +Y, grip at origin. */
export function weaponModel(id: WeaponId): THREE.Group {
  const P = PM();
  const gr = new THREE.Group();
  switch (id) {
    case 'pipe':
      gr.add(part(g.cyl, P.metal, 0x6a6e74, [0, 0, 0.35], [0.025, 0.85, 0.025], [Math.PI / 2, 0, 0]));
      gr.add(part(g.cyl, P.metal, 0x4a4e54, [0, 0, 0.78], [0.035, 0.08, 0.035], [Math.PI / 2, 0, 0]));
      gr.add(part(g.cyl, P.paint, 0x2a2a2a, [0, 0, -0.02], [0.03, 0.14, 0.03], [Math.PI / 2, 0, 0]));
      break;
    case 'axe':
      gr.add(part(g.cyl, P.wood, 0x8a5a30, [0, 0, 0.35], [0.028, 0.85, 0.028], [Math.PI / 2, 0, 0]));
      gr.add(part(g.box, P.metal, 0xc02020, [0, 0.08, 0.72], [0.03, 0.22, 0.12]));
      gr.add(part(g.box, P.metal, 0xd0d4d8, [0, 0.2, 0.72], [0.025, 0.06, 0.14]));
      break;
    case 'pistol':
      gr.add(part(g.box, P.metal, 0x22262c, [0, 0.07, 0.08], [0.045, 0.06, 0.24]));
      gr.add(part(g.box, P.paint, 0x16181c, [0, -0.02, 0.0], [0.04, 0.12, 0.06], [0.25, 0, 0]));
      gr.add(part(g.box, P.glowV, 0x3ef0ff, [0.024, 0.07, 0.08], [0.004, 0.012, 0.16]));
      gr.add(part(g.cyl, P.metal, 0x101214, [0, 0.07, 0.21], [0.012, 0.03, 0.012], [Math.PI / 2, 0, 0]));
      break;
    case 'shotgun':
      gr.add(part(g.cyl, P.metal, 0x2a2c30, [0, 0.06, 0.32], [0.022, 0.62, 0.022], [Math.PI / 2, 0, 0]));
      gr.add(part(g.cyl, P.metal, 0x2a2c30, [0, 0.02, 0.28], [0.02, 0.5, 0.02], [Math.PI / 2, 0, 0]));
      gr.add(part(g.box, P.wood, 0x6a4020, [0, 0.03, 0.3], [0.05, 0.05, 0.14]));
      gr.add(part(g.box, P.metal, 0x1a1c20, [0, 0.03, 0.02], [0.05, 0.09, 0.2]));
      gr.add(part(g.box, P.wood, 0x6a4020, [0, -0.01, -0.2], [0.045, 0.1, 0.3], [0.15, 0, 0]));
      gr.add(part(g.box, P.glowV, 0xff8040, [0.026, 0.05, 0.05], [0.004, 0.01, 0.08]));
      break;
    case 'arc':
      gr.add(part(g.box, P.metal, 0x1a2028, [0, 0.04, 0.1], [0.07, 0.1, 0.42]));
      gr.add(part(g.cyl, P.metal, 0x3a4048, [0, 0.05, 0.42], [0.03, 0.22, 0.03], [Math.PI / 2, 0, 0]));
      for (let i = 0; i < 3; i++) gr.add(part(g.torus, P.glowV, 0x60e0ff, [0, 0.05, 0.36 + i * 0.07], [0.045, 0.045, 0.6]));
      gr.add(part(g.cyl, P.glowV, 0x60e0ff, [0, 0.11, 0.05], [0.025, 0.2, 0.025], [Math.PI / 2, 0, 0]));
      gr.add(part(g.box, P.paint, 0x16181c, [0, -0.05, 0.0], [0.05, 0.12, 0.06], [0.25, 0, 0]));
      gr.add(part(g.box, P.metal, 0x1a2028, [0, 0.0, -0.22], [0.05, 0.1, 0.22]));
      break;
  }
  return compact(gr);
}

/** Attach a weapon to a character's right hand bone. */
export function attachWeapon(hand: THREE.Bone, id: WeaponId): THREE.Group {
  const w = weaponModel(id);
  const holder = new THREE.Group();
  holder.add(w);
  if (id === 'pipe' || id === 'axe') {
    // pipe extends out of the fist, roughly perpendicular to the forearm
    holder.rotation.set(-0.35, 0, 0);
    holder.position.set(0, -0.06, 0.0);
  } else {
    // barrel along the hand's -Y (the forearm direction)
    holder.rotation.set(Math.PI / 2, 0, 0);
    holder.position.set(0, -0.07, 0.03);
  }
  hand.add(holder);
  return holder;
}

export function itemModel(id: ItemId | 'gloomy' | 'log' | 'evidence'): THREE.Group {
  const P = PM();
  const gr = new THREE.Group();
  switch (id) {
    case 'pistolAmmo':
      gr.add(part(g.box, P.paint, 0x3a4a2a, [0, 0.1, 0], [0.3, 0.2, 0.2]));
      gr.add(part(g.box, P.glowV, 0xffd060, [0, 0.15, 0.101], [0.2, 0.05, 0.005]));
      break;
    case 'shells':
      for (let i = 0; i < 4; i++) gr.add(part(g.cyl, P.paint, 0xc03020, [-0.12 + i * 0.08, 0.08, 0], [0.035, 0.16, 0.035]));
      for (let i = 0; i < 4; i++) gr.add(part(g.cyl, P.metal, 0xd0a040, [-0.12 + i * 0.08, 0.01, 0], [0.037, 0.03, 0.037]));
      break;
    case 'cells':
      gr.add(part(g.cyl, P.metal, 0x2a3038, [0, 0.12, 0], [0.07, 0.24, 0.07]));
      gr.add(part(g.cyl, P.glowV, 0x60e0ff, [0, 0.12, 0], [0.075, 0.12, 0.075]));
      break;
    case 'medkit':
      gr.add(part(g.box, P.paint, 0xf0f0f0, [0, 0.12, 0], [0.38, 0.24, 0.16]));
      gr.add(part(g.box, P.glowV, 0xff3030, [0, 0.12, 0.081], [0.18, 0.05, 0.005]));
      gr.add(part(g.box, P.glowV, 0xff3030, [0, 0.12, 0.081], [0.05, 0.18, 0.005]));
      break;
    case 'bandage':
      gr.add(part(g.cyl, P.paint, 0xf0e8d8, [0, 0.07, 0], [0.09, 0.12, 0.09], [Math.PI / 2, 0, 0]));
      break;
    case 'pills':
      gr.add(part(g.cyl, P.paint, 0xd0c0f0, [0, 0.1, 0], [0.06, 0.2, 0.06]));
      gr.add(part(g.cyl, P.glowV, 0xb06cff, [0, 0.22, 0], [0.065, 0.05, 0.065]));
      break;
    case 'scrap':
      gr.add(part(g.torus, P.metal, 0x9aa0a8, [0, 0.06, 0], [0.12, 0.12, 0.8], [Math.PI / 2, 0, 0]));
      gr.add(part(g.box, P.metal, 0x7a8088, [0.08, 0.1, 0.05], [0.18, 0.04, 0.06], [0, 0.5, 0.3]));
      gr.add(part(g.cyl6, P.metal, 0xb0a070, [-0.06, 0.08, -0.06], [0.03, 0.14, 0.03], [0.4, 0, 0.6]));
      break;
    case 'chem':
      gr.add(part(g.sphere, P.paint, 0xd0e8e0, [0, 0.1, 0], [0.09, 0.09, 0.09]));
      gr.add(part(g.cyl, P.paint, 0xd0e8e0, [0, 0.22, 0], [0.03, 0.1, 0.03]));
      gr.add(part(g.sphere, P.glowV, 0x80ff60, [0, 0.09, 0], [0.07, 0.06, 0.07]));
      break;
    case 'cloth':
      gr.add(part(g.box, P.paint, 0xd8c8a8, [0, 0.05, 0], [0.3, 0.1, 0.22], [0, 0.3, 0]));
      gr.add(part(g.box, P.paint, 0x8a6a5a, [0.02, 0.11, 0], [0.26, 0.04, 0.2], [0, 0.6, 0]));
      break;
    case 'flare':
      gr.add(part(g.cyl, P.paint, 0xd02020, [0, 0.03, 0], [0.03, 0.3, 0.03], [0, 0, Math.PI / 2]));
      gr.add(part(g.cyl, P.glowV, 0xff6040, [0.16, 0.03, 0], [0.032, 0.04, 0.032], [0, 0, Math.PI / 2]));
      break;
    case 'pipebomb':
      gr.add(part(g.cyl, P.metal, 0x6a6a6a, [0, 0.06, 0], [0.05, 0.25, 0.05], [0, 0, Math.PI / 2]));
      gr.add(part(g.cyl, P.paint, 0x2a2a2a, [0.15, 0.06, 0], [0.006, 0.08, 0.006], [0, 0, 1]));
      break;
    case 'pistol':
    case 'shotgun':
    case 'arc':
    case 'axe': {
      const w = weaponModel(id as WeaponId);
      w.rotation.set(0, Math.PI / 2, Math.PI / 2);
      w.position.y = 0.1;
      gr.add(w);
      break;
    }
    case 'credits':
      gr.add(part(g.cyl, P.glowV, 0xffd84a, [0, 0.1, 0], [0.1, 0.02, 0.1], [Math.PI / 2, 0, 0]));
      break;
    case 'fuse':
      gr.add(part(g.cyl, P.paint, 0xe8e0d0, [0, 0.12, 0], [0.06, 0.22, 0.06]));
      gr.add(part(g.cyl, P.metal, 0xc0a040, [0, 0.0, 0], [0.065, 0.04, 0.065]));
      gr.add(part(g.cyl, P.metal, 0xc0a040, [0, 0.24, 0], [0.065, 0.04, 0.065]));
      gr.add(part(g.cyl, P.glowV, 0xffc040, [0, 0.12, 0], [0.062, 0.03, 0.062]));
      break;
    case 'keyRed':
    case 'keyBlue':
    case 'keyGreen':
    case 'labKey': {
      const c = id === 'keyRed' ? 0xff4040 : id === 'keyBlue' ? 0x4080ff : id === 'keyGreen' ? 0x40ff80 : 0xff5fd2;
      gr.add(part(g.box, P.paint, 0xf0f0f0, [0, 0.1, 0], [0.2, 0.13, 0.01]));
      gr.add(part(g.box, P.glowV, c, [0, 0.13, 0.006], [0.2, 0.04, 0.003]));
      break;
    }
    case 'coreKey':
      gr.add(part(g.torus, P.metal, 0xd4a640, [0, 0.16, 0], [0.05, 0.05, 1]));
      gr.add(part(g.box, P.metal, 0xd4a640, [0, 0.05, 0], [0.025, 0.18, 0.01]));
      gr.add(part(g.box, P.glowV, 0xff2a4a, [0, 0.0, 0], [0.04, 0.04, 0.012]));
      break;
    case 'valve':
      gr.add(part(g.torus, P.metal, 0xd08040, [0, 0.15, 0], [0.15, 0.15, 1]));
      gr.add(part(g.box, P.metal, 0xd08040, [0, 0.15, 0], [0.28, 0.025, 0.025]));
      gr.add(part(g.box, P.metal, 0xd08040, [0, 0.15, 0], [0.025, 0.28, 0.025]));
      break;
    case 'uvBulb':
      gr.add(part(g.cyl, P.metal, 0x3a3a3a, [0, 0.05, 0], [0.05, 0.1, 0.05]));
      gr.add(part(g.sphere, P.glowV, 0xb070ff, [0, 0.17, 0], [0.08, 0.12, 0.08]));
      break;
    case 'thermal':
      for (let i = 0; i < 5; i++) gr.add(part(g.torus, P.glowV, 0xff7030, [0, 0.04 + i * 0.05, 0], [0.07, 0.07, 1], [Math.PI / 2, 0, 0]));
      gr.add(part(g.cyl, P.metal, 0x5a5a5a, [0, 0.14, 0], [0.02, 0.3, 0.02]));
      break;
    case 'gloomy':
      for (let i = 0; i < 3; i++) {
        const s = [1, 0.7, 0.55][i];
        const x = [0, 0.14, -0.12][i], z = [0, 0.06, 0.08][i];
        gr.add(part(g.cyl, P.glowSoft, 0xa8c8e0, [x, 0.12 * s, z], [0.03 * s, 0.24 * s, 0.03 * s]));
        gr.add(part(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), P.glowV, [0x30c8ff, 0x8a5aff, 0xff5ad0][i], [x, 0.23 * s, z], [0.14 * s, 0.1 * s, 0.14 * s]));
        gr.add(part(g.sphere, P.paint, 0x0a0a14, [x - 0.03 * s, 0.27 * s, z + 0.12 * s], [0.012, 0.016, 0.01]));
        gr.add(part(g.sphere, P.paint, 0x0a0a14, [x + 0.03 * s, 0.27 * s, z + 0.12 * s], [0.012, 0.016, 0.01]));
      }
      break;
    case 'log':
      gr.add(part(g.box, P.metal, 0x22262e, [0, 0.06, 0], [0.22, 0.12, 0.14]));
      gr.add(part(g.cyl, P.glowV, 0xff3040, [0.06, 0.13, 0.03], [0.02, 0.02, 0.02]));
      gr.add(part(g.box, P.glowSoft, 0x30d0ff, [-0.02, 0.121, 0], [0.12, 0.003, 0.08]));
      gr.add(part(g.cyl, P.metal, 0x8a8a8a, [-0.08, 0.2, 0.0], [0.005, 0.16, 0.005]));
      break;
    case 'evidence':
      gr.add(part(g.cone, P.glowV, 0xff5fd2, [0, 0.35, 0], [0.12, 0.25, 0.12], [Math.PI, 0, 0]));
      gr.add(part(g.sphere, P.glowV, 0xff5fd2, [0, 0.08, 0], [0.06, 0.06, 0.06]));
      break;
    default:
      gr.add(part(g.ico, P.glowV, 0xffffff, [0, 0.1, 0], [0.1, 0.1, 0.1]));
  }
  return compact(gr);
}

export function flareModel() {
  return itemModel('flare');
}
