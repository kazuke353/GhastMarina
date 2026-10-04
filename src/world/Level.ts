import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { normalizeGeo } from '../gfx/Materials';

export const CELL = 3;

export const enum T {
  Void = 0,
  Floor = 1,
  Wall = 2,
  Low = 3, // low obstacle (solid, see-through)
  Glass = 4, // solid, see-through
  Water = 5,
  Ice = 6,
  Deep = 7, // pool: solid, see-through
  Floor2 = 8,
  Floor3 = 9,
  Door = 10,
}

export interface LightSource {
  pos: THREE.Vector3;
  color: THREE.Color;
  intensity: number;
  range: number;
  flicker?: number;
  on?: boolean;
}

export interface BoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  h: number; // height (for projectiles / LOS when low)
  active?: boolean;
  id?: string;
}
export interface CircleCollider {
  x: number;
  z: number;
  r: number;
  active?: boolean;
}

/** Collects static geometry by material and merges into chunked meshes. */
export class Batcher {
  private buckets = new Map<THREE.Material, Map<string, THREE.BufferGeometry[]>>();
  private shadowMats = new Set<THREE.Material>();
  constructor(private chunk = 24) {}
  add(geo: THREE.BufferGeometry, mat: THREE.Material, matrix?: THREE.Matrix4, color?: THREE.Color | number, castShadow = false) {
    const g = normalizeGeo(geo, color !== undefined ? new THREE.Color(color as any) : undefined);
    if (matrix) g.applyMatrix4(matrix);
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    const cx = Math.floor((bb.min.x + bb.max.x) / 2 / this.chunk);
    const cz = Math.floor((bb.min.z + bb.max.z) / 2 / this.chunk);
    const key = cx + ',' + cz;
    let m = this.buckets.get(mat);
    if (!m) this.buckets.set(mat, (m = new Map()));
    let arr = m.get(key);
    if (!arr) m.set(key, (arr = []));
    arr.push(g);
    if (castShadow) this.shadowMats.add(mat);
  }
  /** Add every mesh under an object (using world matrices). */
  addObject(obj: THREE.Object3D, castShadow = false) {
    obj.updateMatrixWorld(true);
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const col = (mesh.userData.color as number | undefined) ?? undefined;
      this.add(mesh.geometry, mat, mesh.matrixWorld, col, castShadow || !!mesh.castShadow);
    });
  }
  build(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'static';
    for (const [mat, chunks] of this.buckets) {
      for (const [, geos] of chunks) {
        // merge in batches to keep buffers sane
        for (let i = 0; i < geos.length; i += 400) {
          const merged = mergeGeometries(geos.slice(i, i + 400), false);
          if (!merged) continue;
          merged.computeBoundingSphere();
          const mesh = new THREE.Mesh(merged, mat);
          mesh.receiveShadow = true;
          mesh.castShadow = this.shadowMats.has(mat);
          mesh.matrixAutoUpdate = false;
          g.add(mesh);
        }
        for (const x of geos) x.dispose();
      }
    }
    this.buckets.clear();
    return g;
  }
}

class Heap {
  private a: number[] = [];
  constructor(private f: Float32Array) {}
  push(n: number) {
    const a = this.a;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.f[a[p]] <= this.f[a[i]]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): number {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && this.f[a[l]] < this.f[a[m]]) m = l;
        if (r < a.length && this.f[a[r]] < this.f[a[m]]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.a.length;
  }
}

export class Level {
  w: number;
  h: number;
  terrain: Uint8Array;
  solid: Uint8Array;
  opaque: Uint8Array;
  blocked: Uint8Array; // pathfinding blockers from props
  group = new THREE.Group();
  lights: LightSource[] = [];
  boxes: BoxCollider[] = [];
  circles: CircleCollider[] = [];
  private boxGrid = new Map<number, BoxCollider[]>();
  spawns: Record<string, { pos: THREE.Vector3; yaw: number }> = {};
  open = false;
  floorY = 0;
  explored: Uint8Array;
  /** cells with a ceiling overhead (weather is hidden there) */
  roofed: Uint8Array;
  surfaceOf: (x: number, z: number) => string = () => 'metal';

