import * as THREE from 'three';
import { Level, Batcher, CELL, T, LightSource } from './Level';
import { getTheme, Theme } from './Themes';
import { buildProp, PM, PropOut } from './Props';
import type { EntSpec, LevelDef } from './LevelDef';
import { rng, rpick, fbm, hashStr, RNG } from '../core/math';

export interface SpawnSpec {
  spec: EntSpec;
  pos: THREE.Vector3;
  yaw: number;
  gx: number;
  gy: number;
}
export interface DoorSpec {
  gx: number;
  gy: number;
  axis: 'x' | 'z';
  pos: THREE.Vector3;
  spec: Extract<EntSpec, { t: 'door' }>;
}
export interface BuiltLevel {
  level: Level;
  theme: Theme;
  spawns: SpawnSpec[];
  doors: DoorSpec[];
  water: THREE.Mesh | null;
  waterMat: THREE.ShaderMaterial | null;
}

const TERRAIN: Record<string, number> = {
  '#': T.Wall, '&': T.Wall, ' ': T.Void, '.': T.Floor, ',': T.Floor2, ';': T.Floor3, '_': T.Ice, '~': T.Water,
  '=': T.Deep, '%': T.Low, '|': T.Glass, '+': T.Door, '@': T.Floor,
};
const FLOORCHAR: Record<number, string> = { [T.Floor]: '.', [T.Floor2]: ',', [T.Floor3]: ';', [T.Ice]: '_', [T.Water]: '~', [T.Door]: '.' };

