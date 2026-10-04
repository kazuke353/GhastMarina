import * as THREE from 'three';
import { ParticleSystem } from '../gfx/Particles';
import { rand } from '../core/math';

interface Line {
  mesh: THREE.Line;
  life: number;
  max: number;
}
interface Ring {
  mesh: THREE.Mesh;
  life: number;
  max: number;
  mode: 'tele' | 'shock';
  r0: number;
  r1: number;
}

export class FX {
  add: ParticleSystem;
  alpha: ParticleSystem;
  group = new THREE.Group();
  private lines: Line[] = [];
  private rings: Ring[] = [];
  muzzleLight: THREE.PointLight;
  private muzzleT = 0;
  explosionLight: THREE.PointLight;
  private exT = 0;
  private lineMat = new Map<number, THREE.LineBasicMaterial>();
  private ringGeo = new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2);
  private discGeo = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);

  constructor(scene: THREE.Scene) {
    this.add = new ParticleSystem(3000, true);
    this.alpha = new ParticleSystem(2500, false);
    scene.add(this.add.points, this.alpha.points, this.group);
    this.muzzleLight = new THREE.PointLight(0xffb050, 0, 9, 2);
    this.explosionLight = new THREE.PointLight(0xff8040, 0, 20, 1.5);
    scene.add(this.muzzleLight, this.explosionLight);
  }

  update(dt: number, camera: THREE.PerspectiveCamera, vh: number) {
    this.add.update(dt, camera, vh);
    this.alpha.update(dt, camera, vh);
    this.muzzleT = Math.max(0, this.muzzleT - dt);
    this.muzzleLight.intensity = this.muzzleT > 0 ? 18 * (this.muzzleT / 0.06) : 0;
    this.exT = Math.max(0, this.exT - dt);
    this.explosionLight.intensity = this.exT > 0 ? 80 * (this.exT / 0.5) : 0;
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const l = this.lines[i];
      l.life -= dt;
      (l.mesh.material as THREE.LineBasicMaterial).opacity = Math.max(0, l.life / l.max);
      if (l.life <= 0) {
        this.group.remove(l.mesh);
        l.mesh.geometry.dispose();
        this.lines.splice(i, 1);
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      const t = 1 - r.life / r.max;
      const m = r.mesh.material as THREE.MeshBasicMaterial;
      if (r.mode === 'tele') {
        const s = r.r1;
        r.mesh.scale.set(s, 1, s);
        m.opacity = 0.35 + 0.45 * Math.abs(Math.sin(t * Math.PI * 6));
      } else {
        const s = r.r0 + (r.r1 - r.r0) * t;
        r.mesh.scale.set(s, 1, s);
        m.opacity = 1 - t;
      }
      if (r.life <= 0) {
        this.group.remove(r.mesh);
        m.dispose();
        this.rings.splice(i, 1);
      }
    }
  }

  clear() {
    this.add.clear();
    this.alpha.clear();
    for (const l of this.lines) this.group.remove(l.mesh);
    for (const r of this.rings) this.group.remove(r.mesh);
    this.lines = [];
    this.rings = [];
  }

  private lm(color: number) {
    let m = this.lineMat.get(color);
    if (!m) {
      const c = new THREE.Color(color).multiplyScalar(4);
      m = new THREE.LineBasicMaterial({ color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      this.lineMat.set(color, m);
    }
    return m.clone();
  }

  tracer(a: THREE.Vector3, b: THREE.Vector3, color: number) {
    const g = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
    const mesh = new THREE.Line(g, this.lm(color));
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.lines.push({ mesh, life: 0.07, max: 0.07 });
  }
  arcBolt(a: THREE.Vector3, b: THREE.Vector3) {
    const pts: THREE.Vector3[] = [];
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const p = a.clone().lerp(b, i / n);
      if (i > 0 && i < n) p.add(new THREE.Vector3(rand(-0.25, 0.25), rand(-0.25, 0.25), rand(-0.25, 0.25)));
      pts.push(p);
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const mesh = new THREE.Line(g, this.lm(0x80e8ff));
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.lines.push({ mesh, life: 0.09, max: 0.09 });
    this.add.emit({ pos: b, spread: 3, life: 0.25, size: 0.12, color: 0x80e8ff, alpha: 1, count: 4, gravity: 3 });
  }
  muzzle(p: THREE.Vector3, color: number) {
    this.add.emit({ pos: p, spread: 1.2, life: 0.06, size: 0.35, size1: 0.1, color, alpha: 1, count: 4 });
    this.alpha.emit({ pos: p, vel: { x: 0, y: 0.6, z: 0 }, spread: 0.4, life: 0.6, size: 0.25, size1: 0.6, color: 0x707070, alpha: 0.25, count: 2, drag: 1 });
    this.muzzleLight.position.copy(p);
    this.muzzleLight.color.set(color);
    this.muzzleT = 0.06;
  }
  shell(p: THREE.Vector3, side: THREE.Vector3) {
    this.add.emit({ pos: p, vel: { x: side.x * 2, y: 2.5, z: side.z * 2 }, spread: 0.5, life: 0.5, size: 0.04, color: 0xd0a040, alpha: 1, alpha1: 1, gravity: 12 });
  }
  sparks(p: THREE.Vector3, n: THREE.Vector3, color: number, count: number) {
    this.add.emit({ pos: p, vel: { x: n.x * 2, y: n.y * 2 + 1, z: n.z * 2 }, spread: 3, life: 0.35, size: 0.06, size1: 0.02, color, alpha: 1, count, gravity: 9 });
  }
  impact(p: THREE.Vector3, dir: THREE.Vector3, color: number) {
    this.alpha.emit({ pos: p, vel: { x: dir.x * 3, y: 1.5, z: dir.z * 3 }, spread: 2.2, life: 0.5, size: 0.09, size1: 0.04, color, alpha: 1, alpha1: 0.5, count: 10, gravity: 12, jitter: 0.1 });
    this.alpha.emit({ pos: p, spread: 0.6, life: 0.4, size: 0.3, size1: 0.6, color, alpha: 0.5, count: 2, drag: 2 });
  }
  gore(p: THREE.Vector3, color: number, n: number) {
    this.alpha.emit({ pos: p, vel: { x: 0, y: 2.5, z: 0 }, spread: 3.2, life: 0.8, size: 0.12, size1: 0.05, color, alpha: 1, alpha1: 0.6, count: n, gravity: 12, jitter: 0.3 });
    this.alpha.emit({ pos: p, spread: 0.8, life: 0.9, size: 0.6, size1: 1.4, color, alpha: 0.35, count: 3, drag: 2 });
  }
  splash(p: THREE.Vector3, k: number) {
    this.add.emit({ pos: { x: p.x, y: 0.35, z: p.z }, vel: { x: 0, y: 2.4 * k, z: 0 }, spread: 1.4 * k, life: 0.5, size: 0.07, color: 0x80c8e0, alpha: 0.7, count: Math.ceil(6 * k), gravity: 10, jitter: 0.2 });
  }
  leaves(p: THREE.Vector3) {
    this.alpha.emit({ pos: { x: p.x, y: 0.8, z: p.z }, vel: { x: 0, y: 2, z: 0 }, spread: 3, life: 1.4, size: 0.12, color: 0x3a7a2a, alpha: 1, alpha1: 0, count: 24, gravity: 3, drag: 1.5, jitter: 0.6 });
  }
  healSparkle(p: THREE.Vector3) {
    this.add.emit({ pos: { x: p.x, y: 1, z: p.z }, vel: { x: 0, y: 1.2, z: 0 }, spread: 0.6, life: 0.9, size: 0.08, color: 0x60ff90, alpha: 1, count: 20, jitter: 0.4 });
  }
  gloomy(p: THREE.Vector3) {
    this.add.emit({ pos: { x: p.x, y: 0.5, z: p.z }, vel: { x: 0, y: 1.5, z: 0 }, spread: 1.4, life: 1.2, size: 0.1, color: 0x50b0ff, color1: 0xff5ad0, alpha: 1, count: 30, jitter: 0.3, drag: 1 });
  }
  explosion(p: THREE.Vector3, kind: 'fire' | 'toxic' | 'ice' | 'spore' | 'psychic', r: number) {
    const cols: Record<string, [number, number]> = {
      fire: [0xffa040, 0xff3010], toxic: [0xa0ff40, 0x408010], ice: [0xc0f0ff, 0x60a0ff], spore: [0xe0ff60, 0x80a020], psychic: [0xff70e0, 0x8040ff],
    };
    const [c0, c1] = cols[kind];
    this.add.emit({ pos: p, spread: r * 2.4, life: 0.5, size: 0.9, size1: 0.2, color: c0, color1: c1, alpha: 1, count: 40, drag: 3, jitter: 0.3 });
    this.add.emit({ pos: p, vel: { x: 0, y: 4, z: 0 }, spread: 6, life: 0.7, size: 0.08, color: c0, alpha: 1, count: 30, gravity: 9 });
    this.alpha.emit({ pos: p, vel: { x: 0, y: 1.2, z: 0 }, spread: r * 0.8, life: 2.2, size: 1.2, size1: 2.6, color: kind === 'fire' ? 0x2a2420 : c1, alpha: kind === 'fire' ? 0.6 : 0.4, count: 14, drag: 1.2, jitter: r * 0.3 });
    this.explosionLight.position.copy(p);
    this.explosionLight.color.set(c0);
    this.exT = 0.5;
    this.shock(p, r, c0);
  }
  cloud(p: THREE.Vector3, color: number, r: number, life: number) {
    this.alpha.emit({ pos: { x: p.x, y: 0.8, z: p.z }, vel: { x: 0, y: 0.3, z: 0 }, spread: 0.4, life, size: r * 0.9, size1: r * 1.4, color, alpha: 0.35, alpha1: 0, count: 10, jitter: r * 0.5, drag: 1 });
  }
  steam(p: THREE.Vector3, k: number) {
    this.alpha.emit({ pos: p, vel: { x: 0, y: 5 * k, z: 0 }, spread: 0.8, life: 0.9, size: 0.4, size1: 1.4, color: 0xd8dde4, alpha: 0.4, alpha1: 0, count: Math.ceil(3 * k), jitter: 0.2, drag: 1 });
  }
  frost(p: THREE.Vector3, dir: THREE.Vector3, k: number) {
    this.add.emit({ pos: p, vel: { x: dir.x * 9, y: dir.y * 9, z: dir.z * 9 }, spread: 2, life: 0.7, size: 0.35, size1: 1, color: 0x60a8ff, alpha: 0.35, alpha1: 0, count: Math.ceil(4 * k), drag: 1.2 });
  }
  shard(p: THREE.Vector3, n: number) {
    this.add.emit({ pos: p, vel: { x: 0, y: 3, z: 0 }, spread: 5, life: 0.7, size: 0.08, color: 0xc0f0ff, alpha: 1, count: n, gravity: 12 });
  }
  shock(p: THREE.Vector3, r: number, color: number) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(this.ringGeo, m);
    mesh.position.set(p.x, 0.08, p.z);
    this.group.add(mesh);
    this.rings.push({ mesh, life: 0.4, max: 0.4, mode: 'shock', r0: 0.3, r1: r });
  }
  /** Ground telegraph for incoming attacks. */
  telegraph(p: THREE.Vector3, r: number, time: number, color = 0xff2a2a) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const disc = new THREE.Mesh(this.discGeo, m);
    disc.position.set(p.x, 0.06, p.z);
    this.group.add(disc);
    this.rings.push({ mesh: disc, life: time, max: time, mode: 'tele', r0: r, r1: r });
  }
}
