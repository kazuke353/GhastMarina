import * as THREE from 'three';
import { buildHumanoid, buildHound, CharacterModel, HoundModel } from '../chars/CharacterBuilder';
import { Animator, HoundAnimator } from '../chars/Animator';
import { ENEMIES, EnemyDef } from './EnemyDefs';
import type { EnemyKind } from '../world/LevelDef';
import type { World } from '../game/World';
import { audio } from '../core/Audio';
import { angleDiff, clamp, clamp01, damp, lerp, lerpAngle, rand, chance } from '../core/math';
import { T } from '../world/Level';
import { buildProp } from '../world/Props';

export type EState = 'dormant' | 'idle' | 'wander' | 'investigate' | 'chase' | 'attack' | 'stagger' | 'dead' | 'rise' | 'lure' | 'scripted';

export interface DamageOpts {
  knock?: number;
  headshot?: boolean;
  melee?: boolean;
  stagger?: number;
  explosive?: boolean;
  fire?: boolean;
  shock?: number;
  from?: THREE.Vector3;
  silent?: boolean;
}

const tv = new THREE.Vector3();
const tv2 = new THREE.Vector3();
let enemySeed = 1000;

export class Enemy {
  def: EnemyDef;
  model: CharacterModel | null = null;
  hound: HoundModel | null = null;
  anim: Animator | null = null;
  hanim: HoundAnimator | null = null;
  root: THREE.Group;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  hp: number;
  maxHp: number;
  state: EState = 'idle';
  dead = false;
  deadT = 0;
  removed = false;
  dormantHidden = false;
  radius: number;
  scale: number;
  lastSeen = new THREE.Vector3();
  lastSeenT = -99;
  private path: THREE.Vector3[] | null = null;
  private pathT = 0;
  private atkT = -1;
  private atkCd = 0;
  private atkHit = false;
  private lungeT = -1;
  private lungeCd = 0;
  private lungeHit = false;
  private rangedCd = 2;
  private rangedT = -1;
  private staggerT = 0;
  private dmgAccum = 0;
  private dmgAccumT = 0;
  fuseT = -1;
  shockT = 0;
  private flashT = 0;
  private wanderT = 0;
  private wanderTarget: THREE.Vector3 | null = null;
  private perceiveT = Math.random() * 0.3;
  private moanT = rand(3, 10);
  private riseT = 0;
  private dodgeT = -1;
  private dodgeDir = new THREE.Vector3();
  private dodgeCheckT = 0;
  home = new THREE.Vector3();
  id: string;
  isBoss = false;
  disguise: THREE.Object3D | null = null;
  wakeFlag: string | null = null;
  elite = false;
  speedMult = 1;
  visibility = 1;
  noLoot = false;
  investigateT = 0;
  onDeathCb: (() => void) | null = null;
  /** sanity hallucination: harmless, vanishes when touched */
  illusion = false;
  private illusionT = 0;

  constructor(public w: World, public kind: EnemyKind | 'custom', id: string, def?: EnemyDef, opts: { elite?: boolean; noModel?: boolean } = {}) {
    this.def = def ?? ENEMIES[kind as EnemyKind];
    this.id = id;
    this.elite = !!opts.elite;
    const diff = w.game.state.difficulty;
    const hpMult = (diff === 'story' ? 0.7 : diff === 'nightmare' ? 1.35 : 1) * (this.elite ? 1.8 : 1);
    this.hp = this.maxHp = this.def.hp * hpMult;
    this.scale = rand(this.def.scale[0], this.def.scale[1]) * (this.elite ? 1.12 : 1);
    this.radius = this.def.radius * this.scale;
    const seed = enemySeed++;
    if (opts.noModel) {
      this.root = new THREE.Group();
    } else if (this.def.hound) {
      const blood = this.def.blood;
      this.hound = buildHound({ skin: kind === 'vinehound' ? 0x5a6a4a : 0x7a5a50, glow: kind === 'vinehound' ? 0xd0ff40 : 0xff5020, scale: this.scale, vines: kind === 'vinehound', seed });
      this.hanim = new HoundAnimator(this.hound);
      this.root = this.hound.root;
      void blood;
    } else {
      const look = this.def.look(seed);
      if (this.elite) look.glowColor = 0xff3050;
      look.height = this.scale;
      this.model = buildHumanoid(look);
      this.anim = new Animator(this.model);
      this.anim.p.zombie = 1;
      this.root = this.model.root;
    }
    if (this.def.phantom) this.setTransparent(true);
  }

