import './styles.css';
import type { Game } from '../game/Game';
import { HUD } from './HUD';
import { DialogueUI, markup } from './Dialogue';
import { GloomBandUI, BandTab } from './GloomBand';
import { HackUI } from './Hack';
import { TrialUI } from './TrialUI';
import { audio } from '../core/Audio';
import { hasSave, loadGame, unlockedChapters, deleteSave } from '../game/State';
import { ITEMS, VENDOR, WEAPONS, UPGRADE_COST, RECIPES } from '../game/Items';
import { LOGS, EVIDENCE, CHAPTERS } from '../story/Lore';
import { icon } from './icons';
import { CAST, SURVIVORS } from '../chars/Cast';
import type { WeaponId } from '../game/State';

const div = (cls: string, html = '') => {
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = html;
  return d;
};

interface Overlay {
  el: HTMLElement;
  blocks: boolean;
  close: () => void;
  escClose: boolean;
}

export class UI {
  root: HTMLDivElement;
  hud: HUD;
  dlg: DialogueUI;
  band: GloomBandUI;
  hackUI: HackUI;
  trial: TrialUI;
  private overlays: Overlay[] = [];
  private title: HTMLElement | null = null;
  private gameOverEl: HTMLElement | null = null;
  private narrEl: HTMLElement;

  constructor(private game: Game) {
    this.root = document.createElement('div');
    this.root.id = 'ui';
    document.body.appendChild(this.root);
    this.hud = new HUD(game, this.root);
    this.trial = new TrialUI(game, this.root);
    this.dlg = new DialogueUI(game, this.root);
    this.band = new GloomBandUI(game, this.root);
    this.band.onClose = () => this.pop(this.band.el);
    this.hackUI = new HackUI(game, this.root);
    this.narrEl = div('narration hidden', '<p></p>');
    this.root.appendChild(this.narrEl);
    game.renderer.canvas.addEventListener('mousedown', () => {
      if ((game.mode === 'play' || game.mode === 'trial') && !this.anyOverlay()) game.input.requestLock();
    });
  }

  // ---------------- overlay stack ----------------
  private push(el: HTMLElement, blocks = true, escClose = true, close?: () => void) {
    const o: Overlay = { el, blocks, escClose, close: close ?? (() => this.pop(el)) };
    this.overlays.push(o);
    this.game.input.exitLock();
    return o;
  }
  private pop(el: HTMLElement) {
    const i = this.overlays.findIndex((o) => o.el === el);
    if (i >= 0) this.overlays.splice(i, 1);
    if (el !== this.band.el && el !== this.hackUI.el) el.remove();
  }
  anyOverlay() {
    return this.overlays.length > 0 || this.dlg.choosing || this.hackUI.open;
  }
  blocksGame() {
    return this.overlays.some((o) => o.blocks) || this.hackUI.open;
  }
  closeAll() {
    for (const o of [...this.overlays]) o.close();
    this.overlays = [];
    this.dlg.hide();
    if (this.band.isOpen) this.band.close();
  }

  update(dt: number) {
    this.hud.update(dt);
    this.dlg.update(dt);
    this.hackUI.update(dt);
    this.trial.update(dt);
    const inp = this.game.input;
    const top = this.overlays[this.overlays.length - 1];
    if (top && top.escClose && (inp.keyPressed('Escape') || (top.el === this.band.el && (inp.keyPressed('Tab') || inp.keyPressed('KeyI') || inp.keyPressed('KeyM'))))) {
      inp.consume('pause');
      inp.consume('band');
      top.close();
      audio.play('uiBack', { vol: 0.4 });
    }
  }

