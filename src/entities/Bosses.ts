import * as THREE from 'three';
import { Enemy, DamageOpts } from './Enemy';
import { EnemyDef } from './EnemyDefs';
import type { World } from '../game/World';
import type { BossKind, EnemyKind } from '../world/LevelDef';
import { buildHumanoid, Look } from '../chars/CharacterBuilder';
import { Animator } from '../chars/Animator';
import { audio } from '../core/Audio';
import { clamp, clamp01, damp, lerp, lerpAngle, rand, pick, angleDiff } from '../core/math';
import { Breakable } from './Interactables';
import { PM, part } from '../world/Props';
import { compact } from './Models';
import { T } from '../world/Level';

const tv = new THREE.Vector3();

function bossDef(o: Partial<EnemyDef> & { name: string; hp: number }): EnemyDef {
  return {
    walk: 2, run: 3, dmg: 30, reach: 3, windup: 0.8, cooldown: 1.5, sight: 60, hearing: 5, fov: 6.3, radius: 1.2,
    scale: [1, 1], blood: 0x6a8a20, stagger: 99999, credits: 400, sanity: 6, loot: [], pitch: 0.5,
    look: () => ({}) as Look,
    ...o,
  };
}

export const BOSS_INFO: Record<BossKind, { name: string; title: string; music: 'boss' | 'finale' }> = {
  gridlock: { name: 'GRIDLOCK', title: 'The Commuter Who Never Got Home', music: 'boss' },
  foreman: { name: 'THE FOREMAN', title: 'Shift Supervisor, Line 7', music: 'boss' },
  subjectZero: { name: 'SUBJECT ZERO', title: 'GloomTech Evolution Trial #000', music: 'boss' },
  leviathan: { name: 'THE LEVIATHAN', title: 'Habitat Mascot “Finn” (Mutated)', music: 'boss' },
  motherBloom: { name: 'MOTHER BLOOM', title: 'Yield-Optimized Cultivar 9', music: 'boss' },
  warden: { name: 'THE WARDEN', title: 'Keeper of the Cold Sleep', music: 'boss' },
  apex: { name: 'APEX', title: 'Evolution Enhancer™ — Final Form', music: 'finale' },
};

export abstract class Boss extends Enemy {
  started = false;
  phase = 1;
  action = 'idle';
  actT = 0;
  nextT = 1.5;
  vulnerable = 1;
  weak: { bone: string; off: THREE.Vector3; r: number; mult: number }[] = [];
  breakables: Breakable[] = [];
  bossKind: BossKind;
  defeated = false;
  constructor(w: World, kind: BossKind, def: EnemyDef, look: Look | null) {
    super(w, 'custom', 'boss:' + kind, def, { noModel: true });
    this.bossKind = kind;
    this.isBoss = true;
    const diff = w.game.state.difficulty;
    this.hp = this.maxHp = def.hp * (diff === 'story' ? 0.6 : diff === 'nightmare' ? 1.3 : 1);
    if (look) {
      this.model = buildHumanoid(look);
      this.anim = new Animator(this.model);
      this.anim.p.zombie = 1;
      this.root = this.model.root;
      this.scale = look.height ?? 1;
      this.radius = def.radius;
    }
    this.state = 'scripted';
  }
  get info() {
    return BOSS_INFO[this.bossKind];
  }
  begin() {
    this.started = true;
    this.state = 'chase';
    this.nextT = 1.2;
  }
  hitSpheres() {
    const base = super.hitSpheres().map((s) => ({ ...s, head: false, mult: s.head ? 1.3 : 1 }));
    if (this.model) {
      for (const wk of this.weak) {
        const b = (this.model.bones as any)[wk.bone] as THREE.Bone;
        const c = wk.off.clone().applyMatrix4(b.matrixWorld);
        base.push({ c, r: wk.r, head: false, mult: wk.mult });
      }
    }
    return base;
  }
  damage(amount: number, dir: THREE.Vector3, o: DamageOpts & { mult?: number } = {}) {
    if (!this.started || this.dead) return false;
    const before = this.hp;
    const ok = super.damage(amount * this.vulnerable, dir, { ...o, silent: true });
    if (ok && this.hp > 0) this.onHurt(before - this.hp);
    return ok;
  }
  onHurt(_d: number) {}
  die(o: DamageOpts = {}) {
    if (this.dead) return;
    super.die({ ...o, silent: true });
    this.defeated = true;
    audio.play('bossRoar', { pos: this.pos, pitch: 0.7, vol: 1 });
    this.w.onBossDefeated(this);
    for (const b of this.breakables) b.hp = 0;
  }
  // --- helpers ---
  face(p: THREE.Vector3, dt: number, k = 4) {
    const a = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    this.yaw = lerpAngle(this.yaw, a, damp(k, dt));
  }
  moveToward(p: THREE.Vector3, speed: number, dt: number) {
    const d = tv.copy(p).sub(this.pos).setY(0);
    const L = d.length();
    if (L < 0.1) return;
    let dir = d.normalize();
    if (this.w.level.rayGrid(this.pos.x, this.pos.z, p.x, p.z, 'solid') !== Infinity) {
      const path = this.w.level.findPath(this.pos, p, 800);
      if (path?.length) dir = path[0].clone().sub(this.pos).setY(0).normalize();
    }
    this.vel.x = lerp(this.vel.x, dir.x * speed, damp(6, dt));
    this.vel.z = lerp(this.vel.z, dir.z * speed, damp(6, dt));
  }
  slamAt(p: THREE.Vector3, r: number, dmg: number, delay: number, kind: 'fire' | 'toxic' | 'ice' | 'spore' | 'psychic' = 'fire', knock = 7) {
    const at = p.clone().setY(0);
    this.w.fx.telegraph(at, r, delay);
    this.w.after(delay, () => {
      if (this.dead) return;
      this.w.fx.explosion(at.clone().setY(0.4), kind, r);
      audio.play(kind === 'ice' ? 'iceCrack' : 'stomp', { pos: at, vol: 1 });
      this.w.game.rig.addShake(0.5);
      const pl = this.w.player;
      if (pl.pos.distanceTo(at) < r + pl.radius) pl.damage(dmg, at, { knock, freeze: kind === 'ice' ? 2 : 0, sanity: kind === 'psychic' ? 8 : 0 });
    });
  }
  shockwave(center: THREE.Vector3, maxR: number, dmg: number, dur: number, color = 0xffa040) {
    const c = center.clone().setY(0);
    let t = 0;
    let hit = false;
    this.w.fx.shock(c, maxR, color);
    const tick = (dt: number) => {
      t += dt;
      const r = (t / dur) * maxR;
      const pl = this.w.player;
      const d = pl.pos.distanceTo(c);
      if (!hit && Math.abs(d - r) < 0.7) {
        if (pl.damage(dmg, c, { knock: 6 })) hit = true;
      }
      return t < dur;
    };
    this.w.addTicker(tick);
  }
  summon(kind: EnemyKind, n: number, radius = 6) {
    for (let i = 0; i < n; i++) {
      const p = this.w.level.randomFloorNear(this.w.player.pos, Math.ceil(radius / 3));
      if (!p) continue;
      if (p.distanceTo(this.w.player.pos) < 3) continue;
      const e = this.w.spawnEnemy(kind, p, { rise: true });
      e.noLoot = Math.random() < 0.6;
    }
  }
  cone(range: number, angle: number, dps: number, dur: number, kind: 'steam' | 'frost', extra: { freeze?: number } = {}) {
    let t = 0;
    let tickD = 0;
    const tick = (dt: number) => {
      t += dt;
      if (this.dead) return false;
      const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const mouth = this.pos.clone().addScaledVector(f, this.radius).setY(2.2 * this.scale * 0.6);
      if (kind === 'steam') this.w.fx.steam(mouth, 2);
      else this.w.fx.frost(mouth, f.clone().setY(-0.2), 3);
      const pl = this.w.player;
      const to = pl.pos.clone().sub(this.pos).setY(0);
      const d = to.length();
      tickD -= dt;
      if (d < range && to.normalize().dot(f) > Math.cos(angle / 2) && tickD <= 0) {
        tickD = 0.25;
        pl.damage(dps * 0.25, this.pos, { freeze: extra.freeze ?? 0 });
      }
      return t < dur;
    };
    this.w.addTicker(tick);
  }
  update(dt: number) {
    if (this.dead) {
      super.update(dt);
      return;
    }
    if (!this.started) {
      this.animIdle(dt);
      return;
    }
    this.actT += dt;
    this.nextT -= dt;
    this.vel.multiplyScalar(Math.max(0, 1 - dt * 3));
    this.think(dt);
    this.pos.addScaledVector(this.vel, dt);
    this.w.level.collide(this.pos, this.radius);
    // push player out
    const pl = this.w.player;
    const dx = pl.pos.x - this.pos.x, dz = pl.pos.z - this.pos.z;
    const rr = this.radius + pl.radius;
    if (dx * dx + dz * dz < rr * rr) {
      const d = Math.max(0.01, Math.hypot(dx, dz));
      pl.pos.x = this.pos.x + (dx / d) * rr;
      pl.pos.z = this.pos.z + (dz / d) * rr;
    }
    this.root.position.set(this.pos.x, this.root.position.y, this.pos.z);
    this.root.rotation.y = this.yaw;
    this.animBoss(dt);
    // drain sanity while fighting
    this.w.game.state.sanity = Math.max(0, this.w.game.state.sanity - dt * 0.6);
  }
  animIdle(dt: number) {
    if (this.anim) {
      this.anim.p.speed = 0;
      this.anim.p.zombie = 1;
      this.anim.tick(dt);
    }
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
  }
  animBoss(dt: number) {
    if (!this.anim) return;
    const p = this.anim.p;
    p.speed = Math.hypot(this.vel.x, this.vel.z) / Math.max(1, this.scale * 0.8);
    p.run = p.speed > 2.5 ? 1 : 0;
    this.anim.tick(dt);
  }
  abstract think(dt: number): void;
  get pl() {
    return this.w.player;
  }
  get dist() {
    return this.pos.distanceTo(this.w.player.pos);
  }
  start(a: string) {
    this.action = a;
    this.actT = 0;
  }
}