  get mats(): THREE.Material[] {
    const m = this.model ?? this.hound;
    if (!m) return [];
    return [m.material, ...(m.glowMaterial ? [m.glowMaterial] : [])];
  }
  setTransparent(on: boolean) {
    for (const m of this.mats) {
      m.transparent = on;
      m.depthWrite = !on;
      m.needsUpdate = true;
    }
  }

  place(p: THREE.Vector3, yaw: number) {
    this.pos.copy(p).setY(0);
    this.home.copy(this.pos);
    this.yaw = yaw;
    this.root.position.copy(this.pos);
    this.root.rotation.y = yaw;
  }

  setDormant(disguise: boolean) {
    this.state = 'dormant';
    if (disguise) {
      this.dormantHidden = true;
      this.root.visible = false;
      const b = buildProp('bush', Math.floor(Math.random() * 1e6), { leaf: 0x3a6a2a });
      b.obj.position.copy(this.pos);
      b.obj.scale.setScalar(1.3);
      this.disguise = b.obj;
      this.w.scene.add(b.obj);
    }
  }

  wake(rise = false) {
    if (this.dead) return;
    if (this.disguise) {
      this.w.fx.leaves(this.pos);
      this.w.scene.remove(this.disguise);
      this.disguise = null;
      rise = true;
    }
    this.dormantHidden = false;
    this.root.visible = true;
    if (rise) {
      this.state = 'rise';
      this.riseT = 0;
      audio.play('zombieAlert', { pos: this.pos, pitch: this.def.pitch });
    } else this.alertTo(this.w.player.pos, true);
  }

  alertTo(p: THREE.Vector3, saw: boolean) {
    if (this.dead || this.state === 'dormant' || this.state === 'rise' || this.state === 'scripted') return;
    const was = this.state;
    this.lastSeen.copy(p);
    this.lastSeenT = this.w.time;
    if (saw) {
      if (was !== 'chase' && was !== 'attack' && was !== 'stagger') {
        this.state = 'chase';
        if (Math.random() < 0.7) audio.play('zombieAlert', { pos: this.pos, pitch: this.def.pitch * rand(0.9, 1.1) });
        this.w.onEnemyAlert(this);
      }
    } else if (was === 'idle' || was === 'wander' || was === 'investigate' || was === 'lure') {
      this.state = 'investigate';
      this.investigateT = 8;
      this.path = null;
    }
  }

  // ------------ hit volumes ------------
  hitSpheres(): { c: THREE.Vector3; r: number; head: boolean; mult: number }[] {
    const s = this.scale;
    const out: { c: THREE.Vector3; r: number; head: boolean; mult: number }[] = [];
    if (this.model) {
      const b = this.model.bones;
      const head = b.head.getWorldPosition(new THREE.Vector3());
      head.y += 0.1 * s;
      out.push({ c: head, r: 0.17 * s * (this.model.look.mutations?.includes('bigHead') ? 1.4 : 1), head: true, mult: 1 });
      out.push({ c: b.chest.getWorldPosition(new THREE.Vector3()), r: 0.3 * s, head: false, mult: 1 });
      out.push({ c: b.hips.getWorldPosition(new THREE.Vector3()), r: 0.28 * s, head: false, mult: 0.9 });
      const k = b.shinL.getWorldPosition(new THREE.Vector3());
      out.push({ c: k, r: 0.2 * s, head: false, mult: 0.7 });
      const k2 = b.shinR.getWorldPosition(new THREE.Vector3());
      out.push({ c: k2, r: 0.2 * s, head: false, mult: 0.7 });
    } else if (this.hound) {
      const b = this.hound.bones;
      out.push({ c: b.head.getWorldPosition(new THREE.Vector3()), r: 0.2 * s, head: true, mult: 1 });
      out.push({ c: b.body.getWorldPosition(new THREE.Vector3()), r: 0.32 * s, head: false, mult: 1 });
      out.push({ c: b.chest.getWorldPosition(new THREE.Vector3()), r: 0.3 * s, head: false, mult: 1 });
    } else {
      out.push({ c: this.pos.clone().setY(1), r: this.radius, head: false, mult: 1 });
    }
    return out;
  }

