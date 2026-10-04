import * as THREE from 'three';
import type { World } from '../game/World';
import type { EntSpec, ItemId } from '../world/LevelDef';
import { ITEMS } from '../game/Items';
import { itemModel, compact } from './Models';
import { PM, part, buildProp } from '../world/Props';
import { audio } from '../core/Audio';
import { CELL } from '../world/Level';
import { LOGS, EVIDENCE, GLOOMY_QUOTES } from '../story/Lore';
import { pick, rand } from '../core/math';

export abstract class Interactable {
  pos: THREE.Vector3;
  radius = 2.1;
  obj: THREE.Object3D | null = null;
  enabled = true;
  removed = false;
  priority = 0;
  id: string;
  constructor(public w: World, pos: THREE.Vector3, id: string) {
    this.pos = pos.clone();
    this.id = id;
  }
  abstract label(): string;
  abstract interact(): void | Promise<void>;
  update(dt: number, t: number) {}
  remove() {
    this.removed = true;
    this.enabled = false;
    if (this.obj) this.w.scene.remove(this.obj);
  }
  get game() {
    return this.w.game;
  }
  get state() {
    return this.w.game.state;
  }
}

const ring = new THREE.RingGeometry(0.28, 0.36, 24).rotateX(-Math.PI / 2);

function glowRing(color: number) {
  const m = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.5), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.y = 0.04;
  return m;
}

export function giveItem(w: World, id: ItemId, n: number, quiet = false) {
  const st = w.game.state;
  const def = ITEMS[id];
  if (def.cat === 'weapon') {
    const wid = id as 'pistol' | 'shotgun' | 'arc' | 'axe';
    const first = !st.weapons[wid];
    st.weapons[wid] = true;
    if (first) {
      const wpn = { pistol: 12, shotgun: 6, arc: 40, axe: 0 }[wid];
      st.mag[wid] = wpn;
      w.game.ui.hud.banner(`NEW WEAPON — ${def.name.toUpperCase()}`, def.desc);
      w.player.equip(wid);
      audio.play('levelUp', { vol: 0.5 });
    }
    return;
  }
  if (id === 'credits') {
    st.credits += n;
    if (!quiet) w.game.ui.hud.toast(`+${n} Gloom Credits`, 'credit');
    audio.play('coin', { vol: 0.5 });
    return;
  }
  const max = def.max ?? 99;
  const before = st.inv[id] ?? 0;
  const after = Math.min(max, before + n);
  st.inv[id] = after;
  if (!quiet) w.game.ui.hud.toast(after > before ? `+${after - before} ${def.name}` : `${def.name} full`, def.cat === 'key' ? 'key' : 'item', def.icon);
  audio.play('pickup', { vol: 0.5, pitch: def.cat === 'key' ? 0.8 : 1 });
}

// ----------------------------------------------------------------
export class ItemPickup extends Interactable {
  private t0 = Math.random() * 6;
  constructor(w: World, pos: THREE.Vector3, id: string, public item: ItemId, public n: number) {
    super(w, pos, id);
    const g = new THREE.Group();
    const m = itemModel(item);
    m.name = 'model';
    g.add(m);
    g.add(glowRing(ITEMS[item].color));
    g.position.copy(pos);
    this.obj = g;
    w.scene.add(g);
    this.priority = ITEMS[item].cat === 'key' || ITEMS[item].cat === 'weapon' ? 2 : 1;
  }
  label() {
    const d = ITEMS[this.item];
    return `Take ${d.name}${this.n > 1 && d.cat !== 'weapon' ? ` ×${this.n}` : ''}`;
  }
  interact() {
    giveItem(this.w, this.item, this.n);
    this.w.player.reach();
    this.state.picked.push(this.w.key(this.id));
    this.remove();
    this.w.game.director.emit('pickup:' + this.item);
  }
  update(dt: number, t: number) {
    const m = this.obj?.getObjectByName('model');
    if (m) {
      m.rotation.y = t * 1.4 + this.t0;
      m.position.y = 0.35 + Math.sin(t * 2 + this.t0) * 0.06;
    }
  }
}