  constructor(public id: string, w: number, h: number) {
    this.w = w;
    this.h = h;
    this.terrain = new Uint8Array(w * h);
    this.solid = new Uint8Array(w * h);
    this.opaque = new Uint8Array(w * h);
    this.blocked = new Uint8Array(w * h);
    this.explored = new Uint8Array(w * h);
    this.roofed = new Uint8Array(w * h);
  }

  idx(gx: number, gy: number) {
    return gy * this.w + gx;
  }
  inside(gx: number, gy: number) {
    return gx >= 0 && gy >= 0 && gx < this.w && gy < this.h;
  }
  cellOf(x: number, z: number): [number, number] {
    return [Math.floor(x / CELL), Math.floor(z / CELL)];
  }
  center(gx: number, gy: number, y = 0) {
    return new THREE.Vector3(gx * CELL + CELL / 2, y, gy * CELL + CELL / 2);
  }
  terrainAt(x: number, z: number): number {
    const [gx, gy] = this.cellOf(x, z);
    if (!this.inside(gx, gy)) return T.Void;
    return this.terrain[this.idx(gx, gy)];
  }
  isRoofed(x: number, z: number) {
    const [gx, gy] = this.cellOf(x, z);
    return this.inside(gx, gy) && this.roofed[this.idx(gx, gy)] === 1;
  }
  isSolidCell(gx: number, gy: number) {
    if (!this.inside(gx, gy)) return true;
    return this.solid[this.idx(gx, gy)] === 1;
  }
  isOpaqueCell(gx: number, gy: number) {
    if (!this.inside(gx, gy)) return true;
    return this.opaque[this.idx(gx, gy)] === 1;
  }
  walkable(gx: number, gy: number) {
    if (!this.inside(gx, gy)) return false;
    const i = this.idx(gx, gy);
    return this.solid[i] === 0 && this.blocked[i] === 0;
  }
  setSolid(gx: number, gy: number, solid: boolean, opaque = solid) {
    if (!this.inside(gx, gy)) return;
    const i = this.idx(gx, gy);
    this.solid[i] = solid ? 1 : 0;
    this.opaque[i] = opaque ? 1 : 0;
  }

  addBox(b: BoxCollider) {
    if (b.active === undefined) b.active = true;
    this.boxes.push(b);
    const x0 = Math.floor(b.minX / CELL), x1 = Math.floor(b.maxX / CELL);
    const z0 = Math.floor(b.minZ / CELL), z1 = Math.floor(b.maxZ / CELL);
    for (let gz = z0; gz <= z1; gz++)
      for (let gx = x0; gx <= x1; gx++) {
        const k = gz * 10000 + gx;
        let arr = this.boxGrid.get(k);
        if (!arr) this.boxGrid.set(k, (arr = []));
        arr.push(b);
      }
    return b;
  }
  /** Mark cells mostly covered by a box as blocked for pathfinding. */
  blockCellsUnder(b: BoxCollider) {
    const x0 = Math.floor(b.minX / CELL), x1 = Math.floor(b.maxX / CELL);
    const z0 = Math.floor(b.minZ / CELL), z1 = Math.floor(b.maxZ / CELL);
    for (let gz = z0; gz <= z1; gz++)
      for (let gx = x0; gx <= x1; gx++) {
        if (!this.inside(gx, gz)) continue;
        const ox = Math.min(b.maxX, (gx + 1) * CELL) - Math.max(b.minX, gx * CELL);
        const oz = Math.min(b.maxZ, (gz + 1) * CELL) - Math.max(b.minZ, gz * CELL);
        if (ox * oz > CELL * CELL * 0.45) this.blocked[this.idx(gx, gz)] = 1;
      }
  }

