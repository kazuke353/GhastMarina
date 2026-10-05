import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { World } from '../game/World';
import { NPC } from '../entities/NPC';
import { CAST, CastId, SURVIVORS } from '../chars/Cast';
import { audio } from '../core/Audio';
import { unlockChapter } from '../game/State';
import { CHAPTER_DEFS, ChapterDef } from './Chapters';
import { HUB_TALK, GENERIC_TALK, TalkLine } from './Talk';
import { CHAPTERS, EVIDENCE } from './Lore';
import type { ChoiceOpt } from '../ui/Dialogue';
import { BOSS_INFO, type Boss } from '../entities/Bosses';
import { runTrial, TrialResult } from './TrialEngine';
import { clamp, lerp } from '../core/math';
import { EvidencePickup, ItemPickup } from '../entities/Interactables';
import type { ItemId } from '../world/LevelDef';
import type { SongId } from '../core/Music';

export class Abort extends Error {}

const ORDER = ['prologue', 'ch1', 'ch2', 'trial1', 'ch3', 'trial2', 'ch4', 'trial3', 'ch5', 'trial4', 'ch6', 'trial5', 'ch7', 'trial6', 'ch8', 'end'];
export const COMPANION: Record<string, CastId> = { ch2: 'hana', ch3: 'isaac', ch4: 'elise', ch5: 'dexter', ch6: 'luna', ch7: 'aria' };

/** A script scope: every await re-checks that the scope is still valid, otherwise throws Abort. */
export class Script {
  constructor(public d: Director, private run: number, private lvl: number | null) {}
  get g() {
    return this.d.game;
  }
  get w(): World {
    const w = this.d.game.world;
    if (!w) throw new Abort();
    return w;
  }
  check() {
    if (this.d.runToken !== this.run || (this.lvl !== null && this.d.levelToken !== this.lvl)) throw new Abort();
  }
  async guard<T>(p: Promise<T>): Promise<T> {
    this.check();
    const r = await p;
    this.check();
    return r;
  }
  say(who: string, text: string, opts: string | { style?: string; title?: string; pose?: string; cam?: boolean; auto?: number } = {}) {
    return this.guard(this.d.say(who, text, typeof opts === 'string' ? { pose: opts } : opts));
  }
  async lines(ls: TalkLine[]) {
    for (const l of ls) await this.say(l[0], l[1], { pose: l[2] });
  }
  choose(opts: (string | ChoiceOpt)[]) {
    return this.guard(this.d.choose(opts));
  }
  wait(s: number) {
    return this.guard(this.d.waitGame(s));
  }
  waitFlag(f: string) {
    return this.guard(this.d.waitFlag(f));
  }
  waitEvent(e: string) {
    return this.guard(this.d.waitEvent(e));
  }
  /**
   * Resolve with the first of `evs` to fire. A 'flag:x' entry whose flag is already set can't fire again, so it is
   * ignored (callers re-check state in their loop); if nothing is left to wait for, yield briefly instead of spinning.
   */
  waitAny(evs: string[]): Promise<string> {
    const pending = evs.filter((e) => !(e.startsWith('flag:') && this.g.flag(e.slice(5))));
    if (!pending.length) return this.guard(this.d.waitGame(0.25).then(() => evs[0]));
    return this.guard(Promise.race(pending.map((e) => this.d.waitEvent(e).then(() => e))));
  }
  waitUntil(pred: () => boolean) {
    return this.guard(this.d.waitUntil(pred));
  }
  /** Run `fn` in a sibling scope (same lifetime as this one) the first time `ev` fires. */
  when(ev: string, fn: (S: Script) => Promise<void>) {
    this.check();
    const S2 = new Script(this.d, this.run, this.lvl);
    this.d
      .waitEvent(ev)
      .then(() => {
        S2.check();
        return fn(S2);
      })
      .catch((e) => {
        if (!(e instanceof Abort)) console.error('[director]', e);
      });
  }
  fade(to: number, dur: number) {
    return this.guard(this.g.fade(to, dur));
  }
  async step(id: string, fn: () => Promise<void>) {
    this.check();
    if (this.g.flag('step_' + id)) return;
    await fn();
    this.check();
    this.g.setFlag('step_' + id);
  }
  done(id: string) {
    return this.g.flag('step_' + id);
  }
  cinematic<T>(fn: () => Promise<T>) {
    return this.guard(this.d.cinematic(fn));
  }
  captain(text: string) {
    return this.guard(this.d.say('captain', text, { style: 'captain', cam: false }));
  }
  band(text: string) {
    return this.guard(this.d.say('band', text, { cam: false }));
  }
  thought(text: string) {
    return this.guard(this.d.say('noah', text, { style: 'thought', title: '(thinking)', cam: false }));
  }
  bark(who: CastId | 'captain', text: string, dur = 4) {
    this.d.bark(who, text, dur);
  }
  objective(t: string) {
    this.d.objective(t);
  }
  message(from: string, text: string) {
    this.d.message(from, text);
  }
  journal(text: string) {
    this.d.journal(text);
  }
  hint(text: string, dur = 6) {
    this.g.ui.hud.hint(text, dur);
  }
  evidence(id: string) {
    return this.guard(this.g.addEvidence(id));
  }
  blackout(evidence: string | null, wake: string) {
    return this.guard(this.d.blackout(evidence, wake));
  }
  boss(kind: string) {
    return this.guard(this.d.bossIntro(kind as any));
  }
  trial(id: string) {
    return this.guard(runTrial(this.d, id));
  }
  async load(level: string, spawn: string, opts: { pos?: [number, number]; yaw?: number; fade?: boolean } = {}) {
    this.check();
    await this.g.loadLevel(level, spawn, opts);
  }
  shot(pos: THREE.Vector3, look: THREE.Vector3, opts: { fov?: number; blend?: number; drift?: THREE.Vector3; shake?: number } = {}) {
    this.g.rig.setCine({ pos, look, fov: opts.fov, blend: opts.blend, drift: opts.drift, shakeAmt: opts.shake });
  }
  follow() {
    this.g.rig.setCine(null);
  }
  npc(id: CastId) {
    return this.d.game.world?.npc(id);
  }
}