// ----------------------------------------------------------------
export class Crate extends Interactable {
  private lid: THREE.Object3D;
  private open = false;
  private openT = 0;
  constructor(w: World, pos: THREE.Vector3, yaw: number, id: string, public loot: [ItemId, number][] | undefined) {
    super(w, pos, id);
    const P = PM();
    const g = new THREE.Group();
    const base = compact(new THREE.Group().add(
      part(new THREE.BoxGeometry(1, 1, 1), P.metal, 0x22262e, [0, 0.3, 0], [1.1, 0.6, 0.7]),
      part(new THREE.BoxGeometry(1, 1, 1), P.glowV, 0x3ef0ff, [0, 0.42, 0.355], [0.8, 0.04, 0.01]),
      part(new THREE.BoxGeometry(1, 1, 1), P.glowV, 0x3ef0ff, [0, 0.3, 0.356], [0.12, 0.12, 0.01]),
    ));
    g.add(base);
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.6, -0.35);
    const lid = compact(new THREE.Group().add(part(new THREE.BoxGeometry(1, 1, 1), P.metal, 0x2a3038, [0, 0.06, 0.35], [1.14, 0.12, 0.74])));
    lidPivot.add(lid);
    g.add(lidPivot);
    this.lid = lidPivot;
    g.position.copy(pos);
    g.rotation.y = yaw;
    this.obj = g;
    w.scene.add(g);
    w.level.circles.push({ x: pos.x, z: pos.z, r: 0.5 });
  }
  label() {
    return 'Open GloomTech Supply Crate';
  }
  interact() {
    if (this.open) return;
    this.open = true;
    this.enabled = false;
    this.w.player.reach();
    audio.play('door', { pos: this.pos, vol: 0.5, pitch: 1.5 });
    this.state.picked.push(this.w.key(this.id));
    const loot = this.loot ?? this.w.rollLoot();
    setTimeout(() => {
      for (const [id, n] of loot) giveItem(this.w, id, n);
      this.w.fx.sparks(this.pos.clone().setY(0.8), new THREE.Vector3(0, 1, 0), 0x3ef0ff, 12);
    }, 350);
  }
  update(dt: number) {
    if (this.open && this.openT < 1) {
      this.openT = Math.min(1, this.openT + dt * 3);
      this.lid.rotation.x = -this.openT * 1.9;
    }
  }
}

// ----------------------------------------------------------------
export class GloomyPickup extends Interactable {
  private t0 = Math.random() * 6;
  constructor(w: World, pos: THREE.Vector3, id: string) {
    super(w, pos, id);
    const g = new THREE.Group();
    const m = itemModel('gloomy');
    m.name = 'model';
    m.scale.setScalar(1.6);
    g.add(m);
    g.position.copy(pos);
    this.obj = g;
    w.scene.add(g);
    this.light = { pos: pos.clone().setY(0.8), color: new THREE.Color(0x60a0ff), intensity: 6, range: 5 };
    w.level.lights.push(this.light);
  }
  private light: any;
  label() {
    return 'Commune with Gloomy';
  }
  interact() {
    const st = this.state;
    st.gloomy.push(this.id);
    this.w.fx.gloomy(this.pos);
    audio.play('chime', { vol: 0.5 });
    st.sanity = Math.min(100, st.sanity + 20);
    giveItem(this.w, 'credits', 25, true);
    const n = st.gloomy.length;
    this.w.game.ui.hud.toast(`Gloomy found (${n}/30) · +20 Sanity · +25 credits`, 'gloomy');
    this.w.game.ui.hud.whisper(`Gloomy: “${pick(GLOOMY_QUOTES)}”`);
    if (n % 5 === 0) {
      st.insight += 1;
      this.w.game.ui.hud.banner('INSIGHT GAINED', 'Gloomy’s glow sharpens your mind. Spend Insight in the GloomBand › Status tab.');
      audio.play('levelUp', { vol: 0.5 });
    }
    const i = this.w.level.lights.indexOf(this.light);
    if (i >= 0) this.w.level.lights.splice(i, 1);
    this.remove();
  }
  update(dt: number, t: number) {
    const m = this.obj?.getObjectByName('model');
    if (m) {
      m.position.y = Math.sin(t * 1.5 + this.t0) * 0.04;
      m.rotation.y = Math.sin(t * 0.7 + this.t0) * 0.4;
    }
    if (Math.random() < dt * 3) this.w.fx.add.emit({ pos: this.pos.clone().setY(0.5), vel: { x: 0, y: 0.5, z: 0 }, spread: 0.4, life: 1.2, size: 0.05, color: 0x60c0ff, alpha: 1 });
  }
}