  // ---------------- title ----------------
  showTitle() {
    this.hideTitle();
    this.hud.show(false);
    const save = loadGame();
    const t = div('title-screen');
    t.innerHTML = `<div class="logo"><h1 data-t="GHASTMARINA">GHAST<span>MARINA</span></h1><h2>Voyage of the Betrayed</h2>
      <div class="sub">Twelve condemned strangers. Six haunted vessels. One traitor — and it might be you.</div></div>
      <div class="menu"></div><div class="title-foot">A GLOOMTECH™ PRODUCTION · BROADCAST LIVE ON THE UNDERNET · <span id="title-hint">CLICK OR PRESS ANY KEY TO ENABLE SOUND</span></div>`;
    const menu = t.querySelector('.menu')!;
    const add = (label: string, fn: () => void, disabled = false, cls = '') => {
      const b = document.createElement('button');
      b.className = 'btn ' + cls;
      b.innerHTML = label;
      b.disabled = disabled;
      b.addEventListener('mouseenter', () => audio.play('uiHover', { vol: 0.3 }));
      b.addEventListener('click', () => {
        audio.init();
        audio.play('uiConfirm', { vol: 0.5 });
        fn();
      });
      menu.appendChild(b);
      return b;
    };
    if (save) {
      const ch = CHAPTERS.find((c) => c.id === save.chapter);
      add(`Continue <small style="opacity:.6;margin-left:8px;letter-spacing:.05em;text-transform:none">${ch ? ch.num + ' — ' + ch.title : ''}</small>`, () => void this.game.continueGame());
    }
    add('New Game', () => this.difficultyPicker());
    add('Chapter Select', () => this.chapterSelect(), unlockedChapters().length === 0);
    add('Settings', () => this.openSettings());
    add('Controls', () => this.openControls());
    add('Credits', () => void this.showCredits(null));
    this.root.appendChild(t);
    this.title = t;
    const unlock = () => {
      audio.init();
      this.game.music.play('title', 2);
      audio.setAmbience('title');
      const h = t.querySelector('#title-hint');
      if (h) h.textContent = 'PRESS ENTER TO BEGIN';
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    if (audio.ctx) unlock();
    this.game.director.setupTitle();
  }
  hideTitle() {
    this.title?.remove();
    this.title = null;
  }

  private difficultyPicker() {
    const o = div('overlay');
    o.innerHTML = `<div class="panel window" style="height:auto;width:min(760px,94vw)"><header><h2>NEW VOYAGE</h2><button class="btn small x">Back</button></header><div class="body">
      <p style="font:400 14px var(--type);color:var(--dim);margin:0 0 16px">Choose how cruel the Captain should be. You can change difficulty later in Settings.</p>
      <div class="menu">
        <button class="btn" data-d="story">Story — <span style="text-transform:none;letter-spacing:.02em">“I’m here for the mystery.” Enemies hit softer, trials forgive more.</span></button>
        <button class="btn" data-d="survivor">Survivor — <span style="text-transform:none;letter-spacing:.02em">The intended experience.</span></button>
        <button class="btn danger" data-d="nightmare">Nightmare — <span style="text-transform:none;letter-spacing:.02em">The Undernet wants blood. Give it to them.</span></button>
      </div>${hasSave() ? '<p style="font:600 12px var(--ui);color:var(--red);margin-top:14px">Starting a new game will overwrite your current save.</p>' : ''}</div></div>`;
    this.root.appendChild(o);
    this.push(o, false);
    o.querySelector('.x')!.addEventListener('click', () => this.pop(o));
    o.querySelectorAll('[data-d]').forEach((b) =>
      b.addEventListener('click', () => {
        const d = (b as HTMLElement).dataset.d as any;
        this.pop(o);
        deleteSave();
        this.game.settings.set('difficulty', d);
        void this.game.newGame(d);
      }),
    );
  }

  private chapterSelect() {
    const un = unlockedChapters();
    const o = div('overlay');
    let html = `<div class="panel window" style="height:auto;max-height:88vh;width:min(760px,94vw)"><header><h2>CHAPTER SELECT</h2><button class="btn small x">Back</button></header><div class="body"><div class="menu">`;
    for (const c of CHAPTERS) {
      if (!un.includes(c.id)) continue;
      html += `<button class="btn" data-c="${c.id}">${c.num} — <span style="text-transform:none;letter-spacing:.03em">${c.title}</span></button>`;
    }
    html += '</div></div></div>';
    o.innerHTML = html;
    this.root.appendChild(o);
    this.push(o, false);
    o.querySelector('.x')!.addEventListener('click', () => this.pop(o));
    o.querySelectorAll('[data-c]').forEach((b) =>
      b.addEventListener('click', () => {
        this.pop(o);
        void this.game.newGame(this.game.settings.data.difficulty, (b as HTMLElement).dataset.c!);
      }),
    );
  }

  // ---------------- pause ----------------
  openPause() {
    if (this.overlays.some((o) => o.el.classList.contains('pause'))) return;
    const o = div('overlay pause');
    o.innerHTML = `<div class="panel" style="padding:26px 30px;min-width:360px"><h2 style="margin:0 0 18px;font:400 40px var(--display);letter-spacing:.2em">PAUSED</h2><div class="menu"></div>
      <p style="margin:16px 0 0;font:600 11px var(--ui);letter-spacing:.2em;color:var(--dim)">${CHAPTERS.find((c) => c.id === this.game.state.chapter)?.num ?? ''} · ${this.game.world?.def.name ?? ''}</p></div>`;
    const menu = o.querySelector('.menu')!;
    const add = (label: string, fn: () => void, cls = '') => {
      const b = document.createElement('button');
      b.className = 'btn ' + cls;
      b.textContent = label;
      b.addEventListener('click', () => {
        audio.play('uiConfirm', { vol: 0.4 });
        fn();
      });
      menu.appendChild(b);
    };
    const ov = this.push(o, true, true, () => {
      this.pop(o);
      this.game.paused = false;
      audio.setMuffle(false);
    });
    add('Resume', () => ov.close());
    add('GloomBand', () => {
      ov.close();
      this.openGloomBand();
    });
    add('Settings', () => this.openSettings());
    add('Controls', () => this.openControls());
    add('Load Last Save', () => {
      ov.close();
      void this.game.retry();
    });
    add('Quit to Title', () => {
      ov.close();
      void this.game.quitToTitle();
    }, 'danger');
    this.root.appendChild(o);
    this.game.paused = true;
    audio.setMuffle(true);
    audio.play('uiOpen', { vol: 0.4 });
  }

  openSettings() {
    const s = this.game.settings;
    const o = div('overlay');
    const row = (label: string, ctl: string) => `<div class="settings-row"><span>${label}</span>${ctl}</div>`;
    const slider = (k: string, min: number, max: number, step: number) => `<input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${(s.data as any)[k]}"><span data-v="${k}">${(s.data as any)[k]}</span>`;
    const seg = (k: string, opts: string[]) => `<div class="seg" data-k="${k}">${opts.map((x) => `<button data-o="${x}" class="${(s.data as any)[k] === x ? 'on' : ''}">${x}</button>`).join('')}</div><span></span>`;
    const tog = (k: string) => seg(k, ['on', 'off']).replace(/class="([^"]*)" *>(on|off)</g, (m) => m);
    o.innerHTML = `<div class="panel window" style="height:auto;max-height:90vh;width:min(780px,94vw)"><header><h2>SETTINGS</h2><button class="btn small x">Done</button></header><div class="body">
      ${row('Mouse sensitivity', slider('sensitivity', 0.2, 3, 0.05))}
      ${row('Invert Y', `<div class="seg" data-b="invertY"><button data-o="1" class="${s.data.invertY ? 'on' : ''}">On</button><button data-o="0" class="${!s.data.invertY ? 'on' : ''}">Off</button></div><span></span>`)}
      ${row('Field of view', slider('fov', 55, 100, 1))}
      ${row('Master volume', slider('master', 0, 1, 0.05))}
      ${row('Music volume', slider('music', 0, 1, 0.05))}
      ${row('Effects volume', slider('sfx', 0, 1, 0.05))}
      ${row('Voice babble', slider('voice', 0, 1, 0.05))}
      ${row('Graphics quality', seg('quality', ['low', 'medium', 'high']))}
      ${row('Difficulty', seg('difficulty', ['story', 'survivor', 'nightmare']))}
      ${row('Text speed', slider('textSpeed', 0.5, 3, 0.1))}
      ${row('Camera shake', slider('shake', 0, 1, 0.05))}
      ${row('Ink outlines', `<div class="seg" data-b="outlines"><button data-o="1" class="${s.data.outlines ? 'on' : ''}">On</button><button data-o="0" class="${!s.data.outlines ? 'on' : ''}">Off</button></div><span></span>`)}
      ${row('Film grain', `<div class="seg" data-b="grain"><button data-o="1" class="${s.data.grain ? 'on' : ''}">On</button><button data-o="0" class="${!s.data.grain ? 'on' : ''}">Off</button></div><span></span>`)}
      ${row('Tutorial hints', `<div class="seg" data-b="showHints"><button data-o="1" class="${s.data.showHints ? 'on' : ''}">On</button><button data-o="0" class="${!s.data.showHints ? 'on' : ''}">Off</button></div><span></span>`)}
      </div></div>`;
    void tog;
    this.root.appendChild(o);
    this.push(o, true);
    o.querySelector('.x')!.addEventListener('click', () => this.pop(o));
    o.querySelectorAll('input[type=range]').forEach((inp) =>
      inp.addEventListener('input', () => {
        const el = inp as HTMLInputElement;
        const k = el.dataset.k as any;
        s.set(k, parseFloat(el.value) as any);
        o.querySelector(`[data-v="${k}"]`)!.textContent = el.value;
      }),
    );
    o.querySelectorAll('.seg[data-k]').forEach((sg) =>
      sg.querySelectorAll('button').forEach((b) =>
        b.addEventListener('click', () => {
          const k = (sg as HTMLElement).dataset.k as any;
          s.set(k, b.dataset.o as any);
          if (k === 'difficulty') this.game.state.difficulty = b.dataset.o as any;
          sg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
          audio.play('uiHover', { vol: 0.3 });
        }),
      ),
    );
    o.querySelectorAll('.seg[data-b]').forEach((sg) =>
      sg.querySelectorAll('button').forEach((b) =>
        b.addEventListener('click', () => {
          const k = (sg as HTMLElement).dataset.b as any;
          s.set(k, (b.dataset.o === '1') as any);
          sg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
          audio.play('uiHover', { vol: 0.3 });
        }),
      ),
    );
  }

