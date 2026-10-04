import type { Game } from '../game/Game';
import type { Boss } from '../entities/Bosses';
import { WEAPONS, ITEMS } from '../game/Items';
import { icon } from './icons';
import { CAST } from '../chars/Cast';

const h = (tag: string, cls = '', html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

export class HUD {
  el: HTMLDivElement;
  private hp: HTMLElement;
  private hpLag: HTMLElement;
  private st: HTMLElement;
  private san: HTMLElement;
  private hpTxt: HTMLElement;
  private sanTxt: HTMLElement;
  private heads: HTMLElement;
  private wname: HTMLElement;
  private wammo: HTMLElement;
  private wslots: HTMLElement;
  private wreload: HTMLElement;
  private live: HTMLElement;
  private obj: HTMLElement;
  private promptEl: HTMLElement;
  private cross: HTMLElement;
  private hit: HTMLElement;
  private dmg: HTMLElement;
  private toasts: HTMLElement;
  private tips: HTMLElement;
  private bannerEl: HTMLElement;
  private areaEl: HTMLElement;
  private whisperEl: HTMLElement;
  private subEl: HTMLElement;
  private hintEl: HTMLElement;
  private boss: HTMLElement;
  private bossFill: HTMLElement;
  private bossRef: Boss | null = null;
  private hitT = 0;
  private subT = 0;
  private hintT = 0;
  private last: Record<string, string> = {};
  visible = false;
  objectiveText = '';

  constructor(private game: Game, root: HTMLElement) {
    const el = h('div', 'off') as HTMLDivElement;
    el.id = 'hud';
    this.el = el;
    // vitals
    const v = h('div', 'vitals');
    v.appendChild(h('div', 'lbl', '<span>HEALTH</span><span id="hp-t"></span>'));
    const hpb = h('div', 'bar');
    this.hpLag = h('b');
    this.hp = h('i');
    hpb.append(this.hpLag, this.hp);
    v.appendChild(hpb);
    const stb = h('div', 'bar stam');
    this.st = h('i');
    stb.appendChild(this.st);
    v.appendChild(stb);
    v.appendChild(h('div', 'lbl', '<span>SANITY</span><span id="san-t"></span>'));
    const sb = h('div', 'bar san');
    this.san = h('i');
    sb.appendChild(this.san);
    v.appendChild(sb);
    this.heads = h('div', 'heads');
    v.appendChild(this.heads);
    el.appendChild(v);
    this.hpTxt = v.querySelector('#hp-t')!;
    this.sanTxt = v.querySelector('#san-t')!;
    // weapon
    const w = h('div', 'weapon');
    this.wreload = h('div', 'reload');
    this.wname = h('div', 'name');
    this.wammo = h('div', 'ammo');
    this.wslots = h('div', 'slots');
    w.append(this.wreload, this.wname, this.wammo, this.wslots);
    el.appendChild(w);
    // live
    this.live = h('div', 'live');
    el.appendChild(this.live);
    this.obj = h('div', 'objective hidden');
    el.appendChild(this.obj);
    this.promptEl = h('div', 'prompt');
    el.appendChild(this.promptEl);
    this.cross = h('div', 'crosshair', '<i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><i class="d"></i>');
    el.appendChild(this.cross);
    this.hit = h('div', 'hitmark');
    el.appendChild(this.hit);
    this.dmg = h('div', 'dmgind');
    el.appendChild(this.dmg);
    this.toasts = h('div', 'toasts');
    el.appendChild(this.toasts);
    this.tips = h('div', 'tips');
    el.appendChild(this.tips);
    this.boss = h('div', 'bossbar hidden');
    this.boss.innerHTML = '<h3></h3><small></small><div class="bar"><b></b><i></i></div>';
    this.bossFill = this.boss.querySelector('i')!;
    el.appendChild(this.boss);
    root.appendChild(el);
    // non-hud-hidden layers
    this.bannerEl = h('div', 'banner');
    this.areaEl = h('div', 'area');
    this.whisperEl = h('div', 'whisper');
    this.subEl = h('div', 'subtitle');
    this.hintEl = h('div', 'hint');
    root.append(this.bannerEl, this.areaEl, this.whisperEl, this.subEl, this.hintEl);
  }

  show(on: boolean) {
    this.visible = on;
    this.el.classList.toggle('off', !on);
  }

  private set(key: string, el: HTMLElement, html: string) {
    if (this.last[key] === html) return;
    this.last[key] = html;
    el.innerHTML = html;
  }

  update(dt: number) {
    const g = this.game;
    const w = g.world;
    this.hitT = Math.max(0, this.hitT - dt);
    this.hit.style.opacity = this.hitT > 0 ? '1' : '0';
    this.subT -= dt;
    if (this.subT <= 0) this.subEl.style.opacity = '0';
    this.hintT -= dt;
    if (this.hintT <= 0 && this.hintEl.innerHTML) this.hintEl.innerHTML = '';
    if (!w || !this.visible) return;
    const st = g.state;
    const pl = w.player;
    this.hp.style.transform = `scaleX(${Math.max(0, st.hp / st.maxHp)})`;
    this.hpLag.style.transform = `scaleX(${Math.max(0, st.hp / st.maxHp)})`;
    this.st.style.transform = `scaleX(${pl.stamina / 100})`;
    this.san.style.transform = `scaleX(${st.sanity / 100})`;
    this.set('hpt', this.hpTxt, `${Math.ceil(st.hp)}/${st.maxHp}`);
    this.set('sant', this.sanTxt, st.sanity < 25 ? '<span style="color:#ff5fd2">FRAYING</span>' : `${Math.round(st.sanity)}%`);
    const inv = st.inv;
    this.set('heads', this.heads,
      `<div title="Medkits / Bandages (H)">${icon('medkit')}${inv.medkit ?? 0}<span style="opacity:.5">/</span>${inv.bandage ?? 0}</div>` +
      `<div title="Calm Pills">${icon('pills')}${inv.pills ?? 0}</div>` +
      `<div title="Flares (G)">${icon('flare')}${inv.flare ?? 0}</div>` +
      `<div title="Pipe bombs (B)">${icon('bomb')}${inv.pipebomb ?? 0}</div>` +
      `<div title="GloomBand light (F)" style="color:${pl.flashlight ? '#3ef0ff' : '#556'}">${icon('bulb', pl.flashlight ? '#3ef0ff' : '#556')}${pl.flashlight ? 'ON' : 'OFF'}</div>`);
    const wd = WEAPONS[pl.equipped];
    this.set('wn', this.wname, wd.name.toUpperCase());
    if (wd.kind === 'gun') {
      const mag = st.mag[pl.equipped] ?? 0;
      const res = st.inv[wd.ammo!] ?? 0;
      this.set('wa', this.wammo, `${mag}<small> / ${res}</small>`);
      this.wammo.classList.toggle('low', mag <= Math.ceil(pl.magSize(pl.equipped) * 0.25));
    } else {
      this.set('wa', this.wammo, `<small>MELEE</small>`);
      this.wammo.classList.remove('low');
    }
    this.set('wr', this.wreload, pl.reloadT >= 0 ? 'RELOADING' : pl.healT >= 0 ? 'HEALING' : '');
    const slots = (['pipe', 'pistol', 'shotgun', 'arc'] as const).map((id, i) => {
      const own = id === 'pipe' ? true : st.weapons[id];
      const on = id === 'pipe' ? WEAPONS[pl.equipped].kind === 'melee' : pl.equipped === id;
      return own ? `<span class="${on ? 'on' : ''}">${i + 1}</span>` : '';
    });
    this.set('ws', this.wslots, slots.join(''));
    this.set('live', this.live, `<span class="dot"></span><span>LIVE</span><span class="v">${st.viewers.toLocaleString()} watching</span><span class="c">¢ ${st.credits.toLocaleString()}</span>`);
    // crosshair spread
    const spread = wd.kind === 'gun' ? (pl.aiming ? wd.spreadAim : wd.spreadHip) * 260 + pl.spreadBloom * 14 + 4 : 4;
    this.cross.classList.toggle('melee', wd.kind === 'melee');
    const cs = this.cross.children as HTMLCollectionOf<HTMLElement>;
    cs[0].style.top = `${-spread - 8}px`;
    cs[1].style.top = `${spread}px`;
    cs[2].style.left = `${-spread - 8}px`;
    cs[3].style.left = `${spread}px`;
    this.cross.style.opacity = g.cinematic || pl.dead ? '0' : '1';
    if (this.bossRef) {
      const b = this.bossRef;
      this.bossFill.style.transform = `scaleX(${Math.max(0, b.hp / b.maxHp)})`;
      if (b.dead) this.bossBar(null);
    }
  }

  weaponChanged() {
    this.last.wn = '';
  }

  prompt(text: string) {
    if (!text) {
      this.set('prompt', this.promptEl, '');
      return;
    }
    const pad = this.game.input.lastDevice === 'pad';
    this.set('prompt', this.promptEl, `<span class="kbd">${pad ? 'A' : 'E'}</span> ${text}`);
  }

  objective(text: string) {
    this.objectiveText = text;
    if (!text) {
      this.obj.classList.add('hidden');
      return;
    }
    this.obj.classList.remove('hidden');
    this.obj.innerHTML = `<small>OBJECTIVE</small>${text}`;
    this.obj.classList.remove('flash');
    void this.obj.offsetWidth;
    this.obj.classList.add('flash');
  }

  toast(text: string, kind = 'info', ic?: string) {
    const t = h('div', 'toast ' + kind, `${icon(ic ?? (kind === 'warn' ? 'warn' : kind === 'heal' ? 'heart' : kind === 'sanity' ? 'eye' : kind === 'gloomy' ? 'gloomy' : kind === 'credit' ? 'credit' : kind === 'save' ? 'save' : 'info'))}<span>${text}</span>`);
    this.toasts.prepend(t);
    while (this.toasts.children.length > 6) this.toasts.lastChild?.remove();
    setTimeout(() => t.classList.add('out'), 3000);
    setTimeout(() => t.remove(), 3500);
  }

  tip(n: number, label: string | null) {
    const t = h('div', 'tipx', `+${n} ¢ tip${label ? `<b>${label}</b>` : ''}`);
    this.tips.prepend(t);
    while (this.tips.children.length > 4) this.tips.lastChild?.remove();
    setTimeout(() => t.remove(), 2500);
  }

  hitMarker(head: boolean) {
    this.hitT = 0.12;
    this.hit.classList.toggle('head', head);
  }

  damageFrom(from: { x: number; z: number }, pp: { x: number; z: number }, camYaw: number) {
    const ang = Math.atan2(from.x - pp.x, from.z - pp.z);
    // camera forward = yaw + PI in model terms
    const rel = ang - (camYaw + Math.PI);
    const i = h('i');
    const deg = (-rel * 180) / Math.PI + 180;
    i.style.transformOrigin = '35px 130px';
    i.style.transform = `rotate(${deg}deg)`;
    this.dmg.appendChild(i);
    setTimeout(() => (i.style.opacity = '0'), 400);
    setTimeout(() => i.remove(), 1100);
  }

  banner(title: string, sub = '') {
    this.bannerEl.innerHTML = `<h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}`;
    this.bannerEl.classList.remove('show');
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('show');
  }

  areaTitle(name: string, sub: string) {
    this.areaEl.innerHTML = `<h1>${name.toUpperCase()}</h1><p>${sub}</p>`;
    this.areaEl.classList.remove('show');
    void this.areaEl.offsetWidth;
    this.areaEl.classList.add('show');
  }

  whisper(text: string) {
    this.whisperEl.textContent = text;
    this.whisperEl.classList.remove('show');
    void this.whisperEl.offsetWidth;
    this.whisperEl.classList.add('show');
  }

  subtitle(who: string, text: string, dur = 4) {
    const c = (CAST as any)[who];
    const name = c ? c.name : who;
    const color = c ? c.color : '#3ef0ff';
    this.subEl.innerHTML = `<b style="color:${color}">${name}:</b>${text}`;
    this.subEl.style.opacity = '1';
    this.subT = dur;
  }

  hint(text: string, dur = 5) {
    if (!this.game.settings.data.showHints) return;
    this.hintEl.innerHTML = text.replace(/\[(\w+)\]/g, '<span class="kbd">$1</span>');
    this.hintT = dur;
  }

  bossBar(b: Boss | null) {
    this.bossRef = b;
    if (!b) {
      this.boss.classList.add('hidden');
      return;
    }
    this.boss.classList.remove('hidden');
    this.boss.querySelector('h3')!.textContent = b.info.name;
    this.boss.querySelector('small')!.textContent = b.info.title;
  }
}
export { ITEMS };