// ----------------------------------------------------------------
export class LogPickup extends Interactable {
  private t0 = Math.random() * 6;
  constructor(w: World, pos: THREE.Vector3, id: string) {
    super(w, pos, id);
    const g = new THREE.Group();
    const m = itemModel('log');
    m.name = 'model';
    m.scale.setScalar(1.5);
    g.add(m);
    g.add(glowRing(0xff3040));
    g.position.copy(pos);
    this.obj = g;
    w.scene.add(g);
    this.priority = 2;
  }
  label() {
    return `Play Recording — “${LOGS[this.id]?.title ?? 'Audio Log'}”`;
  }
  async interact() {
    const st = this.state;
    if (!st.logs.includes(this.id)) st.logs.push(this.id);
    this.remove();
    await this.w.game.ui.showLog(this.id);
    this.w.game.director.emit('log:' + this.id);
  }
  update(dt: number, t: number) {
    const m = this.obj?.getObjectByName('model');
    if (m) m.position.y = 0.3 + Math.sin(t * 2 + this.t0) * 0.05;
  }
}

// ----------------------------------------------------------------
export class EvidencePickup extends Interactable {
  constructor(w: World, pos: THREE.Vector3, id: string, public flag?: string) {
    super(w, pos, id);
    const g = new THREE.Group();
    const m = itemModel('evidence');
    m.name = 'model';
    g.add(m);
    g.add(glowRing(0xff5fd2));
    g.position.copy(pos);
    this.obj = g;
    w.scene.add(g);
    this.priority = 3;
  }
  label() {
    return `Examine — ${EVIDENCE[this.id]?.name ?? 'Evidence'}`;
  }
  async interact() {
    this.remove();
    await this.w.game.addEvidence(this.id);
    if (this.flag) this.w.game.setFlag(this.flag);
  }
  update(dt: number, t: number) {
    const m = this.obj?.getObjectByName('model');
    if (m) {
      m.position.y = 0.6 + Math.sin(t * 3) * 0.08;
      m.rotation.y = t * 2;
    }
  }
}

// ----------------------------------------------------------------
export class SavePoint extends Interactable {
  constructor(w: World, pos: THREE.Vector3, yaw: number, id: string) {
    super(w, pos, id);
    const shrine = new THREE.Group();
    const P = PM();
    const term = compact(new THREE.Group().add(
      part(new THREE.BoxGeometry(1, 1, 1), P.metal, 0x1a1e26, [0, 0.6, -0.3], [0.7, 1.2, 0.35]),
      part(new THREE.BoxGeometry(1, 1, 1), P.glowSoft, 0x30c8ff, [0, 0.85, -0.12], [0.55, 0.4, 0.02]),
      part(new THREE.BoxGeometry(1, 1, 1), P.glowV, 0x3ef0ff, [0, 0.05, -0.3], [0.8, 0.1, 0.45]),
    ));
    shrine.add(term);
    const gl = buildProp('gloomyCluster', 7, { n: 5, scale: 1.6 });
    gl.obj.position.set(0.6, 0, 0.1);
    shrine.add(gl.obj);
    const gl2 = buildProp('gloomyCluster', 9, { n: 3, scale: 1.2 });
    gl2.obj.position.set(-0.55, 0, 0.2);
    shrine.add(gl2.obj);
    shrine.position.copy(pos);
    shrine.rotation.y = yaw;
    this.obj = shrine;
    w.scene.add(shrine);
    w.level.lights.push({ pos: pos.clone().setY(1.2), color: new THREE.Color(0x40a8ff), intensity: 10, range: 8 });
    w.level.circles.push({ x: pos.x, z: pos.z, r: 0.5 });
    this.priority = 1;
  }
  label() {
    return 'Rest at Gloomy Shrine (Save)';
  }
  async interact() {
    const st = this.state;
    st.sanity = Math.max(st.sanity, 75);
    this.w.player.reach();
    audio.play('chime', { vol: 0.5 });
    this.w.fx.gloomy(this.pos);
    this.w.game.saveAt(this.id);
  }
}