// =====================================================================
class Gridlock extends Boss {
  private chargeDir = new THREE.Vector3();
  private hitThisAction = false;
  private summoned = false;
  constructor(w: World) {
    super(w, 'gridlock', bossDef({ name: 'Gridlock', hp: 1500, radius: 1.1, blood: 0x6a8a20 }), {
      skin: 0x8a9478, hair: 0x2a2a20, hairStyle: 'none', top: 0x3a3e48, topStyle: 'suit', under: 0x8a8a80, accent: 0x6a1a1a, bottom: 0x2a2a30, shoes: 0x1a1a1a,
      zombie: true, eyeGlow: true, eye: 0xffa030, glowColor: 0xc0ff40, mutations: ['carDoor', 'trafficLight', 'tumor', 'claws'], band: false, height: 2.4, build: 1.35, seed: 501,
    });
    this.weak = [{ bone: 'chest', off: new THREE.Vector3(0, 0.12, -0.2), r: 0.38, mult: 3 }];
  }
  think(dt: number) {
    const pl = this.pl;
    const p = this.anim!.p;
    const speedK = this.phase === 2 ? 1.25 : 1;
    if (this.phase === 1 && this.hp < this.maxHp * 0.5) {
      this.phase = 2;
      if (!this.summoned) {
        this.summoned = true;
        this.summon('shambler', 3);
        this.summon('runner', 1);
        audio.play('bossRoar', { pos: this.pos });
        this.w.game.ui.hud.toast('Gridlock calls the rush-hour crowd!', 'warn');
      }
    }
    p.attack = -1;
    p.pose = null;
    p.poseW = 0;
    switch (this.action) {
      case 'idle':
      case 'chase':
        this.face(pl.pos, dt, 3);
        if (this.dist > 3.8) this.moveToward(pl.pos, 2.6 * speedK, dt);
        if (this.nextT <= 0) {
          const d = this.dist;
          if (d < 4.6) this.start('swipe');
          else if (d > 7 && Math.random() < 0.55) this.start('chargeWind');
          else if (d > 8) this.start('throw');
          else this.start('chase'), (this.nextT = 0.6);
          this.hitThisAction = false;
        }
        break;
      case 'swipe': {
        this.face(pl.pos, dt, 6);
        const k = this.actT / 1.4;
        p.attack = clamp01(k);
        if (!this.hitThisAction && this.actT > 0.6) {
          this.hitThisAction = true;
          audio.play('swing', { pos: this.pos, pitch: 0.5, vol: 1 });
          const to = pl.pos.clone().sub(this.pos).setY(0);
          const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          if (to.length() < 4.6 && to.normalize().dot(f) > 0.1) pl.damage(28, this.pos, { knock: 9 });
        }
        if (this.actT > 1.4) this.endAction(1.0);
        break;
      }
      case 'chargeWind':
        this.face(pl.pos, dt, 5);
        p.pose = 'fight';
        p.poseW = 1;
        if (this.actT < 0.05) {
          audio.play('bossRoar', { pos: this.pos, pitch: 0.9 });
          this.w.fx.telegraph(this.pos.clone().add(new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(4)), 1.2, 0.9);
        }
        if (this.actT > 0.9) {
          this.chargeDir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          this.start('charge');
        }
        break;
      case 'charge': {
        this.vel.copy(this.chargeDir).multiplyScalar(11 * speedK);
        this.anim!.p.run = 1;
        if (!this.hitThisAction && this.dist < this.radius + 1.3) {
          this.hitThisAction = true;
          pl.damage(38, this.pos, { knock: 14 });
          this.w.game.rig.addShake(0.6);
        }
        // hit wall?
        const ahead = this.pos.clone().addScaledVector(this.chargeDir, this.radius + 0.4);
        const [gx, gz] = this.w.level.cellOf(ahead.x, ahead.z);
        if (this.w.level.isSolidCell(gx, gz)) {
          audio.play('explosion', { pos: this.pos, vol: 0.8 });
          this.w.fx.explosion(ahead.setY(1), 'fire', 2);
          this.w.game.rig.addShake(0.9);
          this.vel.set(0, 0, 0);
          this.start('stunned');
          this.w.game.ui.hud.toast('Gridlock is stunned — hit the glowing tumor on its back!', 'info');
        } else if (this.actT > 1.7) this.endAction(0.8);
        break;
      }
      case 'stunned':
        this.vulnerable = 1.5;
        p.pose = 'despair';
        p.poseW = 1;
        this.anim!.p.hurt = 0.5;
        if (this.actT > 2.6) {
          this.vulnerable = 1;
          this.endAction(0.5);
        }
        break;
      case 'throw':
        this.face(pl.pos, dt, 5);
        p.throwT = clamp01(this.actT / 1.0);
        if (!this.hitThisAction && this.actT > 0.6) {
          this.hitThisAction = true;
          const from = this.pos.clone().setY(3.4);
          for (let i = 0; i < (this.phase === 2 ? 5 : 3); i++) {
            const t = pl.pos.clone().add(new THREE.Vector3(rand(-2.5, 2.5), 0, rand(-2.5, 2.5)));
            if (i === 0) t.copy(pl.pos);
            this.w.fx.telegraph(t, 1.8, 1.0);
            this.w.projectiles.enemyShot('rock', from, t, 13, 22, { lob: true });
          }
        }
        if (this.actT > 1.0) {
          p.throwT = -1;
          this.endAction(0.8);
        }
        break;
    }
  }
  endAction(cd: number) {
    this.start('chase');
    this.nextT = cd * (this.phase === 2 ? 0.75 : 1);
    this.anim!.p.throwT = -1;
  }
}