  openControls() {
    const o = div('overlay');
    const k = (keys: string) => keys.split(' ').map((x) => `<span class="kbd">${x}</span>`).join('');
    const rows: [string, string][] = [
      ['Move', 'W A S D'], ['Look', 'Mouse'], ['Sprint', 'Shift'], ['Sneak', 'Ctrl/C'], ['Dodge roll (i-frames)', 'Space'],
      ['Attack / Fire', 'LMB'], ['Aim', 'RMB'], ['Reload', 'R'], ['Interact / Takedown', 'E'], ['GloomBand light', 'F'],
      ['Heal (auto-picks item)', 'H'], ['Throw flare', 'G'], ['Throw pipe bomb', 'B'], ['Weapons', '1 2 3 4'], ['Quick swap', 'Q'],
      ['GloomBand', 'Tab'], ['Map', 'M'], ['Pause', 'Esc'],
    ];
    o.innerHTML = `<div class="panel window" style="height:auto;width:min(780px,94vw)"><header><h2>CONTROLS</h2><button class="btn small x">Done</button></header><div class="body">
      <div class="controls-table">${rows.map(([a, b]) => `<div><span>${a}</span><span>${k(b)}</span></div>`).join('')}</div>
      <p style="font:400 13px var(--ui);color:var(--dim);margin-top:16px">Gamepad supported: left stick move, right stick look, RT fire, LT aim, A interact, B dodge, X reload, Y swap, LB flare, RB heal, View = GloomBand.<br>
      Tips: sneak up behind unaware mutants for a silent takedown. Your GloomBand light makes you visible — turn it off to hide, but darkness erodes sanity. Gloomy mushrooms restore it.</p></div></div>`;
    this.root.appendChild(o);
    this.push(o, true);
    o.querySelector('.x')!.addEventListener('click', () => this.pop(o));
  }

