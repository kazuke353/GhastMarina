import * as THREE from 'three';
import { Renderer } from '../gfx/Renderer';
import { Input } from '../core/Input';
import { Settings } from '../core/Settings';
import { audio } from '../core/Audio';
import { Music, SongId } from '../core/Music';
import { CameraRig } from './CameraRig';
import { FX } from './FX';
import { Weather } from '../gfx/Particles';
import { LightPool } from '../world/Level';
import { World } from './World';
import { GameState, newState, saveGame, loadGame } from './State';
import { LEVELS } from '../world/maps';
import { UI } from '../ui/UI';
import { Director } from '../story/Director';
import { BOSS_INFO, type Boss } from '../entities/Bosses';
import { clamp, clamp01, damp, lerp, rand } from '../core/math';
import { EVIDENCE, CHAPTERS } from '../story/Lore';
import { CAST } from '../chars/Cast';

export type Mode = 'boot' | 'title' | 'play' | 'trial' | 'ending';

export class Game {
  renderer: Renderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  rig: CameraRig;
  input: Input;
  settings = new Settings();
  music: Music;
  fx: FX;
  weather: Weather;
  lightPool: LightPool;
  hemi: THREE.HemisphereLight;
  amb: THREE.AmbientLight;
  moon: THREE.DirectionalLight;
  flashlight: THREE.SpotLight;
  private flashTarget = new THREE.Object3D();
  ui: UI;
  director: Director;
  state: GameState = newState();
  world: World | null = null;
  mode: Mode = 'boot';
  paused = false;
  cinematic = false;
  private hitstopT = 0;
  slowmo = 1;
  time = 0;
  threat = 0;
  private flashA = 0;
  private hbT = 0;
  private whisperT = 8;
  private hallucT = 15;
  private last = performance.now();
  private loading = false;
  private fadeV = 0;
  private fadeTarget = 0;
  private fadeSpeed = 1;
  private fadeResolve: (() => void) | null = null;
  letterbox = 0;
  private letterTarget = 0;
  sanityLow = false;
  private viewerDrift = 0;
  private autoSaveT = 0;
  private glitchT = 0;
  debug = false;
  /** Debug/test: seconds before dialogue auto-advances (-1 = off). */
  autoplay = -1;
  autoChoice = 0;