// =====================================================================
class Foreman extends Boss {
  private tanks: { b: Breakable; side: number; mesh: THREE.Object3D }[] = [];
  private summons = 0;
  private hit = false;
  constructor(w: World) {
    super(w, 'foreman', bossDef({ name: 'Foreman', hp: 1700, radius: 1.1, blood: 0x8a6a20 }), {
      skin: 0x9a8a78, hair: 0x2a2a20, hairStyle: 'none', top: 0xb08a20, topStyle: 'overalls', under: 0x5a4a3a, bottom: 0x4a3a2a, shoes: 0x1a1a1a,
      zombie: true, eyeGlow: true, eye: 0xff8030, glowColor: 0xff8030, mutations: ['hydraulic', 'tanks', 'mask', 'pipes'], band: false, height: 2.3, build: 1.4, hat: 'helmet', hatColor: 0xd0a020, seed: 502,
    });
    this.weak = [];
    for (const side of [1, -1]) {
      const P = PM();
      const mesh = compact(new THREE.Group().add(part(new THREE.SphereGeometry(1, 10, 8), P.glowV, 0xffa040, [0, 0, 0], [0.22, 0.22, 0.22])));
      w.scene.add(mesh);
      const b = new Breakable(new THREE.Vector3(), 0.55, 200, () => {
        this.w.fx.sparks(b.pos, new THREE.Vector3(0, 1, 0), 0xffa040, 6);
        audio.play('metal', { pos: b.pos, vol: 0.6 });
      }, () => {
        this.w.explode(b.pos.clone(), 3, 0, 'fire', null);
        this.w.scene.remove(mesh);
        this.vulnerable += 0.3;
        this.start('stunned');
        audio.play('bossRoar', { pos: this.pos, pitch: 0.8 });
        this.w.game.ui.hud.toast('Pressure tank ruptured! The Foreman staggers.', 'info');
        this.hp -= this.maxHp * 0.08;
      }, 4);
      this.tanks.push({ b, side, mesh });
      this.breakables.push(b);
      w.breakables.push(b);
    }
  }
  begin() {
    super.begin();
    this.w.game.ui.hud.toast('Shoot the glowing pressure tanks on its back!', 'info');
  }
  think(dt: number) {
    const pl = this.pl;
    const p = this.anim!.p;
    // tanks follow chest bone
    const chest = this.model!.bones.chest;
    for (const t of this.tanks) {
      if (t.b.hp <= 0) continue;
      t.b.pos.copy(new THREE.Vector3(0.08 * t.side, 0.26, -0.2).applyMatrix4(chest.matrixWorld));
      t.mesh.position.copy(t.b.pos);
      t.mesh.scale.setScalar(this.action === 'steamWind' ? 1.4 + Math.sin(this.w.time * 30) * 0.2 : 1);
    }
    const hpK = this.hp / this.maxHp;
    if ((this.summons === 0 && hpK < 0.66) || (this.summons === 1 && hpK < 0.33)) {
      this.summons++;
      this.summon(this.summons === 1 ? 'welder' : 'hauler', this.summons === 1 ? 3 : 1);
      this.summon('shambler', 2);
      this.w.game.ui.hud.toast('“SHIFT CHANGE!” — reinforcements on the line', 'warn');
    }
    p.attack = -1;
    p.pose = null;
    p.poseW = 0;
    switch (this.action) {
      case 'idle':
      case 'chase':
        this.face(pl.pos, dt, 3);
        if (this.dist > 3.5) this.moveToward(pl.pos, 2.2, dt);
        if (this.nextT <= 0) {
          this.hit = false;
          const d = this.dist;
          if (d < 4) this.start(Math.random() < 0.6 ? 'punch' : 'slamWind');
          else if (d < 9 && Math.random() < 0.45) this.start('steamWind');
          else this.start('slamWind');
        }
        break;
      case 'punch':
        this.face(pl.pos, dt, 6);
        p.attack = clamp01(this.actT / 1.2);
        p.attackType = 2;
        if (!this.hit && this.actT > 0.55) {
          this.hit = true;
          audio.play('stomp', { pos: this.pos });
          const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          const to = pl.pos.clone().sub(this.pos).setY(0);
          if (to.length() < 4.2 && to.normalize().dot(f) > 0.2) pl.damage(34, this.pos, { knock: 10 });
        }
        if (this.actT > 1.2) this.end(1);
        break;
      case 'slamWind': {
        this.face(pl.pos, dt, 4);
        p.pose = 'arms';
        p.poseW = clamp01(this.actT * 2);
        if (this.actT > 1.0) {
          const at = this.pos.clone().add(new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(2.5));
          audio.play('stomp', { pos: at, vol: 1.2 });
          this.w.fx.explosion(at.clone().setY(0.3), 'fire', 2.5);
          this.w.game.rig.addShake(0.8);
          if (pl.pos.distanceTo(at) < 2.5) pl.damage(30, at, { knock: 8 });
          this.shockwave(at, 13, 22, 1.3, 0xffa040);
          this.w.game.ui.hud.hint('Dodge-roll (Space) through the shockwave!');
          this.end(1.6);
        }
        break;
      }
      case 'steamWind':
        this.face(pl.pos, dt, 4);
        if (this.actT < 0.05) audio.play('steam', { pos: this.pos, vol: 0.6 });
        if (this.actT > 0.8) {
          this.start('steam');
          this.cone(9, 0.9, 26, 2.2, 'steam');
          audio.play('steam', { pos: this.pos, vol: 1 });
        }
        break;
      case 'steam':
        this.face(pl.pos, dt, 1.2);
        if (this.actT > 2.2) this.end(1.2);
        break;
      case 'stunned':
        p.pose = 'despair';
        p.poseW = 1;
        if (this.actT > 3) this.end(0.5);
        break;
    }
  }
  end(cd: number) {
    this.start('chase');
    this.nextT = cd;
  }
  die(o: DamageOpts = {}) {
    for (const t of this.tanks) this.w.scene.remove(t.mesh);
    super.die(o);
  }
}