  /** Resolve a circle against walls and colliders. Mutates pos. Returns true if collided. */
  collide(pos: THREE.Vector3, r: number, ignoreLow = false): boolean {
    let hit = false;
    for (let iter = 0; iter < 2; iter++) {
      const gx0 = Math.floor((pos.x - r) / CELL), gx1 = Math.floor((pos.x + r) / CELL);
      const gz0 = Math.floor((pos.z - r) / CELL), gz1 = Math.floor((pos.z + r) / CELL);
      for (let gz = gz0; gz <= gz1; gz++)
        for (let gx = gx0; gx <= gx1; gx++) {
          if (!this.isSolidCell(gx, gz)) continue;
          if (ignoreLow && this.inside(gx, gz) && this.terrain[this.idx(gx, gz)] === T.Low) continue;
          if (this.pushOutBox(pos, r, gx * CELL, gx * CELL + CELL, gz * CELL, gz * CELL + CELL)) hit = true;
        }
      const k0 = gz0 * 10000;
      const seen = new Set<BoxCollider>();
      for (let gz = gz0; gz <= gz1; gz++)
        for (let gx = gx0; gx <= gx1; gx++) {
          const arr = this.boxGrid.get(gz * 10000 + gx);
          if (!arr) continue;
          for (const b of arr) {
            if (!b.active || seen.has(b)) continue;
            seen.add(b);
            if (this.pushOutBox(pos, r, b.minX, b.maxX, b.minZ, b.maxZ)) hit = true;
          }
        }
      void k0;
      for (const c of this.circles) {
        if (c.active === false) continue;
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const d2 = dx * dx + dz * dz, rr = r + c.r;
        if (d2 < rr * rr && d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x = c.x + (dx / d) * rr;
          pos.z = c.z + (dz / d) * rr;
          hit = true;
        }
      }
    }
    return hit;
  }
  private pushOutBox(pos: THREE.Vector3, r: number, minX: number, maxX: number, minZ: number, maxZ: number) {
    const cx = Math.max(minX, Math.min(pos.x, maxX));
    const cz = Math.max(minZ, Math.min(pos.z, maxZ));
    let dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return false;
    if (d2 < 1e-10) {
      // center inside box: push along smallest axis
      const l = pos.x - minX, ri = maxX - pos.x, t = pos.z - minZ, b = maxZ - pos.z;
      const m = Math.min(l, ri, t, b);
      if (m === l) pos.x = minX - r;
      else if (m === ri) pos.x = maxX + r;
      else if (m === t) pos.z = minZ - r;
      else pos.z = maxZ + r;
      return true;
    }
    const d = Math.sqrt(d2);
    dx /= d;
    dz /= d;
    pos.x = cx + dx * r;
    pos.z = cz + dz * r;
    return true;
  }

