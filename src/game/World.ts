import * as THREE from 'three';
import type { Game } from './Game';
import { buildLevel, BuiltLevel } from '../world/LevelBuilder';
import { Level, CELL, T } from '../world/Level';
import type { Theme } from '../world/Themes';
import type { EnemyKind, ItemId, LevelDef, BossKind } from '../world/LevelDef';
import { Player } from '../entities/Player';
import { Enemy, DamageOpts } from '../entities/Enemy';
import { Boss, makeBoss } from '../entities/Bosses';
import { NPC } from '../entities/NPC';
import { Door } from '../entities/Door';
import { Hazards } from '../entities/Hazards';
import { Projectiles } from '../entities/Projectiles';
import {
  Interactable, ItemPickup, Crate, GloomyPickup, LogPickup, EvidencePickup, SavePoint, Switch, Terminal, Exit, Station, Breakable,
} from '../entities/Interactables';
import { Exterior } from '../gfx/Exterior';
import { FX } from './FX';
import { audio } from '../core/Audio';
import { rand, randInt, clamp } from '../core/math';
import type { CastId } from '../chars/Cast';
import { ENEMIES } from '../entities/EnemyDefs';

export interface HitResult {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  dist: number;
  enemy: Enemy | null;
  head: boolean;
  mult: number;
  breakable: Breakable | null;
}

let dynId = 0;

export class World {
  built: BuiltLevel;
  level: Level;
  theme: Theme;
  player: Player;
  enemies: Enemy[] = [];
  npcs: NPC[] = [];
  interactables: Interactable[] = [];
  doors: Door[] = [];
  hazards: Hazards;
  projectiles: Projectiles;
  breakables: Breakable[] = [];
  exterior: Exterior | null = null;
  time = 0;
  disposed = false;
  triggers: { id: string; pos: THREE.Vector3; r: number; once: boolean; fired: boolean; inside: boolean }[] = [];
  private timers: { t: number; fn: () => void }[] = [];
  private tickers: ((dt: number) => boolean)[] = [];
  boss: Boss | null = null;
  bosses: Boss[] = [];
  promptTarget: { kind: 'int'; it: Interactable } | { kind: 'door'; d: Door } | { kind: 'npc'; n: NPC } | { kind: 'takedown'; e: Enemy } | null = null;
  safe: boolean;
  private sanityT = 0;

  constructor(public game: Game, public def: LevelDef, spawnId: string) {
    this.built = buildLevel(def);
    this.level = this.built.level;
    this.theme = this.built.theme;
    this.safe = def.id === 'hub' || def.id === 'ballroom';
    game.scene.add(this.level.group);
    this.hazards = new Hazards(this);
    this.projectiles = new Projectiles(this);
    // exterior
    const t = this.theme;
    if (t.open || t.sea || t.beam) {
      const beamPos = def.beam ? new THREE.Vector3(def.beam[0] * CELL, 0, def.beam[1] * CELL) : new THREE.Vector3(this.level.w * CELL * 0.5, 0, this.level.h * CELL * 0.5);
      if (def.id !== 'hub' && def.id !== 'core') beamPos.add(new THREE.Vector3(260, 0, -320));
      beamPos.y = def.id === 'hub' ? 6 : def.id === 'core' ? 2 : -14;
      this.exterior = new Exterior({ sea: t.sea, beam: t.beam, vessels: t.vessels, beamPos, seaLevel: -14, fogColor: new THREE.Color(t.fog[0]), fogDensity: t.fog[1] * 0.5 });
      this.exterior.onLightning = () => {
        if (this.player.pos.distanceTo(beamPos) < 400 && Math.random() < 0.5) audio.play('lightning', { vol: 0.25, rev: 1 });
      };
      game.scene.add(this.exterior.group);
    }
    // player
    this.player = new Player(this);
    game.scene.add(this.player.root);
    const sp = this.level.spawns[spawnId] ?? this.level.spawns.start ?? { pos: this.level.center(1, 1), yaw: 0 };
    this.player.place(sp.pos, sp.yaw);
    // entities
    this.spawnAll();
  }

