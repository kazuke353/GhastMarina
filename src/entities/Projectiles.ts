import * as THREE from 'three';
import type { World } from '../game/World';
import { audio } from '../core/Audio';
import { itemModel } from './Models';
import { CELL, LightSource } from '../world/Level';

type EShot = 'acid' | 'spark' | 'ice' | 'spore' | 'orb' | 'rock';

interface Proj {
  kind: EShot | 'flare' | 'pipebomb';
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  gravity: number;
  life: number;
  dmg: number;
  mesh: THREE.Object3D;
  homing?: number;
  player: boolean;
  resting?: boolean;
  fuse?: number;
  light?: LightSource;
  radius: number;
  dead?: boolean;
}

const COLORS: Record<EShot, number> = { acid: 0x90ff40, spark: 0xffa040, ice: 0xa0e8ff, spore: 0xd0ff60, orb: 0xff70e0, rock: 0x6a6460 };

export class Projectiles {
  list: Proj[] = [];
  private geo = new THREE.SphereGeometry(1, 10, 8);
  private mats = new Map<string, THREE.Material>();
  constructor(private w: World) {}

  private mat(kind: EShot) {
    let m = this.mats.get(kind);
    if (!m) {
      m = kind === 'rock'
        ? new THREE.MeshToonMaterial({ color: COLORS.rock })
        : new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS[kind]).multiplyScalar(3) });
      this.mats.set(kind, m);
    }
    return m;
  }

  get flares() {
    return this.list.filter((p) => p.kind === 'flare' && !p.dead);
  }

  enemyShot(kind: EShot, from: THREE.Vector3, target: THREE.Vector3, speed: number, dmg: number, opts: { lob?: boolean; homing?: number; size?: number } = {}) {
    const lob = opts.lob ?? (kind === 'acid' || kind === 'rock' || kind === 'spore');
    const vel = new THREE.Vector3();
    const g = lob ? 14 : 0;
    if (lob) {
      const d = target.clone().sub(from);
      const flat = Math.hypot(d.x, d.z);
      const t = Math.max(0.45, flat / speed);
      vel.set(d.x / t, d.y / t + 0.5 * g * t, d.z / t);
    } else vel.copy(target).sub(from).normalize().multiplyScalar(speed);
    const size = opts.size ?? (kind === 'rock' ? 0.45 : kind === 'orb' ? 0.22 : 0.16);
    const mesh = new THREE.Mesh(this.geo, this.mat(kind));
    mesh.scale.setScalar(size);
    mesh.position.copy(from);
    this.w.scene.add(mesh);
    this.list.push({ kind, pos: from.clone(), vel, gravity: g, life: 6, dmg, mesh, homing: opts.homing, player: false, radius: size + 0.3 });
  }

  throwItem(kind: 'flare' | 'pipebomb', from: THREE.Vector3, vel: THREE.Vector3) {
    const mesh = itemModel(kind);
    mesh.position.copy(from);
    this.w.scene.add(mesh);
    const p: Proj = { kind, pos: from.clone(), vel: vel.clone(), gravity: 16, life: kind === 'flare' ? 22 : 99, dmg: 0, mesh, player: true, radius: 0.1, fuse: kind === 'pipebomb' ? 1.8 : undefined };
    if (kind === 'flare') {
      p.light = { pos: p.pos.clone(), color: new THREE.Color(0xff3a20), intensity: 26, range: 13, flicker: 0.35 };
      this.w.level.lights.push(p.light);
      audio.play('flare', { pos: from, vol: 0.6 });
    }
    this.list.push(p);
  }

  update(dt: number) {
    const w = this.w;
    const pl = w.player;
    for (const p of this.list) {
      if (p.dead) continue;
      p.life -= dt;
      if (p.kind === 'flare' || p.kind === 'pipebomb') {
        if (!p.resting) {
          p.vel.y -= p.gravity * dt;
          const next = p.pos.clone().addScaledVector(p.vel, dt);
          if (w.level.isSolidCell(Math.floor(next.x / CELL), Math.floor(next.z / CELL)) && next.y < 4) {
            // bounce off wall
            const gx = Math.floor(next.x / CELL), gz = Math.floor(next.z / CELL);
            const cx = Math.floor(p.pos.x / CELL), cz = Math.floor(p.pos.z / CELL);
            if (gx !== cx) p.vel.x *= -0.35;
            if (gz !== cz) p.vel.z *= -0.35;
            next.copy(p.pos);
          }
          if (next.y <= 0.06) {
            next.y = 0.06;
            p.vel.y = Math.abs(p.vel.y) > 2 ? -p.vel.y * 0.3 : 0;
            p.vel.x *= 0.6;
            p.vel.z *= 0.6;
            if (Math.hypot(p.vel.x, p.vel.z) < 0.4 && p.vel.y === 0) p.resting = true;
          }
          p.pos.copy(next);
          p.mesh.rotation.x += dt * 8;
        }
        if (p.kind === 'flare') {
          if (p.light) p.light.pos.copy(p.pos).setY(p.pos.y + 0.4);
          if (Math.random() < dt * 30) w.fx.add.emit({ pos: p.pos, vel: { x: 0, y: 1.5, z: 0 }, spread: 0.6, life: 0.5, size: 0.12, size1: 0.02, color: 0xff5030, alpha: 1, gravity: -1 });
          if (Math.random() < dt * 6) w.fx.alpha.emit({ pos: p.pos, vel: { x: 0, y: 1.2, z: 0 }, spread: 0.2, life: 1.5, size: 0.2, size1: 0.8, color: 0x806060, alpha: 0.2 });
          // burn nearby enemies
          if (p.resting) {
            for (const e of w.enemies) if (!e.dead && e.pos.distanceTo(p.pos) < 1.3) e.damage(dt * 16, new THREE.Vector3(), { fire: true, silent: true });
          }
          if (p.life <= 0) this.kill(p);
        } else if (p.fuse !== undefined) {
          p.fuse -= dt;
          if (Math.random() < dt * 20) w.fx.sparks(p.pos.clone().setY(p.pos.y + 0.1), new THREE.Vector3(0, 1, 0), 0xffc060, 1);
          if (p.fuse <= 0) {
            this.kill(p);
            w.explode(p.pos.clone().setY(0.6), 4.8, 150, 'fire', null);
          }
        }
        p.mesh.position.copy(p.pos);
        continue;
      }
      // enemy shots
      if (p.homing) {
        const to = pl.pos.clone().setY(1.1).sub(p.pos).normalize().multiplyScalar(p.vel.length());
        p.vel.lerp(to, Math.min(1, dt * p.homing));
      }
      p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      if (Math.random() < dt * 25) w.fx.add.emit({ pos: p.pos, spread: 0.3, life: 0.3, size: 0.12, size1: 0.02, color: COLORS[p.kind as EShot], alpha: 0.8 });
      // hit player
      const dp = pl.pos.clone().setY(1.0).distanceTo(p.pos);
      if (dp < p.radius + 0.35 && !pl.dead) {
        this.impact(p, true);
        continue;
      }
      // hit world
      const gx = Math.floor(p.pos.x / CELL), gz = Math.floor(p.pos.z / CELL);
      if (p.pos.y <= 0.05 || (w.level.isSolidCell(gx, gz) && w.level.isOpaqueCell(gx, gz) && p.pos.y < 6) || p.life <= 0) this.impact(p, false);
    }
    this.list = this.list.filter((p) => !p.dead);
  }

  private impact(p: Proj, direct: boolean) {
    const w = this.w;
    const pl = w.player;
    const k = p.kind as EShot;
    const at = p.pos.clone();
    switch (k) {
      case 'acid':
        audio.play('acid', { pos: at, vol: 0.6 });
        w.fx.explosion(at.clone().setY(0.3), 'toxic', 1.2);
        if (direct || pl.pos.distanceTo(at.clone().setY(0)) < 1.4) pl.damage(p.dmg, at, { poison: 2.5 });
        w.hazards.addTemp('acid', at.clone().setY(0), 4);
        break;
      case 'spore':
        audio.play('spore', { pos: at });
        w.fx.cloud(at, 0xc0e040, 2.2, 3);
        w.hazards.addTemp('spore', at.clone().setY(0), 3.5);
        if (direct) pl.damage(p.dmg, at, { sanity: 6 });
        break;
      case 'ice':
        audio.play('iceCrack', { pos: at, vol: 0.6 });
        w.fx.shard(at, 10);
        if (direct) pl.damage(p.dmg, at, { freeze: 2 });
        break;
      case 'orb':
        audio.play('teleport', { pos: at, vol: 0.5 });
        w.fx.explosion(at, 'psychic', 1);
        if (direct) pl.damage(p.dmg, at, { sanity: 10 });
        break;
      case 'rock':
        audio.play('stomp', { pos: at, vol: 0.8 });
        w.fx.explosion(at.clone().setY(0.3), 'fire', 1.6);
        w.game.rig.addShake(0.4);
        if (direct || pl.pos.distanceTo(at.clone().setY(0)) < 2) pl.damage(p.dmg, at, { knock: 5 });
        break;
      case 'spark':
      default:
        audio.play('zap', { pos: at, vol: 0.4 });
        w.fx.sparks(at, new THREE.Vector3(0, 1, 0), 0xffa040, 10);
        if (direct) pl.damage(p.dmg, at, { knock: 1.5 });
    }
    this.kill(p);
  }

  private kill(p: Proj) {
    p.dead = true;
    this.w.scene.remove(p.mesh);
    if (p.light) {
      const i = this.w.level.lights.indexOf(p.light);
      if (i >= 0) this.w.level.lights.splice(i, 1);
    }
  }

  clear() {
    for (const p of this.list) this.kill(p);
    this.list = [];
  }
}