// =====================================================================
class SubjectZero extends Boss {
  private clones: Enemy[] = [];
  private hit = false;
  private combo = 0;
  constructor(w: World) {
    super(w, 'subjectZero', bossDef({ name: 'Subject Zero', hp: 1300, radius: 0.6, blood: 0xff70c0 }), {
      skin: 0xd8d8e8, hair: 0x101010, hairStyle: 'none', top: 0xe0e4ea, topStyle: 'jumpsuit', bottom: 0xe0e4ea, shoes: 0x2a2a2a,
      zombie: true, eyeGlow: true, eye: 0xff70e0, glowColor: 0xff70e0, mutations: ['bigHead', 'brain', 'claws'], band: false, height: 1.45, build: 0.8, seed: 503,
    });
  }
  think(dt: number) {
    const pl = this.pl;
    const p = this.anim!.p;
    p.attack = -1;
    p.pose = null;
    p.poseW = 0;
    // sanity aura
    if (this.dist < 7) this.w.game.state.sanity = Math.max(0, this.w.game.state.sanity - dt * 3);
    if (this.phase === 1 && this.hp < this.maxHp * 0.5) {
      this.phase = 2;
      audio.play('bossRoar', { pos: this.pos, pitch: 1.6 });
    }
    this.clones = this.clones.filter((c) => !c.dead);
    switch (this.action) {
      case 'idle':
      case 'chase':
        this.face(pl.pos, dt, 6);
        if (this.dist > 2.2) this.moveToward(pl.pos, 3.2, dt);
        if (this.nextT <= 0) {
          this.hit = false;
          const r = Math.random();
          if (this.dist < 2.8) this.start('claw');
          else if (r < 0.35) this.start('blink');
          else if (r < 0.65) this.start('orbs');
          else if (this.clones.length === 0 && this.phase === 2) this.start('mirror');
          else this.start('blink');
        }
        break;
      case 'blink': {
        if (this.actT < 0.05) {
          this.w.fx.explosion(this.pos.clone().setY(1), 'psychic', 1.2);
          audio.play('teleport', { pos: this.pos });
          const ang = Math.random() * Math.PI * 2;
          const tgt = pl.pos.clone().add(new THREE.Vector3(Math.cos(ang) * 3.5, 0, Math.sin(ang) * 3.5));
          const [gx, gz] = this.w.level.cellOf(tgt.x, tgt.z);
          if (this.w.level.walkable(gx, gz)) this.pos.copy(tgt);
          this.w.fx.explosion(this.pos.clone().setY(1), 'psychic', 1.2);
        }
        if (this.actT > 0.35) {
          this.combo = 0;
          this.start('claw');
        }
        break;
      }
      case 'claw':
        this.face(pl.pos, dt, 10);
        p.attack = clamp01((this.actT % 0.6) / 0.6);
        p.attackType = this.combo;
        if (this.actT > 0.3 + this.combo * 0.6 && this.combo < 2) {
          this.combo++;
          audio.play('swing', { pos: this.pos, pitch: 1.4 });
          const to = pl.pos.clone().sub(this.pos).setY(0);
          if (to.length() < 2.6) pl.damage(16, this.pos, { knock: 3, sanity: 5 });
        }
        if (this.actT > 1.3) this.end(this.phase === 2 ? 0.6 : 1.0);
        break;
      case 'orbs':
        p.pose = 'arms';
        p.poseW = 1;
        if (!this.hit && this.actT > 0.6) {
          this.hit = true;
          const n = this.phase === 2 ? 7 : 5;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const from = this.pos.clone().add(new THREE.Vector3(Math.cos(a) * 1.2, 2.2, Math.sin(a) * 1.2));
            this.w.projectiles.enemyShot('orb', from, from.clone().add(new THREE.Vector3(Math.cos(a), 0.3, Math.sin(a))), 4.5, 12, { lob: false, homing: 1.4, size: 0.25 });
          }
          audio.play('teleport', { pos: this.pos, pitch: 0.6 });
        }
        if (this.actT > 1.2) this.end(1.2);
        break;
      case 'mirror':
        p.pose = 'meditate';
        p.poseW = 1;
        if (!this.hit && this.actT > 0.8) {
          this.hit = true;
          for (let i = 0; i < 3; i++) {
            const pos = this.w.level.randomFloorNear(this.pos, 2) ?? this.pos.clone();
            const c = this.w.spawnEnemy('phantom', pos, { rise: false });
            c.hp = c.maxHp = 30;
            c.noLoot = true;
            this.clones.push(c);
          }
          this.w.game.ui.hud.toast('Subject Zero splinters into illusions — the real one casts no shimmer.', 'info');
        }
        if (this.actT > 1.2) this.end(0.8);
        break;
    }
  }
  end(cd: number) {
    this.start('chase');
    this.nextT = cd;
  }
  die(o: DamageOpts = {}) {
    for (const c of this.clones) if (!c.dead) c.die({ silent: true });
    super.die(o);
  }
}