  // ------------ damage ------------
  damage(amount: number, dir: THREE.Vector3, o: DamageOpts = {}): boolean {
    if (this.dead || this.dormantHidden) return false;
    if (this.illusion) {
      this.vanish();
      return true;
    }
    if (this.state === 'dormant' || this.state === 'idle' || this.state === 'wander' || this.state === 'investigate' || this.state === 'lure') {
      // sneak attack bonus
      amount *= o.melee ? 2.5 : 1.5;
    }
    let dmg = amount;
    if (this.def.shield && !o.explosive && this.state !== 'stagger') {
      // dir is the travel direction of the hit; compare to facing
      const f = tv.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const incoming = tv2.copy(dir).setY(0).normalize().multiplyScalar(-1);
      if (f.dot(incoming) > 0.35) {
        dmg *= o.stagger && o.stagger >= 2 ? 0.5 : 0.12;
        audio.play('metal', { pos: this.pos, vol: 0.6 });
        if (o.stagger && o.stagger >= 2) this.stagger(1.2);
        this.w.fx.sparks(this.pos.clone().setY(1.2), incoming, 0xffe0a0, 6);
      }
    }
    if (this.def.armor && !o.explosive && !o.fire) dmg *= 1 - this.def.armor;
    if (o.fire && (this.kind === 'creeper' || this.kind === 'sporer' || this.kind === 'farmer' || this.kind === 'vinehound')) dmg *= 1.8;
    if (o.fire && (this.kind === 'frostbitten' || this.kind === 'cryobrute' || this.kind === 'shatterer')) dmg *= 2;
    this.hp -= dmg;
    this.flashT = 0.12;
    if (o.shock) this.shockT = Math.max(this.shockT, o.shock);
    if (o.knock) {
      const k = o.knock / Math.max(1, this.scale * this.scale);
      this.vel.addScaledVector(tv.copy(dir).setY(0).normalize(), k);
    }
    this.dmgAccum += dmg;
    this.dmgAccumT = 0.8;
    if (this.dmgAccum > this.def.stagger * (this.elite ? 1.5 : 1) || (o.stagger ?? 0) >= 2) {
      this.dmgAccum = 0;
      if (!this.isBoss) this.stagger(o.stagger && o.stagger >= 2 ? 0.9 : 0.55);
    }
    if (!o.silent && Math.random() < 0.35) audio.play('zombieAttack', { pos: this.pos, vol: 0.4, pitch: this.def.pitch * 1.2 });
    // being hit always alerts
    if (this.state !== 'dead' && this.state !== 'rise' && this.state !== 'scripted') {
      if (this.state === 'dormant') this.wake(false);
      const src = o.from ?? this.w.player.pos;
      this.alertTo(src, true);
    }
    if (this.hp <= 0) {
      this.die(o);
    }
    return true;
  }

  vanish() {
    if (this.dead) return;
    this.dead = true;
    this.state = 'dead';
    this.removed = true;
    this.w.fx.explosion(this.pos.clone().setY(1), 'psychic', 0.8);
    audio.play('whisper', { pos: this.pos, vol: 0.6 });
  }

  stagger(t: number) {
    if (this.dead) return;
    this.staggerT = t;
    this.state = 'stagger';
    this.atkT = -1;
    this.lungeT = -1;
    this.rangedT = -1;
  }