  /** Grid DDA raycast. Returns distance to first opaque (or solid if `solidOnly`) cell along XZ, or Infinity. */
  rayGrid(x0: number, z0: number, x1: number, z1: number, mode: 'opaque' | 'solid' = 'opaque'): number {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) return Infinity;
    const dirX = dx / len, dirZ = dz / len;
    let gx = Math.floor(x0 / CELL), gz = Math.floor(z0 / CELL);
    const stepX = dirX > 0 ? 1 : -1, stepZ = dirZ > 0 ? 1 : -1;
    const tDeltaX = dirX !== 0 ? Math.abs(CELL / dirX) : Infinity;
    const tDeltaZ = dirZ !== 0 ? Math.abs(CELL / dirZ) : Infinity;
    let tMaxX = dirX !== 0 ? ((dirX > 0 ? (gx + 1) * CELL : gx * CELL) - x0) / dirX : Infinity;
    let tMaxZ = dirZ !== 0 ? ((dirZ > 0 ? (gz + 1) * CELL : gz * CELL) - z0) / dirZ : Infinity;
    const test = mode === 'opaque' ? this.opaque : this.solid;
    let t = 0;
    for (let i = 0; i < 400; i++) {
      if (tMaxX < tMaxZ) {
        t = tMaxX;
        tMaxX += tDeltaX;
        gx += stepX;
      } else {
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        gz += stepZ;
      }
      if (t > len) return Infinity;
      if (!this.inside(gx, gz)) return t;
      if (test[this.idx(gx, gz)]) return t;
    }
    return Infinity;
  }
  los(a: THREE.Vector3, b: THREE.Vector3) {
    return this.rayGrid(a.x, a.z, b.x, b.z, 'opaque') === Infinity;
  }
  /** Ray vs box colliders (XZ), considering heights at given y. */
  rayBoxes(o: THREE.Vector3, d: THREE.Vector3, maxT: number): number {
    let best = maxT;
    for (const b of this.boxes) {
      if (!b.active) continue;
      // slab test in 3D with box from y=0..h
      let tmin = 0, tmax = best;
      const ax = [o.x, o.y, o.z], ad = [d.x, d.y, d.z];
      const mn = [b.minX, 0, b.minZ], mx = [b.maxX, b.h, b.maxZ];
      let ok = true;
      for (let k = 0; k < 3; k++) {
        if (Math.abs(ad[k]) < 1e-8) {
          if (ax[k] < mn[k] || ax[k] > mx[k]) {
            ok = false;
            break;
          }
        } else {
          let t1 = (mn[k] - ax[k]) / ad[k], t2 = (mx[k] - ax[k]) / ad[k];
          if (t1 > t2) [t1, t2] = [t2, t1];
          tmin = Math.max(tmin, t1);
          tmax = Math.min(tmax, t2);
          if (tmin > tmax) {
            ok = false;
            break;
          }
        }
      }
      if (ok && tmin < best) best = tmin;
    }
    return best;
  }

  // ---------- pathfinding ----------
  private gScore?: Float32Array;
  private fScore?: Float32Array;
  private came?: Int32Array;
  private closed?: Uint8Array;
  findPath(from: THREE.Vector3, to: THREE.Vector3, maxNodes = 2500): THREE.Vector3[] | null {
    const W = this.w, H = this.h, N = W * H;
    if (!this.gScore) {
      this.gScore = new Float32Array(N);
      this.fScore = new Float32Array(N);
      this.came = new Int32Array(N);
      this.closed = new Uint8Array(N);
    }
    const g = this.gScore, f = this.fScore!, came = this.came!, closed = this.closed!;
    let [sx, sz] = this.cellOf(from.x, from.z);
    let [tx, tz] = this.cellOf(to.x, to.z);
    if (!this.inside(sx, sz) || !this.inside(tx, tz)) return null;
    if (!this.walkable(tx, tz)) {
      // find nearest walkable neighbor to target
      let found = false;
      for (let r = 1; r <= 2 && !found; r++)
        for (let dz = -r; dz <= r && !found; dz++)
          for (let dx = -r; dx <= r && !found; dx++)
            if (this.walkable(tx + dx, tz + dz)) {
              tx += dx;
              tz += dz;
              found = true;
            }
      if (!found) return null;
    }
    g.fill(Infinity);
    closed.fill(0);
    came.fill(-1);
    const start = this.idx(sx, sz), goal = this.idx(tx, tz);
    const hfn = (i: number) => {
      const x = i % W, z = (i / W) | 0;
      const ddx = Math.abs(x - tx), ddz = Math.abs(z - tz);
      return Math.max(ddx, ddz) + 0.414 * Math.min(ddx, ddz);
    };
    g[start] = 0;
    f[start] = hfn(start);
    const open = new Heap(f);
    open.push(start);
    let n = 0;
    while (open.size) {
      const cur = open.pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (++n > maxNodes) return null;
      const cx = cur % W, cz = (cur / W) | 0;
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = cx + dx, nz = cz + dz;
          if (!this.walkable(nx, nz)) continue;
          if (dx && dz && (!this.walkable(cx + dx, cz) || !this.walkable(cx, cz + dz))) continue;
          const ni = nz * W + nx;
          if (closed[ni]) continue;
          const cost = g[cur] + (dx && dz ? 1.414 : 1) + (this.terrain[ni] === T.Water ? 0.6 : 0);
          if (cost < g[ni]) {
            g[ni] = cost;
            came[ni] = cur;
            f[ni] = cost + hfn(ni);
            open.push(ni);
          }
        }
    }
    if (came[goal] === -1 && goal !== start) return null;
    const cells: number[] = [];
    let c = goal;
    while (c !== -1 && c !== start) {
      cells.push(c);
      c = came[c];
    }
    cells.reverse();
    const pts = cells.map((i) => this.center(i % W, (i / W) | 0));
    if (pts.length) pts[pts.length - 1] = to.clone().setY(0);
    // string-pull smoothing
    const out: THREE.Vector3[] = [];
    let anchor = from.clone();
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && this.rayGrid(anchor.x, anchor.z, pts[j].x, pts[j].z, 'solid') !== Infinity) j--;
      out.push(pts[j]);
      anchor = pts[j];
      i = j + 1;
    }
    return out;
  }

  randomFloorNear(p: THREE.Vector3, radiusCells: number): THREE.Vector3 | null {
    const [cx, cz] = this.cellOf(p.x, p.z);
    for (let k = 0; k < 20; k++) {
      const gx = cx + Math.round((Math.random() * 2 - 1) * radiusCells);
      const gz = cz + Math.round((Math.random() * 2 - 1) * radiusCells);
      if (this.walkable(gx, gz)) return this.center(gx, gz).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0, (Math.random() - 0.5) * 1.5));
    }
    return null;
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}