// =====================================================================
class Leviathan extends Boss {
  private body: THREE.Group;
  private tentacles: { g: THREE.Group; segs: THREE.Object3D[]; base: THREE.Vector3; target: THREE.Vector3 | null; t: number; state: 'idle' | 'raise' | 'slam' }[] = [];
  private emerge = 0;
  private submerged = false;
  private hit = false;
  private lurePos = new THREE.Vector3();
  constructor(w: World) {
    super(w, 'leviathan', bossDef({ name: 'Leviathan', hp: 1600, radius: 2.4, blood: 0x2a8a8a }), null);
    const P = PM();
    const body = new THREE.Group();
    const skin = 0x3a6a72;
    body.add(compact(new THREE.Group().add(
      part(new THREE.SphereGeometry(1, 16, 12), P.paint, skin, [0, 0, 0], [2.2, 1.8, 2.6]),
      part(new THREE.SphereGeometry(1, 12, 8), P.paint, 0x2a4a52, [0, -0.9, 1.4], [1.6, 0.6, 1.4]),
      part(new THREE.ConeGeometry(1, 1, 4), P.paint, 0xe8e0d0, [0.6, -0.5, 2.3], [0.12, 0.5, 0.12], [Math.PI, 0, 0]),
      part(new THREE.ConeGeometry(1, 1, 4), P.paint, 0xe8e0d0, [-0.6, -0.5, 2.3], [0.12, 0.5, 0.12], [Math.PI, 0, 0]),
      part(new THREE.ConeGeometry(1, 1, 4), P.paint, 0xe8e0d0, [0, -0.5, 2.5], [0.12, 0.5, 0.12], [Math.PI, 0, 0]),
      part(new THREE.SphereGeometry(1, 10, 8), P.glowV, 0x40ffd0, [0.9, 0.5, 2.0], [0.28, 0.28, 0.2]),
      part(new THREE.SphereGeometry(1, 10, 8), P.glowV, 0x40ffd0, [-0.9, 0.5, 2.0], [0.28, 0.28, 0.2]),
      part(new THREE.CylinderGeometry(1, 1, 1, 8), P.paint, 0x2a4a52, [0, 2.0, 1.2], [0.06, 1.8, 0.06], [0.7, 0, 0]),
      part(new THREE.SphereGeometry(1, 12, 10), P.glowV, 0x80ffe0, [0, 2.7, 2.0], [0.45, 0.45, 0.45]),
      part(new THREE.ConeGeometry(1, 1, 5), P.paint, 0x2a5a62, [0, 1.6, -0.6], [0.5, 1.4, 0.2]),
    )));
    this.body = body;
    this.root.add(body);
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const segs: THREE.Object3D[] = [];
      let parent: THREE.Object3D = g;
      for (let s = 0; s < 7; s++) {
        const seg = new THREE.Group();
        seg.add(compact(new THREE.Group().add(part(new THREE.CylinderGeometry(1, 1, 1, 8), P.paint, s % 2 ? 0x3a6a72 : 0x4a7a82, [0, 0.45, 0], [0.32 - s * 0.035, 0.95, 0.32 - s * 0.035]), part(new THREE.SphereGeometry(1, 8, 6), P.glowV, 0x40ffd0, [0, 0.45, 0.25 - s * 0.02], [0.06, 0.06, 0.06]))));
        if (s > 0) seg.position.y = 0.9;
        parent.add(seg);
        segs.push(seg);
        parent = seg;
      }
      this.w.scene.add(g);
      this.tentacles.push({ g, segs, base: new THREE.Vector3(), target: null, t: 0, state: 'idle' });
    }
  }
  place(p: THREE.Vector3, yaw: number) {
    super.place(p, yaw);
    this.tentacles.forEach((t, i) => {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      t.base.set(p.x + Math.cos(a) * 4.5, -1.5, p.z + Math.sin(a) * 4.5);
      t.g.position.copy(t.base);
    });
    this.root.position.y = -5;
  }
  hitSpheres() {
    if (this.submerged || this.emerge < 0.8) return [];
    this.body.updateWorldMatrix(true, false);
    const head = new THREE.Vector3(0, 0, 0).applyMatrix4(this.body.matrixWorld);
    const lure = new THREE.Vector3(0, 2.7, 2.0).applyMatrix4(this.body.matrixWorld);
    this.lurePos.copy(lure);
    const eyes = new THREE.Vector3(0, 0.5, 2.0).applyMatrix4(this.body.matrixWorld);
    return [
      { c: head, r: 2.3, head: false, mult: 1 },
      { c: lure, r: 0.6, head: false, mult: 2.5 },
      { c: eyes, r: 0.9, head: false, mult: 1.6 },
    ];
  }
  begin() {
    super.begin();
    this.w.game.ui.hud.toast('Aim for the glowing lure above its head!', 'info');
  }
  think(dt: number) {
    const pl = this.pl;
    this.vel.set(0, 0, 0);
    this.face(pl.pos, dt, 1.5);
    const targetEmerge = this.submerged ? 0 : 1;
    this.emerge = lerp(this.emerge, targetEmerge, damp(2, dt));
    this.root.position.y = -5 + this.emerge * 4.4 + Math.sin(this.w.time * 1.3) * 0.15;
    this.body.rotation.z = Math.sin(this.w.time * 0.9) * 0.08;
    if (this.phase === 1 && this.hp < this.maxHp * 0.5) {
      this.phase = 2;
      audio.play('bossRoar', { pos: this.pos, pitch: 0.4 });
    }
    // tentacles
    for (const t of this.tentacles) this.animTentacle(t, dt);
    switch (this.action) {
      case 'idle':
      case 'chase':
        if (this.nextT <= 0) {
          this.hit = false;
          const r = Math.random();
          if (r < 0.5) this.start('slam');
          else if (r < 0.8) this.start('spit');
          else this.start('submerge');
        }
        break;
      case 'slam': {
        if (!this.hit) {
          this.hit = true;
          const n = this.phase === 2 ? 3 : 2;
          const avail = this.tentacles.filter((t) => t.state === 'idle');
          for (let i = 0; i < Math.min(n, avail.length); i++) {
            const t = avail[i];
            const target = i === 0 ? pl.pos.clone() : pl.pos.clone().add(new THREE.Vector3(rand(-3, 3), 0, rand(-3, 3)));
            t.target = target;
            t.state = 'raise';
            t.t = 0;
            this.w.fx.telegraph(target, 1.9, 1.1);
            this.w.after(1.1, () => {
              if (this.dead) return;
              t.state = 'slam';
              t.t = 0;
              audio.play('stomp', { pos: target, vol: 1.1 });
              this.w.fx.splash(target, 3);
              this.w.game.rig.addShake(0.5);
              if (pl.pos.distanceTo(target) < 2.1) pl.damage(30, target, { knock: 8 });
            });
          }
        }
        if (this.actT > 2.4) this.end(1.2);
        break;
      }
      case 'spit':
        if (!this.hit && this.actT > 0.6) {
          this.hit = true;
          audio.play('spit', { pos: this.pos, vol: 1 });
          const from = this.pos.clone().setY(3);
          for (let i = 0; i < (this.phase === 2 ? 7 : 5); i++) {
            const t = pl.pos.clone().add(new THREE.Vector3(rand(-3.5, 3.5), 0, rand(-3.5, 3.5)));
            if (i === 0) t.copy(pl.pos);
            this.w.projectiles.enemyShot('acid', from, t, 12, 14, { lob: true, size: 0.3 });
          }
        }
        if (this.actT > 1.4) this.end(1.0);
        break;
      case 'submerge':
        if (this.actT < 0.05) {
          this.submerged = true;
          audio.play('splash', { pos: this.pos, vol: 1.2 });
          this.summon('diver', this.phase === 2 ? 3 : 2);
        }
        if (this.actT > 4.5) {
          this.submerged = false;
          audio.play('bossRoar', { pos: this.pos, pitch: 0.45 });
          this.w.fx.splash(this.pos, 4);
          this.end(1.5);
        }
        break;
    }
  }
  private animTentacle(t: Leviathan['tentacles'][0], dt: number) {
    t.t += dt;
    const sway = this.w.time * 1.5 + t.base.x;
    const rise = this.submerged ? 0 : 1;
    t.g.position.y = lerp(t.g.position.y, -1.5 - (1 - rise) * 6, damp(3, dt));
    if (t.state === 'idle' || !t.target) {
      t.segs.forEach((s, i) => {
        s.rotation.x = Math.sin(sway + i * 0.6) * 0.25;
        s.rotation.z = Math.cos(sway * 0.8 + i * 0.5) * 0.2;
      });
      t.g.rotation.y += dt * 0.2;
      return;
    }
    // bend toward target
    const yawT = Math.atan2(t.target.x - t.base.x, t.target.z - t.base.z);
    t.g.rotation.y = lerpAngle(t.g.rotation.y, yawT, damp(6, dt));
    const d = Math.hypot(t.target.x - t.base.x, t.target.z - t.base.z);
    const reach = clamp(d / 6, 0.3, 1.2);
    if (t.state === 'raise') {
      t.segs.forEach((s, i) => {
        s.rotation.x = lerp(s.rotation.x, -0.15 - (i < 3 ? 0.1 : 0.05), damp(5, dt));
        s.rotation.z = 0;
      });
    } else {
      const k = clamp01(t.t / 0.18);
      t.segs.forEach((s, i) => (s.rotation.x = lerp(s.rotation.x, (0.28 + i * 0.02) * reach * 1.4 * k, damp(25, dt))));
      if (t.t > 1.2) t.state = 'idle';
    }
  }
  end(cd: number) {
    this.start('chase');
    this.nextT = cd;
  }
  damage(amount: number, dir: THREE.Vector3, o: DamageOpts = {}) {
    if (this.submerged) return false;
    return super.damage(amount, dir, o);
  }
  die(o: DamageOpts = {}) {
    super.die(o);
    for (const t of this.tentacles) this.w.after(1.5, () => this.w.scene.remove(t.g));
    this.removed = false;
  }
  update(dt: number) {
    if (this.dead) {
      this.deadT += dt;
      this.root.position.y -= dt * 1.2;
      for (const t of this.tentacles) t.g.position.y -= dt * 2;
      if (this.deadT > 6) this.removed = true;
      return;
    }
    super.update(dt);
  }
}