  // ---------------- game over ----------------
  showGameOver() {
    this.hud.show(false);
    const o = div('overlay');
    const lines = ['You fed the abyss.', 'The viewers loved that one.', 'The Captain sends his condolences. And a replay.', 'Somewhere, a viewer tipped 5¢ for your death.'];
    o.innerHTML = `<div class="gameover"><h1>YOU DIED</h1><p>${lines[Math.floor(Math.random() * lines.length)]}</p><div class="menu"><button class="btn r">Retry from last save</button><button class="btn danger q">Quit to title</button></div></div>`;
    this.root.appendChild(o);
    this.gameOverEl = o;
    this.push(o, true, false);
    o.querySelector('.r')!.addEventListener('click', () => void this.game.retry());
    o.querySelector('.q')!.addEventListener('click', () => {
      this.hideGameOver();
      void this.game.quitToTitle();
    });
  }
  hideGameOver() {
    if (this.gameOverEl) this.pop(this.gameOverEl);
    this.gameOverEl = null;
  }

  // ---------------- gloomband ----------------
  openGloomBand(tab?: BandTab) {
    if (this.band.isOpen) return Promise.resolve();
    this.band.open(tab);
    this.push(this.band.el, true, true, () => this.band.close());
    return new Promise<void>((res) => {
      const prev = this.band.onClose;
      this.band.onClose = () => {
        this.pop(this.band.el);
        this.band.onClose = prev;
        res();
      };
    });
  }