  die(o: DamageOpts = {}) {
    if (this.dead) return;
    this.dead = true;
    this.state = 'dead';
    this.deadT = 0;
    this.hp = 0;
    if (this.anim) {
      this.anim.p.dead = 0.001;
      this.anim.p.deadDir = Math.random() < 0.6 ? 1 : -1;
    }
    audio.play('zombieDie', { pos: this.pos, pitch: this.def.pitch });
    this.w.fx.gore(this.pos.clone().setY(1.0), this.def.blood, o.headshot ? 18 : 10);
    if (this.def.explode && !o.silent) this.w.explode(this.pos.clone().setY(1), this.def.explode.radius, this.def.explode.dmg, this.def.explode.kind, this);
    this.w.onEnemyKilled(this, o);
    this.onDeathCb?.();
  }

  // ------------ AI ------------
  update(dt: number) {
    const w = this.w;
    const pl = w.player;
    this.flashT = Math.max(0, this.flashT - dt);
    this.updateFlash();
    if (this.illusion) {
      this.illusionT += dt;
      const op = 0.35 + Math.sin(this.w.time * 17) * 0.15 + (Math.random() < 0.05 ? -0.3 : 0);
      for (const m of this.mats) (m as THREE.MeshBasicMaterial).opacity = Math.max(0.05, op);
      if (this.illusionT > 9 || (this.pos.distanceTo(this.w.player.pos) < 1.6 && this.illusionT > 1.5)) {
        this.vanish();
        return;
      }
    }
    if (this.dead) {
      this.deadT += dt;
      if (this.anim) {
        this.anim.p.dead = Math.min(1, this.deadT * 1.6);
        this.anim.p.speed = 0;
        this.anim.tick(dt);
      }
      if (this.hanim) {
        this.hanim.dead = Math.min(1, this.deadT * 2);
        this.hanim.speed = 0;
        this.hanim.tick(dt);
      }
      this.vel.multiplyScalar(Math.max(0, 1 - dt * 6));
      this.pos.addScaledVector(this.vel, dt);
      w.level.collide(this.pos, this.radius * 0.5);
      if (this.deadT > 5) this.root.position.y = -(this.deadT - 5) * 0.6;
      else this.root.position.copy(this.pos);
      if (this.deadT > 7) this.removed = true;
      return;
    }
    if (this.state === 'dormant') {
      if (this.disguise) {
        // creepers wake when the player gets close
        if (pl.pos.distanceTo(this.pos) < 4.2 && !pl.dead) this.wake(true);
        else if (pl.pos.distanceTo(this.pos) < 7) this.disguise.rotation.z = Math.sin(w.time * 9) * 0.03;
      } else if (this.wakeFlag && w.game.flag(this.wakeFlag)) this.wake(true);
      this.animate(dt, 0);
      return;
    }
    if (this.state === 'rise') {
      this.riseT += dt / 0.9;
      this.root.position.set(this.pos.x, -1.6 * (1 - clamp01(this.riseT)), this.pos.z);
      if (this.riseT >= 1) {
        this.state = 'chase';
        this.lastSeen.copy(pl.pos);
        this.lastSeenT = w.time;
      }
      this.faceTo(pl.pos, dt, 6);
      this.animate(dt, 0);
      if (this.riseT < 1) return;
    }
    if (this.state === 'scripted') {
      this.animate(dt, Math.hypot(this.vel.x, this.vel.z));
      this.root.position.copy(this.pos);
      this.root.rotation.y = this.yaw;
      return;
    }

    this.atkCd -= dt;
    this.lungeCd -= dt;
    this.rangedCd -= dt;
    this.dmgAccumT -= dt;
    if (this.dmgAccumT <= 0) this.dmgAccum = 0;
    if (this.shockT > 0) {
      this.shockT -= dt;
      if (Math.random() < dt * 20) w.fx.sparks(this.pos.clone().setY(rand(0.5, 1.6)), new THREE.Vector3(0, 1, 0), 0x80e0ff, 2);
    }

    // perception
    this.perceiveT -= dt;
    if (this.perceiveT <= 0) {
      this.perceiveT = 0.2;
      this.perceive();
    }
    // moans
    this.moanT -= dt;
    if (this.moanT <= 0) {
      this.moanT = rand(4, 11);
      if (pl.pos.distanceTo(this.pos) < 25) audio.play('zombieMoan', { pos: this.pos, pitch: this.def.pitch * rand(0.85, 1.1), vol: 0.7 });
    }

    const toP = tv.copy(pl.pos).sub(this.pos).setY(0);
    const dist = toP.length();
    let speed = 0;
    let moveTarget: THREE.Vector3 | null = null;
    const inWater = w.level.terrainAt(this.pos.x, this.pos.z) === T.Water;
    const swimMult = inWater ? (this.def.swim ? 1.8 : 0.65) : 1;

    if (this.staggerT > 0) {
      this.staggerT -= dt;
      if (this.staggerT <= 0) this.state = 'chase';
    } else if (this.shockT > 0.2) {
      // stunned
    } else if (this.dodgeT >= 0) {
      this.dodgeT += dt;
      this.vel.copy(this.dodgeDir).multiplyScalar(6.5);
      if (this.dodgeT > 0.3) this.dodgeT = -1;
    } else if (this.lungeT >= 0) {
      this.lungeT += dt;
      if (!this.lungeHit && dist < this.radius + pl.radius + 0.6) {
        this.lungeHit = true;
        if (this.illusion) {
          this.vanish();
          return;
        }
        pl.damage(this.def.dmg * 1.2, this.pos, { knock: 4, sanity: this.def.sanity });
      }
      if (this.lungeT > 0.38) {
        this.lungeT = -1;
        this.atkCd = 0.6;
      }
    } else if (this.atkT >= 0) {
      this.updateAttack(dt, dist);
    } else if (this.rangedT >= 0) {
      this.rangedT += dt / 0.55;
      this.faceTo(pl.pos, dt, 10);
      if (this.rangedT >= 1) {
        this.rangedT = -1;
        this.shoot();
      }
    } else {
      switch (this.state) {
        case 'idle':
          this.wanderT -= dt;
          if (this.wanderT <= 0) {
            this.wanderT = rand(3, 8);
            if (Math.random() < 0.5) {
              this.wanderTarget = w.level.randomFloorNear(this.home, 3);
              if (this.wanderTarget) this.state = 'wander';
            }
          }
          break;
        case 'wander':
          if (!this.wanderTarget || this.pos.distanceTo(this.wanderTarget) < 0.8) {
            this.state = 'idle';
            this.wanderTarget = null;
          } else {
            moveTarget = this.wanderTarget;
            speed = this.def.walk;
          }
          break;
        case 'investigate':
          this.investigateT -= dt;
          moveTarget = this.lastSeen;
          speed = (this.def.walk + this.def.run) * 0.5;
          if (this.pos.distanceTo(this.lastSeen) < 1.2 || this.investigateT <= 0) {
            this.state = 'idle';
            this.wanderT = rand(2, 5);
            this.home.copy(this.pos);
          }
          break;
        case 'lure': {
          const f = w.nearestFlare(this.pos, 16);
          if (!f) {
            this.state = 'idle';
            break;
          }
          moveTarget = f.pos;
          speed = this.def.run * 0.8;
          if (this.pos.distanceTo(f.pos) < 1.4) {
            speed = 0;
            this.damage(dt * 18, new THREE.Vector3(), { fire: true, silent: true });
          }
          break;
        }
        case 'chase': {
          if (pl.dead) {
            this.state = 'idle';
            break;
          }
          const seenRecently = w.time - this.lastSeenT < 7;
          if (!seenRecently) {
            this.state = 'investigate';
            this.investigateT = 6;
            break;
          }
          moveTarget = w.time - this.lastSeenT < 0.5 ? pl.pos : this.lastSeen;
          speed = this.def.run;
          // keep distance for ranged
          if (this.def.ranged && dist < this.def.ranged.range[0] && w.time - this.lastSeenT < 0.5) {
            moveTarget = this.pos.clone().sub(toP.clone().normalize().multiplyScalar(3));
            speed = this.def.walk * 1.5;
          }
          const canSee = w.time - this.lastSeenT < 0.3;
          // attacks
          if (canSee && this.atkCd <= 0 && dist < this.def.reach + pl.radius + 0.1) {
            this.startAttack();
          } else if (canSee && this.def.lunge && this.lungeCd <= 0 && dist < this.def.lunge.range && dist > this.def.reach + 0.5) {
            this.lungeT = 0;
            this.lungeHit = false;
            this.lungeCd = this.def.lunge.cd;
            this.vel.copy(toP).normalize().multiplyScalar(this.def.lunge.speed * swimMult);
            audio.play('zombieAttack', { pos: this.pos, pitch: this.def.pitch * 1.2 });
          } else if (canSee && this.def.ranged && this.rangedCd <= 0 && dist > this.def.ranged.range[0] && dist < this.def.ranged.range[1]) {
            this.rangedT = 0;
            this.rangedCd = this.def.ranged.cd * rand(0.8, 1.2);
            audio.play(this.def.ranged.kind === 'acid' ? 'spit' : 'zombieAttack', { pos: this.pos, pitch: this.def.pitch });
          }
          // bloaters arm their fuse
          if (this.def.explode && dist < 2.2 && this.fuseT < 0) {
            this.fuseT = 0;
            audio.play('steam', { pos: this.pos, vol: 0.5 });
          }
          // thinker dodge
          if (this.def.dodge) this.tryDodge(dt);
          break;
        }
      }
    }
    if (this.fuseT >= 0 && this.def.explode) {
      this.fuseT += dt;
      speed *= 0.4;
      if (this.fuseT >= this.def.explode.fuse) this.die();
    }

    // movement
    if (this.lungeT < 0 && this.dodgeT < 0) {
      const desired = tv2.set(0, 0, 0);
      if (moveTarget && speed > 0 && this.staggerT <= 0 && this.shockT <= 0.2 && this.atkT < 0 && this.rangedT < 0) {
        const dir = this.steer(moveTarget, dt);
        desired.copy(dir).multiplyScalar(speed * this.speedMult * swimMult * (this.elite ? 1.15 : 1));
      }
      // separation
      for (const o of w.enemies) {
        if (o === this || o.dead || o.dormantHidden) continue;
        const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
        const rr = this.radius + o.radius + 0.15;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          desired.x += (dx / d) * (rr - d) * 4;
          desired.z += (dz / d) * (rr - d) * 4;
        }
      }
      this.vel.x = lerp(this.vel.x, desired.x, damp(8, dt));
      this.vel.z = lerp(this.vel.z, desired.z, damp(8, dt));
    }
    this.pos.addScaledVector(this.vel, dt);
    w.level.collide(this.pos, this.radius);
    // don't overlap player
    const dx = this.pos.x - pl.pos.x, dz = this.pos.z - pl.pos.z;
    const rr = this.radius + pl.radius;
    if (dx * dx + dz * dz < rr * rr && !pl.dead) {
      const d = Math.max(1e-4, Math.hypot(dx, dz));
      this.pos.x = pl.pos.x + (dx / d) * rr;
      this.pos.z = pl.pos.z + (dz / d) * rr;
    }
    const spd = Math.hypot(this.vel.x, this.vel.z);
    if (this.atkT >= 0 || this.rangedT >= 0) this.faceTo(pl.pos, dt, 8);
    else if (spd > 0.2) this.yaw = lerpAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), damp(8, dt));
    else if (this.state === 'chase') this.faceTo(pl.pos, dt, 5);

    this.animate(dt, spd);
    const sink = inWater ? (this.def.swim ? -0.45 : -0.1) : 0;
    this.root.position.set(this.pos.x, sink, this.pos.z);
    this.root.rotation.y = this.yaw;
    if (inWater && spd > 1 && Math.random() < dt * 6) w.fx.splash(this.pos, 0.5);
    if (this.def.phantom) this.updatePhantom(dt);
  }

  private steer(target: THREE.Vector3, dt: number): THREE.Vector3 {
    const w = this.w;
    const direct = w.level.rayGrid(this.pos.x, this.pos.z, target.x, target.z, 'solid') === Infinity;
    if (direct) {
      this.path = null;
      return new THREE.Vector3().copy(target).sub(this.pos).setY(0).normalize();
    }
    this.pathT -= dt;
    if (!this.path || this.pathT <= 0) {
      this.pathT = rand(0.5, 0.9);
      this.path = w.level.findPath(this.pos, target, 1500);
    }
    if (this.path && this.path.length) {
      while (this.path.length > 1 && this.pos.distanceTo(this.path[0]) < 0.7) this.path.shift();
      return new THREE.Vector3().copy(this.path[0]).sub(this.pos).setY(0).normalize();
    }
    return new THREE.Vector3().copy(target).sub(this.pos).setY(0).normalize();
  }

  private perceive() {
    const w = this.w;
    const pl = w.player;
    if (pl.dead || this.state === 'dormant' || this.state === 'rise' || this.state === 'scripted') return;
    const d = this.pos.distanceTo(pl.pos);
    let range = this.def.sight * (pl.flashlight ? 1.3 : 0.75) * (pl.sneaking ? 0.55 : 1);
    if (w.game.state.difficulty === 'story') range *= 0.8;
    if (d < range) {
      const f = tv2.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const to = tv.copy(pl.pos).sub(this.pos).setY(0).normalize();
      const inFov = f.dot(to) > Math.cos(this.def.fov / 2) || d < 2.5 || this.state === 'chase';
      if (inFov && w.level.los(this.pos, pl.pos)) {
        this.alertTo(pl.pos, true);
        return;
      }
    }
    // hearing the player's own movement noise
    if (d < pl.noise * this.def.hearing * 1.6 && this.state !== 'chase') this.alertTo(pl.pos, false);
    // flares lure
    if (this.state !== 'chase' || d > 6) {
      const f = w.nearestFlare(this.pos, 14);
      if (f && this.state !== 'attack') this.state = 'lure';
    }
  }

  private tryDodge(dt: number) {
    const w = this.w;
    this.dodgeCheckT -= dt;
    if (this.dodgeCheckT > 0 || !w.player.aiming) return;
    this.dodgeCheckT = 0.7;
    const cam = w.game.camera.position;
    const dir = w.game.rig.dir(new THREE.Vector3());
    const toE = this.pos.clone().setY(1.2).sub(cam);
    const along = toE.dot(dir);
    if (along < 0) return;
    const perp = toE.sub(dir.clone().multiplyScalar(along)).length();
    if (perp < 0.8 && Math.random() < (this.def.dodge ?? 0)) {
      const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(Math.random() < 0.5 ? 1 : -1);
      this.dodgeDir.copy(side);
      this.dodgeT = 0;
      audio.play('dodge', { pos: this.pos, vol: 0.5 });
    }
  }

  private startAttack() {
    this.atkT = 0;
    this.atkHit = false;
    audio.play('zombieAttack', { pos: this.pos, pitch: this.def.pitch * rand(0.9, 1.1) });
  }
  private updateAttack(dt: number, dist: number) {
    const pl = this.w.player;
    const wind = this.def.windup;
    // phase 0..0.42 windup, 0.42..1 recovery (0.45s)
    if (this.atkT < 0.42) this.atkT += (dt / wind) * 0.42;
    else this.atkT += (dt / 0.45) * 0.58;
    if (!this.atkHit && this.atkT >= 0.42) {
      this.atkHit = true;
      const f = tv2.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const to = tv.copy(pl.pos).sub(this.pos).setY(0).normalize();
      if (dist < this.def.reach * 1.3 + pl.radius && f.dot(to) > 0.2) {
        if (this.illusion) {
          this.w.game.state.sanity = Math.max(0, this.w.game.state.sanity - 6);
          this.vanish();
          return;
        }
        const hit = pl.damage(this.def.dmg * (this.elite ? 1.3 : 1), this.pos, { knock: this.radius > 0.6 ? 6 : 2.5, freeze: this.def.freeze, sanity: this.def.sanity });
        if (hit) this.w.fx.impact(pl.pos.clone().setY(1.2), to, 0x8a1010);
        if (this.radius > 0.6) this.w.game.rig.addShake(0.5);
      }
    }
    if (this.atkT >= 1) {
      this.atkT = -1;
      this.atkCd = this.def.cooldown * rand(0.85, 1.15);
    }
  }

  private shoot() {
    const w = this.w;
    const r = this.def.ranged!;
    const pl = w.player;
    const from = this.pos.clone().setY(1.5 * this.scale);
    const lead = pl.vel.clone().multiplyScalar(this.pos.distanceTo(pl.pos) / r.speed * 0.6);
    const target = pl.pos.clone().add(lead).setY(1.0);
    w.projectiles.enemyShot(r.kind, from, target, r.speed, r.dmg * (this.elite ? 1.3 : 1));
  }

  private faceTo(p: THREE.Vector3, dt: number, k: number) {
    const a = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    this.yaw = lerpAngle(this.yaw, a, damp(k, dt));
  }

  private animate(dt: number, spd: number) {
    if (this.anim) {
      const p = this.anim.p;
      p.speed = spd;
      p.run = this.state === 'chase' && spd > 2.5 ? 0.6 : 0;
      p.attack = this.atkT >= 0 ? this.atkT : this.rangedT >= 0 ? this.rangedT * 0.42 : -1;
      p.attackType = 0;
      p.lunge = this.lungeT >= 0 ? 1 : 0;
      p.hurt = Math.max(p.hurt - dt * 3, this.staggerT > 0 ? 1 : 0, this.flashT > 0 ? 0.6 : 0);
      p.stiff = this.shockT > 0 ? 0.6 : 0;
      p.zombie = this.state === 'dormant' && !this.dormantHidden ? 0 : 1;
      if (this.state === 'dormant' && !this.disguise) {
        p.pose = 'slump';
        p.poseW = 1;
      } else {
        p.pose = null;
        p.poseW = 0;
      }
      this.anim.tick(dt);
    } else if (this.hanim) {
      this.hanim.speed = spd;
      this.hanim.attack = this.atkT >= 0 ? this.atkT : this.lungeT >= 0 ? clamp01(this.lungeT / 0.38) : -1;
      this.hanim.hurt = this.staggerT > 0 ? 1 : 0;
      this.hanim.tick(dt);
    }
  }

  private updateFlash() {
    const m = (this.model ?? this.hound)?.material;
    if (!m) return;
    const f = this.flashT > 0 ? 1 : this.fuseT >= 0 ? (Math.sin(this.w.time * 30) > 0 ? 0.8 : 0) : this.shockT > 0 ? 0.4 : 0;
    m.emissive.setRGB(f * (this.fuseT >= 0 ? 1.5 : 1), f * (this.fuseT >= 0 ? 0.6 : 1), f * (this.shockT > 0 && this.flashT <= 0 ? 2 : 1));
  }

  private updatePhantom(dt: number) {
    const w = this.w;
    const pl = w.player;
    let vis = 0.06 + 0.04 * Math.sin(w.time * 7 + this.pos.x);
    const night = (w.game.state.skills.nighteyes ?? 0) > 0;
    if (night) vis = Math.max(vis, 0.35);
    if (pl.flashlight) {
      const cam = w.game.camera.position;
      const d = w.game.rig.dir(tv2);
      const to = tv.copy(this.pos).setY(1.2).sub(cam);
      const L = to.length();
      if (L < 20 && to.normalize().dot(d) > Math.cos(night ? 0.6 : 0.45)) vis = 0.9;
    }
    if (this.atkT >= 0 || this.flashT > 0) vis = Math.max(vis, 0.6);
    if (this.dead) vis = 0.5;
    this.visibility = lerp(this.visibility, vis, damp(6, dt));
    for (const m of this.mats) (m as THREE.MeshBasicMaterial).opacity = this.visibility;
  }

  dispose() {
    if (this.disguise) this.w.scene.remove(this.disguise);
    this.root.parent?.remove(this.root);
    for (const m of this.mats) m.dispose();
    (this.model?.mesh ?? this.hound?.mesh)?.geometry.dispose();
  }
}

export function angleTo(a: THREE.Vector3, b: THREE.Vector3) {
  return Math.atan2(b.x - a.x, b.z - a.z);
}
export { angleDiff, clamp, chance };