// =====================================================================
class MotherBloom extends Boss {
  private petals: THREE.Object3D[] = [];
  private core: THREE.Mesh;
  private bulbs: { b: Breakable; mesh: THREE.Object3D }[] = [];
  private openK = 0;
  private openTimer = 0;
  private hit = false;
  private lastSummon = 0;
  constructor(w: World) {
    super(w, 'motherBloom', bossDef({ name: 'Mother Bloom', hp: 1500, radius: 2.2, blood: 0xd0ff40 }), null);
    const P = PM();
    const g = new THREE.Group();
    g.add(compact(new THREE.Group().add(
      part(new THREE.CylinderGeometry(1, 1.3, 1, 10), P.paint, 0x2a5a24, [0, 2, 0], [0.9, 4, 0.9]),
      part(new THREE.SphereGeometry(1, 12, 8), P.leaves, 0x3a6a2a, [0, 0.3, 0], [2.6, 0.8, 2.6]),
    )));
    for (let i = 0; i < 6; i++) {
      const piv = new THREE.Group();
      piv.position.set(0, 4.2, 0);
      piv.rotation.y = (i / 6) * Math.PI * 2;
      const pet = compact(new THREE.Group().add(part(new THREE.SphereGeometry(1, 12, 8), P.paint, i % 2 ? 0xc04080 : 0xa03070, [0, 1.4, 0.4], [1.0, 1.8, 0.25])));
      piv.add(pet);
      g.add(piv);
      this.petals.push(piv);
    }
    this.core = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 0.6) }));
    this.core.position.y = 4.6;
    g.add(this.core);
    this.root.add(g);
  }
  place(p: THREE.Vector3, yaw: number) {
    super.place(p, yaw);
    const P = PM();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      const bp = p.clone().add(new THREE.Vector3(Math.cos(a) * 7, 0, Math.sin(a) * 7));
      const mesh = compact(new THREE.Group().add(
        part(new THREE.SphereGeometry(1, 12, 10), P.leaves, 0x4a6a2a, [0, 0.7, 0], [0.9, 0.8, 0.9]),
        part(new THREE.SphereGeometry(1, 10, 8), P.glowV, 0xd0ff40, [0, 1.1, 0], [0.45, 0.45, 0.45]),
        part(new THREE.CylinderGeometry(1, 1, 1, 6), P.paint, 0x2a5a24, [0, 0.1, 0], [0.3, 0.3, 4], [Math.PI / 2, 0, 0]),
      ));
      mesh.position.copy(bp);
      mesh.lookAt(p.x, 0, p.z);
      this.w.scene.add(mesh);
      const b = new Breakable(bp.clone().setY(1), 1.0, 240, () => {
        this.w.fx.gore(bp.clone().setY(1), 0xd0ff40, 4);
        mesh.scale.setScalar(0.9 + Math.random() * 0.15);
      }, () => {
        this.w.fx.explosion(bp.clone().setY(1), 'spore', 2.5);
        audio.play('bossRoar', { pos: this.pos, pitch: 1.1 });
        this.w.scene.remove(mesh);
        const left = this.bulbs.filter((x) => x.b.hp > 0).length;
        this.w.game.ui.hud.toast(left ? `Root bulb destroyed (${3 - left}/3)` : 'All root bulbs destroyed — the bloom must open to feed!', 'info');
        if (!left) this.openTimer = 3;
      }, 1.6);
      this.bulbs.push({ b, mesh });
      this.breakables.push(b);
      this.w.breakables.push(b);
    }
    this.w.level.circles.push({ x: p.x, z: p.z, r: 2.4 });
  }
  begin() {
    super.begin();
    this.w.game.ui.hud.toast('Destroy the three glowing root bulbs to expose its core!', 'info');
  }
  hitSpheres() {
    this.core.updateWorldMatrix(true, false);
    const c = new THREE.Vector3().setFromMatrixPosition(this.core.matrixWorld);
    const stem = this.pos.clone().setY(2);
    return [
      { c, r: 1.2, head: false, mult: 1 },
      { c: stem, r: 1.3, head: false, mult: 1 },
    ];
  }
  damage(amount: number, dir: THREE.Vector3, o: DamageOpts = {}) {
    if (!this.started) return false;
    if (this.openK < 0.6) {
      this.w.fx.leaves(this.pos.clone().setY(2));
      return true; // absorbed by petals
    }
    return super.damage(amount * (o.fire ? 2 : 1), dir, o);
  }
  think(dt: number) {
    const pl = this.pl;
    this.vel.set(0, 0, 0);
    const allBroken = this.bulbs.every((b) => b.b.hp <= 0);
    if (allBroken) {
      this.openTimer -= dt;
      if (this.openTimer <= 0) this.openTimer = 14;
    }
    const open = allBroken && this.openTimer > 7 && this.openTimer < 13.5;
    this.openK = lerp(this.openK, open ? 1 : 0, damp(3, dt));
    this.petals.forEach((pv, i) => {
      pv.rotation.x = lerp(0.25, 1.35, this.openK) + Math.sin(this.w.time * 1.5 + i) * 0.04;
    });
    (this.core.material as THREE.MeshBasicMaterial).color.setRGB(3 * (0.5 + this.openK), 2.6 * (0.5 + this.openK), 0.6);
    this.root.rotation.y += dt * 0.15;
    this.lastSummon += dt;
    if (this.lastSummon > 22) {
      this.lastSummon = 0;
      this.summon(Math.random() < 0.5 ? 'creeper' : 'vinehound', 2, 8);
    }
    switch (this.action) {
      case 'idle':
      case 'chase':
        if (this.nextT <= 0) {
          this.hit = false;
          const r = Math.random();
          this.start(r < 0.55 ? 'lash' : 'spores');
        }
        break;
      case 'lash': {
        if (!this.hit) {
          this.hit = true;
          // line telegraphs toward the player
          const dir = pl.pos.clone().sub(this.pos).setY(0).normalize();
          const lines = this.phase === 2 ? [-0.35, 0, 0.35] : [0];
          for (const off of lines) {
            const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), off);
            for (let k = 1; k <= 6; k++) {
              const at = this.pos.clone().addScaledVector(d, 2 + k * 2.2);
              this.w.fx.telegraph(at, 1.1, 0.9 + k * 0.06, 0x80ff40);
              this.w.after(0.9 + k * 0.06, () => {
                if (this.dead) return;
                this.w.fx.leaves(at);
                audio.play('swing', { pos: at, pitch: 0.6, vol: 0.6 });
                if (pl.pos.distanceTo(at) < 1.4) pl.damage(22, at, { knock: 5 });
              });
            }
          }
        }
        if (this.actT > 2) this.end(1.4);
        break;
      }
      case 'spores':
        if (!this.hit) {
          this.hit = true;
          audio.play('spore', { pos: this.pos, vol: 1 });
          for (let i = 0; i < (this.phase === 2 ? 5 : 3); i++) {
            const t = pl.pos.clone().add(new THREE.Vector3(rand(-4, 4), 0, rand(-4, 4)));
            this.w.projectiles.enemyShot('spore', this.pos.clone().setY(5), t, 9, 10, { lob: true, size: 0.35 });
          }
        }
        if (this.actT > 1.6) this.end(1.6);
        break;
    }
    if (this.phase === 1 && this.hp < this.maxHp * 0.5) this.phase = 2;
  }
  end(cd: number) {
    this.start('chase');
    this.nextT = cd;
  }
  update(dt: number) {
    if (this.dead) {
      this.deadT += dt;
      this.root.scale.setScalar(Math.max(0.01, 1 - this.deadT * 0.25));
      if (this.deadT > 4) this.removed = true;
      return;
    }
    super.update(dt);
  }
}