  // ---------------- hack ----------------
  async hack(diff: number) {
    if (this.game.autoplay >= 0) return true;
    this.game.input.exitLock();
    const ok = await this.hackUI.start(diff);
    return ok;
  }

  // ---------------- readers ----------------
  showLog(id: string): Promise<void> {
    const l = LOGS[id];
    if (!l) return Promise.resolve();
    return new Promise((res) => {
      const o = div('overlay');
      o.innerHTML = `<div class="panel logview"><header>${icon('log')}<h3>${l.title}</h3><span class="tag">${l.where}</span><div class="wave" style="margin-left:auto">${'<i></i>'.repeat(12)}</div></header>
        <div style="padding:10px 18px 0;font:600 12px var(--ui);color:var(--dim);letter-spacing:.15em">VOYAGELOG · ${l.speaker.toUpperCase()}</div>
        <div class="reader"></div><footer><button class="btn small">Close <span class="kbd">E</span></button></footer></div>`;
      o.querySelectorAll('.wave i').forEach((w, i) => ((w as HTMLElement).style.animationDelay = `${i * 0.07}s`));
      this.root.appendChild(o);
      const reader = o.querySelector('.reader') as HTMLElement;
      let shown = 0;
      const full = l.text;
      const timer = setInterval(() => {
        shown = Math.min(full.length, shown + 3);
        reader.innerHTML = markup(full.slice(0, shown));
        if (shown % 9 === 0) audio.voiceBlip(l.speaker.includes('Captain') ? 75 : 150 + (l.title.length % 7) * 12, 0.3, 0.6);
        if (shown >= full.length) clearInterval(timer);
      }, 16);
      const close = () => {
        clearInterval(timer);
        this.pop(o);
        res();
      };
      const ov = this.push(o, true, true, close);
      o.querySelector('button')!.addEventListener('click', () => ov.close());
      if (this.game.autoplay >= 0) setTimeout(() => ov.close(), 500);
      const key = (e: KeyboardEvent) => {
        if (e.code === 'KeyE' || e.code === 'Enter') {
          if (shown < full.length) {
            shown = full.length;
            reader.innerHTML = markup(full);
          } else {
            window.removeEventListener('keydown', key);
            ov.close();
          }
        }
      };
      window.addEventListener('keydown', key);
      audio.play('uiOpen', { vol: 0.4 });
      this.hud.toast(`VoyageLog: “${l.title}” saved`, 'info', 'log');
    });
  }