export class Director {
  runToken = 0;
  levelToken = 0;
  private listeners = new Map<string, Set<() => void>>();
  private talkPartner: NPC | null = null;
  private cineDepth = 0;
  private titleT = 0;
  autoCam = true;
  private sleeping = false;
  private gameTimers: { t: number; r: () => void }[] = [];
  private conds: { f: () => boolean; r: () => void }[] = [];
  /** True while the current run was started from the title / chapter select rather than flowing from a previous chapter. */
  freshRun = false;

  constructor(public game: Game) {}

  // ---------------- events ----------------
  emit(ev: string) {
    const l = this.listeners.get(ev);
    if (!l) return;
    this.listeners.delete(ev);
    for (const f of l) f();
  }
  waitEvent(ev: string): Promise<void> {
    return new Promise((res) => {
      let s = this.listeners.get(ev);
      if (!s) this.listeners.set(ev, (s = new Set()));
      s.add(res);
    });
  }
  waitFlag(f: string): Promise<void> {
    if (this.game.flag(f)) return Promise.resolve();
    return this.waitEvent('flag:' + f);
  }
  waitGame(sec: number): Promise<void> {
    return new Promise((r) => this.gameTimers.push({ t: sec, r }));
  }
  waitUntil(f: () => boolean): Promise<void> {
    return new Promise((r) => this.conds.push({ f, r }));
  }
  update(dt: number) {
    for (let i = this.conds.length - 1; i >= 0; i--) {
      const c = this.conds[i];
      let ok = false;
      try {
        ok = c.f();
      } catch {
        ok = true;
      }
      if (ok) {
        this.conds.splice(i, 1);
        c.r();
      }
    }
    for (let i = this.gameTimers.length - 1; i >= 0; i--) {
      const t = this.gameTimers[i];
      t.t -= dt;
      if (t.t <= 0) {
        this.gameTimers.splice(i, 1);
        t.r();
      }
    }
  }