const WATER_V = /* glsl */ `
varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WATER_F = /* glsl */ `
uniform float uTime; uniform vec3 uColor; uniform float uElectric;
varying vec3 vW;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
void main(){
  vec2 p = vW.xz * 0.8;
  float w = n(p + vec2(uTime*0.4, uTime*0.3)) * 0.6 + n(p*2.3 - vec2(uTime*0.5, -uTime*0.2)) * 0.4;
  float caust = pow(1.0 - abs(w - 0.5) * 2.0, 6.0);
  vec3 col = uColor * (0.5 + w * 0.6) + vec3(0.3, 0.7, 0.9) * caust * 0.6;
  col += vec3(0.6, 0.9, 1.6) * uElectric * step(0.93, n(p * 4.0 + uTime * 9.0)) * 3.0;
  gl_FragColor = vec4(col, 0.72);
}`;

class Quads {
  private data = new Map<THREE.Material, Map<string, { p: number[]; n: number[]; uv: number[]; c: number[] }>>();
  add(mat: THREE.Material, pts: THREE.Vector3[], n: THREE.Vector3, uvs: [number, number][], color = new THREE.Color(1, 1, 1)) {
    // fix winding so the face points along n
    const e1 = pts[1].clone().sub(pts[0]), e2 = pts[2].clone().sub(pts[0]);
    if (e1.cross(e2).dot(n) < 0) {
      pts = [pts[0], pts[3], pts[2], pts[1]];
      uvs = [uvs[0], uvs[3], uvs[2], uvs[1]];
    }
    const cx = Math.floor((pts[0].x + pts[2].x) / 2 / 24), cz = Math.floor((pts[0].z + pts[2].z) / 2 / 24);
    const key = cx + ',' + cz;
    let m = this.data.get(mat);
    if (!m) this.data.set(mat, (m = new Map()));
    let d = m.get(key);
    if (!d) m.set(key, (d = { p: [], n: [], uv: [], c: [] }));
    for (const i of [0, 1, 2, 0, 2, 3]) {
      d.p.push(pts[i].x, pts[i].y, pts[i].z);
      d.n.push(n.x, n.y, n.z);
      d.uv.push(uvs[i][0], uvs[i][1]);
      d.c.push(color.r, color.g, color.b);
    }
  }
  build(group: THREE.Group, receiveShadow = true) {
    for (const [mat, chunks] of this.data)
      for (const [, d] of chunks) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(d.p, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(d.n, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(d.uv, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(d.c, 3));
        g.computeBoundingSphere();
        const m = new THREE.Mesh(g, mat);
        m.receiveShadow = receiveShadow;
        m.matrixAutoUpdate = false;
        group.add(m);
      }
  }
}

const DIRS: [number, number, number][] = [
  [1, 0, Math.PI / 2], // east: yaw facing +x
  [-1, 0, -Math.PI / 2],
  [0, 1, 0], // south
  [0, -1, Math.PI],
];

export function buildLevel(def: LevelDef): BuiltLevel {
  const theme = getTheme(def.theme);
  const rows = def.map;
  const H = rows.length;
  const Wd = Math.max(...rows.map((r) => r.length));
  const level = new Level(def.id, Wd, H);
  level.open = theme.open;
  const r = rng(def.seed ?? hashStr(def.id));
  const spawns: SpawnSpec[] = [];
  const doors: DoorSpec[] = [];
  const pillars: [number, number][] = [];
  const altWall = new Uint8Array(Wd * H);
  const ents: { gx: number; gy: number; specs: EntSpec[] }[] = [];

  // ---- parse ----
  for (let gy = 0; gy < H; gy++) {
    const row = rows[gy];
    for (let gx = 0; gx < Wd; gx++) {
      const ch = gx < row.length ? row[gx] : ' ';
      const i = level.idx(gx, gy);
      let t = TERRAIN[ch];
      if (t === undefined) {
        const L = def.legend[ch];
        if (!L) {
          console.warn(`[${def.id}] unknown map char '${ch}' at ${gx},${gy}`);
          t = T.Floor;
        } else {
          let floor = '.';
          let specs: EntSpec[] = [];
          if (Array.isArray(L)) specs = L;
          else if ('floor' in L) {
            floor = L.floor;
            specs = L.ent ? (Array.isArray(L.ent) ? L.ent : [L.ent]) : [];
          } else specs = [L as EntSpec];
          t = TERRAIN[floor] ?? T.Floor;
          ents.push({ gx, gy, specs });
        }
      }
      if (ch === '&') altWall[i] = 1;
      if (ch === '@') pillars.push([gx, gy]);
      level.terrain[i] = t;
      const solid = t === T.Wall || t === T.Void || t === T.Low || t === T.Glass || t === T.Deep || t === T.Door;
      const opaque = t === T.Wall || t === T.Door;
      level.solid[i] = solid ? 1 : 0;
      level.opaque[i] = opaque ? 1 : 0;
    }
  }
  const tAt = (gx: number, gy: number) => (level.inside(gx, gy) ? level.terrain[level.idx(gx, gy)] : T.Void);
  const isWall = (gx: number, gy: number) => tAt(gx, gy) === T.Wall;
  const isFloorish = (t: number) => t === T.Floor || t === T.Floor2 || t === T.Floor3 || t === T.Ice || t === T.Water || t === T.Door;
  level.surfaceOf = (x, z) => {
    const t = level.terrainAt(x, z);
    const ch = FLOORCHAR[t] ?? '.';
    return theme.floors[ch]?.surface ?? 'metal';
  };

  const Q = new Quads();
  const B = new Batcher();
  const white = new THREE.Color(1, 1, 1);
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  // ---- wall heights ----
  const wallH = new Float32Array(Wd * H);
  for (let gy = 0; gy < H; gy++)
    for (let gx = 0; gx < Wd; gx++) {
      let h = theme.wallH;
      if (theme.wallHVar) {
        const [a, b] = theme.wallHVar;
        const nz = fbm(Math.floor(gx / 2) * 0.37, Math.floor(gy / 2) * 0.37, 2, hashStr(def.id));
        h = Math.round((a + (b - a) * nz) / 1.5) * 1.5;
      }
      wallH[level.idx(gx, gy)] = h;
    }

  // ---- floors & ceilings ----
  for (let gy = 0; gy < H; gy++)
    for (let gx = 0; gx < Wd; gx++) {
      const t = tAt(gx, gy);
      const x0 = gx * CELL, z0 = gy * CELL, x1 = x0 + CELL, z1 = z0 + CELL;
      if (isFloorish(t) || t === T.Low || t === T.Glass) {
        const ch = FLOORCHAR[t] ?? (t === T.Low || t === T.Glass ? '.' : '.');
        const fs = theme.floors[ch] ?? theme.floors['.'];
        const s = fs.uvScale / CELL;
        Q.add(fs.mat, [V(x0, 0, z0), V(x0, 0, z1), V(x1, 0, z1), V(x1, 0, z0)], V(0, 1, 0), [[x0 * s, z0 * s], [x0 * s, z1 * s], [x1 * s, z1 * s], [x1 * s, z0 * s]]);
        if (theme.ceiling && theme.ceilingOn.includes(ch)) {
          level.roofed[level.idx(gx, gy)] = 1;
          const y = theme.wallH;
          Q.add(theme.ceiling, [V(x0, y, z0), V(x0, y, z1), V(x1, y, z1), V(x1, y, z0)], V(0, -1, 0), [[x0 / CELL, z0 / CELL], [x0 / CELL, z1 / CELL], [x1 / CELL, z1 / CELL], [x1 / CELL, z0 / CELL]]);
        }
      }
      if (t === T.Deep) {
        const fs = theme.floors['~'];
        Q.add(fs.mat, [V(x0, -2.5, z0), V(x0, -2.5, z1), V(x1, -2.5, z1), V(x1, -2.5, z0)], V(0, 1, 0), [[0, 0], [0, 1], [1, 1], [1, 0]], new THREE.Color(0.4, 0.5, 0.6));
        if (theme.ceiling) {
          level.roofed[level.idx(gx, gy)] = 1;
          const y = theme.wallH;
          Q.add(theme.ceiling, [V(x0, y, z0), V(x0, y, z1), V(x1, y, z1), V(x1, y, z0)], V(0, -1, 0), [[0, 0], [0, 1], [1, 1], [1, 0]]);
        }
        // pool inner walls
        for (const [dx, dz] of DIRS) {
          if (tAt(gx + dx, gy + dz) === T.Deep) continue;
          const bx = dx > 0 ? x1 : dx < 0 ? x0 : null;
          const bz = dz > 0 ? z1 : dz < 0 ? z0 : null;
          const n = V(-dx, 0, -dz);
          if (bx !== null) Q.add(theme.wallAlt, [V(bx, -2.5, z0), V(bx, -2.5, z1), V(bx, 0, z1), V(bx, 0, z0)], n, [[0, 0], [1, 0], [1, 0.8], [0, 0.8]]);
          else if (bz !== null) Q.add(theme.wallAlt, [V(x0, -2.5, bz), V(x1, -2.5, bz), V(x1, 0, bz), V(x0, 0, bz)], n, [[0, 0], [1, 0], [1, 0.8], [0, 0.8]]);
        }
      }
    }

  // ---- walls ----
  const decoQueue: { gx: number; gy: number; dx: number; dz: number }[] = [];
  for (let gy = 0; gy < H; gy++)
    for (let gx = 0; gx < Wd; gx++) {
      const t = tAt(gx, gy);
      if (t !== T.Wall) continue;
      const i = level.idx(gx, gy);
      const h = wallH[i];
      const mat = altWall[i] ? theme.wallAlt : theme.wall;
      const x0 = gx * CELL, z0 = gy * CELL, x1 = x0 + CELL, z1 = z0 + CELL;
      const uvs = theme.wallUV / CELL;
      for (const [dx, dz, yaw] of DIRS) {
        const nt = tAt(gx + dx, gy + dz);
        if (nt === T.Wall) {
          // neighbor wall shorter? expose side
          const nh = wallH[level.idx(gx + dx, gy + dz)] ?? h;
          if (!theme.open || nh >= h) continue;
          addWallFace(mat, gx, gy, dx, dz, nh, h, uvs);
          continue;
        }
        if (nt === T.Void && !theme.open) continue;
        addWallFace(mat, gx, gy, dx, dz, 0, h, uvs);
        if (isFloorish(nt) && nt !== T.Door && r() < theme.decoChance) decoQueue.push({ gx: gx + dx, gy: gy + dz, dx: -dx, dz: -dz });
      }
      // top (visible in open themes, or when no ceiling)
      if (theme.open || !theme.ceiling) {
        Q.add(theme.wallTop, [V(x0, h, z0), V(x0, h, z1), V(x1, h, z1), V(x1, h, z0)], V(0, 1, 0), [[0, 0], [0, 1], [1, 1], [1, 0]]);
      }
    }
  function addWallFace(mat: THREE.Material, gx: number, gy: number, dx: number, dz: number, y0: number, y1: number, uvs: number) {
    const x0 = gx * CELL, z0 = gy * CELL, x1 = x0 + CELL, z1 = z0 + CELL;
    const n = V(dx, 0, dz);
    if (dx !== 0) {
      const x = dx > 0 ? x1 : x0;
      Q.add(mat, [V(x, y0, z0), V(x, y0, z1), V(x, y1, z1), V(x, y1, z0)], n, [[z0 * uvs, y0 * uvs], [z1 * uvs, y0 * uvs], [z1 * uvs, y1 * uvs], [z0 * uvs, y1 * uvs]]);
    } else {
      const z = dz > 0 ? z1 : z0;
      Q.add(mat, [V(x0, y0, z), V(x1, y0, z), V(x1, y1, z), V(x0, y1, z)], n, [[x0 * uvs, y0 * uvs], [x1 * uvs, y0 * uvs], [x1 * uvs, y1 * uvs], [x0 * uvs, y1 * uvs]]);
    }
  }

  // ---- hull edges / railings (open themes) ----
  if (theme.open) {
    const hullMat = theme.wallAlt;
    for (let gy = 0; gy < H; gy++)
      for (let gx = 0; gx < Wd; gx++) {
        const t = tAt(gx, gy);
        if (t === T.Void) continue;
        for (const [dx, dz, yaw] of DIRS) {
          if (tAt(gx + dx, gy + dz) !== T.Void) continue;
          addWallFace(hullMat, gx, gy, dx, dz, -14, 0, 1 / CELL);
          if (theme.edge === 'rail' && isFloorish(t)) {
            const p = level.center(gx, gy);
            p.x += (dx * CELL) / 2 - dx * 0.1;
            p.z += (dz * CELL) / 2 - dz * 0.1;
            placeProp('railing', p, yaw, {}, false);
          }
        }
      }
  }

  // ---- low walls, glass, pillars ----
  const boxG = new THREE.BoxGeometry(1, 1, 1);
  const m4 = new THREE.Matrix4();
  for (let gy = 0; gy < H; gy++)
    for (let gx = 0; gx < Wd; gx++) {
      const t = tAt(gx, gy);
      const c = level.center(gx, gy);
      if (t === T.Low) {
        m4.compose(V(c.x, theme.lowH / 2, c.z), new THREE.Quaternion(), V(CELL, theme.lowH, CELL));
        B.add(boxG, theme.low, m4);
      } else if (t === T.Glass) {
        const alongX = isWall(gx - 1, gy) || isWall(gx + 1, gy) || tAt(gx - 1, gy) === T.Glass || tAt(gx + 1, gy) === T.Glass;
        const h = theme.open ? 3.5 : theme.wallH;
        const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), alongX ? 0 : Math.PI / 2);
        m4.compose(V(c.x, h / 2, c.z), q, V(CELL, h, 0.08));
        B.add(boxG, PM().glass, m4);
        m4.compose(V(c.x, 0.1, c.z), q, V(CELL, 0.2, 0.25));
        B.add(boxG, PM().metal, m4, 0x4a5058);
        m4.compose(V(c.x, h - 0.1, c.z), q, V(CELL, 0.2, 0.25));
        B.add(boxG, PM().metal, m4, 0x4a5058);
        for (const s of [-1, 1]) {
          const off = alongX ? V(s * (CELL / 2 - 0.05), 0, 0) : V(0, 0, s * (CELL / 2 - 0.05));
          m4.compose(V(c.x + off.x, h / 2, c.z + off.z), q, V(0.12, h, 0.25));
          B.add(boxG, PM().metal, m4, 0x4a5058);
        }
      } else if (t === T.Door) {
        const axis: 'x' | 'z' = isWall(gx - 1, gy) || isWall(gx + 1, gy) ? 'x' : 'z';
        // frame
        const h = Math.min(theme.wallH, 4.5);
        const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), axis === 'x' ? 0 : Math.PI / 2);
        for (const s of [-1, 1]) {
          const off = axis === 'x' ? V(s * (CELL / 2 - 0.2), 0, 0) : V(0, 0, s * (CELL / 2 - 0.2));
          m4.compose(V(c.x + off.x, h / 2, c.z + off.z), q, V(0.4, h, 0.6));
          B.add(boxG, PM().metal, m4, 0x3a3e46);
        }
        m4.compose(V(c.x, h - 0.2, c.z), q, V(CELL, 0.4, 0.6));
        B.add(boxG, PM().metal, m4, 0x3a3e46);
        if (theme.wallH > h) {
          m4.compose(V(c.x, (theme.wallH + h) / 2, c.z), q, V(CELL, theme.wallH - h, 0.5));
          B.add(boxG, theme.wall, m4);
        }
      }
    }
  for (const [gx, gy] of pillars) {
    const c = level.center(gx, gy);
    const h = theme.open ? Math.min(theme.wallH, 6) : theme.wallH;
    m4.compose(V(c.x, h / 2, c.z), new THREE.Quaternion(), V(1.2, h, 1.2));
    B.add(boxG, theme.wallAlt, m4);
    level.addBox({ minX: c.x - 0.6, maxX: c.x + 0.6, minZ: c.z - 0.6, maxZ: c.z + 0.6, h });
  }

  // ---- props helper ----
  function placeProp(kind: string, pos: THREE.Vector3, yaw: number, opts: any, collide = true, seed = Math.floor(r() * 1e9)): PropOut {
    const out = buildProp(kind, seed, opts);
    const o = out.obj;
    o.position.copy(pos);
    o.rotation.y = yaw;
    o.updateMatrixWorld(true);
    if (out.dynamic) level.group.add(o);
    else B.addObject(o, !!out.shadow);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const quarter = Math.abs(Math.sin(yaw)) > 0.7;
    if (collide) {
      for (const b of out.boxes ?? []) {
        const wx = pos.x + b.x * cy + b.z * sy, wz = pos.z - b.x * sy + b.z * cy;
        const w = quarter ? b.d : b.w, d = quarter ? b.w : b.d;
        const box = level.addBox({ minX: wx - w / 2, maxX: wx + w / 2, minZ: wz - d / 2, maxZ: wz + d / 2, h: b.h });
        if (b.block) level.blockCellsUnder(box);
      }
      for (const cc of out.circles ?? []) {
        level.circles.push({ x: pos.x + cc.x * cy + cc.z * sy, z: pos.z - cc.x * sy + cc.z * cy, r: cc.r });
      }
    }
    for (const l of out.lights ?? []) {
      level.lights.push({
        pos: V(pos.x + l.x * cy + l.z * sy, pos.y + l.y, pos.z - l.x * sy + l.z * cy),
        color: new THREE.Color(l.color),
        intensity: l.intensity,
        range: l.range,
        flicker: l.flicker,
      });
    }
    return out;
  }

  // auto-orientation: face away from adjacent wall
  function autoYaw(gx: number, gy: number): { yaw: number; wall: [number, number] | null } {
    for (const [dx, dz, yaw] of DIRS) {
      if (isWall(gx + dx, gy + dz) || tAt(gx + dx, gy + dz) === T.Void) return { yaw: yaw + Math.PI, wall: [dx, dz] };
    }
    return { yaw: 0, wall: null };
  }

  // ---- decorations ----
  for (const d of decoQueue) {
    // d.dx/d.dz point from the floor cell toward the wall; decorations sit on the wall face looking back into the room
    const kind = rpick(r, theme.wallDeco);
    const p = level.center(d.gx, d.gy);
    p.x += d.dx * (CELL / 2 - 0.12);
    p.z += d.dz * (CELL / 2 - 0.12);
    const yaw = Math.atan2(-d.dx, -d.dz);
    if (kind === 'pipeRun') placeProp('pipeRun', p, yaw, { len: CELL, y: theme.wallH - 1.2 }, false);
    else if (kind === 'pipesV') placeProp('pipesV', p, yaw, {}, false);
    else if (kind === 'poster' && r() < 0.5) placeProp('poster', p, yaw, {}, false);
    else if (kind === 'vinesHang') placeProp('vinesHang', p, yaw, {}, false);
    else if (kind === 'icicles') placeProp('icicles', p, yaw, {}, false);
    else if (kind === 'porthole') placeProp('porthole', p, yaw, {}, false);
    else if (kind === 'monitor') placeProp('monitor', p, yaw, {}, false);
  }

  // ---- entities ----
  for (const e of ents) {
    for (const spec of e.specs) {
      const c = level.center(e.gx, e.gy);
      const ay = autoYaw(e.gx, e.gy);
      const yawSpec = (spec as any).yaw;
      const yaw = yawSpec !== undefined ? (yawSpec * Math.PI) / 180 : ay.yaw;
      switch (spec.t) {
        case 'prop': {
          const p = c.clone();
          p.x += spec.dx ?? 0;
          p.z += spec.dz ?? 0;
          placeProp(spec.kind, p, yaw, spec.opts ?? {}, spec.solid !== false);
          break;
        }
        case 'scatter': {
          const kind = rpick(r, theme.scatter);
          const p = c.clone().add(V((r() - 0.5) * 0.8, 0, (r() - 0.5) * 0.8));
          placeProp(kind, p, r() * Math.PI * 2, {}, true);
          break;
        }
        case 'light': {
          const y = spec.y ?? (theme.open ? 4.5 : theme.wallH - 0.6);
          if (spec.model !== false) {
            const out = placeProp(theme.lamp.kind, c, ay.yaw, { color: spec.color, y: theme.lamp.kind === 'ceilingLamp' || theme.lamp.kind === 'lampCage' ? theme.wallH - 0.1 : undefined, flicker: spec.flicker }, true);
            // placeProp adds the lamp's own light; override color/intensity on the last light if requested
            const l = level.lights[level.lights.length - 1];
            if (l && out.lights?.length) {
              l.color.set(spec.color);
              if (spec.intensity) l.intensity = spec.intensity;
              if (spec.range) l.range = spec.range;
              if (spec.flicker !== undefined) l.flicker = spec.flicker;
            }
          } else {
            level.lights.push({ pos: V(c.x, y, c.z), color: new THREE.Color(spec.color), intensity: spec.intensity ?? 15, range: spec.range ?? 12, flicker: spec.flicker });
          }
          break;
        }
        case 'player':
          level.spawns.start = { pos: c.clone(), yaw };
          break;
        case 'spawn':
          level.spawns[spec.id] = { pos: c.clone(), yaw };
          break;
        default:
          spawns.push({ spec, pos: c.clone(), yaw, gx: e.gx, gy: e.gy });
      }
    }
  }
  // doors from '+'
  for (let gy = 0; gy < H; gy++)
    for (let gx = 0; gx < Wd; gx++) {
      if (tAt(gx, gy) !== T.Door) continue;
      const axis: 'x' | 'z' = isWall(gx - 1, gy) || isWall(gx + 1, gy) ? 'x' : 'z';
      // door spec may have been provided by legend at same cell? doors via '+' use default spec
      doors.push({ gx, gy, axis, pos: level.center(gx, gy), spec: { t: 'door' } });
    }

  // ---- water ----
  let water: THREE.Mesh | null = null;
  let waterMat: THREE.ShaderMaterial | null = null;
  {
    const p: number[] = [];
    for (let gy = 0; gy < H; gy++)
      for (let gx = 0; gx < Wd; gx++) {
        const t = tAt(gx, gy);
        if (t !== T.Water && t !== T.Deep) continue;
        const y = t === T.Water ? 0.32 : -0.3;
        const x0 = gx * CELL, z0 = gy * CELL, x1 = x0 + CELL, z1 = z0 + CELL;
        p.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0);
      }
    if (p.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      waterMat = new THREE.ShaderMaterial({
        vertexShader: WATER_V,
        fragmentShader: WATER_F,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.03, 0.14, 0.2) }, uElectric: { value: 0 } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      water = new THREE.Mesh(g, waterMat);
      water.renderOrder = 5;
      level.group.add(water);
    }
  }

  Q.build(level.group);
  level.group.add(B.build());
  return { level, theme, spawns, doors, water, waterMat };
}

export function yawToVec(yaw: number) {
  return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
}
export type { RNG };