  constructor(public app: HTMLElement) {
    this.renderer = new Renderer(app);
    this.renderer.setQuality(this.settings.data.quality);
    this.camera = new THREE.PerspectiveCamera(this.settings.data.fov, window.innerWidth / window.innerHeight, 0.1, 1800);
    this.rig = new CameraRig(this.camera);
    this.rig.baseFov = this.settings.data.fov;
    this.input = new Input(this.renderer.canvas);
    this.music = new Music(audio);
    this.fx = new FX(this.scene);
    this.weather = new Weather(2600);
    this.scene.add(this.weather.points);
    // lighting rig (fixed light count keeps shaders stable)
    this.hemi = new THREE.HemisphereLight(0x5a6a8a, 0x1a1a22, 0.7);
    this.scene.add(this.hemi);
    this.amb = new THREE.AmbientLight(0x8090b0, 1);
    this.scene.add(this.amb);
    this.moon = new THREE.DirectionalLight(0x8090b0, 0);
    this.moon.position.set(-30, 60, 20);
    this.scene.add(this.moon);
    this.flashlight = new THREE.SpotLight(0xd8f4ff, 0, 30, 0.48, 0.55, 1.3);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.set(1024, 1024);
    this.flashlight.shadow.camera.near = 0.3;
    this.flashlight.shadow.camera.far = 30;
    this.flashlight.shadow.bias = -0.0006;
    this.flashlight.shadow.normalBias = 0.04;
    this.scene.add(this.flashlight, this.flashTarget);
    this.flashlight.target = this.flashTarget;
    this.lightPool = new LightPool(this.scene, 6);
    this.ui = new UI(this);
    this.director = new Director(this);
    this.applySettings();
    this.settings.onChange(() => this.applySettings());
    this.input.onLockChange = (locked) => {
      if (!locked && (this.mode === 'play') && !this.ui.anyOverlay() && !this.cinematic && !this.input.lockFailed) this.ui.openPause();
    };
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'play' && !this.ui.anyOverlay()) this.ui.openPause();
    });
  }

  applySettings() {
    const s = this.settings.data;
    this.renderer.setQuality(s.quality);
    this.rig.baseFov = s.fov;
    audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, voice: s.voice });
    this.flashlight.shadow.mapSize.set(s.quality === 'high' ? 2048 : s.quality === 'medium' ? 1024 : 512, s.quality === 'high' ? 2048 : s.quality === 'medium' ? 1024 : 512);
    if (this.flashlight.shadow.map) {
      this.flashlight.shadow.map.dispose();
      (this.flashlight.shadow as any).map = null;
    }
    this.renderer.renderer.shadowMap.enabled = s.quality !== 'low';
    this.weather.points.visible = this.weather.kind !== 'none';
  }

  start() {
    document.getElementById('boot')?.remove();
    this.mode = 'title';
    this.ui.showTitle();
    const loop = () => {
      requestAnimationFrame(loop);
      const now = performance.now();
      let dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.frame(dt);
    };
    requestAnimationFrame(loop);
  }

  // ---------------- flags ----------------
  flag(name: string): boolean {
    return !!this.state.flags[name];
  }
  setFlag(name: string, v: boolean | number | string = true) {
    this.state.flags[name] = v;
    this.director.emit('flag:' + name);
  }

  // ---------------- main frame ----------------
  private frame(rawDt: number) {
    this.input.pollGamepad();
    this.time += rawDt;
    audio.update(rawDt);
    this.music.update(rawDt);
    // fades
    if (this.fadeV !== this.fadeTarget) {
      const s = this.fadeSpeed * rawDt;
      this.fadeV = this.fadeV < this.fadeTarget ? Math.min(this.fadeTarget, this.fadeV + s) : Math.max(this.fadeTarget, this.fadeV - s);
      if (this.fadeV === this.fadeTarget && this.fadeResolve) {
        const r = this.fadeResolve;
        this.fadeResolve = null;
        r();
      }
    }
    this.letterbox = lerp(this.letterbox, this.letterTarget, damp(4, rawDt));
    this.ui.update(rawDt);
    if (this.mode === 'title') this.director.titleUpdate(rawDt);
    const w = this.world;
    const frozen = this.paused || this.ui.blocksGame();
    let dt = rawDt;
    if (this.hitstopT > 0) {
      this.hitstopT -= rawDt;
      dt *= 0.05;
    }
    dt *= this.slowmo;
    if (w && !frozen && !this.loading) {
      // camera look
      if (!this.cinematic && w.player.control && !w.player.dead) {
        const s = this.settings.data;
        this.rig.look(this.input.mouseDX, this.input.mouseDY, s.sensitivity, s.invertY);
        if (this.input.padLook.x || this.input.padLook.y) this.rig.look(this.input.padLook.x * 900 * rawDt, this.input.padLook.y * 600 * rawDt, s.sensitivity, s.invertY);
      }
      if (!this.cinematic && this.input.pressed('band')) {
        this.ui.openGloomBand();
      } else if (this.input.pressed('map') && !this.cinematic) {
        this.ui.openGloomBand('map');
      } else if (this.input.pressed('pause') && !this.cinematic) {
        this.ui.openPause();
      }
      w.update(dt);
      this.state.playTime += rawDt;
      this.director.update(dt);
      this.updatePresentation(rawDt, dt);
    }
    if (w) {
      this.rig.ceiling = w.theme.ceiling ? w.theme.wallH : 99;
      this.rig.update(rawDt, w.player.pos, w.level, this.settings.data.shake);
      this.updateLights(rawDt);
      w.exterior?.update(rawDt, this.time, this.camera);
      audio.listener.x = this.camera.position.x;
      audio.listener.y = this.camera.position.y;
      audio.listener.z = this.camera.position.z;
      const d = this.camera.getWorldDirection(new THREE.Vector3());
      audio.listener.yaw = Math.atan2(-d.x, -d.z);
    } else this.director.titleCamera(rawDt);
    this.fx.update(frozen ? 0 : dt, this.camera, this.renderer.height * this.renderer.pixelRatio);
    if (this.world) {
      const c = this.camera.position;
      this.weather.setFade(this.world.level.isRoofed(c.x, c.z) ? 0 : 1, rawDt);
    }
    this.weather.update(this.time, this.camera, this.renderer.height * this.renderer.pixelRatio);
    this.updateFX(rawDt);
    this.renderer.render(this.scene, this.camera, this.time);
    this.input.endFrame();
  }

  private updateLights(dt: number) {
    const w = this.world!;
    const pl = w.player;
    const on = pl.flashlight && !pl.dead && (this.mode === 'play' || this.cinematic) && !(this.mode === 'trial');
    const night = (this.state.skills.nighteyes ?? 0) > 0;
    const targetI = on ? (night ? 60 : 42) : 0;
    this.flashlight.intensity = lerp(this.flashlight.intensity, targetI, damp(18, dt));
    this.flashlight.angle = night ? 0.62 : 0.5;
    this.flashlight.distance = night ? 34 : 28;
    // emitter at the GloomBand side of the chest, aimed where the camera looks
    const fwd = new THREE.Vector3(Math.sin(pl.yaw), 0, Math.cos(pl.yaw));
    const left = new THREE.Vector3(fwd.z, 0, -fwd.x);
    this.flashlight.position.copy(pl.pos).add(new THREE.Vector3(0, 1.45, 0)).addScaledVector(fwd, 0.35).addScaledVector(left, 0.25);
    if (this.rig.mode === 'follow') {
      const aimPt = this.camera.position.clone().add(this.rig.dir(new THREE.Vector3()).multiplyScalar(14));
      this.flashTarget.position.lerp(aimPt, damp(14, dt));
    } else this.flashTarget.position.copy(pl.pos).addScaledVector(fwd, 8).setY(1);
    const camDir = this.camera.getWorldDirection(new THREE.Vector3());
    this.lightPool.update(dt, w.level.lights, this.camera.position, camDir, this.time);
  }

  private updatePresentation(rawDt: number, dt: number) {
    const w = this.world!;
    const st = this.state;
    const pl = w.player;
    // music intensity from threat
    const boss = w.boss && !w.boss.dead;
    if (!boss && this.mode === 'play' && !this.cinematic) {
      this.music.setIntensity(clamp01(this.threat / 3));
    }
    // heartbeat at low health
    if (st.hp < st.maxHp * 0.3 && !pl.dead) {
      this.hbT -= rawDt;
      if (this.hbT <= 0) {
        this.hbT = 0.55 + (st.hp / st.maxHp) * 1.5;
        audio.play('heartbeat', { vol: 0.7 });
      }
    }
    // sanity side effects
    this.sanityLow = st.sanity < 25;
    if (st.sanity < 50 && !w.safe) {
      this.whisperT -= rawDt;
      if (this.whisperT <= 0) {
        this.whisperT = rand(4, 10) * (st.sanity / 50 + 0.4);
        audio.play('whisper', { vol: 0.5 * (1 - st.sanity / 50) + 0.15 });
        if (st.sanity < 30 && Math.random() < 0.3) this.ui.hud.whisper(pickWhisper());
      }
    }
    if (st.sanity < 22 && !w.safe && !this.cinematic) {
      this.hallucT -= rawDt;
      if (this.hallucT <= 0) {
        this.hallucT = rand(14, 26);
        const p = w.level.randomFloorNear(pl.pos, 3);
        if (p && p.distanceTo(pl.pos) > 5) {
          const e = w.spawnEnemy(Math.random() < 0.5 ? 'shambler' : 'runner', p, { rise: true });
          e.illusion = true;
          e.setTransparent(true);
          e.noLoot = true;
        }
      }
    }
    // viewers drift
    this.viewerDrift += rawDt;
    if (this.viewerDrift > 2) {
      this.viewerDrift = 0;
      const chg = Math.round((this.threat > 0 ? rand(5, 40) : rand(-25, 15)) + (boss ? 80 : 0));
      st.viewers = Math.max(800, st.viewers + chg);
    }
    // gentle autosave of play time
    this.autoSaveT += rawDt;
  }

  private updateFX(dt: number) {
    const f = this.renderer.fx;
    const st = this.state;
    const w = this.world;
    const theme = w?.theme;
    const s = this.settings.data;
    // base grade from theme
    if (theme) {
      const g = theme.grade;
      f.tint.setRGB(g.tint[0], g.tint[1], g.tint[2]);
      f.lift.setRGB(g.lift[0], g.lift[1], g.lift[2]);
      f.sat = g.sat;
      f.contrast = g.contrast;
      f.exposure = g.exposure;
      f.bloom = g.bloom;
      f.vignette = g.vignette;
    }
    const inPlay = this.mode === 'play' && w;
    const san = inPlay ? st.sanity : 100;
    const lowS = clamp01((60 - san) / 60);
    const veryLow = clamp01((30 - san) / 30);
    f.chroma = 0.12 + lowS * 0.9;
    f.warp = veryLow * 1.4;
    f.vignette += lowS * 0.35;
    const hpK = inPlay ? st.hp / st.maxHp : 1;
    f.desat = clamp01((0.35 - hpK) / 0.35) * 0.7 + lowS * 0.25;
    f.grain = s.grain ? 0.03 + lowS * 0.05 : 0;
    f.outline = s.outlines ? 0.85 : 0;
    this.flashA = Math.max(0, this.flashA - dt * 1.8);
    f.flash.set(0.55, 0.0, 0.02, this.flashA * 0.7);
    if (hpK < 0.3 && inPlay) f.flash.w = Math.max(f.flash.w, (0.3 - hpK) * (0.6 + 0.4 * Math.sin(this.time * 6)));
    this.glitchT = Math.max(0, this.glitchT - dt);
    f.glitch = Math.max(this.glitchT > 0 ? 0.8 : 0, veryLow > 0.5 && Math.random() < 0.02 ? 0.5 : 0);
    f.fade = this.fadeV;
    f.letterbox = this.letterbox;
    f.pulse = 0;
  }

  // ---------------- events ----------------
  onPlayerHurt(dmg: number, from: THREE.Vector3 | null) {
    this.flashA = Math.min(1, this.flashA + 0.35 + dmg / 60);
    this.rig.addShake(Math.min(0.8, 0.2 + dmg / 50));
    if (from && this.world) this.ui.hud.damageFrom(from, this.world.player.pos, this.rig.yaw);
    this.addViewers(Math.round(dmg));
  }
  onPlayerDeath() {
    this.state.deaths++;
    this.music.play('none', 2);
    audio.setMuffle(true);
    this.slowmo = 0.4;
    setTimeout(() => {
      this.slowmo = 1;
      audio.setMuffle(false);
      this.ui.showGameOver();
    }, 2200);
  }
  onBossDefeated(b: Boss) {
    this.slowmo = 0.25;
    this.rig.addShake(1);
    setTimeout(() => (this.slowmo = 1), 1600);
    this.ui.hud.bossBar(null);
    this.ui.hud.banner(`${BOSS_INFO[b.bossKind].name} DEFEATED`, `+${b.def.credits} viewer tips · +1 Insight`);
    this.state.insight += 1;
    this.tip(b.def.credits, 'BOSS KILL');
    this.music.play(this.world?.theme.music === 'finale' ? 'finale' : 'explore', 3);
    this.director.emit('boss:dead:' + b.bossKind);
  }
  hitstop(t: number) {
    this.hitstopT = Math.max(this.hitstopT, t);
  }
  addViewers(n: number) {
    this.state.viewers += Math.max(0, n) * 3;
  }
  tip(n: number, label: string | null) {
    if (n <= 0) return;
    this.state.credits += n;
    this.ui.hud.tip(n, label);
  }
  sanityBlackout() {
    const w = this.world;
    if (!w) return;
    audio.play('blackout', { vol: 0.8 });
    this.glitchT = 1;
    this.cinematic = true;
    void this.fade(1, 0.3).then(async () => {
      await this.wait(1.2);
      this.state.sanity = 40;
      this.state.hp = Math.max(1, this.state.hp - 10);
      this.state.suspicion = Math.min(100, this.state.suspicion + 2);
      const odd = ['scrap', 'cloth', 'chem'] as const;
      const it = odd[Math.floor(Math.random() * odd.length)];
      this.state.inv[it] = (this.state.inv[it] ?? 0) + 1;
      for (const e of w.enemies) if (!e.dead && !e.isBoss && e.state === 'chase') e.state = 'idle';
      this.cinematic = false;
      await this.fade(0, 0.8);
      this.ui.hud.whisper('…you lost time. Your hands are sticky. There is something in your pocket you don’t remember taking.');
    });
  }

  async addEvidence(id: string) {
    if (this.state.evidence.includes(id)) return;
    this.state.evidence.push(id);
    audio.play('objection', { vol: 0.35 });
    await this.ui.evidenceCard(id);
    this.director.emit('evidence:' + id);
    void EVIDENCE;
  }

  // ---------------- fades / cinematics ----------------
  fade(to: number, dur: number): Promise<void> {
    this.fadeTarget = to;
    this.fadeSpeed = dur > 0 ? 1 / dur : 1e6;
    if (this.fadeV === to) return Promise.resolve();
    return new Promise((r) => (this.fadeResolve = r));
  }
  setFadeInstant(v: number) {
    this.fadeV = this.fadeTarget = v;
  }
  setLetterbox(on: boolean) {
    this.letterTarget = on ? 1 : 0;
  }
  wait(sec: number): Promise<void> {
    return new Promise((r) => setTimeout(r, sec * 1000));
  }
  glitch(t = 0.6) {
    this.glitchT = t;
  }

  // ---------------- levels ----------------
  async loadLevel(id: string, spawn: string, opts: { fade?: boolean; pos?: [number, number]; yaw?: number; keepMusic?: boolean } = {}) {
    const def = LEVELS[id];
    if (!def) throw new Error('Unknown level ' + id);
    this.loading = true;
    if (opts.fade !== false) await this.fade(1, 0.5);
    this.ui.hud.prompt('');
    this.ui.hud.bossBar(null);
    if (this.world) {
      this.world.dispose();
      this.world = null;
    }
    this.lightPool.off();
    await this.wait(0.05);
    const w = new World(this, def, spawn);
    this.world = w;
    if (opts.pos) {
      w.player.place(new THREE.Vector3(opts.pos[0], 0, opts.pos[1]), opts.yaw ?? 0);
    }
    this.rig.yaw = w.player.yaw + Math.PI;
    this.rig.pitch = -0.12;
    this.rig.setCine(null);
    this.state.level = id;
    this.state.spawn = spawn;
    // environment
    const t = w.theme;
    this.scene.fog = new THREE.FogExp2(t.fog[0], t.fog[1]);
    this.scene.background = new THREE.Color(t.bg);
    this.hemi.color.set(t.hemi[0]);
    this.hemi.groundColor.set(t.hemi[1]);
    // theme values are authored in "artist" units; scale into three's physical light units
    this.hemi.intensity = t.hemi[2] * 2.6;
    this.amb.color.set(t.hemi[0]).lerp(new THREE.Color(0xffffff), 0.45);
    this.amb.intensity = t.hemi[2] * 3.2;
    this.moon.intensity = t.open ? 1.6 : 0;
    this.moon.color.set(t.dir ? t.dir[0] : 0x8fa4d0);
    if (t.dir) this.moon.position.set(t.dir[2][0], t.dir[2][1], t.dir[2][2]).normalize().multiplyScalar(80);
    this.weather.set(t.weather);
    audio.setAmbience(t.ambience as any);
    if (!opts.keepMusic) this.music.play((t.music as SongId) ?? 'explore', 2);
    w.player.equip(this.state.equipped, true);
    if (!this.state.weapons[this.state.equipped]) w.player.equip('pipe', true);
    this.director.onLevelLoaded(w);
    this.loading = false;
    if (opts.fade !== false) void this.fade(0, 0.8);
    if (opts.fade !== false && !this.cinematic) {
      const ch = CHAPTERS.find((c) => c.id === this.state.chapter);
      this.ui.hud.areaTitle(def.name, ch ? `${ch.num} · ${ch.title}` : t.name);
    }
    return w;
  }

  async travel(to: string, spawn: string) {
    if (this.loading) return;
    const ok = await this.director.beforeTravel(to, spawn);
    if (!ok) return;
    await this.loadLevel(to, spawn);
    this.save();
  }

  saveAt(id: string) {
    if (!this.world) return;
    this.state.pos = [this.world.player.pos.x, this.world.player.pos.z];
    this.state.yaw = this.world.player.yaw;
    this.state.spawn = id;
    this.save();
    this.ui.hud.toast('Progress saved', 'save');
  }
  save() {
    if (this.world) {
      this.state.level = this.world.def.id;
      this.state.pos = [this.world.player.pos.x, this.world.player.pos.z];
      this.state.yaw = this.world.player.yaw;
    }
    saveGame(this.state);
  }

  // ---------------- game flow ----------------
  async newGame(difficulty: GameState['difficulty'], chapter = 'prologue') {
    audio.init();
    this.state = newState(difficulty);
    this.mode = 'play';
    this.ui.hideTitle();
    await this.director.runFrom(chapter);
  }
  async continueGame() {
    audio.init();
    const s = loadGame();
    if (!s) return;
    this.state = s;
    this.mode = 'play';
    this.ui.hideTitle();
    await this.director.resume();
  }
  async retry() {
    const s = loadGame();
    this.ui.hideGameOver();
    if (s) {
      this.state = s;
      this.state.hp = Math.max(this.state.hp, this.state.maxHp * 0.6);
      this.state.sanity = Math.max(this.state.sanity, 50);
      await this.director.resume();
    } else {
      await this.newGame(this.state.difficulty);
    }
  }
  async quitToTitle() {
    this.ui.closeAll();
    this.director.abort();
    await this.fade(1, 0.4);
    if (this.world) {
      this.world.dispose();
      this.world = null;
    }
    this.cinematic = false;
    this.paused = false;
    this.setLetterbox(false);
    this.mode = 'title';
    this.ui.showTitle();
    this.ui.hud.show(false);
    await this.fade(0, 0.6);
  }

  get playerName() {
    return CAST.noah.name;
  }
}

const WHISPERS = [
  'you did this',
  'they know',
  'cut the wire, noah',
  'it’s not your hand',
  'smile for the viewers',
  'trust is fatal',
  'the captain is proud of you',
  'who is wearing your face?',
  'count them. one is missing.',
  'lila would have trusted them',
];
function pickWhisper() {
  return '…' + WHISPERS[Math.floor(Math.random() * WHISPERS.length)] + '…';
}