  abort() {
    this.runToken++;
    this.levelToken++;
    this.listeners.clear();
    for (const t of this.gameTimers) t.r();
    this.gameTimers = [];
    for (const c of this.conds) c.r();
    this.conds = [];
    this.cineDepth = 0;
    this.game.cinematic = false;
    this.game.setLetterbox(false);
    this.game.ui.dlg.hide();
    this.game.ui.trial.show(false);
    this.game.ui.trial.clear();
  }

  scope(levelScoped: boolean) {
    return new Script(this, this.runToken, levelScoped ? this.levelToken : null);
  }
  spawn(fn: (S: Script) => Promise<void>, levelScoped: boolean) {
    const S = this.scope(levelScoped);
    fn(S).catch((e) => {
      if (!(e instanceof Abort)) console.error('[director]', e);
    });
  }

  // ---------------- flow ----------------
  async runFrom(chapter: string) {
    this.abort();
    this.game.state.chapter = chapter;
    this.freshRun = true;
    unlockChapter(chapter);
    this.prepareChapterState(chapter);
    this.spawn(async (S) => {
      const def = CHAPTER_DEFS[chapter];
      await def.start(S);
    }, false);
  }
  async resume() {
    this.abort();
    this.freshRun = true;
    const st = this.game.state;
    const def = CHAPTER_DEFS[st.chapter];
    if (!def) return;
    if (def.resume) {
      this.spawn(async (S) => def.resume!(S), false);
      return;
    }
    this.game.ui.hud.show(true);
    await this.game.loadLevel(st.level, st.spawn, { pos: st.pos ?? undefined, yaw: st.yaw });
  }
  completeChapter(next: string) {
    const st = this.game.state;
    this.freshRun = false;
    st.chapter = next;
    unlockChapter(next);
    this.game.save();
    this.abort();
    this.spawn(async (S) => {
      const def = CHAPTER_DEFS[next];
      if (def) await def.start(S);
    }, false);
  }
  /** When jumping straight into a later chapter (chapter select), give a sensible loadout and cast state. */
  private prepareChapterState(ch: string) {
    const st = this.game.state;
    const i = ORDER.indexOf(ch);
    const has = (c: string) => i >= ORDER.indexOf(c);
    if (i <= 1) return;
    const deaths: [string, CastId][] = [['ch3', 'leo'], ['ch4', 'grant'], ['ch5', 'jade'], ['ch6', 'dexter'], ['ch7', 'fiona']];
    for (const [c, who] of deaths) if (has(c)) st.alive[who] = false;
    st.flags.step_ch1_wake = true;
    st.flags.step_ch1_deck = true;
    st.flags.step_ch1_night = true;
    if (has('ch2')) st.weapons.pistol = has('ch2') && i > ORDER.indexOf('ch2');
    if (has('trial1')) {
      st.weapons.pistol = true;
      st.mag.pistol = 12;
      st.inv.pistolAmmo = (st.inv.pistolAmmo ?? 0) + 24;
    }
    if (has('trial2')) {
      st.weapons.shotgun = true;
      st.weapons.axe = true;
      st.mag.shotgun = 6;
      st.inv.shells = (st.inv.shells ?? 0) + 10;
      st.equipped = 'axe';
    }
    if (has('trial3')) {
      st.weapons.arc = true;
      st.mag.arc = 40;
      st.inv.cells = (st.inv.cells ?? 0) + 30;
    }
    st.inv.medkit = Math.max(st.inv.medkit ?? 0, 1 + Math.floor(i / 4));
    st.inv.bandage = Math.max(st.inv.bandage ?? 0, 2);
    st.inv.flare = Math.max(st.inv.flare ?? 0, Math.floor(i / 3));
    st.insight = Math.max(st.insight, Math.floor(i / 2));
    const opens: [string, string][] = [['ch2', 'open_city'], ['ch3', 'open_ind'], ['ch4', 'open_lab'], ['ch5', 'open_aqua'], ['ch6', 'open_bio'], ['ch7', 'open_cryo']];
    for (const [c, f] of opens) if (has(c)) st.flags[f] = true;
    // evidence that would have been collected on the way to a trial
    for (const [id, e] of Object.entries(EVIDENCE)) {
      const tn = parseInt(ch.replace('trial', ''), 10);
      if (ch.startsWith('trial') && e.trial === tn && !st.evidence.includes(id)) st.evidence.push(id);
    }
  }

