import * as THREE from 'three';
import type { World } from '../game/World';
import type { HazardKind } from '../world/LevelDef';
import { audio } from '../core/Audio';
import { CELL, LightSource } from '../world/Level';
import { PM, part } from '../world/Props';
import { compact } from './Models';
import { tex } from '../gfx/Textures';

interface Hazard {
  kind: HazardKind;
  pos: THREE.Vector3;
  yaw: number;
  period: number;
  offset: number;
  t: number;
  flag?: string;
  len: number;
  obj?: THREE.Object3D;
  beam?: THREE.Mesh;
  block?: THREE.Object3D;
  lamp?: THREE.Mesh;
  life?: number;
  tick: number;
  phase: number;
  cd: number;
  light?: LightSource;
  belt?: THREE.Texture;
}

const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 12);
const disc = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);

export class Hazards {
  list: Hazard[] = [];
  electricOn = false;
  constructor(private w: World) {}

  add(kind: HazardKind, pos: THREE.Vector3, yaw: number, o: { period?: number; offset?: number; flag?: string; len?: number } = {}) {
    const P = PM();
    const h: Hazard = { kind, pos: pos.clone(), yaw, period: o.period ?? 4, offset: o.offset ?? Math.random() * 3, t: 0, flag: o.flag, len: o.len ?? 1, tick: 0, phase: -1, cd: 0 };
    const g = new THREE.Group();
    switch (kind) {
      case 'steam':
        g.add(part(box, P.metal, 0x2a2a2a, [0, 0.03, 0], [1.4, 0.06, 1.4]));
        for (let i = 0; i < 5; i++) g.add(part(box, P.paint, 0x0a0a0a, [-0.5 + i * 0.25, 0.065, 0], [0.12, 0.01, 1.2]));
        g.add(part(box, P.glowV, 0xff8040, [0, 0.07, 0.68], [1.2, 0.02, 0.04]));
        break;
      case 'laser': {
        const along = Math.abs(Math.sin(yaw)) < 0.5; // beam along x
        for (const s of [-1, 1]) {
          const off = along ? [s * (CELL / 2 - 0.15), 0] : [0, s * (CELL / 2 - 0.15)];
          g.add(part(box, P.metal, 0x2a2e36, [off[0], 0.9, off[1]], [0.25, 1.8, 0.25]));
          g.add(part(box, P.glowV, 0xff2030, [off[0], 1.5, off[1]], [0.27, 0.06, 0.27]));
        }
        const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.4, 0.5), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
        const beams = new THREE.Group();
        for (let i = 0; i < 4; i++) {
          const b = new THREE.Mesh(box, beamMat);
          b.scale.set(along ? CELL - 0.3 : 0.03, 0.03, along ? 0.03 : CELL - 0.3);
          b.position.y = 0.35 + i * 0.4;
          beams.add(b);
        }
        h.beam = beams as any;
        h.obj = g;
        g.position.copy(pos);
        this.w.scene.add(g);
        g.add(beams);
        this.list.push(h);
        return h;
      }
      case 'electric':
        g.add(part(box, P.metal, 0x3a3a3a, [0, 0.6, 0], [0.4, 1.2, 0.3]));
        g.add(part(box, P.glowV, 0x80e0ff, [0, 1.0, 0.16], [0.2, 0.1, 0.02]));
        g.add(part(cyl, P.paint, 0x1a1a1a, [0.5, 0.35, 0], [0.03, 1.2, 0.03], [0, 0, 1.2]));
        this.electricOn = true;
        break;
      case 'spore':
        g.add(part(new THREE.SphereGeometry(1, 10, 8), P.leaves, 0x5a7a2a, [0, 0.45, 0], [0.55, 0.5, 0.55]));
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          g.add(part(new THREE.SphereGeometry(1, 8, 6), P.glowV, 0xd0ff40, [Math.cos(a) * 0.45, 0.5, Math.sin(a) * 0.45], [0.09, 0.09, 0.09]));
        }
        break;
      case 'press': {
        g.add(part(box, P.metal, 0x4a4038, [-1.2, 2.2, 0], [0.4, 4.4, 1.6]));
        g.add(part(box, P.metal, 0x4a4038, [1.2, 2.2, 0], [0.4, 4.4, 1.6]));
        g.add(part(box, P.metal, 0x4a4038, [0, 4.5, 0], [2.8, 0.5, 1.6]));
        g.add(part(box, P.hazard, 0xffffff, [0, 0.03, 0], [2.0, 0.05, 1.6]));
        const blk = compact(new THREE.Group().add(part(box, P.metal, 0x8a7a60, [0, 0, 0], [1.9, 1.2, 1.4]), part(box, P.hazard, 0xffffff, [0, -0.62, 0], [1.9, 0.05, 1.4])));
        blk.position.y = 3.4;
        g.add(blk);
        h.block = blk;
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.05, 0.05) }));
        lamp.position.set(0, 4.85, 0.6);
        g.add(lamp);
        h.lamp = lamp;
        this.w.level.addBox({ minX: pos.x - 1.45, maxX: pos.x - 0.95, minZ: pos.z - 0.8, maxZ: pos.z + 0.8, h: 4.4 });
        this.w.level.addBox({ minX: pos.x + 0.95, maxX: pos.x + 1.45, minZ: pos.z - 0.8, maxZ: pos.z + 0.8, h: 4.4 });
        break;
      }
      case 'conveyor': {
        const t = tex('hazard').clone();
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(1, h.len * 3);
        t.needsUpdate = true;
        h.belt = t;
        const belt = new THREE.Mesh(box, new THREE.MeshToonMaterial({ map: t, color: 0x6a6a6a }));
        belt.scale.set(2.2, 0.1, CELL * h.len);
        belt.position.set(0, 0.05, (CELL * (h.len - 1)) / 2);
        g.add(belt);
        g.add(part(box, P.metal, 0x2a2a2a, [1.2, 0.15, (CELL * (h.len - 1)) / 2], [0.2, 0.3, CELL * h.len]));
        g.add(part(box, P.metal, 0x2a2a2a, [-1.2, 0.15, (CELL * (h.len - 1)) / 2], [0.2, 0.3, CELL * h.len]));
        break;
      }
      case 'cold':
        g.add(part(cyl, P.metal, 0x8aa0b8, [0, 0.05, 0], [0.7, 0.1, 0.7]));
        g.add(part(cyl, P.glowV, 0x80d0ff, [0, 0.11, 0], [0.5, 0.02, 0.5]));
        break;
      case 'fire':
        g.add(part(new THREE.ConeGeometry(1, 1, 7), P.glowV, 0xff6020, [0, 0.4, 0], [0.6, 0.8, 0.6]));
        h.light = { pos: pos.clone().setY(1), color: new THREE.Color(0xff7030), intensity: 18, range: 9, flicker: 0.5 };
        this.w.level.lights.push(h.light);
        break;
      case 'acid':
        g.add(part(disc, P.glowSoft, 0x60c020, [0, 0.03, 0], [1.3, 1, 1.3]));
        break;
    }
    h.obj = compact(g);
    if (kind === 'press' || kind === 'conveyor') h.obj = g;
    h.obj.position.copy(pos);
    h.obj.rotation.y = yaw;
    this.w.scene.add(h.obj);
    this.list.push(h);
    return h;
  }

  addTemp(kind: 'acid' | 'spore', pos: THREE.Vector3, life: number) {
    const h = this.add(kind === 'acid' ? 'acid' : 'spore', pos, 0);
    h.life = life;
    if (kind === 'spore') {
      // temp spore clouds have no pod model
      if (h.obj) this.w.scene.remove(h.obj);
      h.obj = undefined;
      h.phase = 99; // marks a cloud
    }
    return h;
  }

  active(h: Hazard) {
    return !(h.flag && this.w.game.flag(h.flag));
  }

  pushAt(p: THREE.Vector3): THREE.Vector3 {
    const out = new THREE.Vector3();
    for (const h of this.list) {
      if (h.kind !== 'conveyor' || !this.active(h)) continue;
      const dir = new THREE.Vector3(Math.sin(h.yaw), 0, Math.cos(h.yaw));
      const rel = p.clone().sub(h.pos);
      const along = rel.dot(dir);
      const side = Math.abs(rel.x * dir.z - rel.z * dir.x);
      if (along > -CELL / 2 && along < CELL * (h.len - 0.5) && side < 1.1) out.addScaledVector(dir, 2.4);
    }
    return out;
  }

  update(dt: number) {
    const w = this.w;
    const pl = w.player;
    let anyElectric = false;
    for (const h of this.list) {
      h.t += dt;
      h.cd = Math.max(0, h.cd - dt);
      if (h.life !== undefined) {
        h.life -= dt;
        if (h.life <= 0) {
          this.remove(h);
          continue;
        }
      }
      const on = this.active(h);
      const dpl = Math.hypot(pl.pos.x - h.pos.x, pl.pos.z - h.pos.z);
      const hurt = (dmg: number, opts: any = {}) => {
        h.tick -= dt;
        if (h.tick <= 0) {
          h.tick = 0.3;
          pl.damage(dmg * 0.3, h.pos, opts);
        }
      };
      switch (h.kind) {
        case 'steam': {
          if (!on) break;
          const ph = (h.t + h.offset) % h.period;
          if (ph < 0.8) {
            if (Math.random() < dt * 8) w.fx.steam(h.pos.clone().setY(0.1), 0.3);
            if (h.phase !== 0) {
              h.phase = 0;
              if (dpl < 15) audio.play('steam', { pos: h.pos, vol: 0.3 });
            }
          } else if (ph < 2.0) {
            if (h.phase !== 1) {
              h.phase = 1;
              if (dpl < 20) audio.play('steam', { pos: h.pos, vol: 0.9 });
            }
            w.fx.steam(h.pos.clone().setY(0.1), 1.5);
            if (dpl < 1.5) hurt(20);
          } else h.phase = 2;
          break;
        }
        case 'laser': {
          const ph = (h.t + h.offset) % h.period;
          const lit = on && ph < h.period * 0.65;
          if (h.beam) h.beam.visible = lit;
          if (lit) {
            const along = Math.abs(Math.sin(h.yaw)) < 0.5;
            const off = along ? Math.abs(pl.pos.z - h.pos.z) : Math.abs(pl.pos.x - h.pos.x);
            const inSpan = along ? Math.abs(pl.pos.x - h.pos.x) < CELL / 2 : Math.abs(pl.pos.z - h.pos.z) < CELL / 2;
            if (off < 0.45 && inSpan && h.cd <= 0) {
              h.cd = 0.6;
              pl.damage(28, h.pos, { knock: 4 });
              audio.play('zap', { pos: h.pos });
              w.fx.sparks(pl.pos.clone().setY(1), new THREE.Vector3(0, 1, 0), 0xff4040, 12);
            }
          }
          break;
        }
        case 'electric': {
          if (!on) break;
          anyElectric = true;
          if (Math.random() < dt * 6) {
            const p = h.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0.35, (Math.random() - 0.5) * 6));
            if (w.level.terrainAt(p.x, p.z) === 5) w.fx.sparks(p, new THREE.Vector3(0, 1, 0), 0x80e0ff, 4);
          }
          if (dpl < 7 && pl.inWater) {
            hurt(16, { knock: 0 });
            if (Math.random() < dt * 4) audio.play('zap', { pos: pl.pos, vol: 0.5 });
          }
          break;
        }
        case 'spore': {
          if (h.phase === 99) {
            // temporary cloud
            if (Math.random() < dt * 4) w.fx.cloud(h.pos, 0xb0d040, 2, 1.5);
            if (dpl < 2.3) {
              hurt(8);
              w.game.state.sanity = Math.max(0, w.game.state.sanity - dt * 5);
            }
            break;
          }
          if (!on) break;
          if (dpl < 3 && h.cd <= 0) {
            h.cd = 6;
            audio.play('spore', { pos: h.pos });
            w.fx.cloud(h.pos, 0xc0e040, 2.4, 3.5);
            this.addTemp('spore', h.pos.clone(), 4);
          }
          if (h.obj) h.obj.scale.setScalar(1 + Math.sin(h.t * 3) * 0.05);
          break;
        }
        case 'press': {
          if (!on || !h.block) break;
          const ph = (h.t + h.offset) % h.period;
          const slamAt = h.period - 0.6;
          let y = 3.4;
          if (ph > slamAt) {
            const k = (ph - slamAt) / 0.6;
            y = k < 0.25 ? 3.4 - (k / 0.25) * 2.75 : 0.65 + ((k - 0.25) / 0.75) * 2.75;
            if (k >= 0.25 && h.phase !== 1) {
              h.phase = 1;
              audio.play('stomp', { pos: h.pos, vol: 1 });
              w.fx.steam(h.pos.clone().setY(0.2), 2);
              if (dpl < 15) w.game.rig.addShake(Math.max(0, 0.6 - dpl * 0.04));
              const local = pl.pos.clone().sub(h.pos);
              if (Math.abs(local.x) < 1.1 && Math.abs(local.z) < 0.9) pl.damage(55, h.pos, { knock: 7 });
              for (const e of w.enemies) {
                if (e.dead) continue;
                const l2 = e.pos.clone().sub(h.pos);
                if (Math.abs(l2.x) < 1.1 && Math.abs(l2.z) < 0.9) e.damage(300, new THREE.Vector3(0, -1, 0), { explosive: true });
              }
            }
          } else h.phase = 0;
          h.block.position.y = y;
          const warn = ph > slamAt - 1.0 && ph < slamAt;
          if (h.lamp) (h.lamp.material as THREE.MeshBasicMaterial).color.setRGB(warn && Math.sin(h.t * 25) > 0 ? 4 : 0.3, 0.05, 0.05);
          break;
        }
        case 'conveyor':
          if (on && h.belt) h.belt.offset.y -= dt * 0.8;
          break;
        case 'cold': {
          if (!on) break;
          const ph = (h.t + h.offset) % h.period;
          if (ph < 1.4) {
            if (Math.random() < dt * 20) w.fx.frost(h.pos.clone().setY(0.2), new THREE.Vector3(0, 0.6, 0), 1);
            if (dpl < 1.6) {
              hurt(8, { freeze: 1.5 });
            }
          }
          break;
        }
        case 'fire':
          if (Math.random() < dt * 20) w.fx.add.emit({ pos: h.pos.clone().setY(0.5), vel: { x: 0, y: 2.5, z: 0 }, spread: 0.6, life: 0.6, size: 0.4, size1: 0.05, color: 0xff7020, color1: 0xff2000, alpha: 1 });
          if (dpl < 1.2) hurt(14);
          break;
        case 'acid':
          if (dpl < 1.3) hurt(8, { poison: 1.5 });
          break;
      }
    }
    this.electricOn = anyElectric;
    if (w.built.waterMat) w.built.waterMat.uniforms.uElectric.value = anyElectric ? 1 : 0;
  }

  remove(h: Hazard) {
    if (h.obj) this.w.scene.remove(h.obj);
    if (h.light) {
      const i = this.w.level.lights.indexOf(h.light);
      if (i >= 0) this.w.level.lights.splice(i, 1);
    }
    const i = this.list.indexOf(h);
    if (i >= 0) this.list.splice(i, 1);
  }

  clear() {
    for (const h of [...this.list]) this.remove(h);
  }
}