// ----------------------------------------------------------------
export class Switch extends Interactable {
  private handle: THREE.Object3D;
  private on = false;
  private anim = 0;
  constructor(w: World, pos: THREE.Vector3, yaw: number, public spec: Extract<EntSpec, { t: 'switch' }>) {
    super(w, pos, spec.id);
    const P = PM();
    const g = new THREE.Group();
    const model = spec.model ?? 'lever';
    // place against wall: offset backwards
    const base = new THREE.Group();
    if (model === 'valve') {
      base.add(part(new THREE.CylinderGeometry(1, 1, 1, 10), P.rust, 0x6a5040, [0, 1.0, -0.2], [0.12, 2, 0.12]));
      base.add(part(new THREE.CylinderGeometry(1, 1, 1, 10), P.rust, 0x6a5040, [0, 1.1, -0.05], [0.15, 0.3, 0.15], [Math.PI / 2, 0, 0]));
    } else if (model === 'fusebox' || model === 'panel') {
      base.add(part(new THREE.BoxGeometry(1, 1, 1), P.metal, 0x3a4048, [0, 1.3, -0.15], [0.9, 1.1, 0.3]));
      base.add(part(new THREE.BoxGeometry(1, 1, 1), P.hazard, 0xffffff, [0, 1.92, -0.15], [0.9, 0.12, 0.3]));
      for (let i = 0; i < 3; i++) base.add(part(new THREE.CylinderGeometry(1, 1, 1, 8), P.paint, 0x1a1a1a, [-0.25 + i * 0.25, 1.2, 0.01], [0.07, 0.04, 0.07], [Math.PI / 2, 0, 0]));
    } else {
      base.add(part(new THREE.BoxGeometry(1, 1, 1), P.metal, 0x3a4048, [0, 1.1, -0.1], [0.5, 0.8, 0.2]));
    }
    g.add(compact(base));
    const handle = new THREE.Group();
    if (model === 'valve') {
      handle.add(compact(new THREE.Group().add(part(new THREE.TorusGeometry(1, 0.15, 6, 14), P.metal, 0xd08040, [0, 0, 0], [0.32, 0.32, 1]), part(new THREE.BoxGeometry(1, 1, 1), P.metal, 0xd08040, [0, 0, 0], [0.6, 0.05, 0.05]))));
      handle.position.set(0, 1.1, 0.15);
      handle.visible = !spec.needs;
    } else if (model === 'fusebox' || model === 'panel') {
      handle.add(compact(new THREE.Group().add(part(new THREE.BoxGeometry(1, 1, 1), P.glowV, 0xff3030, [0, 0, 0], [0.5, 0.1, 0.04]))));
      handle.position.set(0, 1.6, 0.02);
    } else {
      handle.add(compact(new THREE.Group().add(part(new THREE.CylinderGeometry(1, 1, 1, 8), P.metal, 0x8a8a8a, [0, 0.2, 0], [0.04, 0.4, 0.04]), part(new THREE.SphereGeometry(1, 8, 6), P.paint, 0xd02020, [0, 0.42, 0], [0.07, 0.07, 0.07]))));
      handle.position.set(0, 1.1, 0.02);
      handle.rotation.x = 0.6;
    }
    g.add(handle);
    this.handle = handle;
    g.position.copy(pos);
    g.rotation.y = yaw;
    this.obj = g;
    w.scene.add(g);
    this.on = w.game.flag(spec.flag);
    if (this.on) this.setOnVisual();
    this.priority = 2;
  }
  private setOnVisual() {
    const m = this.spec.model ?? 'lever';
    if (m === 'valve') this.handle.visible = true;
    else if (m === 'fusebox' || m === 'panel') {
      this.handle.traverse((o) => {
        const mm = o as THREE.Mesh;
        if (mm.isMesh) mm.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 3, 0.8) });
      });
    } else this.handle.rotation.x = -0.6;
  }
  label() {
    if (this.on) return '';
    const s = this.spec;
    if (s.needs && (this.state.inv[s.needs] ?? 0) < (s.needsN ?? 1)) {
      const have = this.state.inv[s.needs] ?? 0;
      return `${s.label ?? 'Use'} — requires ${ITEMS[s.needs].name}${s.needsN ? ` (${have}/${s.needsN})` : ''}`;
    }
    return s.label ?? 'Pull Lever';
  }
  interact() {
    if (this.on) return;
    const s = this.spec;
    const st = this.state;
    if (s.needs) {
      const need = s.needsN ?? 1;
      if ((st.inv[s.needs] ?? 0) < need) {
        audio.play('doorLocked', { pos: this.pos });
        this.w.game.ui.hud.toast(s.msg ?? `Requires ${ITEMS[s.needs].name}`, 'warn');
        return;
      }
      st.inv[s.needs] = (st.inv[s.needs] ?? 0) - need;
    }
    this.on = true;
    this.enabled = false;
    this.w.player.reach();
    audio.play(s.model === 'valve' ? 'steam' : 'clank', { pos: this.pos, vol: 0.8 });
    audio.play('uiConfirm', { vol: 0.4 });
    this.setOnVisual();
    this.w.game.setFlag(s.flag);
    this.w.game.director.emit('switch:' + s.id);
  }
  update(dt: number) {
    if (this.on && (this.spec.model ?? 'lever') === 'valve') this.handle.rotation.z += dt * (this.anim < 2 ? 4 : 0) ;
    if (this.on) this.anim += dt;
  }
}