  get chapterDef(): ChapterDef | undefined {
    return CHAPTER_DEFS[this.game.state.chapter];
  }

  onLevelLoaded(w: World, titleBackdrop = false) {
    this.levelToken++;
    this.talkPartner = null;
    const st = this.game.state;
    const def = this.chapterDef;
    // persistent world setup
    if (w.def.id === 'hub') this.populateHub(w);
    if (titleBackdrop) return;
    const comp = COMPANION[st.chapter];
    if (comp && w.def.id !== 'hub' && w.def.id !== 'ballroom' && st.alive[comp] && !this.game.flag('nocomp_' + st.chapter)) {
      const n = new NPC(w, comp);
      const p = w.player.pos.clone().add(new THREE.Vector3(1.2, 0, -1.2));
      n.place(p, w.player.yaw);
      w.scene.add(n.root);
      w.npcs.push(n);
      n.follow(true);
      n.arm(comp === 'isaac' ? 'shotgun' : comp === 'dexter' ? 'arc' : comp === 'luna' ? null : 'pistol');
      n.interactable = true;
    }
    if (def?.levels) {
      const h = def.levels[w.def.id] ?? def.levels['*'];
      if (h) this.spawn(async (S) => h(S, w), true);
    }
    if (def?.objective) this.objective(def.objective(this));
  }

  /** Re-run the current chapter's handler for the already-loaded level (used when a chapter flows on without a reload). */
  rerunLevel() {
    const w = this.game.world;
    if (!w) return;
    this.levelToken++;
    const def = this.chapterDef;
    const h = def?.levels?.[w.def.id] ?? def?.levels?.['*'];
    if (h) this.spawn(async (S) => h(S, w), true);
    if (def?.objective) this.objective(def.objective(this));
  }

  async beforeTravel(to: string, spawn: string): Promise<boolean> {
    const def = this.chapterDef;
    if (def?.beforeTravel) return def.beforeTravel(this, to, spawn);
    return true;
  }

  // ---------------- hub population ----------------
  populateHub(w: World) {
    const st = this.game.state;
    const def = this.chapterDef;
    const phase = this.hubPhase();
    for (const id of SURVIVORS) {
      if (id === 'noah' || !st.alive[id]) continue;
      if (def?.hubAbsent?.includes(id)) continue;
      const sp = w.level.spawns['n_' + id];
      if (!sp) continue;
      const n = new NPC(w, id);
      n.place(sp.pos, sp.yaw);
      const pose = def?.hubPose?.[id] ?? DEFAULT_POSES[id] ?? null;
      n.setPose(pose);
      w.scene.add(n.root);
      w.npcs.push(n);
    }
    void phase;
  }
  hubPhase(): string {
    const st = this.game.state;
    const ch = st.chapter;
    const boss: Record<string, string> = { ch2: 'gridlock', ch3: 'foreman', ch4: 'subjectZero', ch5: 'leviathan', ch6: 'motherBloom', ch7: 'warden' };
    if (boss[ch]) return ch + (this.game.flag(`boss_${boss[ch]}_dead`) ? 'post' : 'pre');
    return ch;
  }