/** Pool of real lights assigned to the nearest level light sources. */
export class LightPool {
  lights: THREE.PointLight[] = [];
  private assign: (LightSource | null)[] = [];
  private timer = 0;
  constructor(scene: THREE.Scene, n = 6) {
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 1.6);
      l.castShadow = false;
      scene.add(l);
      this.lights.push(l);
      this.assign.push(null);
    }
  }
  update(dt: number, sources: LightSource[], cam: THREE.Vector3, camDir: THREE.Vector3, time: number) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.2;
      const scored = sources
        .filter((s) => s.on !== false)
        .map((s) => {
          const dx = s.pos.x - cam.x, dz = s.pos.z - cam.z, dy = s.pos.y - cam.y;
          const d = Math.sqrt(dx * dx + dz * dz + dy * dy);
          const facing = d > 0.01 ? (dx * camDir.x + dz * camDir.z + dy * camDir.y) / d : 1;
          return { s, score: d - s.range * 0.6 - facing * 6 };
        })
        .sort((a, b) => a.score - b.score)
        .slice(0, this.lights.length)
        .map((x) => x.s);
      // keep existing assignments when still chosen
      const next: (LightSource | null)[] = this.assign.map((a) => (a && scored.includes(a) ? a : null));
      for (const s of scored) if (!next.includes(s)) next[next.indexOf(null)] = s;
      this.assign = next;
    }
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i], s = this.assign[i];
      if (!s || s.on === false) {
        l.intensity = Math.max(0, l.intensity - dt * 60);
        continue;
      }
      if (l.position.distanceToSquared(s.pos) > 0.01) {
        // fade in from zero at the new position
        if (l.intensity > 0.5) {
          l.intensity = Math.max(0, l.intensity - dt * 120);
          continue;
        }
        l.position.copy(s.pos);
        l.color.copy(s.color);
        l.distance = s.range;
      }
      let target = s.intensity;
      if (s.flicker) target *= 1 - s.flicker * (Math.sin(time * 23 + i * 7) * 0.5 + 0.5) * (Math.sin(time * 3.1 + i) > 0.6 ? 1 : 0.2);
      l.intensity += (target - l.intensity) * Math.min(1, dt * 8);
    }
  }
  off() {
    for (const l of this.lights) l.intensity = 0;
    this.assign = this.assign.map(() => null);
    this.timer = 0;
  }
}