// ----------------------------------------------------------------
export class Terminal extends Interactable {
  private screen: THREE.Mesh;
  done = false;
  constructor(w: World, pos: THREE.Vector3, yaw: number, public spec: Extract<EntSpec, { t: 'terminal' }>) {
    super(w, pos, spec.id);
    const p = buildProp('console', 3, { screen: 0xff3050 });
    const g = new THREE.Group();
    g.add(p.obj);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 0.5) }));
    scr.position.set(0, 1.5, -0.24);
    scr.rotation.x = -0.15;
    g.add(scr);
    this.screen = scr;
    g.position.copy(pos);
    g.rotation.y = yaw;
    this.obj = g;
    w.scene.add(g);
    const yc = Math.cos(yaw), ys = Math.sin(yaw);
    void yc;
    void ys;
    w.level.addBox({ minX: pos.x - 0.7, maxX: pos.x + 0.7, minZ: pos.z - 0.45, maxZ: pos.z + 0.45, h: 1.2 });
    this.done = w.game.flag(spec.flag);
    if (this.done) (this.screen.material as THREE.MeshBasicMaterial).color.setRGB(0.3, 2.5, 1);
    this.priority = 2;
  }
  label() {
    return this.done ? 'Read Terminal' : `${this.spec.label ?? 'Hack Terminal'} (GloomOS breach)`;
  }
  async interact() {
    const g = this.w.game;
    if (this.done) {
      if (this.spec.text) await g.ui.showTerminal(this.spec.label ?? 'TERMINAL', this.spec.text);
      return;
    }
    const ok = await g.ui.hack(this.spec.diff ?? 1);
    if (ok) {
      this.done = true;
      (this.screen.material as THREE.MeshBasicMaterial).color.setRGB(0.3, 2.5, 1);
      g.setFlag(this.spec.flag);
      g.addViewers(40);
      g.director.emit('terminal:' + this.spec.id);
      if (this.spec.text) await g.ui.showTerminal(this.spec.label ?? 'TERMINAL', this.spec.text);
    }
  }
}

// ----------------------------------------------------------------
export class Exit extends Interactable {
  constructor(w: World, pos: THREE.Vector3, yaw: number, public spec: Extract<EntSpec, { t: 'exit' }>) {
    super(w, pos, 'exit:' + spec.to + ':' + spec.spawn);
    this.radius = 2.6;
    const P = PM();
    const g = new THREE.Group();
    g.add(compact(new THREE.Group().add(
      part(new THREE.BoxGeometry(1, 1, 1), P.metal, 0x2a2e36, [-1.3, 1.8, 0], [0.4, 3.6, 0.5]),
      part(new THREE.BoxGeometry(1, 1, 1), P.metal, 0x2a2e36, [1.3, 1.8, 0], [0.4, 3.6, 0.5]),
      part(new THREE.BoxGeometry(1, 1, 1), P.metal, 0x2a2e36, [0, 3.7, 0], [3, 0.4, 0.5]),
      part(new THREE.BoxGeometry(1, 1, 1), P.glowSoft, 0x101820, [0, 1.75, -0.05], [2.2, 3.5, 0.1]),
      part(new THREE.BoxGeometry(1, 1, 1), P.glowV, 0x3ef0ff, [0, 3.5, 0.26], [2.6, 0.06, 0.02]),
    )));
    const sign = buildProp('sign', 1, { text: spec.label.toUpperCase(), w: 2.6, h: 0.5, y: 4.3, light: false, color: '#3ef0ff', bright: 2 });
    g.add(sign.obj);
    g.position.copy(pos);
    g.rotation.y = yaw;
    this.obj = g;
    w.scene.add(g);
    this.priority = 1;
  }
  label() {
    if (this.spec.flag && !this.w.game.flag(this.spec.flag)) return `${this.spec.label} — Sealed`;
    return `Go to ${this.spec.label}`;
  }
  interact() {
    if (this.spec.flag && !this.w.game.flag(this.spec.flag)) {
      audio.play('doorLocked', { pos: this.pos });
      this.w.game.ui.hud.toast('The gangway is sealed. The Captain decides when you leave.', 'warn');
      return;
    }
    this.w.game.travel(this.spec.to, this.spec.spawn);
  }
}