  // ---------------- dialogue ----------------
  npcName(n: NPC) {
    return CAST[n.id].name;
  }
  canTalk(n: NPC) {
    if (n.id === 'captain') return false;
    if (this.game.world?.def.id === 'ballroom') return false;
    return true;
  }
  async talk(n: NPC) {
    if (this.cineDepth > 0) return;
    const phase = this.hubPhase();
    const key = `talk_${phase}_${n.id}`;
    const entry = HUB_TALK[phase]?.[n.id];
    const companion = COMPANION[this.game.state.chapter] === n.id && this.game.world?.def.id !== 'hub';
    await this.cinematic(async () => {
      this.talkPartner = n;
      n.talking = 0.1;
      if (entry && (!this.game.flag(key) || entry.repeat)) {
        await this.playLines(entry.lines);
        if (entry.give) for (const [id, num] of entry.give) this.giveItem(id, num);
        if (entry.evidence && !this.game.state.evidence.includes(entry.evidence)) {
          this.talkPartner = null;
          await this.game.addEvidence(entry.evidence);
        }
        this.game.setFlag(key);
        if (entry.flag) this.game.setFlag(entry.flag);
        this.emit('talked:' + n.id);
        this.emit('talked');
      } else {
        const gen = GENERIC_TALK[n.id] ?? [['...']];
        const pick = companion ? COMPANION_BARKS[n.id] ?? gen : gen;
        const line = pick[Math.floor(Math.random() * pick.length)];
        await this.say(n.id, line[0]);
      }
      this.talkPartner = null;
    });
  }
  private async playLines(lines: TalkLine[]) {
    for (const l of lines) {
      const npc = this.game.world?.npc(l[0] as CastId);
      if (npc && l[2]) npc.setPose(l[2]);
      await this.say(l[0], l[1], { pose: l[2] });
    }
  }
  giveItem(id: ItemId, n: number) {
    const w = this.game.world;
    if (!w) return;
    const it = new ItemPickup(w, w.player.pos.clone(), 'gift', id, n);
    void it.interact();
  }

  async say(who: string, text: string, opts: { style?: string; title?: string; pose?: string; cam?: boolean; auto?: number } = {}) {
    const w = this.game.world;
    // camera framing
    if (w && opts.cam !== false && this.autoCam && this.game.cinematic) this.frame(who);
    const npc = w?.npc(who as CastId);
    if (npc) npc.talking = 1e9;
    if (who === 'noah' && w && opts.style !== 'thought') w.player.anim.p.talk = 1;
    try {
      await this.game.ui.dlg.say(who, text, opts);
    } finally {
      if (npc) npc.talking = 0.3;
      if (w) w.player.anim.p.talk = 0;
    }
  }
  async choose(opts: (string | ChoiceOpt)[]) {
    const o = opts.map((x) => (typeof x === 'string' ? { text: x } : x));
    const r = await this.game.ui.dlg.choose(o);
    return r;
  }
  /** Over-the-shoulder framing for conversations. */
  private frame(who: string) {
    const w = this.game.world!;
    const pl = w.player;
    let speaker: THREE.Vector3 | null = null;
    let listener: THREE.Vector3 | null = null;
    const partner = this.talkPartner;
    if (who === 'noah' && partner) {
      speaker = pl.pos;
      listener = partner.pos;
    } else {
      const n = w.npc(who as CastId);
      if (n) {
        speaker = n.pos;
        listener = pl.pos;
      }
    }
    if (!speaker || !listener) return;
    const sH = 1.62 * (who === 'noah' ? 1 : CAST[who as CastId]?.look.height ?? 1);
    const dir = speaker.clone().sub(listener).setY(0);
    const d = Math.max(0.5, dir.length());
    dir.normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const camPos = listener.clone().addScaledVector(dir, -0.9).addScaledVector(side, 0.75).setY(1.75);
    const look = speaker.clone().setY(sH - 0.05);
    if (d > 6) camPos.copy(speaker).addScaledVector(dir, -2.2).addScaledVector(side, 0.8).setY(1.7);
    this.game.rig.setCine({ pos: camPos, look, fov: 42, blend: 0.45 });
  }

  bark(who: string, text: string, dur = 4) {
    this.game.ui.hud.subtitle(who, text, dur);
    const c = (CAST as any)[who];
    if (c) {
      let n = 0;
      const id = setInterval(() => {
        audio.voiceBlip(c.pitch, c.timbre, 0.7);
        if (++n > Math.min(14, text.length / 4)) clearInterval(id);
      }, 70);
    }
  }
  objective(t: string) {
    this.game.ui.hud.objective(t);
  }
  message(from: string, text: string) {
    this.game.state.messages.push({ from, text, t: this.game.state.playTime });
    audio.play('chime', { vol: 0.4 });
    const c = (CAST as any)[from];
    this.game.ui.hud.toast(`GloomText from ${c ? c.name : from === 'viewer' ? 'a viewer' : from}`, 'info');
  }
  journal(text: string) {
    const ch = CHAPTERS.find((c) => c.id === this.game.state.chapter);
    this.game.state.journal.push({ t: ch ? ch.num : '', text });
  }