  showTerminal(title: string, text: string): Promise<void> {
    return new Promise((res) => {
      const o = div('overlay terminal');
      o.innerHTML = `<div class="panel logview"><header>${icon('info', '#7dff8a')}<h3>${title}</h3></header><div class="reader">${markup(text)}</div><footer><button class="btn small">Close <span class="kbd">Esc</span></button></footer></div>`;
      this.root.appendChild(o);
      const ov = this.push(o, true, true, () => {
        this.pop(o);
        res();
      });
      o.querySelector('button')!.addEventListener('click', () => ov.close());
      if (this.game.autoplay >= 0) setTimeout(() => ov.close(), 500);
    });
  }

  evidenceCard(id: string): Promise<void> {
    const e = EVIDENCE[id];
    if (!e) return Promise.resolve();
    return new Promise((res) => {
      const o = div('cardfx');
      o.innerHTML = `<div class="hd">TRUTH BULLET ACQUIRED</div><div class="bd"><h3>${e.name}</h3><p>${e.desc}</p><div class="hint2">ADDED TO GLOOMBAND › EVIDENCE · CLICK TO CONTINUE</div></div>`;
      this.root.appendChild(o);
      const ov = this.push(o, true, true, () => {
        this.pop(o);
        res();
      });
      o.addEventListener('mousedown', () => ov.close());
      if (this.game.autoplay >= 0) setTimeout(() => ov.close(), 500);
      const k = (ev: KeyboardEvent) => {
        if (['KeyE', 'Enter', 'Space'].includes(ev.code)) {
          window.removeEventListener('keydown', k);
          ov.close();
        }
      };
      setTimeout(() => window.addEventListener('keydown', k), 300);
    });
  }

  chapterCard(num: string, title: string, sub: string): Promise<void> {
    const o = div('chapter', `<small>${num}</small><h1>${title}</h1><p>${sub}</p>`);
    this.root.appendChild(o);
    audio.play('bell', { vol: 0.5, pitch: 0.5 });
    return new Promise((res) =>
      setTimeout(() => {
        o.remove();
        res();
      }, this.game.autoplay >= 0 ? 700 : 5600),
    );
  }

  async narrate(lines: string[], hold = 3.2) {
    const p = this.narrEl.querySelector('p') as HTMLElement;
    this.narrEl.classList.remove('hidden');
    for (const l of lines) {
      p.style.opacity = '0';
      p.textContent = l;
      await new Promise((r) => setTimeout(r, 60));
      p.style.opacity = '1';
      let skip = false;
      const sk = () => (skip = true);
      window.addEventListener('keydown', sk, { once: true });
      window.addEventListener('mousedown', sk, { once: true });
      const t0 = performance.now();
      if (this.game.autoplay >= 0) skip = true;
      while (performance.now() - t0 < (hold + l.length * 0.035) * 1000 && !skip) await new Promise((r) => setTimeout(r, 50));
      window.removeEventListener('keydown', sk);
      window.removeEventListener('mousedown', sk);
      p.style.opacity = '0';
      await new Promise((r) => setTimeout(r, 900));
    }
    this.narrEl.classList.add('hidden');
  }