// =====================================================================
class Warden extends Boss {
  private armorT = 0;
  private hit = false;
  private shocks = 0;
  constructor(w: World) {
    super(w, 'warden', bossDef({ name: 'Warden', hp: 2000, radius: 1.2, blood: 0x80c8ff }), {
      skin: 0x98b0c8, hair: 0xe0f0ff, hairStyle: 'none', top: 0x6a8098, topStyle: 'uniform', under: 0x3a4a5a, bottom: 0x4a5a6a, shoes: 0x1a1a2a,
      zombie: true, eyeGlow: true, eye: 0x80e0ff, glowColor: 0xa0f0ff, mutations: ['armor', 'ice', 'crystalSpine', 'claws'], band: false, height: 2.6, build: 1.4, hat: 'captain', hatColor: 0x3a4a5a, seed: 506,
    });
  }
  begin() {
    super.begin();
    this.w.game.ui.hud.toast('Its ice armor shrugs off damage — use fire, explosives, or lure it over the heat vents!', 'info');
  }
  damage(amount: number, dir: THREE.Vector3, o: DamageOpts = {}) {
    if (o.fire || o.explosive) this.breakArmor();
    if (o.shock) {
      this.shocks++;
      if (this.shocks >= 6) {
        this.shocks = 0;
        this.breakArmor();
      }
    }
    const k = this.armorT > 0 ? 1.25 : 0.25;
    if (this.armorT <= 0 && Math.random() < 0.3) audio.play('metal', { pos: this.pos, vol: 0.5, pitch: 1.4 });
    return super.damage(amount * k, dir, o);
  }
  breakArmor() {
    if (this.armorT <= 0) {
      audio.play('glass', { pos: this.pos, vol: 1 });
      this.w.fx.shard(this.pos.clone().setY(2), 30);
      this.w.game.ui.hud.toast('Armor shattered!', 'info');
    }
    this.armorT = 8;
  }
  think(dt: number) {
    const pl = this.pl;
    const p = this.anim!.p;
    this.armorT = Math.max(0, this.armorT - dt);
    this.model!.material.emissive.setRGB(this.armorT > 0 ? 0.4 : 0, this.armorT > 0 ? 0.15 : 0, 0);
    // heat vents (fire hazards) melt armor
    for (const h of this.w.hazards.list) if (h.kind === 'fire' && h.pos.distanceTo(this.pos) < 2.2) this.breakArmor();
    if (this.phase === 1 && this.hp < this.maxHp * 0.5) {
      this.phase = 2;
      this.summon('shatterer', 3);
      audio.play('bossRoar', { pos: this.pos, pitch: 0.5 });
    }
    p.attack = -1;
    p.pose = null;
    p.poseW = 0;
    switch (this.action) {
      case 'idle':
      case 'chase':
        this.face(pl.pos, dt, 3);
        if (this.dist > 3.8) this.moveToward(pl.pos, 1.9, dt);
        if (this.nextT <= 0) {
          this.hit = false;
          const d = this.dist;
          const r = Math.random();
          if (d < 4.2 && r < 0.5) this.start('swipe');
          else if (d < 8 && r < 0.7) this.start('breathWind');
          else if (r < 0.5) this.start('spikes');
          else this.start('stomp');
        }
        break;
      case 'swipe':
        this.face(pl.pos, dt, 6);
        p.attack = clamp01(this.actT / 1.3);
        if (!this.hit && this.actT > 0.55) {
          this.hit = true;
          audio.play('swing', { pos: this.pos, pitch: 0.45 });
          const to = pl.pos.clone().sub(this.pos).setY(0);
          const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          if (to.length() < 4.6 && to.normalize().dot(f) > 0.1) pl.damage(32, this.pos, { knock: 9, freeze: 2 });
        }
        if (this.actT > 1.3) this.end(1);
        break;
      case 'breathWind':
        this.face(pl.pos, dt, 4);
        if (this.actT < 0.05) audio.play('freeze', { pos: this.pos });
        if (this.actT > 0.7) {
          this.start('breath');
          this.cone(10, 0.8, 22, 2.4, 'frost', { freeze: 2.5 });
          audio.play('freeze', { pos: this.pos, vol: 1 });
        }
        break;
      case 'breath':
        this.face(pl.pos, dt, 1.0);
        if (this.actT > 2.4) this.end(1.2);
        break;
      case 'spikes':
        p.pose = 'arms';
        p.poseW = 1;
        if (!this.hit && this.actT > 0.5) {
          this.hit = true;
          const dir = pl.pos.clone().sub(this.pos).setY(0).normalize();
          const rows = this.phase === 2 ? [-0.3, 0, 0.3] : [0];
          for (const off of rows) {
            const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), off);
            for (let k = 1; k <= 7; k++) {
              const at = this.pos.clone().addScaledVector(d, 1.5 + k * 1.8);
              this.slamAt(at, 1.1, 24, 0.7 + k * 0.12, 'ice', 4);
            }
          }
        }
        if (this.actT > 2) this.end(1.2);
        break;
      case 'stomp':
        p.pose = 'shock';
        p.poseW = clamp01(this.actT * 2);
        if (!this.hit && this.actT > 0.8) {
          this.hit = true;
          audio.play('stomp', { pos: this.pos, vol: 1.2 });
          this.w.game.rig.addShake(0.8);
          this.shockwave(this.pos, 8, 18, 1.0, 0xa0e8ff);
          for (let i = 0; i < (this.phase === 2 ? 8 : 5); i++) {
            const at = pl.pos.clone().add(new THREE.Vector3(rand(-5, 5), 0, rand(-5, 5)));
            if (i === 0) at.copy(pl.pos);
            this.slamAt(at, 1.3, 26, 1.2 + i * 0.15, 'ice', 3);
          }
        }
        if (this.actT > 1.6) this.end(1.4);
        break;
    }
  }
  end(cd: number) {
    this.start('chase');
    this.nextT = cd;
  }
}