  async cinematic<T>(fn: () => Promise<T>): Promise<T> {
    const g = this.game;
    this.cineDepth++;
    g.cinematic = true;
    g.setLetterbox(true);
    g.ui.hud.prompt('');
    const w = g.world;
    if (w) {
      w.player.control = false;
      w.player.vel.set(0, 0, 0);
    }
    try {
      return await fn();
    } finally {
      this.cineDepth = Math.max(0, this.cineDepth - 1);
      if (this.cineDepth === 0) {
        g.cinematic = false;
        g.setLetterbox(false);
        g.ui.dlg.hide();
        g.rig.setCine(null);
        const w2 = g.world;
        if (w2) {
          w2.player.control = true;
          w2.player.anim.p.pose = null;
          w2.player.anim.p.poseW = 0;
          // hand control back with the follow camera settled behind Noah
          g.rig.yaw = w2.player.yaw + Math.PI;
          g.rig.pitch = -0.12;
        }
      }
    }
  }
  get inCinematic() {
    return this.cineDepth > 0;
  }

  // ---------------- blackout ----------------
  async blackout(evidence: string | null, wake: string) {
    const g = this.game;
    await this.cinematic(async () => {
      audio.play('glitch', { vol: 0.8 });
      g.glitch(1.2);
      g.ui.hud.whisper('▌▌ SIGNAL LOST ▌▌');
      await g.wait(0.9);
      audio.play('blackout', { vol: 0.9 });
      await g.fade(1, 0.25);
      audio.setMuffle(true);
      g.music.play('none', 0.5);
      await g.wait(1.2);
      g.ui.hud.banner('— TIME MISSING —', '');
      await g.wait(2.4);
      audio.setMuffle(false);
      g.glitch(0.8);
      await g.fade(0, 1.2);
      await this.say('noah', wake, { style: 'thought', title: '(thinking)', cam: false });
      if (evidence) await g.addEvidence(evidence);
      g.state.suspicion = Math.min(100, g.state.suspicion + 4);
      g.music.play((g.world?.theme.music ?? 'explore') as SongId, 2);
    });
  }

  // ---------------- bosses ----------------
  async bossIntro(kind: keyof typeof BOSS_INFO) {
    const g = this.game;
    const w = g.world;
    if (!w) return;
    const b = w.bosses.find((x) => x.bossKind === kind && !x.dead) as Boss | undefined;
    if (!b) return;
    await this.cinematic(async () => {
      const to = w.player.pos.clone().sub(b.pos).setY(0).normalize();
      const camPos = b.pos.clone().addScaledVector(to, 6 + b.radius * 2).setY(2.2 + b.radius);
      const look = b.pos.clone().setY(1.6 * Math.max(1, b.scale));
      g.rig.setCine({ pos: camPos, look, fov: 48, blend: 0.8, drift: to.clone().multiplyScalar(-0.6), shakeAmt: 0.3 });
      g.music.play(BOSS_INFO[kind].music, 0.5);
      audio.play('bossRoar', { pos: b.pos, vol: 1.1 });
      g.rig.addShake(0.6);
      g.ui.hud.banner(BOSS_INFO[kind].name, BOSS_INFO[kind].title);
      await g.wait(3.2);
    });
    w.startBoss(kind);
    g.ui.hud.bossBar(b);
    g.music.setIntensity(1);
  }

  // ---------------- sleeping ----------------
  canSleep() {
    const def = this.chapterDef;
    return !!def?.canSleep?.(this);
  }
  async sleep() {
    if (this.sleeping) return;
    if (!this.canSleep()) {
      this.game.saveAt('bed');
      this.game.state.sanity = 100;
      this.game.ui.hud.toast('You rest a while. Sanity restored.', 'sanity');
      return;
    }
    this.sleeping = true;
    this.emit('sleep');
    setTimeout(() => (this.sleeping = false), 2000);
  }

