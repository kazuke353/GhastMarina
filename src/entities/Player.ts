import * as THREE from 'three';
import { buildHumanoid, CharacterModel } from '../chars/CharacterBuilder';
import { Animator } from '../chars/Animator';
import { CAST } from '../chars/Cast';
import { attachWeapon } from './Models';
import { WEAPONS, WeaponDef } from '../game/Items';
import type { WeaponId } from '../game/State';
import type { World } from '../game/World';
import { audio, Surface } from '../core/Audio';
import { angleDiff, clamp, clamp01, damp, lerp, lerpAngle, rand } from '../core/math';
import { T } from '../world/Level';

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

export class Player {
  model: CharacterModel;
  anim: Animator;
  root: THREE.Group;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  radius = 0.38;
  stamina = 100;
  private staminaDelay = 0;
  dead = false;
  deadT = 0;
  control = true; // input allowed
  busy = 0; // seconds of action lock (takedown, interacting)
  // combat
  attackT = -1;
  private attackDur = 0.5;
  private attackHit = false;
  combo = 0;
  private comboWindow = 0;
  fireCd = 0;
  reloadT = -1;
  private reloadDur = 1;
  rollT = -1;
  private rollDir = new THREE.Vector3();
  invuln = 0;
  hurtT = 0;
  healT = -1;
  private healDur = 1.2;
  private healItem: 'medkit' | 'bandage' | 'pills' | null = null;
  throwT = -1;
  private throwKind: 'flare' | 'pipebomb' = 'flare';
  private thrown = false;
  spreadBloom = 0;
  aiming = false;
  sprinting = false;
  sneaking = false;
  flashlight = true;
  weaponHolder: THREE.Group | null = null;
  equipped: WeaponId = 'pipe';
  private footT = 0;
  slowT = 0; // freeze slow
  poisonT = 0;
  noise = 0;
  lastHitT = 0;
  moveInput = new THREE.Vector2();
  interactAnim = 0;
  surface: Surface = 'metal';
  inWater = false;
  private iceVel = new THREE.Vector3();
  scriptedMove: { target: THREE.Vector3; speed: number; resolve: () => void } | null = null;

  constructor(private w: World) {
    this.model = buildHumanoid(CAST.noah.look);
    this.root = this.model.root;
    this.anim = new Animator(this.model);
    this.root.traverse((o) => (o.frustumCulled = false));
  }

  get game() {
    return this.w.game;
  }
  get state() {
    return this.w.game.state;
  }
  get weapon(): WeaponDef {
    return WEAPONS[this.equipped];
  }

  place(p: THREE.Vector3, yaw: number) {
    this.pos.copy(p);
    this.pos.y = 0;
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.root.position.copy(this.pos);
    this.root.rotation.y = yaw;
  }

  equip(id: WeaponId, silent = false) {
    if (!this.state.weapons[id]) return;
    if (this.weaponHolder) {
      this.weaponHolder.parent?.remove(this.weaponHolder);
      this.weaponHolder = null;
    }
    this.equipped = id;
    this.state.equipped = id;
    if (WEAPONS[id].kind === 'gun') this.state.lastGun = id;
    this.weaponHolder = attachWeapon(this.model.bones.handR, id);
    this.reloadT = -1;
    this.attackT = -1;
    if (!silent) audio.play('reload', { vol: 0.3, pitch: 1.4 });
    this.game.ui.hud.weaponChanged();
  }

  magOf(id: WeaponId) {
    const w = WEAPONS[id];
    if (w.kind !== 'gun') return 0;
    return this.state.mag[id] ?? 0;
  }
  magSize(id: WeaponId) {
    const w = WEAPONS[id];
    const up = this.state.upgrades[id]?.mag ?? 0;
    return Math.round(w.mag * (1 + up * 0.25));
  }
  dmgMult(id: WeaponId) {
    const up = this.state.upgrades[id]?.dmg ?? 0;
    let m = 1 + up * 0.15;
    if (WEAPONS[id].kind === 'melee') m *= 1 + (this.state.skills.heavy ?? 0) * 0.25;
    return m;
  }
  reloadMult(id: WeaponId) {
    const up = this.state.upgrades[id]?.reload ?? 0;
    return (1 - up * 0.15) * (1 - (this.state.skills.quickhands ?? 0) * 0.2);
  }

