import * as THREE from 'three';
import { buildHumanoid, CharacterModel } from '../chars/CharacterBuilder';
import { Animator } from '../chars/Animator';
import { CAST, CastId } from '../chars/Cast';
import type { World } from '../game/World';
import { attachWeapon } from './Models';
import { audio } from '../core/Audio';
import { angleDiff, clamp, damp, lerp, lerpAngle, rand } from '../core/math';
import type { WeaponId } from '../game/State';

const tv = new THREE.Vector3();

export class NPC {
  model: CharacterModel;
  anim: Animator;
  root: THREE.Group;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  homeYaw = 0;
  home = new THREE.Vector3();
  mode: 'idle' | 'follow' | 'walk' | 'hold' = 'idle';
  pose: string | null = null;
  talkId: string | null = null;
  talking = 0;
  lookTarget: THREE.Vector3 | null = null;
  lookAtPlayer = true;
  private walkTarget: THREE.Vector3 | null = null;
  private walkSpeed = 2;
  private walkResolve: (() => void) | null = null;
  private path: THREE.Vector3[] | null = null;
  private pathT = 0;
  private shootCd = rand(1, 2);
  private aimT = 0;
  weapon: WeaponId | null = null;
  private weaponHolder: THREE.Object3D | null = null;
  combat = false;
  hologram = false;
  interactable = true;
  barkT = rand(8, 20);

  constructor(public w: World, public id: CastId) {
    const look = { ...CAST[id].look };
    this.model = buildHumanoid(look);
    this.anim = new Animator(this.model);
    this.root = this.model.root;
    if (id === 'captain') this.makeHologram();
  }

  private holoMat: THREE.MeshBasicMaterial | null = null;
  private holoTime = { value: 0 };
  private holoAlpha = { value: 0.6 };