  // ---------------- dynamic spawns ----------------
  spawnEvidenceAt(id: string, spawn: string) {
    const w = this.game.world;
    if (!w || this.game.state.evidence.includes(id)) return;
    const sp = w.level.spawns[spawn];
    if (!sp) return;
    if (w.interactables.some((i) => i instanceof EvidencePickup && i.id === id)) return;
    w.interactables.push(new EvidencePickup(w, sp.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6)), id));
  }
  spawnNPC(id: CastId, at: THREE.Vector3, yaw = 0, pose: string | null = null) {
    const w = this.game.world!;
    let n = w.npc(id);
    if (!n) {
      n = new NPC(w, id);
      w.scene.add(n.root);
      w.npcs.push(n);
    }
    n.place(at, yaw);
    n.setPose(pose);
    return n;
  }
  removeNPC(id: CastId) {
    const w = this.game.world;
    if (!w) return;
    const n = w.npc(id);
    if (!n) return;
    n.dispose();
    w.npcs = w.npcs.filter((x) => x !== n);
  }

  // ---------------- title screen ----------------
  setupTitle() {
    const g = this.game;
    this.abort();
    void g.loadLevel('hub', 'deck', { fade: false, title: true }).then((w) => {
      if (!w || g.mode !== 'title') return;
      w.player.root.visible = false;
      w.player.control = false;
      g.cinematic = true;
      g.ui.hud.show(false);
      g.music.play('title', 2);
      audio.setAmbience('title');
      g.ui.hud.prompt('');
    });
  }
  titleUpdate(dt: number) {
    this.titleT += dt;
    const g = this.game;
    const w = g.world;
    if (!w || g.mode !== 'title') return;
    const t = this.titleT * 0.04;
    const c = new THREE.Vector3(19 * 3, 0, 4 * 3);
    const r = 70;
    const pos = new THREE.Vector3(c.x + Math.cos(t) * r, 18 + Math.sin(t * 0.7) * 4, c.z + Math.sin(t) * r + 30);
    const look = new THREE.Vector3(c.x, 26, c.z);
    g.rig.setCine({ pos, look, fov: 55 });
    g.ui.hud.prompt('');
  }
  titleCamera(_dt: number) {
    this.game.camera.position.set(0, 10, 30);
    this.game.camera.lookAt(0, 10, 0);
  }

  // ---------------- trials ----------------
  trial(id: string): Promise<TrialResult> {
    return runTrial(this, id);
  }
}

export const DEFAULT_POSES: Partial<Record<CastId, string | null>> = {
  elise: 'think', leo: 'cross', aria: 'typing', dexter: 'hips', fiona: 'cross', grant: 'think', hana: null, isaac: 'typing', jade: 'cross', kai: 'hips', luna: 'meditate',
};

const COMPANION_BARKS: Partial<Record<CastId, [string][]>> = {
  hana: [['Stay close. I’ll call out anything that moves.'], ['Fuses first, sightseeing later!'], ['You okay, Noah? You look... far away.']],
  isaac: [['Every machine here is screaming. I can hear it.'], ['Don’t touch anything with a skull sticker. Trust me.'], ['If you find a valve wheel, grab it. Furnace one needs it.']],
  elise: [['This place... I know these corridors.'], ['Watch the light. Phantoms hate being seen.'], ['If I tell you something later, promise you’ll listen before you judge.']],
  dexter: [['Eyes up. Water hides things.'], ['Breaker first. Electrified water is a coffin.'], ['Protocol keeps people alive, Noah. Most of them.']],
  luna: [['The vines are listening. Speak softly.'], ['Gloomy says the bushes breathe. Do not trust the bushes.'], ['The cards keep showing me a mask. Yours, I think.']],
  aria: [['Every terminal here is talking about you, Noah.'], ['I can crack anything. The question is whether I should.'], ['Lila was my cousin. Did you know that?']],
};

export { clamp, lerp, ORDER };