  damage(amount: number, from: THREE.Vector3 | null, opts: { knock?: number; freeze?: number; poison?: number; sanity?: number; unblockable?: boolean } = {}) {
    if (this.dead) return false;
    if (this.invuln > 0 && !opts.unblockable) return false;
    if ((this.w.game as any).__god) return false;
    const diff = this.state.difficulty;
    const mult = diff === 'story' ? 0.5 : diff === 'nightmare' ? 1.5 : 1;
    let dmg = amount * mult;
    if (this.w.game.sanityLow) dmg *= 1.15;
    this.state.hp = Math.max(0, this.state.hp - dmg);
    this.hurtT = 1;
    this.lastHitT = this.w.time;
    this.invuln = 0.35;
    if (opts.freeze) this.slowT = Math.max(this.slowT, opts.freeze);
    if (opts.poison) this.poisonT = Math.max(this.poisonT, opts.poison);
    if (opts.sanity) this.state.sanity = Math.max(0, this.state.sanity - opts.sanity);
    if (from && opts.knock) {
      tmpV.copy(this.pos).sub(from).setY(0).normalize().multiplyScalar(opts.knock);
      this.vel.add(tmpV);
    }
    audio.play('hurt', { vol: 0.8 });
    this.game.onPlayerHurt(dmg, from);
    if (this.state.hp <= 0) this.die();
    return true;
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.deadT = 0;
    this.anim.p.dead = 0.001;
    this.anim.p.deadDir = Math.random() < 0.5 ? 1 : -1;
    audio.play('zombieDie', { vol: 0.5, pitch: 1.6 });
    this.game.onPlayerDeath();
  }

  revive(hp: number) {
    this.dead = false;
    this.anim.p.dead = 0;
    this.state.hp = hp;
  }

  /** Walk to a point (cutscenes). */
  walkTo(target: THREE.Vector3, speed = 2.2): Promise<void> {
    return new Promise((resolve) => {
      this.scriptedMove = { target: target.clone().setY(0), speed, resolve };
    });
  }