  get scene() {
    return this.game.scene;
  }
  get fx(): FX {
    return this.game.fx;
  }
  key(id: string) {
    return `${this.def.id}:${id}`;
  }

  private spawnAll() {
    const st = this.game.state;
    for (const b of this.built.doors) this.doors.push(new Door(this, b.gx, b.gy, b.axis, b.pos));
    for (const s of this.built.spawns) {
      const spec = s.spec;
      const autoId = `${s.gx},${s.gy}`;
      switch (spec.t) {
        case 'enemy': {
          const id = spec.id ?? autoId;
          if (st.killed.includes(this.key(id))) break;
          const e = new Enemy(this, spec.kind, id, undefined, { elite: spec.elite });
          e.place(s.pos.clone().add(new THREE.Vector3(rand(-0.5, 0.5), 0, rand(-0.5, 0.5))), spec.yaw !== undefined ? (spec.yaw * Math.PI) / 180 : rand(0, Math.PI * 2));
          this.scene.add(e.root);
          if (spec.dormant || ENEMIES[spec.kind].ambush) {
            e.setDormant(!!ENEMIES[spec.kind].ambush);
            if (spec.wake) e.wakeFlag = spec.wake;
          }
          this.enemies.push(e);
          break;
        }
        case 'boss': {
          if (this.game.flag(`boss_${spec.kind}_dead`)) break;
          const b = makeBoss(this, spec.kind);
          b.place(s.pos, s.yaw);
          this.scene.add(b.root);
          this.enemies.push(b);
          this.bosses.push(b);
          break;
        }
        case 'item': {
          const id = spec.id ?? autoId;
          if (st.picked.includes(this.key(id))) break;
          if (['pistol', 'shotgun', 'arc', 'axe'].includes(spec.item) && st.weapons[spec.item as 'pistol']) break;
          this.interactables.push(new ItemPickup(this, s.pos, id, spec.item, spec.n ?? defaultCount(spec.item)));
          break;
        }
        case 'crate': {
          const id = spec.id ?? autoId;
          if (st.picked.includes(this.key(id))) break;
          this.interactables.push(new Crate(this, s.pos, s.yaw, id, spec.loot));
          break;
        }
        case 'gloomy':
          if (!st.gloomy.includes(spec.id)) this.interactables.push(new GloomyPickup(this, s.pos, spec.id));
          break;
        case 'log':
          if (!st.logs.includes(spec.id)) this.interactables.push(new LogPickup(this, s.pos, spec.id));
          break;
        case 'evidence':
          if (!st.evidence.includes(spec.id)) this.interactables.push(new EvidencePickup(this, s.pos, spec.id, spec.flag));
          break;
        case 'save':
          this.interactables.push(new SavePoint(this, s.pos, s.yaw, spec.id));
          break;
        case 'npc': {
          if (!st.alive[spec.who] && spec.who !== 'captain') break;
          const n = new NPC(this, spec.who);
          n.place(s.pos, s.yaw);
          n.setPose(spec.pose ?? null);
          n.talkId = spec.talk ?? null;
          this.scene.add(n.root);
          this.npcs.push(n);
          if (spec.follow) {
            n.follow(true);
            n.arm(spec.who === 'isaac' ? 'shotgun' : spec.who === 'dexter' ? 'arc' : 'pistol');
          }
          break;
        }
        case 'trigger':
          this.triggers.push({ id: spec.id, pos: s.pos, r: (spec.r ?? 1) * CELL * 0.75, once: spec.once !== false, fired: !!this.game.flag('trig_' + this.key(spec.id)), inside: false });
          break;
        case 'switch':
          this.interactables.push(new Switch(this, s.pos.clone().add(this.wallOffset(s.gx, s.gy)), s.yaw, spec));
          break;
        case 'terminal':
          this.interactables.push(new Terminal(this, s.pos.clone().add(this.wallOffset(s.gx, s.gy, 0.6)), s.yaw, spec));
          break;
        case 'hazard':
          this.hazards.add(spec.kind, s.pos, s.yaw + ((spec.dir ?? 0) * Math.PI) / 180, { period: spec.period, offset: spec.offset, flag: spec.flag, len: spec.len });
          break;
        case 'exit':
          this.interactables.push(new Exit(this, s.pos.clone().add(this.wallOffset(s.gx, s.gy, 0.3)), spec.yaw !== undefined ? (spec.yaw * Math.PI) / 180 : s.yaw, spec));
          break;
        case 'station':
          this.interactables.push(new Station(this, s.pos.clone().add(this.wallOffset(s.gx, s.gy, 0.7)), s.yaw, spec.kind));
          break;
        case 'door': {
          const gx = s.gx, gy = s.gy;
          this.level.terrain[this.level.idx(gx, gy)] = T.Door;
          this.level.setSolid(gx, gy, true, true);
          const axis = this.level.isOpaqueCell(gx - 1, gy) || this.level.isOpaqueCell(gx + 1, gy) ? 'x' : 'z';
          this.doors.push(new Door(this, gx, gy, axis, s.pos, spec.key, spec.flag, spec.msg, spec.id ?? `${gx},${gy}`));
          break;
        }
      }
    }
  }

