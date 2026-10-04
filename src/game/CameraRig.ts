import * as THREE from 'three';
import { clamp, damp, lerp } from '../core/math';
import type { Level } from '../world/Level';

export interface CineShot {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov?: number;
  /** seconds to blend into this shot (0 = cut) */
  blend?: number;
  /** slow drift applied over time */
  drift?: THREE.Vector3;
  shakeAmt?: number;
}

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

export class CameraRig {
  yaw = 0;
  pitch = -0.12;
  aim = 0;
  private dist = 3.4;
  shake = 0;
  private shakeT = 0;
  kick = 0;
  baseFov = 70;
  fovBoost = 0;
  mode: 'follow' | 'cine' = 'follow';
  private cine: CineShot | null = null;
  private cineFrom: { pos: THREE.Vector3; look: THREE.Vector3; fov: number } | null = null;
  private cineT = 0;
  private cineAge = 0;
  private curLook = new THREE.Vector3();
  pivot = new THREE.Vector3();
  shoulder = 1; // 1 right, -1 left
  sneak = 0;
  ceiling = 99;

  constructor(public camera: THREE.PerspectiveCamera) {}

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }
  right(out = new THREE.Vector3()) {
    return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }
  dir(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  look(dx: number, dy: number, sens: number, invert: boolean) {
    const s = 0.0022 * sens * (1 - this.aim * 0.45);
    this.yaw -= dx * s;
    this.pitch -= dy * s * (invert ? -1 : 1);
    this.pitch = clamp(this.pitch, -1.2, 1.0);
  }

  setCine(shot: CineShot | null) {
    if (!shot) {
      if (this.mode === 'cine') {
        // derive follow yaw/pitch from current camera orientation for smooth return
        const d = this.camera.getWorldDirection(tmp);
        this.yaw = Math.atan2(-d.x, -d.z);
        this.pitch = clamp(Math.asin(clamp(d.y, -1, 1)), -1.0, 0.8);
      }
      this.mode = 'follow';
      this.cine = null;
      return;
    }
    const blend = shot.blend ?? 0;
    this.cineFrom = blend > 0 ? { pos: this.camera.position.clone(), look: this.curLook.clone(), fov: this.camera.fov } : null;
    this.cine = shot;
    this.cineT = 0;
    this.cineAge = 0;
    this.mode = 'cine';
  }

  addShake(a: number) {
    this.shake = Math.min(1.5, this.shake + a);
  }

  update(dt: number, target: THREE.Vector3, level: Level | null, shakeScale: number) {
    const cam = this.camera;
    this.shakeT += dt;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.kick = Math.max(0, this.kick - dt * 6);
    const sh = this.shake * this.shake * shakeScale;
    const sx = (Math.sin(this.shakeT * 37) + Math.sin(this.shakeT * 23.3)) * 0.5 * sh * 0.06;
    const sy = (Math.sin(this.shakeT * 41.7) + Math.sin(this.shakeT * 29.1)) * 0.5 * sh * 0.06;

    if (this.mode === 'cine' && this.cine) {
      const c = this.cine;
      this.cineAge += dt;
      const drift = c.drift ? tmp2.copy(c.drift).multiplyScalar(this.cineAge) : tmp2.set(0, 0, 0);
      const toPos = tmp.copy(c.pos).add(drift);
      let pos = toPos.clone();
      let look = c.look.clone();
      let fov = c.fov ?? this.baseFov;
      if (this.cineFrom && c.blend) {
        this.cineT = Math.min(1, this.cineT + dt / c.blend);
        const k = this.cineT * this.cineT * (3 - 2 * this.cineT);
        pos = this.cineFrom.pos.clone().lerp(toPos, k);
        look = this.cineFrom.look.clone().lerp(c.look, k);
        fov = lerp(this.cineFrom.fov, fov, k);
      }
      cam.position.copy(pos);
      this.curLook.copy(look);
      cam.lookAt(look);
      const csh = (c.shakeAmt ?? 0) + sh;
      cam.rotation.z += Math.sin(this.shakeT * 31) * csh * 0.01;
      cam.position.x += sx * 4 * (c.shakeAmt ?? 0);
      if (Math.abs(cam.fov - fov) > 0.01) {
        cam.fov = fov;
        cam.updateProjectionMatrix();
      }
      return;
    }

    // follow
    const aim = this.aim;
    const back = lerp(3.3, 1.55, aim) - this.sneak * 0.3;
    const right = lerp(0.6, 0.62, aim) * this.shoulder;
    const up = lerp(0.18, 0.12, aim);
    this.pivot.set(target.x, target.y + lerp(1.55, 1.6, aim) - this.sneak * 0.35, target.z);
    const d = this.dir(tmp);
    const r = this.right(tmp2);
    const desired = new THREE.Vector3().copy(this.pivot).addScaledVector(r, right).addScaledVector(d, -back);
    desired.y += up;
    // collision
    const from = this.pivot;
    const dx = desired.x - from.x, dz = desired.z - from.z;
    const lenXZ = Math.hypot(dx, dz);
    let maxT = 1;
    if (level && lenXZ > 0.01) {
      const ext = 0.3;
      const ex = from.x + (dx / lenXZ) * (lenXZ + ext), ez = from.z + (dz / lenXZ) * (lenXZ + ext);
      const hit = level.rayGrid(from.x, from.z, ex, ez, 'opaque');
      if (hit !== Infinity) maxT = Math.min(maxT, Math.max(0.05, (hit - ext) / lenXZ));
      // tall props
      const full = new THREE.Vector3(desired.x - from.x, desired.y - from.y, desired.z - from.z);
      const L = full.length();
      const bt = level.rayBoxes(from, full.clone().normalize(), L + 0.3);
      if (bt < L + 0.3) maxT = Math.min(maxT, Math.max(0.05, (bt - 0.3) / L));
    }
    this.dist = lerp(this.dist, maxT, maxT < this.dist ? 1 : damp(4, dt));
    const pos = from.clone().lerp(desired, this.dist);
    pos.y = Math.min(pos.y, this.ceiling - 0.25);
    cam.position.copy(pos);
    cam.rotation.order = 'YXZ';
    cam.rotation.set(this.pitch + this.kick * 0.04 + sy, this.yaw + sx, 0);
    this.curLook.copy(cam.position).add(this.dir(tmp).multiplyScalar(10));
    const fov = this.baseFov - aim * 18 + this.fovBoost;
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = lerp(cam.fov, fov, damp(12, dt));
      cam.updateProjectionMatrix();
    }
  }
}