// ----------------------------------------------------------------
export class Station extends Interactable {
  constructor(w: World, pos: THREE.Vector3, yaw: number, public kind: 'workbench' | 'vendor' | 'medbay' | 'bed' | 'board') {
    super(w, pos, 'station:' + kind);
    const propKind = { workbench: 'workbench', vendor: 'vendor', medbay: 'medbed', bed: 'bed', board: 'console' }[kind];
    const p = buildProp(propKind, 5, {});
    p.obj.position.copy(pos);
    p.obj.rotation.y = yaw;
    this.obj = p.obj;
    w.scene.add(p.obj);
    for (const b of p.boxes ?? []) {
      const quarter = Math.abs(Math.sin(yaw)) > 0.7;
      const ww = quarter ? b.d : b.w, dd = quarter ? b.w : b.d;
      w.level.addBox({ minX: pos.x - ww / 2, maxX: pos.x + ww / 2, minZ: pos.z - dd / 2, maxZ: pos.z + dd / 2, h: b.h });
    }
    for (const l of p.lights ?? []) w.level.lights.push({ pos: pos.clone().add(new THREE.Vector3(l.x, l.y, l.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)), color: new THREE.Color(l.color), intensity: l.intensity, range: l.range });
    this.priority = 1;
  }
  label() {
    switch (this.kind) {
      case 'workbench':
        return 'Use Workbench (Upgrade & Craft)';
      case 'vendor':
        return 'Browse GloomMart™';
      case 'medbay':
        return 'Use Medbay';
      case 'bed':
        return this.w.game.director.canSleep() ? 'Sleep (Advance)' : 'Rest (Save)';
      case 'board':
        return 'Check Voyage Board';
    }
  }
  async interact() {
    const g = this.w.game;
    switch (this.kind) {
      case 'workbench':
        await g.ui.openWorkbench();
        break;
      case 'vendor':
        await g.ui.openVendor();
        break;
      case 'medbay': {
        const st = this.state;
        if (st.hp >= st.maxHp && st.sanity >= 100) {
          g.ui.hud.toast('You are in good shape.', 'info');
          return;
        }
        st.hp = st.maxHp;
        st.sanity = 100;
        audio.play('heal', { vol: 0.6 });
        this.w.fx.healSparkle(this.w.player.pos);
        g.ui.hud.toast('Fully treated at the Medbay', 'heal');
        break;
      }
      case 'bed':
        await g.director.sleep();
        break;
      case 'board':
        await g.ui.openGloomBand('missions');
        break;
    }
  }
}

// ----------------------------------------------------------------
/** Breakable targets: boss weak points, vine barriers, etc. */
export class Breakable {
  hp: number;
  maxHp: number;
  constructor(public pos: THREE.Vector3, public r: number, hp: number, public onHit: (dmg: number) => void, public onBreak: () => void, public h = 2) {
    this.hp = this.maxHp = hp;
  }
  hit(dmg: number) {
    if (this.hp <= 0) return;
    this.hp -= dmg;
    this.onHit(dmg);
    if (this.hp <= 0) this.onBreak();
  }
}

export function cellOffsetForWall(w: World, gx: number, gy: number): THREE.Vector3 {
  // shift objects toward an adjacent wall so they sit against it
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dz] of dirs) if (w.level.isOpaqueCell(gx + dx, gy + dz)) return new THREE.Vector3(dx * (CELL / 2 - 0.45), 0, dz * (CELL / 2 - 0.45));
  return new THREE.Vector3();
}
export { rand };