  /** The Captain only ever appears as a broadcast: additive red light with drifting scanlines and signal flicker. */
  makeHologram() {
    this.hologram = true;
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.4, 0.32, 0.42),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.holoTime;
      sh.uniforms.uAlpha = this.holoAlpha;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vHoloY;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvHoloY = (modelMatrix * vec4(transformed, 1.0)).y;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vHoloY; uniform float uTime; uniform float uAlpha;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float scan = 0.55 + 0.45 * step(0.45, fract(vHoloY * 9.0 - uTime * 1.6));
          float band = smoothstep(0.0, 0.08, abs(fract(vHoloY * 0.35 - uTime * 0.4) - 0.5));
          diffuseColor.rgb *= scan * (0.6 + 0.4 * band);
          diffuseColor.a = uAlpha;`,
        );
    };
    this.holoMat = mat;
    this.model.mesh.material = mat;
    this.anim.p.float = 1;
    this.root.traverse((o) => ((o as THREE.Mesh).castShadow = false));
  }

  place(p: THREE.Vector3, yaw: number) {
    this.pos.copy(p).setY(0);
    this.home.copy(this.pos);
    this.yaw = yaw;
    this.homeYaw = yaw;
    this.root.position.copy(this.pos);
    this.root.rotation.y = yaw;
  }

  setPose(p: string | null) {
    this.pose = p;
  }

  arm(weapon: WeaponId | null) {
    if (this.weaponHolder) {
      this.weaponHolder.parent?.remove(this.weaponHolder);
      this.weaponHolder = null;
    }
    this.weapon = weapon;
    if (weapon) this.weaponHolder = attachWeapon(this.model.bones.handR, weapon);
  }

  walkTo(p: THREE.Vector3, speed = 2): Promise<void> {
    this.mode = 'walk';
    this.walkTarget = p.clone().setY(0);
    this.walkSpeed = speed;
    this.path = null;
    return new Promise((res) => (this.walkResolve = res));
  }

  follow(on: boolean) {
    this.mode = on ? 'follow' : 'idle';
    this.combat = on;
    if (!on) this.home.copy(this.pos);
  }

  teleport(p: THREE.Vector3) {
    this.pos.copy(p).setY(0);
    this.root.position.copy(this.pos);
  }

  update(dt: number) {
    const w = this.w;
    const pl = w.player;
    let desired = new THREE.Vector3();
    const p = this.anim.p;
    if (this.mode === 'walk' && this.walkTarget) {
      const d = this.pos.distanceTo(this.walkTarget);
      if (d < 0.3) {
        this.mode = 'hold';
        this.walkTarget = null;
        const r = this.walkResolve;
        this.walkResolve = null;
        r?.();
      } else desired = this.steer(this.walkTarget, dt).multiplyScalar(Math.min(this.walkSpeed, d * 3));
    } else if (this.mode === 'follow') {
      const d = this.pos.distanceTo(pl.pos);
      if (d > 30) {
        // catch up out of sight
        const back = pl.pos.clone().add(w.game.rig.forward(tv).multiplyScalar(-3));
        if (w.level.walkable(...w.level.cellOf(back.x, back.z))) this.teleport(back);
      } else if (d > 3.2) {
        const spd = d > 8 ? 5.2 : d > 5 ? 3.8 : 2.6;
        desired = this.steer(pl.pos, dt).multiplyScalar(spd);
      }
      if (this.combat) this.fight(dt);
    }
    this.vel.x = lerp(this.vel.x, desired.x, damp(8, dt));
    this.vel.z = lerp(this.vel.z, desired.z, damp(8, dt));
    this.pos.addScaledVector(this.vel, dt);
    if (this.mode === 'follow' || this.mode === 'walk') w.level.collide(this.pos, 0.35);
    // facing
    const spd = Math.hypot(this.vel.x, this.vel.z);
    let targetYaw = this.yaw;
    if (this.aimT > 0 && this.lookTarget) targetYaw = Math.atan2(this.lookTarget.x - this.pos.x, this.lookTarget.z - this.pos.z);
    else if (spd > 0.3) targetYaw = Math.atan2(this.vel.x, this.vel.z);
    else if (this.talking > 0 && this.lookAtPlayer) targetYaw = Math.atan2(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z);
    else if (this.mode === 'idle') targetYaw = this.homeYaw;
    this.yaw = lerpAngle(this.yaw, targetYaw, damp(6, dt));
    // head look at player when near
    const dpl = this.pos.distanceTo(pl.pos);
    let ly = 0, lp = 0;
    const lookAt = this.lookTarget ?? (this.lookAtPlayer && dpl < 6 ? pl.pos : null);
    if (lookAt) {
      const a = Math.atan2(lookAt.x - this.pos.x, lookAt.z - this.pos.z);
      ly = clamp(angleDiff(this.yaw, a), -1.1, 1.1);
      if (Math.abs(angleDiff(this.yaw, a)) > 1.6) ly = 0;
    }
    this.aimT = Math.max(0, this.aimT - dt);
    p.speed = spd;
    p.run = spd > 3.5 ? 1 : 0;
    p.lookYaw = lerp(p.lookYaw, ly, damp(5, dt));
    p.lookPitch = lp;
    p.talk = lerp(p.talk, this.talking > 0 ? 1 : 0, damp(6, dt));
    this.talking = Math.max(0, this.talking - dt);
    p.pose = spd > 0.3 ? null : this.pose;
    p.poseW = lerp(p.poseW, p.pose ? 1 : 0, damp(5, dt));
    p.weapon = this.weapon ? (this.weapon === 'pistol' ? 'pistol' : this.weapon === 'pipe' || this.weapon === 'axe' ? 'melee' : 'long') : 'none';
    p.aim = lerp(p.aim, this.aimT > 0 ? 1 : 0, damp(10, dt));
    p.recoil = Math.max(0, p.recoil - dt * 6);
    this.anim.tick(dt);
    this.root.position.set(this.pos.x, 0, this.pos.z);
    this.root.rotation.y = this.yaw;
    if (this.hologram) {
      this.holoTime.value = w.time;
      this.holoAlpha.value = 0.42 + Math.sin(w.time * 13) * 0.05 + (Math.random() < 0.03 ? -0.25 : 0);
      this.root.position.y = 0.95 + Math.sin(w.time * 1.2) * 0.05;
    }
  }

  private steer(target: THREE.Vector3, dt: number) {
    const w = this.w;
    if (w.level.rayGrid(this.pos.x, this.pos.z, target.x, target.z, 'solid') === Infinity) {
      this.path = null;
      return target.clone().sub(this.pos).setY(0).normalize();
    }
    this.pathT -= dt;
    if (!this.path || this.pathT <= 0) {
      this.pathT = 0.7;
      this.path = w.level.findPath(this.pos, target);
    }
    if (this.path?.length) {
      while (this.path.length > 1 && this.pos.distanceTo(this.path[0]) < 0.6) this.path.shift();
      return this.path[0].clone().sub(this.pos).setY(0).normalize();
    }
    return target.clone().sub(this.pos).setY(0).normalize();
  }

  private fight(dt: number) {
    const w = this.w;
    this.shootCd -= dt;
    if (!this.weapon || this.shootCd > 0) return;
    let best: any = null, bd = 15;
    for (const e of w.enemies) {
      if (e.dead || e.dormantHidden || e.state === 'dormant') continue;
      const d = e.pos.distanceTo(this.pos);
      if (d < bd && w.level.los(this.pos, e.pos)) {
        bd = d;
        best = e;
      }
    }
    if (!best) {
      this.shootCd = 0.5;
      return;
    }
    this.shootCd = rand(1.1, 1.8);
    this.lookTarget = best.pos.clone();
    this.aimT = 0.8;
    setTimeout(() => {
      if (best.dead || this.w.disposed) return;
      const from = this.pos.clone().setY(1.4);
      const to = best.pos.clone().setY(1.1);
      const dmg = this.weapon === 'shotgun' ? 26 : this.weapon === 'arc' ? 20 : 15;
      best.damage(dmg, to.clone().sub(from).normalize(), { knock: 1, from: this.pos });
      w.fx.tracer(from, to, 0xffe0a0);
      w.fx.muzzle(from, 0xffb050);
      audio.play(this.weapon === 'shotgun' ? 'shotgun' : 'pistol', { pos: this.pos, vol: 0.5 });
      this.anim.p.recoil = 0.6;
      setTimeout(() => (this.lookTarget = null), 500);
    }, 250);
  }

  dispose() {
    this.root.parent?.remove(this.root);
    this.model.material.dispose();
    this.holoMat?.dispose();
    this.model.mesh.geometry.dispose();
  }
}