  private wallOffset(gx: number, gy: number, k = 0.45) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.level.isOpaqueCell(gx + dx, gy + dz)) return new THREE.Vector3(dx * (CELL / 2 - k), 0, dz * (CELL / 2 - k));
    return new THREE.Vector3();
  }

  npc(id: CastId) {
    return this.npcs.find((n) => n.id === id);
  }

  rollLoot(): [ItemId, number][] {
    const st = this.game.state;
    const sc = 1 + (st.skills.scavenger ?? 0) * 0.35;
    const out: [ItemId, number][] = [];
    const add = (id: ItemId, n: number) => out.push([id, Math.max(1, Math.round(n * sc))]);
    const r = Math.random();
    if (st.weapons.pistol && r < 0.6) add('pistolAmmo', randInt(8, 14));
    if (st.weapons.shotgun && Math.random() < 0.4) add('shells', randInt(3, 6));
    if (st.weapons.arc && Math.random() < 0.4) add('cells', randInt(10, 20));
    if (Math.random() < 0.45) add('scrap', randInt(2, 4));
    if (Math.random() < 0.35) add(Math.random() < 0.5 ? 'cloth' : 'chem', randInt(1, 2));
    if (Math.random() < 0.3) add(st.hp < st.maxHp * 0.6 ? 'medkit' : 'bandage', 1);
    if (Math.random() < 0.2) add('flare', 1);
    if (Math.random() < 0.15) add('pills', 1);
    if (!out.length) add('credits', randInt(20, 50));
    return out;
  }

  noise(pos: THREE.Vector3, r: number, kind: string) {
    for (const e of this.enemies) {
      if (e.dead || e.state === 'dormant' || e.isBoss) continue;
      const d = e.pos.distanceTo(pos);
      if (d < r * e.def.hearing) {
        // loud noises reveal the player's position; others just draw attention
        if (kind === 'shot' || kind === 'explosion') e.alertTo(this.player.pos, d < r * 0.5);
        else e.alertTo(pos, false);
      }
    }
  }

  pushAt(pos: THREE.Vector3) {
    return this.hazards.pushAt(pos);
  }

  nearestFlare(pos: THREE.Vector3, r: number) {
    let best: { pos: THREE.Vector3 } | null = null;
    let bd = r;
    for (const f of this.projectiles.flares) {
      const d = f.pos.distanceTo(pos);
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }

  hitscan(o: THREE.Vector3, dir: THREE.Vector3, maxDist: number): HitResult {
    let best = maxDist;
    let normal = dir.clone().negate();
    // walls
    const flat = Math.hypot(dir.x, dir.z);
    if (flat > 1e-4) {
      const end = o.clone().addScaledVector(dir, maxDist);
      const t2 = this.level.rayGrid(o.x, o.z, end.x, end.z, 'opaque');
      if (t2 !== Infinity) {
        const t3 = t2 / flat;
        const y = o.y + dir.y * t3;
        const wallH = this.theme.wallH;
        if (t3 < best && y < wallH + 20) best = t3;
      }
    }
    // floor / ceiling
    if (dir.y < -1e-4) {
      const tf = -o.y / dir.y;
      if (tf < best) {
        best = tf;
        normal = new THREE.Vector3(0, 1, 0);
      }
    } else if (dir.y > 1e-4 && this.theme.ceiling) {
      const tc = (this.theme.wallH - o.y) / dir.y;
      if (tc < best) best = tc;
    }
    // props
    const tb = this.level.rayBoxes(o, dir, best);
    if (tb < best) best = tb;
    // enemies
    let hitE: Enemy | null = null;
    let head = false;
    let mult = 1;
    const oc = new THREE.Vector3();
    for (const e of this.enemies) {
      if (e.dead || e.dormantHidden) continue;
      if (e.pos.distanceTo(o) > best + 4) continue;
      for (const s of e.hitSpheres()) {
        oc.copy(o).sub(s.c);
        const b = oc.dot(dir);
        const c = oc.lengthSq() - s.r * s.r;
        const disc = b * b - c;
        if (disc < 0) continue;
        const t = -b - Math.sqrt(disc);
        if (t > 0 && t < best) {
          best = t;
          hitE = e;
          head = s.head;
          mult = s.mult;
        }
      }
    }
    let br: Breakable | null = null;
    for (const b of this.breakables) {
      if (b.hp <= 0) continue;
      oc.copy(o).sub(b.pos);
      const bb = oc.dot(dir);
      const c = oc.lengthSq() - b.r * b.r;
      const disc = bb * bb - c;
      if (disc < 0) continue;
      const t = -bb - Math.sqrt(disc);
      if (t > 0 && t < best) {
        best = t;
        br = b;
        hitE = null;
      }
    }
    const res: HitResult = { point: o.clone().addScaledVector(dir, best), normal, dist: best, enemy: hitE, head, mult, breakable: br };
    return res;
  }

  explode(pos: THREE.Vector3, r: number, dmg: number, kind: 'fire' | 'toxic' | 'ice' | 'spore', source: Enemy | null) {
    this.fx.explosion(pos, kind, r);
    audio.play(kind === 'ice' ? 'glass' : kind === 'fire' ? 'explosion' : 'spore', { pos, vol: 1.1, rev: 0.6 });
    if (kind !== 'fire') audio.play('explosion', { pos, vol: 0.5, pitch: 1.4 });
    const dpl = this.player.pos.distanceTo(pos);
    this.game.rig.addShake(clamp(1.2 - dpl / 15, 0, 1));
    if (dmg > 0) {
      if (dpl < r + 0.4) this.player.damage(dmg * (1 - (dpl / (r + 0.4)) * 0.6), pos, { knock: 8, freeze: kind === 'ice' ? 2.5 : 0, poison: kind === 'toxic' ? 3 : 0, sanity: kind === 'spore' ? 8 : 0 });
      for (const e of this.enemies) {
        if (e.dead || e === source || e.dormantHidden) continue;
        const d = e.pos.distanceTo(pos);
        if (d < r + e.radius) e.damage((source ? dmg * 1.5 : dmg) * (1 - (d / (r + e.radius)) * 0.5), e.pos.clone().sub(pos).normalize(), { explosive: true, fire: kind === 'fire', knock: 10, stagger: 2, from: pos });
      }
      for (const b of this.breakables) if (b.hp > 0 && b.pos.distanceTo(pos) < r + b.r) b.hit(dmg);
    }
    if (kind === 'toxic' || kind === 'spore') {
      this.fx.cloud(pos, kind === 'toxic' ? 0x90d030 : 0xc0e040, r * 0.8, 4);
      this.hazards.addTemp(kind === 'toxic' ? 'acid' : 'spore', pos.clone().setY(0), 4);
    }
    this.noise(pos, 30, 'explosion');
  }

  spawnEnemy(kind: EnemyKind, pos: THREE.Vector3, o: { rise?: boolean; elite?: boolean } = {}) {
    const e = new Enemy(this, kind, 'dyn' + dynId++, undefined, { elite: o.elite });
    e.place(pos, rand(0, Math.PI * 2));
    this.scene.add(e.root);
    this.enemies.push(e);
    if (o.rise) {
      e.state = 'rise';
      this.fx.gore(pos.clone().setY(0.2), 0x2a2a20, 8);
    } else e.alertTo(this.player.pos, true);
    return e;
  }

  onEnemyAlert(e: Enemy) {
    for (const o of this.enemies) {
      if (o === e || o.dead || o.state === 'chase' || o.state === 'dormant' || o.isBoss) continue;
      if (o.pos.distanceTo(e.pos) < 9 && this.level.los(o.pos, e.pos)) o.alertTo(this.player.pos, true);
    }
  }

  onEnemyKilled(e: Enemy, o: DamageOpts) {
    const st = this.game.state;
    st.kills++;
    if (!e.id.startsWith('dyn') && !e.isBoss) st.killed.push(this.key(e.id));
    const bonus = o.headshot ? 2 : 1;
    this.game.addViewers(Math.round((e.def.credits * 3 + (o.headshot ? 20 : 0)) * (e.isBoss ? 10 : 1)));
    if (Math.random() < 0.55 || e.isBoss) this.game.tip(Math.round(e.def.credits * bonus * (e.elite ? 2 : 1)), o.headshot ? 'HEADSHOT' : o.melee ? 'BRUTAL' : null);
    if (!e.noLoot && !e.isBoss) {
      for (const [id, chance, a, b] of e.def.loot) {
        if (Math.random() < chance * (1 + (st.skills.scavenger ?? 0) * 0.25)) {
          if (id === 'pistolAmmo' && !st.weapons.pistol) continue;
          if (id === 'shells' && !st.weapons.shotgun) continue;
          if (id === 'cells' && !st.weapons.arc) continue;
          const p = e.pos.clone().add(new THREE.Vector3(rand(-0.6, 0.6), 0, rand(-0.6, 0.6)));
          this.interactables.push(new ItemPickup(this, p, 'drop' + dynId++, id, randInt(a, b)));
          break;
        }
      }
    }
    this.game.director.emit('kill:' + e.kind);
    this.game.director.emit('killed:' + e.id);
  }

  onBossDefeated(b: Boss) {
    this.game.setFlag(`boss_${b.bossKind}_dead`);
    this.game.onBossDefeated(b);
  }

  startBoss(kind: BossKind) {
    const b = this.bosses.find((x) => x.bossKind === kind && !x.dead);
    if (!b) return null;
    this.boss = b;
    b.begin();
    return b;
  }

  after(t: number, fn: () => void) {
    this.timers.push({ t, fn });
  }
  addTicker(fn: (dt: number) => boolean) {
    this.tickers.push(fn);
  }

  aliveEnemies(radius?: number) {
    return this.enemies.filter((e) => !e.dead && !e.isBoss && (radius === undefined || e.pos.distanceTo(this.player.pos) < radius));
  }

  // ------------------------------------------------------------
  update(dt: number) {
    this.time += dt;
    const g = this.game;
    const pl = this.player;
    // timers
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      t.t -= dt;
      if (t.t <= 0) {
        this.timers.splice(i, 1);
        t.fn();
      }
    }
    this.tickers = this.tickers.filter((f) => f(dt));
    pl.update(dt);
    for (const d of this.doors) d.update(dt);
    for (const e of this.enemies) {
      if (e.isBoss || e.pos.distanceTo(pl.pos) < 65 || e.state === 'chase') e.update(dt);
    }
    for (const e of this.enemies) if (e.removed) e.dispose();
    this.enemies = this.enemies.filter((e) => !e.removed);
    for (const n of this.npcs) n.update(dt);
    for (const it of this.interactables) it.update(dt, this.time);
    this.interactables = this.interactables.filter((i) => !i.removed);
    this.hazards.update(dt);
    this.projectiles.update(dt);
    if (this.built.waterMat) this.built.waterMat.uniforms.uTime.value = this.time;
    // triggers
    for (const t of this.triggers) {
      const inside = Math.hypot(pl.pos.x - t.pos.x, pl.pos.z - t.pos.z) < t.r;
      if (inside && !t.inside && !(t.once && t.fired)) {
        t.fired = true;
        if (t.once) g.setFlag('trig_' + this.key(t.id));
        g.director.emit('trigger:' + t.id);
      }
      t.inside = inside;
    }
    // explored cells (map)
    const [cx, cz] = this.level.cellOf(pl.pos.x, pl.pos.z);
    for (let dz = -3; dz <= 3; dz++)
      for (let dx = -3; dx <= 3; dx++) if (this.level.inside(cx + dx, cz + dz)) this.level.explored[this.level.idx(cx + dx, cz + dz)] = 1;
    // sanity
    this.updateSanity(dt);
    // combat intensity
    let threat = 0;
    for (const e of this.enemies) if (!e.dead && (e.state === 'chase' || e.state === 'attack') && e.pos.distanceTo(pl.pos) < 28) threat += e.isBoss ? 3 : e.radius > 0.6 ? 1.5 : 1;
    g.threat = threat;
    // prompts
    this.updatePrompt();
  }

  private updateSanity(dt: number) {
    const st = this.game.state;
    const pl = this.player;
    if (this.game.cinematic) return;
    let delta = 0;
    if (this.safe) delta += 3;
    else {
      // light check
      let lit = false;
      for (const l of this.level.lights) {
        if (l.on === false) continue;
        const d = l.pos.distanceTo(pl.pos);
        if (d < l.range * 0.55) {
          lit = true;
          break;
        }
      }
      if (this.theme.open) lit = true;
      if (!lit && !pl.flashlight) delta -= 2.4;
      else if (lit) delta += 0.6;
      // nearby threats
      let n = 0;
      for (const e of this.enemies) if (!e.dead && e.state === 'chase' && e.pos.distanceTo(pl.pos) < 10) n++;
      delta -= Math.min(3, n * 0.7);
      if (pl.state.hp < pl.state.maxHp * 0.3) delta -= 0.6;
    }
    if (delta < 0) delta *= 1 - (st.skills.iron ?? 0) * 0.3;
    st.sanity = clamp(st.sanity + delta * dt, 0, 100);
    this.sanityT += dt;
    if (st.sanity <= 0 && !pl.dead && this.sanityT > 5) {
      this.sanityT = 0;
      this.game.sanityBlackout();
    }
  }

  private updatePrompt() {
    const pl = this.player;
    const g = this.game;
    let best: World['promptTarget'] = null;
    let bestScore = -Infinity;
    if (!pl.dead && pl.control && !g.cinematic) {
      const fwd = new THREE.Vector3(Math.sin(pl.yaw), 0, Math.cos(pl.yaw));
      const camF = g.rig.forward(new THREE.Vector3());
      const consider = (pos: THREE.Vector3, r: number, pri: number, make: () => World['promptTarget']) => {
        const to = pos.clone().sub(pl.pos).setY(0);
        const d = to.length();
        if (d > r) return;
        const facing = d > 0.3 ? Math.max(to.clone().normalize().dot(fwd), to.clone().normalize().dot(camF)) : 1;
        if (facing < -0.3 && d > 1.2) return;
        const score = pri * 10 - d * 2 + facing * 2;
        if (score > bestScore) {
          bestScore = score;
          best = make();
        }
      };
      for (const it of this.interactables) {
        if (!it.enabled) continue;
        const label = it.label();
        if (!label) continue;
        consider(it.pos, it.radius, it.priority, () => ({ kind: 'int', it }));
      }
      for (const d of this.doors) if (d.locked) consider(d.pos, 2.7, 1, () => ({ kind: 'door', d }));
      for (const n of this.npcs) if (n.interactable && g.director.canTalk(n)) consider(n.pos, 2.6, 2, () => ({ kind: 'npc', n }));
      for (const e of this.enemies) {
        if (e.dead || e.isBoss || e.dormantHidden) continue;
        if (!['idle', 'wander', 'investigate', 'lure', 'dormant'].includes(e.state)) continue;
        const d = e.pos.distanceTo(pl.pos);
        if (d > 1.9 || e.radius > 0.6) continue;
        const ef = new THREE.Vector3(Math.sin(e.yaw), 0, Math.cos(e.yaw));
        const toPl = pl.pos.clone().sub(e.pos).setY(0).normalize();
        if (ef.dot(toPl) < -0.2 || e.state === 'dormant') consider(e.pos, 1.9, 5, () => ({ kind: 'takedown', e }));
      }
    }
    this.promptTarget = best;
    const t = this.promptTarget as World['promptTarget'];
    let text = '';
    if (t) {
      if (t.kind === 'int') text = t.it.label();
      else if (t.kind === 'door') text = t.d.label();
      else if (t.kind === 'npc') text = `Talk to ${g.director.npcName(t.n)}`;
      else text = 'Takedown';
    }
    g.ui.hud.prompt(text);
    if (t && g.input.pressed('interact') && !g.ui.anyOverlay()) {
      g.input.consume('interact');
      if (t.kind === 'int') void t.it.interact();
      else if (t.kind === 'door') t.d.tryUnlock();
      else if (t.kind === 'npc') void g.director.talk(t.n);
      else this.takedown(t.e);
    }
  }

  private takedown(e: Enemy) {
    const pl = this.player;
    pl.busy = 0.8;
    pl.yaw = Math.atan2(e.pos.x - pl.pos.x, e.pos.z - pl.pos.z);
    pl.anim.p.attack = 0.3;
    audio.play('takedown', { pos: e.pos });
    this.game.hitstop(0.12);
    this.game.rig.addShake(0.4);
    this.fx.gore(e.pos.clone().setY(1.4), e.def.blood, 14);
    e.hp = 0;
    e.die({ melee: true, silent: !!e.def.explode });
    this.game.tip(15, 'SILENT TAKEDOWN');
  }

  dispose() {
    this.disposed = true;
    const s = this.scene;
    s.remove(this.level.group);
    this.level.dispose();
    if (this.exterior) {
      s.remove(this.exterior.group);
      this.exterior.dispose();
    }
    s.remove(this.player.root);
    for (const e of this.enemies) e.dispose();
    for (const n of this.npcs) n.dispose();
    for (const i of this.interactables) i.remove();
    for (const d of this.doors) s.remove(d.panel);
    this.hazards.clear();
    this.projectiles.clear();
    this.fx.clear();
  }
}

function defaultCount(id: ItemId) {
  switch (id) {
    case 'pistolAmmo':
      return 12;
    case 'shells':
      return 5;
    case 'cells':
      return 20;
    case 'scrap':
      return 3;
    case 'chem':
    case 'cloth':
      return 2;
    case 'credits':
      return 50;
    default:
      return 1;
  }
}