  update(dt: number) {
    const w = this.w;
    const input = this.game.input;
    const rig = this.game.rig;
    const st = this.state;
    const p = this.anim.p;
    const canAct = this.control && !this.dead && this.busy <= 0 && !this.scriptedMove;

    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtT = Math.max(0, this.hurtT - dt * 3);
    this.busy = Math.max(0, this.busy - dt);
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.comboWindow = Math.max(0, this.comboWindow - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.spreadBloom = Math.max(0, this.spreadBloom - dt * 2.5);
    if (this.poisonT > 0) {
      this.poisonT -= dt;
      st.hp = Math.max(1, st.hp - dt * 4);
    }

    if (this.dead) {
      this.deadT += dt;
      p.dead = Math.min(1, this.deadT * 1.4);
      p.speed = 0;
      this.anim.tick(dt);
      this.root.position.copy(this.pos);
      return;
    }

    // ---- input ----
    const mv = canAct ? input.moveVector() : { x: 0, y: 0 };
    this.moveInput.set(mv.x, mv.y);
    const wantAim = canAct && input.isDown('aim') && this.rollT < 0;
    this.aiming = wantAim;
    rig.aim = lerp(rig.aim, wantAim ? 1 : 0, damp(12, dt));
    this.sneaking = canAct && input.isDown('sneak') && !wantAim;
    rig.sneak = lerp(rig.sneak, this.sneaking ? 1 : 0, damp(6, dt));
    const moving = Math.hypot(mv.x, mv.y) > 0.1;
    const wantSprint = canAct && input.isDown('sprint') && moving && !wantAim && !this.sneaking && this.stamina > 2 && this.healT < 0;
    this.sprinting = wantSprint && mv.y > -0.2;

    // ---- terrain ----
    const terr = w.level.terrainAt(this.pos.x, this.pos.z);
    this.inWater = terr === T.Water;
    const onIce = terr === T.Ice;
    this.surface = w.level.surfaceOf(this.pos.x, this.pos.z) as Surface;
    if (this.inWater) this.surface = 'water';

    // ---- movement ----
    const fwd = rig.forward(tmpV);
    const right = rig.right(tmpV2);
    const desired = new THREE.Vector3();
    if (this.scriptedMove) {
      const sm = this.scriptedMove;
      const d = sm.target.clone().sub(this.pos).setY(0);
      const L = d.length();
      if (L < 0.25) {
        this.scriptedMove = null;
        sm.resolve();
      } else desired.copy(d.normalize().multiplyScalar(Math.min(sm.speed, L * 3)));
    } else {
      desired.addScaledVector(fwd, mv.y).addScaledVector(right, mv.x);
      let speed = 3.1;
      if (this.sprinting) speed = 5.7;
      if (this.sneaking) speed = 1.55;
      if (wantAim) speed = 2.1;
      if (this.attackT >= 0) speed *= 0.35;
      if (this.healT >= 0) speed *= 0.45;
      if (this.reloadT >= 0) speed *= 0.8;
      if (this.inWater) speed *= 0.62;
      if (this.slowT > 0) speed *= 0.5;
      desired.multiplyScalar(speed);
    }

    if (this.rollT >= 0) {
      this.rollT += dt / 0.55;
      const k = 1 - this.rollT;
      this.vel.copy(this.rollDir).multiplyScalar(7.5 * (0.35 + k * 0.9));
      if (this.rollT >= 1) this.rollT = -1;
    } else {
      const accel = onIce ? 2.2 : 14;
      this.vel.x = lerp(this.vel.x, desired.x, damp(accel, dt));
      this.vel.z = lerp(this.vel.z, desired.z, damp(accel, dt));
    }
    // conveyor / external push
    const push = w.pushAt(this.pos);
    this.pos.x += (this.vel.x + push.x) * dt;
    this.pos.z += (this.vel.z + push.z) * dt;
    w.level.collide(this.pos, this.radius);
    for (const e of w.enemies) {
      if (e.dead || e.dormantHidden) continue;
      const dx = this.pos.x - e.pos.x, dz = this.pos.z - e.pos.z;
      const rr = this.radius + e.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        this.pos.x = e.pos.x + (dx / d) * rr;
        this.pos.z = e.pos.z + (dz / d) * rr;
      }
    }
    for (const n of w.npcs) {
      if (!n.root.visible) continue;
      const dx = this.pos.x - n.pos.x, dz = this.pos.z - n.pos.z;
      const rr = this.radius + 0.35;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        this.pos.x = n.pos.x + (dx / d) * rr;
        this.pos.z = n.pos.z + (dz / d) * rr;
      }
    }

    // ---- facing ----
    const spd = Math.hypot(this.vel.x, this.vel.z);
    let targetYaw = this.yaw;
    const camYaw = rig.yaw + Math.PI;
    if (wantAim || this.fireCd > 0.05 || (this.attackT >= 0 && this.attackT < 0.4)) targetYaw = camYaw;
    else if (this.rollT >= 0) targetYaw = Math.atan2(this.rollDir.x, this.rollDir.z);
    else if (spd > 0.3) targetYaw = Math.atan2(this.vel.x, this.vel.z);
    this.yaw = lerpAngle(this.yaw, targetYaw, damp(wantAim ? 25 : 12, dt));