  // ---------------- shops ----------------
  openWorkbench(): Promise<void> {
    return new Promise((res) => {
      const o = div('overlay');
      this.root.appendChild(o);
      const st = this.game.state;
      const render = () => {
        let html = `<div class="panel window shop" style="width:min(860px,94vw)"><header>${icon('scrap')}<h2>ISAAC’S WORKBENCH</h2><span class="tag">Scrap: ${st.inv.scrap ?? 0}</span><button class="btn small x">Close</button></header><div class="body">`;
        html += `<p style="font:400 13px var(--ui);color:var(--dim);margin:0 0 10px">Upgrades cost Scrap. Each weapon has three tiers per stat.</p>`;
        for (const id of ['pipe', 'axe', 'pistol', 'shotgun', 'arc'] as WeaponId[]) {
          if (id !== 'pipe' && !st.weapons[id]) continue;
          const w = WEAPONS[id];
          const up = st.upgrades[id] ?? { dmg: 0, mag: 0, reload: 0 };
          const btn = (stat: 'dmg' | 'mag' | 'reload', label: string) => {
            if (w.kind === 'melee' && stat !== 'dmg') return '';
            const lv = up[stat];
            if (lv >= 3) return `<button class="btn small" disabled>${label} MAX</button>`;
            const cost = UPGRADE_COST[lv];
            return `<button class="btn small up" data-w="${id}" data-s="${stat}" ${(st.inv.scrap ?? 0) >= cost ? '' : 'disabled'}>${label} ${lv + 1} · ${cost} scrap</button>`;
          };
          html += `<div class="row">${icon(id === 'pipe' ? 'pipe' : ITEMS[id as any as 'pistol'].icon)}<div class="nm">${w.name}<small>Damage +${up.dmg * 15}%${w.kind === 'gun' ? ` · Magazine +${up.mag * 25}% · Reload −${up.reload * 15}%` : ''}</small></div>${btn('dmg', 'Damage')}${btn('mag', 'Mag')}${btn('reload', 'Reload')}</div>`;
        }
        html += `<h3 style="font:400 22px var(--display);letter-spacing:.12em;margin:18px 0 6px">CRAFTING</h3>`;
        RECIPES.forEach((r, i) => {
          const can = Object.entries(r.cost).every(([k, v]) => ((st.inv as any)[k] ?? 0) >= (v as number));
          html += `<div class="row">${icon(ITEMS[r.out].icon)}<div class="nm">${ITEMS[r.out].name} ×${r.n}<small>${Object.entries(r.cost).map(([k, v]) => `${v} ${ITEMS[k as any as 'scrap'].name} (have ${(st.inv as any)[k] ?? 0})`).join(' + ')}</small></div><button class="btn small craft" data-i="${i}" ${can ? '' : 'disabled'}>Craft</button></div>`;
        });
        html += '</div></div>';
        o.innerHTML = html;
        o.querySelector('.x')!.addEventListener('click', () => ov.close());
        o.querySelectorAll('.up').forEach((b) =>
          b.addEventListener('click', () => {
            const id = (b as HTMLElement).dataset.w as WeaponId;
            const stat = (b as HTMLElement).dataset.s as 'dmg' | 'mag' | 'reload';
            const up = st.upgrades[id] ?? { dmg: 0, mag: 0, reload: 0 };
            const cost = UPGRADE_COST[up[stat]];
            if ((st.inv.scrap ?? 0) < cost) return;
            st.inv.scrap = (st.inv.scrap ?? 0) - cost;
            up[stat]++;
            st.upgrades[id] = up;
            audio.play('levelUp', { vol: 0.4 });
            render();
          }),
        );
        o.querySelectorAll('.craft').forEach((b) =>
          b.addEventListener('click', () => {
            const r = RECIPES[+(b as HTMLElement).dataset.i!];
            for (const [k, v] of Object.entries(r.cost)) (st.inv as any)[k] -= v as number;
            st.inv[r.out] = Math.min(ITEMS[r.out].max ?? 99, (st.inv[r.out] ?? 0) + r.n);
            audio.play('pickup', { vol: 0.5 });
            render();
          }),
        );
      };
      const ov = this.push(o, true, true, () => {
        this.pop(o);
        res();
      });
      render();
    });
  }