// =====================================================================
class Apex extends Boss {
  private hit = false;
  private chargeDir = new THREE.Vector3();
  private summoned = 0;
  private clones: Enemy[] = [];
  constructor(w: World) {
    super(w, 'apex', bossDef({ name: 'Apex', hp: 3200, radius: 1.4, blood: 0xff5050 }), {
      skin: 0xa88a90, hair: 0x101010, hairStyle: 'none', top: 0x1a1a24, topStyle: 'rags', bottom: 0x1a1a24, shoes: 0x0a0a0a,
      zombie: true, eyeGlow: true, eye: 0xff2a4a, glowColor: 0x60e0ff, mutations: ['tumor', 'hydraulic', 'brain', 'crystalSpine', 'claws', 'bigHead'], band: false, height: 3.0, build: 1.35, seed: 507,
    });
    this.weak = [{ bone: 'head', off: new THREE.Vector3(0, 0.22, 0), r: 0.4, mult: 2 }, { bone: 'chest', off: new THREE.Vector3(0, 0.12, -0.22), r: 0.4, mult: 2.5 }];
  }
  think(dt: number) {
    const pl = this.pl;
    const p = this.anim!.p;
    const k = this.hp / this.maxHp;
    const newPhase = k > 0.66 ? 1 : k > 0.33 ? 2 : 3;
    if (newPhase !== this.phase) {
      this.phase = newPhase;
      audio.play('bossRoar', { pos: this.pos, pitch: 0.55 + this.phase * 0.1 });
      this.w.game.director.emit('apex:phase' + this.phase);
      this.summon(this.phase === 2 ? 'phantom' : 'frostbitten', 3);
      this.summon('runner', 2);
    }
    this.clones = this.clones.filter((c) => !c.dead);
    p.attack = -1;
    p.pose = null;
    p.poseW = 0;
    p.throwT = -1;
    switch (this.action) {
      case 'idle':
      case 'chase':
        this.face(pl.pos, dt, 3.5);
        if (this.dist > 4) this.moveToward(pl.pos, 2.6 + this.phase * 0.3, dt);
        if (this.nextT <= 0) {
          this.hit = false;
          const d = this.dist;
          const pool: string[] = ['slam'];
          if (d < 4.8) pool.push('swipe', 'swipe');
          if (d > 6) pool.push('chargeWind', 'throw');
          if (this.phase >= 2) pool.push('blink', 'orbs');
          if (this.phase >= 3) pool.push('spikes', 'spikes');
          this.start(pick(pool));
        }
        break;
      case 'swipe':
        this.face(pl.pos, dt, 6);
        p.attack = clamp01(this.actT / 1.2);
        p.attackType = Math.floor(this.w.time) % 3;
        if (!this.hit && this.actT > 0.5) {
          this.hit = true;
          audio.play('swing', { pos: this.pos, pitch: 0.4 });
          const to = pl.pos.clone().sub(this.pos).setY(0);
          const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          if (to.length() < 5 && to.normalize().dot(f) > 0.1) pl.damage(32, this.pos, { knock: 10 });
        }
        if (this.actT > 1.2) this.end(0.8);
        break;
      case 'slam':
        this.face(pl.pos, dt, 5);
        p.pose = 'arms';
        p.poseW = clamp01(this.actT * 2);
        if (!this.hit && this.actT > 0.9) {
          this.hit = true;
          const at = this.pos.clone().add(new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(3));
          audio.play('stomp', { pos: at, vol: 1.3 });
          this.w.fx.explosion(at.clone().setY(0.3), 'fire', 3);
          this.w.game.rig.addShake(0.9);
          if (pl.pos.distanceTo(at) < 3) pl.damage(34, at, { knock: 9 });
          this.shockwave(at, 14, 22, 1.2, 0x60e0ff);
        }
        if (this.actT > 1.6) this.end(1.0);
        break;
      case 'chargeWind':
        this.face(pl.pos, dt, 5);
        p.pose = 'fight';
        p.poseW = 1;
        if (this.actT < 0.05) audio.play('bossRoar', { pos: this.pos, pitch: 0.8 });
        if (this.actT > 0.8) {
          this.chargeDir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
          this.start('charge');
        }
        break;
      case 'charge': {
        this.vel.copy(this.chargeDir).multiplyScalar(12);
        if (!this.hit && this.dist < this.radius + 1.4) {
          this.hit = true;
          pl.damage(36, this.pos, { knock: 14 });
        }
        const ahead = this.pos.clone().addScaledVector(this.chargeDir, this.radius + 0.5);
        const [gx, gz] = this.w.level.cellOf(ahead.x, ahead.z);
        if (this.w.level.isSolidCell(gx, gz) || this.actT > 1.5) {
          if (this.w.level.isSolidCell(gx, gz)) {
            this.w.fx.explosion(ahead.setY(1), 'fire', 2);
            this.w.game.rig.addShake(0.8);
            this.vel.set(0, 0, 0);
            this.start('stunned');
          } else this.end(0.8);
        }
        break;
      }
      case 'stunned':
        p.pose = 'despair';
        p.poseW = 1;
        this.vulnerable = 1.5;
        if (this.actT > 2.2) {
          this.vulnerable = 1;
          this.end(0.4);
        }
        break;
      case 'throw':
        this.face(pl.pos, dt, 5);
        p.throwT = clamp01(this.actT / 1.0);
        if (!this.hit && this.actT > 0.6) {
          this.hit = true;
          for (let i = 0; i < 4; i++) {
            const t = i === 0 ? pl.pos.clone() : pl.pos.clone().add(new THREE.Vector3(rand(-3, 3), 0, rand(-3, 3)));
            this.w.fx.telegraph(t, 1.8, 1.0);
            this.w.projectiles.enemyShot('rock', this.pos.clone().setY(4), t, 13, 22, { lob: true });
          }
        }
        if (this.actT > 1.0) this.end(0.8);
        break;
      case 'blink':
        if (this.actT < 0.05) {
          this.w.fx.explosion(this.pos.clone().setY(1.5), 'psychic', 2);
          audio.play('teleport', { pos: this.pos });
          const a = Math.random() * Math.PI * 2;
          const tgt = pl.pos.clone().add(new THREE.Vector3(Math.cos(a) * 4.5, 0, Math.sin(a) * 4.5));
          const [gx, gz] = this.w.level.cellOf(tgt.x, tgt.z);
          if (this.w.level.walkable(gx, gz)) this.pos.copy(tgt);
          this.w.fx.explosion(this.pos.clone().setY(1.5), 'psychic', 2);
        }
        if (this.actT > 0.4) this.start('swipe');
        break;
      case 'orbs':
        p.pose = 'arms';
        p.poseW = 1;
        if (!this.hit && this.actT > 0.6) {
          this.hit = true;
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const from = this.pos.clone().add(new THREE.Vector3(Math.cos(a) * 1.6, 3.5, Math.sin(a) * 1.6));
            this.w.projectiles.enemyShot('orb', from, from.clone().add(new THREE.Vector3(Math.cos(a), 0.2, Math.sin(a))), 5, 12, { lob: false, homing: 1.5, size: 0.28 });
          }
        }
        if (this.actT > 1.2) this.end(1.0);
        break;
      case 'spikes':
        p.pose = 'shock';
        p.poseW = 1;
        if (!this.hit && this.actT > 0.5) {
          this.hit = true;
          const dir = pl.pos.clone().sub(this.pos).setY(0).normalize();
          for (const off of [-0.4, 0, 0.4]) {
            const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), off);
            for (let k = 1; k <= 8; k++) this.slamAt(this.pos.clone().addScaledVector(d, 1.5 + k * 1.8), 1.1, 24, 0.7 + k * 0.1, 'ice', 4);
          }
        }
        if (this.actT > 2) this.end(1.0);
        break;
    }
  }
  end(cd: number) {
    this.start('chase');
    this.nextT = cd * (1.15 - this.phase * 0.12);
  }
}

export function makeBoss(w: World, kind: BossKind): Boss {
  switch (kind) {
    case 'gridlock':
      return new Gridlock(w);
    case 'foreman':
      return new Foreman(w);
    case 'subjectZero':
      return new SubjectZero(w);
    case 'leviathan':
      return new Leviathan(w);
    case 'motherBloom':
      return new MotherBloom(w);
    case 'warden':
      return new Warden(w);
    case 'apex':
      return new Apex(w);
  }
}
export { angleDiff, T };