    // ---- stamina ----
    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - dt * 20);
      this.staminaDelay = 0.8;
    } else {
      this.staminaDelay -= dt;
      if (this.staminaDelay <= 0) this.stamina = Math.min(100, this.stamina + dt * 28 * (1 + (st.skills.wind ?? 0) * 0.3));
    }

    // ---- actions ----
    if (canAct) this.actions(dt, mv);
    this.updateTimers(dt);

    // ---- noise (stealth) ----
    this.noise = this.sprinting ? 9 : this.sneaking ? 1.2 : spd > 0.5 ? 4 : 0.5;
    if (this.inWater && spd > 0.5) this.noise += 3;

    // ---- footsteps ----
    if (spd > 0.6 && this.rollT < 0) {
      this.footT -= dt * spd * (this.sprinting ? 0.62 : 0.72);
      if (this.footT <= 0) {
        this.footT = 1;
        audio.step(this.surface, this.pos, this.sneaking ? 0.15 : this.sprinting ? 0.6 : 0.4);
        if (this.inWater) w.fx.splash(this.pos, 0.6);
        if (this.sprinting || this.inWater) w.noise(this.pos, this.inWater ? 10 : 8, 'step');
      }
    }

    // ---- animation ----
    const local = new THREE.Vector3(this.vel.x, 0, this.vel.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.yaw);
    p.speed = spd;
    p.forward = spd > 0.1 ? local.z / spd : 1;
    p.strafe = spd > 0.1 ? local.x / spd : 0;
    p.run = this.sprinting ? 1 : 0;
    p.crouch = lerp(p.crouch, this.sneaking ? 1 : 0, damp(8, dt));
    p.aim = lerp(p.aim, wantAim || this.fireCd > 0.1 ? (this.weapon.kind === 'gun' ? 1 : 0) : 0, damp(14, dt));
    p.aimPitch = rig.pitch;
    p.weapon = this.weapon.pose === 'melee' ? 'melee' : this.weapon.pose === 'pistol' ? 'pistol' : 'long';
    p.attack = this.attackT >= 0 ? clamp01(this.attackT) : -1;
    p.attackType = this.combo;
    p.recoil = Math.max(0, p.recoil - dt * 8);
    p.roll = this.rollT;
    p.hurt = this.hurtT;
    p.heal = lerp(p.heal, this.healT >= 0 || this.reloadT >= 0 ? 1 : 0, damp(10, dt));
    p.throwT = this.throwT;
    p.interact = lerp(p.interact, this.interactAnim > 0 ? 1 : 0, damp(10, dt));
    this.interactAnim = Math.max(0, this.interactAnim - dt);
    // head looks toward camera aim when idle
    const lookYaw = angleDiff(this.yaw, camYaw);
    p.lookYaw = this.rig_mode_cine() ? 0 : clamp(lookYaw, -1.2, 1.2) * 0.8;
    p.lookPitch = this.rig_mode_cine() ? 0 : rig.pitch * 0.5;
    this.anim.tick(dt);

    this.root.position.set(this.pos.x, this.inWater ? -0.08 : 0, this.pos.z);
    this.root.rotation.y = this.yaw;
  }
  private rig_mode_cine() {
    return this.game.rig.mode === 'cine';
  }

  private actions(dt: number, mv: { x: number; y: number }) {
    const input = this.game.input;
    const st = this.state;
    const w = this.w;
    // weapon switching
    const owned = (['pipe', 'axe', 'pistol', 'shotgun', 'arc'] as WeaponId[]).filter((id) => st.weapons[id]);
    const melee: WeaponId = st.weapons.axe ? 'axe' : 'pipe';
    if (input.pressed('w1')) this.equip(melee);
    if (input.pressed('w2') && st.weapons.pistol) this.equip('pistol');
    if (input.pressed('w3') && st.weapons.shotgun) this.equip('shotgun');
    if (input.pressed('w4') && st.weapons.arc) this.equip('arc');
    if (input.pressed('swap')) {
      if (this.weapon.kind === 'melee' && st.lastGun && st.weapons[st.lastGun]) this.equip(st.lastGun);
      else this.equip(melee);
    }
    if (input.wheel !== 0 && owned.length > 1 && !this.game.ui.anyOverlay()) {
      const list = owned.filter((x) => !(x === 'pipe' && st.weapons.axe));
      const i = list.indexOf(this.equipped);
      const n = list[(i + (input.wheel > 0 ? 1 : -1) + list.length) % list.length];
      this.equip(n);
    }
    // flashlight
    if (input.pressed('flashlight')) {
      this.flashlight = !this.flashlight;
      audio.play('hackTick', { vol: 0.4, pitch: this.flashlight ? 1.2 : 0.8 });
    }
    // dodge roll
    if (input.pressed('dodge') && this.rollT < 0 && this.stamina >= 18 && this.healT < 0) {
      this.stamina -= 22;
      this.staminaDelay = 0.8;
      this.rollT = 0;
      this.invuln = 0.42;
      this.attackT = -1;
      this.reloadT = -1;
      const rig = this.game.rig;
      if (Math.hypot(mv.x, mv.y) > 0.1) {
        this.rollDir.copy(rig.forward(tmpV)).multiplyScalar(mv.y).addScaledVector(rig.right(tmpV2), mv.x).normalize();
      } else this.rollDir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      audio.play('dodge', { vol: 0.6 });
      return;
    }
    if (this.rollT >= 0) return;
    // heal
    if (input.pressed('heal') && this.healT < 0) this.startHeal();
    // throw
    if (input.pressed('throw') && this.throwT < 0) this.startThrow(st.inv.flare ? 'flare' : 'pipebomb');
    if (input.keyPressed('KeyB') && this.throwT < 0) this.startThrow('pipebomb');
    // reload
    const wpn = this.weapon;
    if (wpn.kind === 'gun' && input.pressed('reload')) this.startReload();
    // attack
    if (this.healT < 0 && this.throwT < 0) {
      if (wpn.kind === 'melee') {
        if (input.pressed('attack') && !this.game.ui.anyOverlay()) {
          if (this.attackT < 0 || (this.attackT > 0.62 && this.attackT < 1)) this.startSwing();
        }
      } else {
        const want = wpn.auto ? input.isDown('attack') : input.pressed('attack');
        if (want && !this.game.ui.anyOverlay() && this.reloadT < 0) this.fire();
      }
    }
  }

  private startSwing() {
    if (this.stamina < 6) return;
    this.stamina -= 7;
    this.staminaDelay = 0.6;
    if (this.attackT >= 0 || this.comboWindow > 0) this.combo = (this.combo + 1) % 3;
    else this.combo = 0;
    this.attackT = 0;
    this.attackHit = false;
    this.attackDur = this.weapon.rate * (this.combo === 2 ? 1.35 : 1.15);
    // aim assist: face camera direction or nearest enemy ahead
    const rig = this.game.rig;
    const camF = rig.forward(tmpV);
    let best: number | null = null;
    let bestD = 4.5;
    for (const e of this.w.enemies) {
      if (e.dead || e.dormantHidden) continue;
      const d = e.pos.distanceTo(this.pos);
      if (d > bestD) continue;
      const dir = tmpV2.copy(e.pos).sub(this.pos).setY(0).normalize();
      if (dir.dot(camF) < 0.3) continue;
      bestD = d;
      best = Math.atan2(dir.x, dir.z);
    }
    this.yaw = best ?? Math.atan2(camF.x, camF.z);
    audio.play('swing', { pos: this.pos, vol: 0.7, pitch: this.equipped === 'axe' ? 0.75 : 1 });
  }

  private updateTimers(dt: number) {
    const w = this.w;
    if (this.attackT >= 0) {
      this.attackT += dt / this.attackDur;
      if (!this.attackHit && this.attackT >= 0.42) {
        this.attackHit = true;
        this.meleeHit();
      }
      if (this.attackT >= 1) {
        this.attackT = -1;
        this.comboWindow = 0.35;
      }
    }
    if (this.reloadT >= 0) {
      this.reloadT += dt / this.reloadDur;
      if (this.reloadT >= 1) {
        this.reloadT = -1;
        this.finishReload();
      }
    }
    if (this.healT >= 0) {
      this.healT += dt / this.healDur;
      if (this.healT >= 1) {
        this.healT = -1;
        this.finishHeal();
      }
    }
    if (this.throwT >= 0) {
      this.throwT += dt / 0.7;
      if (!this.thrown && this.throwT >= 0.5) {
        this.thrown = true;
        this.releaseThrow();
      }
      if (this.throwT >= 1) this.throwT = -1;
    }
    void w;
  }

  private meleeHit() {
    const w = this.w;
    const wpn = this.weapon;
    const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const dmgBase = wpn.dmg * this.dmgMult(this.equipped) * (this.combo === 2 ? 1.5 : 1);
    let hits = 0;
    for (const e of w.enemies) {
      if (e.dead || e.dormantHidden) continue;
      const to = tmpV.copy(e.pos).sub(this.pos).setY(0);
      const d = to.length();
      if (d > wpn.range + e.radius) continue;
      to.normalize();
      const ang = Math.acos(clamp(to.dot(f), -1, 1));
      if (ang > (wpn.arc ?? 1.8) / 2 && d > e.radius + 0.6) continue;
      const heavy = this.combo === 2 || (this.state.skills.heavy ?? 0) >= 2 || this.equipped === 'axe';
      e.damage(dmgBase * rand(0.9, 1.1), to, { knock: wpn.knock * (this.combo === 2 ? 1.6 : 1), melee: true, stagger: heavy ? 2 : 1, from: this.pos });
      hits++;
      const hp = e.pos.clone().setY(1.2);
      w.fx.impact(hp, to, e.def.blood);
    }
    for (const b of w.breakables) {
      if (b.hp <= 0) continue;
      const to = tmpV.copy(b.pos).sub(this.pos).setY(0);
      if (to.length() < wpn.range + b.r && to.normalize().dot(f) > 0.2) {
        b.hit(dmgBase);
        hits++;
      }
    }
    if (hits) {
      audio.play(this.equipped === 'axe' ? 'flesh' : 'hit', { pos: this.pos, vol: 0.9 });
      this.game.hitstop(0.06);
      this.game.rig.addShake(0.35);
      w.noise(this.pos, wpn.noise, 'melee');
    }
  }

  private fire() {
    const st = this.state;
    const wpn = this.weapon;
    if (this.fireCd > 0) return;
    const id = this.equipped;
    const mag = st.mag[id] ?? 0;
    if (mag <= 0) {
      audio.play('empty', { vol: 0.6 });
      this.fireCd = 0.25;
      if ((st.inv[wpn.ammo!] ?? 0) > 0) this.startReload();
      return;
    }
    st.mag[id] = mag - 1;
    this.fireCd = wpn.rate;
    const w = this.w;
    const rig = this.game.rig;
    const steady = 1 - (st.skills.steady ?? 0) * 0.2;
    const spreadBase = (this.aiming ? wpn.spreadAim : wpn.spreadHip) * steady + this.spreadBloom * 0.04;
    const camPos = this.game.camera.position;
    const camDir = rig.dir(new THREE.Vector3());
    // start the ray near the player to avoid hitting things behind them
    const toPlayer = this.pos.clone().setY(1.5).sub(camPos);
    const startT = Math.max(0, toPlayer.dot(camDir) - 0.3);
    const origin = camPos.clone().addScaledVector(camDir, startT);
    const muzzle = new THREE.Vector3();
    if (this.weaponHolder) {
      this.weaponHolder.updateWorldMatrix(true, false);
      muzzle.set(0, 0.07, wpn.pose === 'long' ? 0.6 : 0.25).applyMatrix4(this.weaponHolder.matrixWorld);
    } else muzzle.copy(this.pos).setY(1.4);
    const dmg = wpn.dmg * this.dmgMult(id);
    const chained = new Set<any>();
    for (let i = 0; i < wpn.pellets; i++) {
      const dir = camDir.clone();
      if (spreadBase > 0) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spreadBase;
        const up = new THREE.Vector3(0, 1, 0);
        const rt = new THREE.Vector3().crossVectors(dir, up).normalize();
        const u2 = new THREE.Vector3().crossVectors(rt, dir).normalize();
        dir.addScaledVector(rt, Math.cos(a) * r).addScaledVector(u2, Math.sin(a) * r).normalize();
      }
      const hit = w.hitscan(origin, dir, wpn.range);
      if (id === 'arc') {
        w.fx.arcBolt(muzzle, hit.point);
        if (hit.enemy) {
          hit.enemy.damage(dmg * hit.mult * (hit.head ? 1.8 : 1), dir, { knock: wpn.knock, headshot: hit.head, shock: 0.4, from: this.pos });
          chained.add(hit.enemy);
          // chain lightning
          let last = hit.enemy;
          for (let c = 0; c < (wpn.chain ?? 0); c++) {
            let best: any = null, bd = 6;
            for (const e of w.enemies) {
              if (e.dead || chained.has(e) || e.dormantHidden) continue;
              const d = e.pos.distanceTo(last.pos);
              if (d < bd) {
                bd = d;
                best = e;
              }
            }
            if (!best) break;
            w.fx.arcBolt(last.pos.clone().setY(1.2), best.pos.clone().setY(1.2));
            best.damage(dmg * 0.6, dir, { shock: 0.4, from: this.pos });
            chained.add(best);
            last = best;
          }
        } else w.fx.sparks(hit.point, hit.normal, 0x80e0ff, 8);
      } else {
        w.fx.tracer(muzzle, hit.point, wpn.pose === 'long' ? 0xffb060 : 0xffe0a0);
        if (hit.enemy) {
          hit.enemy.damage(dmg * (hit.head ? 2.4 : 1) * hit.mult, dir, { knock: wpn.knock / Math.max(1, wpn.pellets * 0.4), headshot: hit.head, from: this.pos });
          w.fx.impact(hit.point, dir, hit.enemy.def.blood);
          if (hit.head && wpn.pellets === 1) audio.play('headshot', { pos: hit.point, vol: 0.8 });
          else audio.play('flesh', { pos: hit.point, vol: 0.4 });
          this.game.ui.hud.hitMarker(hit.head);
        } else if (hit.breakable) {
          hit.breakable.hit(dmg);
          w.fx.sparks(hit.point, hit.normal, 0xffd080, 6);
        } else if (hit.dist < wpn.range) {
          w.fx.sparks(hit.point, hit.normal, 0xffd080, 5);
          if (Math.random() < 0.2) audio.play('ricochet', { pos: hit.point, vol: 0.4 });
        }
      }
    }
    audio.play(id === 'pistol' ? 'pistol' : id === 'shotgun' ? 'shotgun' : 'arc', { vol: id === 'arc' ? 0.45 : 0.85, rev: 0.4 });
    w.fx.muzzle(muzzle, id === 'arc' ? 0x60e0ff : 0xffb050);
    if (id !== 'arc') w.fx.shell(muzzle, new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).multiplyScalar(-1));
    rig.kick = Math.min(1.5, rig.kick + (id === 'shotgun' ? 1.2 : id === 'arc' ? 0.15 : 0.5) * steady);
    rig.addShake(id === 'shotgun' ? 0.35 : 0.08);
    this.anim.p.recoil = id === 'shotgun' ? 1 : 0.6;
    this.spreadBloom = Math.min(1, this.spreadBloom + (id === 'arc' ? 0.12 : 0.4));
    w.noise(this.pos, wpn.noise, 'shot');
    this.game.addViewers(id === 'shotgun' ? 6 : 2);
    if ((st.mag[id] ?? 0) === 0 && (st.inv[wpn.ammo!] ?? 0) > 0) setTimeout(() => this.startReload(), 250);
  }

  startReload() {
    const wpn = this.weapon;
    if (wpn.kind !== 'gun' || this.reloadT >= 0) return;
    const st = this.state;
    const have = st.inv[wpn.ammo!] ?? 0;
    if (have <= 0 || (st.mag[this.equipped] ?? 0) >= this.magSize(this.equipped)) {
      if (have <= 0) this.game.ui.hud.toast('No ammo', 'warn');
      return;
    }
    this.reloadT = 0;
    this.reloadDur = wpn.reload * this.reloadMult(this.equipped);
    audio.play('reload', { vol: 0.6 });
  }
  private finishReload() {
    const st = this.state;
    const wpn = this.weapon;
    const id = this.equipped;
    const need = this.magSize(id) - (st.mag[id] ?? 0);
    const have = st.inv[wpn.ammo!] ?? 0;
    const take = Math.min(need, have);
    st.mag[id] = (st.mag[id] ?? 0) + take;
    st.inv[wpn.ammo!] = have - take;
  }

  private startHeal() {
    const st = this.state;
    let item: 'medkit' | 'bandage' | 'pills' | null = null;
    if (st.hp < st.maxHp) {
      if (st.hp < st.maxHp - 45 && (st.inv.medkit ?? 0) > 0) item = 'medkit';
      else if ((st.inv.bandage ?? 0) > 0) item = 'bandage';
      else if ((st.inv.medkit ?? 0) > 0) item = 'medkit';
    }
    if (!item && st.sanity < 70 && (st.inv.pills ?? 0) > 0) item = 'pills';
    if (!item) {
      this.game.ui.hud.toast(st.hp >= st.maxHp ? 'Health is full' : 'No healing items', 'warn');
      return;
    }
    this.healItem = item;
    this.healT = 0;
    this.healDur = (item === 'medkit' ? 1.6 : item === 'pills' ? 0.8 : 1.1) * (1 - (st.skills.quickhands ?? 0) * 0.2);
    this.attackT = -1;
    this.reloadT = -1;
  }
  private finishHeal() {
    const st = this.state;
    const it = this.healItem;
    if (!it || (st.inv[it] ?? 0) <= 0) return;
    st.inv[it] = (st.inv[it] ?? 0) - 1;
    if (it === 'pills') {
      st.sanity = Math.min(100, st.sanity + 40);
      this.game.ui.hud.toast('+40 Sanity', 'sanity');
    } else {
      const amt = it === 'medkit' ? 60 : 25;
      st.hp = Math.min(st.maxHp, st.hp + amt);
      this.poisonT = 0;
      this.game.ui.hud.toast(`+${amt} Health`, 'heal');
    }
    audio.play('heal', { vol: 0.6 });
    this.w.fx.healSparkle(this.pos);
  }

  private startThrow(kind: 'flare' | 'pipebomb') {
    const st = this.state;
    if ((st.inv[kind] ?? 0) <= 0) {
      this.game.ui.hud.toast(kind === 'flare' ? 'No flares' : 'No pipe bombs', 'warn');
      return;
    }
    this.throwKind = kind;
    this.throwT = 0;
    this.thrown = false;
    this.attackT = -1;
    this.yaw = this.game.rig.yaw + Math.PI;
  }
  private releaseThrow() {
    const st = this.state;
    const k = this.throwKind;
    if ((st.inv[k] ?? 0) <= 0) return;
    st.inv[k] = (st.inv[k] ?? 0) - 1;
    const dir = this.game.rig.dir(new THREE.Vector3());
    dir.y = Math.max(dir.y + 0.35, 0.15);
    dir.normalize();
    const from = this.pos.clone().setY(1.6).addScaledVector(new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)), 0.4);
    this.w.projectiles.throwItem(k, from, dir.multiplyScalar(13));
    audio.play('swing', { pos: this.pos, vol: 0.5, pitch: 0.8 });
  }

  /** Brief "reach" animation for interactions */
  reach() {
    this.interactAnim = 0.4;
  }
}