  openVendor(): Promise<void> {
    return new Promise((res) => {
      const o = div('overlay');
      this.root.appendChild(o);
      const st = this.game.state;
      const render = () => {
        let html = `<div class="panel window shop" style="width:min(760px,94vw)"><header>${icon('credit')}<h2>GLOOMMART™</h2><span class="wallet">¢ ${st.credits.toLocaleString()}</span><button class="btn small x">Close</button></header><div class="body">
          <p style="font:400 13px var(--type);color:var(--dim);margin:0 0 10px">“Thank you for shopping at GloomMart™, where every purchase is watched with love!” — Credits come from viewer tips. Be spectacular.</p>`;
        VENDOR.forEach((v, i) => {
          const d = ITEMS[v.id];
          const locked = (v.id === 'pistolAmmo' && !st.weapons.pistol) || (v.id === 'shells' && !st.weapons.shotgun) || (v.id === 'cells' && !st.weapons.arc);
          html += `<div class="row">${icon(d.icon)}<div class="nm">${d.name} ×${v.n}<small>${d.desc} (have ${st.inv[v.id] ?? 0})</small></div><div class="price">¢ ${v.price}</div><button class="btn small buy" data-i="${i}" ${st.credits >= v.price && !locked ? '' : 'disabled'}>${locked ? 'Locked' : 'Buy'}</button></div>`;
        });
        html += '</div></div>';
        o.innerHTML = html;
        o.querySelector('.x')!.addEventListener('click', () => ov.close());
        o.querySelectorAll('.buy').forEach((b) =>
          b.addEventListener('click', () => {
            const v = VENDOR[+(b as HTMLElement).dataset.i!];
            if (st.credits < v.price) return;
            st.credits -= v.price;
            st.inv[v.id] = Math.min(ITEMS[v.id].max ?? 99, (st.inv[v.id] ?? 0) + v.n);
            audio.play('coin', { vol: 0.6 });
            render();
          }),
        );
      };
      const ov = this.push(o, true, true, () => {
        this.pop(o);
        res();
      });
      render();
    });
  }

  // ---------------- credits ----------------
  showCredits(ending: 'witness' | 'instrument' | null): Promise<void> {
    return new Promise((res) => {
      const st = this.game.state;
      const o = div('credits');
      const castList = SURVIVORS.map((id) => `<p class="${ending && !st.alive[id] ? 'dead' : ''}">${CAST[id].name} — <span style="color:var(--dim)">${CAST[id].title}</span></p>`).join('');
      o.innerHTML = `<div class="roll">
        <h1>GHASTMARINA</h1><p style="letter-spacing:.5em;color:var(--cyan)">VOYAGE OF THE BETRAYED</p>
        ${ending ? `<h3>Ending</h3><p>${ending === 'witness' ? 'THE WITNESS' : 'THE INSTRUMENT'}</p>` : ''}
        <h3>The Twelve</h3>${castList}
        <h3>And</h3><p>The Captain</p><p>Gloomy (as himself)</p><p>Finn the Mascot (formerly a seal)</p>
        <h3>Story & World</h3><p>From the GhastMarina design documents</p>
        <h3>Engine</h3><p>Three.js · Web Audio · TypeScript</p><p>Every model, texture, sound and note generated procedurally at runtime</p>
        <h3>Your Broadcast</h3><p>Peak viewers: ${st.viewers.toLocaleString()}</p><p>Gloom Credits earned: ${st.credits.toLocaleString()}</p><p>Mutants put down: ${st.kills}</p><p>Gloomies found: ${st.gloomy.length} / 30</p><p>Recordings found: ${st.logs.length} / ${Object.keys(LOGS).length}</p><p>Deaths: ${st.deaths}</p>
        <h3>Sponsored by</h3><p>GloomTech Industries™ — “GloomTech Industries is not aware of Ghastmarina.”</p>
        <h3 style="margin-top:120px">Stage 2</h3><p>Coming whether you like it or not.</p>
        <p style="margin-top:60px;color:var(--dim)">Thank you for watching.</p>
        <button class="btn" style="margin:40px auto 200px;display:block;text-align:center">Continue</button>
      </div>`;
      this.root.appendChild(o);
      const ov = this.push(o, false, true, () => {
        this.pop(o);
        res();
      });
      o.querySelector('button')!.addEventListener('click', () => ov.close());
      setTimeout(() => ov.close(), 75000);
    });
  }
}
