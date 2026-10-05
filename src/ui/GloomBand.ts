import type { Game } from '../game/Game';
import { ITEMS, RECIPES, SKILLS, WEAPONS } from '../game/Items';
import { EVIDENCE, LOGS, GLOOMNET, CHAPTERS } from '../story/Lore';
import { icon } from './icons';
import { audio } from '../core/Audio';
import { CAST, SURVIVORS } from '../chars/Cast';
import { CELL, T } from '../world/Level';
import type { ItemId } from '../world/LevelDef';
import { markup } from './Dialogue';

export type BandTab = 'status' | 'inventory' | 'evidence' | 'logs' | 'messages' | 'map' | 'net' | 'missions';

const TABS: [BandTab, string][] = [
  ['status', 'Status'], ['inventory', 'Inventory'], ['evidence', 'Evidence'], ['logs', 'VoyageLog'], ['messages', 'GloomText'], ['map', 'Map'], ['net', 'GloomNet'], ['missions', 'Survivors'],
];

export class GloomBandUI {
  el: HTMLDivElement;
  private body!: HTMLElement;
  private tab: BandTab = 'status';
  private booted = false;
  private sel: string | null = null;
  onClose: (() => void) | null = null;

  constructor(private game: Game, root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'overlay hidden';
    root.appendChild(this.el);
  }

  open(tab?: BandTab) {
    this.tab = tab ?? this.tab;
    this.sel = null;
    this.el.classList.remove('hidden');
    this.el.innerHTML = `<div class="panel window">
      <header>${icon('gloomy', '#3ef0ff')}<h2>GLOOMOS</h2><span class="tag">Participant #07 · Noah</span><span class="tag" id="gb-ch"></span><button class="btn small x">Close <span class="kbd">Tab</span></button></header>
      <div class="tabs"></div><div class="body"></div></div>`;
    if (!this.booted) {
      this.booted = true;
      const boot = document.createElement('div');
      boot.className = 'boot';
      boot.innerHTML = '<div class="g"></div><p>GLOOMOS</p>';
      this.el.querySelector('.window')!.appendChild(boot);
      audio.play('chime', { vol: 0.4 });
    }
    this.el.querySelector('.x')!.addEventListener('click', () => this.close());
    const ch = CHAPTERS.find((c) => c.id === this.game.state.chapter);
    this.el.querySelector('#gb-ch')!.textContent = ch ? ch.num : '';
    const tabs = this.el.querySelector('.tabs')!;
    for (const [id, label] of TABS) {
      const b = document.createElement('button');
      b.textContent = label;
      if (id === 'messages') {
        const unread = this.game.state.messages.filter((m) => !m.read).length;
        if (unread) b.textContent += ` (${unread})`;
      }
      b.className = id === this.tab ? 'on' : '';
      b.addEventListener('click', () => {
        this.tab = id;
        this.sel = null;
        audio.play('uiHover', { vol: 0.3 });
        this.open(id);
      });
      tabs.appendChild(b);
    }
    this.body = this.el.querySelector('.body')!;
    this.render();
    audio.play('uiOpen', { vol: 0.4 });
  }

  close() {
    this.el.classList.add('hidden');
    this.el.innerHTML = '';
    audio.play('uiBack', { vol: 0.4 });
    this.onClose?.();
  }
  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  private render() {
    const f = (this as any)['r_' + this.tab];
    if (f) f.call(this);
  }

  private r_status() {
    const st = this.game.state;
    const h = (n: number) => `${Math.floor(n / 3600)}h ${Math.floor((n % 3600) / 60)}m`;
    let html = `<div class="stats">
      <div class="stat"><small>HEALTH</small><b>${Math.ceil(st.hp)} / ${st.maxHp}</b></div>
      <div class="stat"><small>SANITY</small><b>${Math.round(st.sanity)}%</b></div>
      <div class="stat"><small>SUSPICION ON YOU</small><b style="color:${st.suspicion > 60 ? '#ff2a4a' : st.suspicion > 30 ? '#ffd84a' : '#7dff8a'}">${Math.round(st.suspicion)}%</b></div>
      <div class="stat"><small>VIEWERS</small><b>${st.viewers.toLocaleString()}</b></div>
      <div class="stat"><small>GLOOM CREDITS</small><b style="color:#ffd84a">¢ ${st.credits.toLocaleString()}</b></div>
      <div class="stat"><small>KILLS · DEATHS · PLAYTIME</small><b>${st.kills} · ${st.deaths} · ${h(st.playTime)}</b></div>
    </div>
    <h3 style="margin:0 0 10px;font:400 24px var(--display);letter-spacing:.12em">SKILLS <span class="tag" style="margin-left:8px">Insight available: ${st.insight}</span></h3>
    <p style="margin:-4px 0 12px;font:400 12px var(--ui);color:var(--dim)">Earn Insight from bosses, Deck Trials and every 5 Gloomies found.</p>
    <div class="skills">`;
    for (const br of ['Survival', 'Combat', 'Mind'] as const) {
      html += `<div><h5>${br.toUpperCase()}</h5>`;
      for (const s of SKILLS.filter((x) => x.branch === br)) {
        const r = st.skills[s.id] ?? 0;
        html += `<div class="skill" data-id="${s.id}"><h6>${s.name} ${r >= s.max ? '<span class="tag">MAX</span>' : ''}</h6><p>${s.desc}</p><div class="pips">${Array.from({ length: s.max }, (_, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('')}</div></div>`;
      }
      html += '</div>';
    }
    html += '</div>';
    this.body.innerHTML = html;
    this.body.querySelectorAll('.skill').forEach((el) =>
      el.addEventListener('click', () => {
        const id = (el as HTMLElement).dataset.id as any;
        const def = SKILLS.find((s) => s.id === id)!;
        const r = st.skills[def.id] ?? 0;
        if (st.insight <= 0 || r >= def.max) {
          audio.play('wrong', { vol: 0.4 });
          return;
        }
        st.insight--;
        st.skills[def.id] = r + 1;
        if (def.id === 'tough') {
          st.maxHp += 20;
          st.hp += 20;
        }
        audio.play('levelUp', { vol: 0.5 });
        this.render();
      }),
    );
  }

  private r_inventory() {
    const st = this.game.state;
    const cats: [string, string[]][] = [
      ['Weapons', ['pipe', 'axe', 'pistol', 'shotgun', 'arc']],
      ['Ammunition', ['pistolAmmo', 'shells', 'cells']],
      ['Medical', ['medkit', 'bandage', 'pills']],
      ['Throwables', ['flare', 'pipebomb']],
      ['Materials', ['scrap', 'chem', 'cloth']],
      ['Key Items', ['fuse', 'keyRed', 'keyBlue', 'keyGreen', 'valve', 'uvBulb', 'thermal', 'labKey', 'coreKey']],
    ];
    let html = '<div class="two"><div>';
    for (const [title, ids] of cats) {
      const rows = ids
        .map((id) => {
          if (title === 'Weapons') {
            const own = id === 'pipe' || (st.weapons as any)[id];
            if (!own) return '';
            const w = WEAPONS[id as keyof typeof WEAPONS];
            const up = st.upgrades[w.id];
            return `<div class="card ${this.game.world?.player.equipped === id ? 'sel' : ''}"><h4>${icon(id === 'pipe' ? 'pipe' : ITEMS[id as ItemId].icon)}${w.name}${up ? `<span class="n">+${up.dmg + up.mag + up.reload}</span>` : ''}</h4><p>${w.kind === 'gun' ? `Dmg ${w.dmg}${w.pellets > 1 ? '×' + w.pellets : ''} · Mag ${this.game.world?.player.magSize(w.id) ?? w.mag}` : `Melee · Dmg ${w.dmg}`}</p></div>`;
          }
          const n = (st.inv as any)[id] ?? 0;
          if (!n) return '';
          const d = ITEMS[id as ItemId];
          return `<div class="card"><h4>${icon(d.icon)}${d.name}<span class="n">×${n}</span></h4><p>${d.desc}</p></div>`;
        })
        .join('');
      if (rows) html += `<h5 style="margin:8px 0;font:600 11px var(--ui);letter-spacing:.3em;color:var(--cyan)">${title.toUpperCase()}</h5><div class="grid">${rows}</div>`;
    }
    html += `</div><div><h5 style="margin:8px 0;font:600 11px var(--ui);letter-spacing:.3em;color:var(--cyan)">FIELD CRAFTING</h5><div class="list">`;
    RECIPES.forEach((r, i) => {
      const can = Object.entries(r.cost).every(([k, v]) => ((st.inv as any)[k] ?? 0) >= (v as number));
      const cost = Object.entries(r.cost).map(([k, v]) => `${v} ${ITEMS[k as ItemId].name}`).join(' + ');
      html += `<div class="card ${can ? '' : 'locked'}"><h4>${icon(ITEMS[r.out].icon)}${ITEMS[r.out].name} ×${r.n}</h4><p>${cost}</p><button class="btn small craft" data-i="${i}" ${can ? '' : 'disabled'}>Craft</button></div>`;
    });
    html += '</div></div></div>';
    this.body.innerHTML = html;
    this.body.querySelectorAll('.craft').forEach((b) =>
      b.addEventListener('click', () => {
        const r = RECIPES[+(b as HTMLElement).dataset.i!];
        for (const [k, v] of Object.entries(r.cost)) (st.inv as any)[k] -= v as number;
        st.inv[r.out] = Math.min(ITEMS[r.out].max ?? 99, (st.inv[r.out] ?? 0) + r.n);
        audio.play('pickup', { vol: 0.5 });
        this.render();
      }),
    );
  }

  private r_evidence() {
    const st = this.game.state;
    if (!st.evidence.length) {
      this.body.innerHTML = `<p style="color:var(--dim)">No Truth Bullets yet. Examine pink-marked objects and talk to survivors to collect evidence for the Deck Trials.</p>`;
      return;
    }
    const sel = this.sel ?? st.evidence[st.evidence.length - 1];
    let html = '<div class="two"><div class="list">';
    for (const id of [...st.evidence].reverse()) {
      const e = EVIDENCE[id];
      if (!e) continue;
      html += `<div class="it ${id === sel ? 'on' : ''}" data-id="${id}">${icon('evidence', e.self ? '#ff2a4a' : '#ff5fd2')}${e.name}<span style="margin-left:auto;font-size:10px;color:var(--dim)">TRIAL ${e.trial}</span></div>`;
    }
    const e = EVIDENCE[sel];
    html += `</div><div class="reader"><h3>${e?.name ?? ''}</h3>${e?.desc ?? ''}${e?.self ? '\n\n<span style="color:#ff5fd2">It points at you. You could keep this to yourself.</span>' : ''}</div></div>`;
    this.body.innerHTML = html;
    this.body.querySelectorAll('.it').forEach((el) =>
      el.addEventListener('click', () => {
        this.sel = (el as HTMLElement).dataset.id!;
        audio.play('uiHover', { vol: 0.3 });
        this.render();
      }),
    );
  }

  private r_logs() {
    const st = this.game.state;
    const journal = st.journal;
    const ids = st.logs;
    const sel = this.sel ?? (ids.length ? ids[ids.length - 1] : 'journal');
    let html = '<div class="two"><div class="list">';
    html += `<div class="it ${sel === 'journal' ? 'on' : ''}" data-id="journal">${icon('info')}Noah’s Journal</div>`;
    for (const id of [...ids].reverse()) {
      const l = LOGS[id];
      if (l) html += `<div class="it ${id === sel ? 'on' : ''}" data-id="${id}">${icon('log')}${l.title}<span style="margin-left:auto;font-size:10px;color:var(--dim)">${l.where.split(' ')[0].toUpperCase()}</span></div>`;
    }
    html += `<p style="font:400 11px var(--ui);color:var(--dim);padding:8px">Recordings found: ${ids.length} / ${Object.keys(LOGS).length}</p></div>`;
    if (sel === 'journal') {
      html += `<div class="reader"><h3>JOURNAL</h3>${journal.length ? [...journal].reverse().map((j) => `<b style="color:var(--cyan)">${j.t}</b>\n${markup(j.text)}`).join('\n\n') : 'Nothing written yet.'}</div>`;
    } else {
      const l = LOGS[sel];
      html += `<div class="reader"><h3>${l.title}</h3><span style="color:var(--dim)">${l.speaker} — ${l.where}</span>\n\n${markup(l.text)}</div>`;
    }
    html += '</div>';
    this.body.innerHTML = html;
    this.body.querySelectorAll('.it').forEach((el) =>
      el.addEventListener('click', () => {
        this.sel = (el as HTMLElement).dataset.id!;
        this.render();
      }),
    );
  }

  private r_messages() {
    const st = this.game.state;
    if (!st.messages.length) {
      this.body.innerHTML = '<p style="color:var(--dim)">No messages.</p>';
      return;
    }
    let html = '<div class="list">';
    for (const m of [...st.messages].reverse()) {
      const c = (CAST as any)[m.from];
      const col = c ? c.color : m.from === 'viewer' ? '#ffd84a' : '#3ef0ff';
      const nm = c ? c.name : m.from === 'viewer' ? 'Anonymous Viewer' : m.from;
      html += `<div class="card ${m.read ? '' : 'sel'}"><h4 style="color:${col}">${nm}</h4><p style="color:var(--text);font-size:14px">${markup(m.text)}</p></div>`;
      m.read = true;
    }
    html += '</div>';
    this.body.innerHTML = html;
  }

  private r_map() {
    const w = this.game.world;
    if (!w) {
      this.body.innerHTML = '';
      return;
    }
    const L = w.level;
    const px = Math.max(4, Math.min(14, Math.floor(Math.min(1000 / L.w, 560 / L.h))));
    const c = document.createElement('canvas');
    c.width = L.w * px;
    c.height = L.h * px;
    const ctx = c.getContext('2d')!;
    for (let y = 0; y < L.h; y++)
      for (let x = 0; x < L.w; x++) {
        const i = L.idx(x, y);
        if (!L.explored[i] && !w.safe) continue;
        const t = L.terrain[i];
        let col = '';
        if (t === T.Wall) col = '#2a4a5a';
        else if (t === T.Void) col = '';
        else if (t === T.Water || t === T.Deep) col = '#0c3048';
        else if (t === T.Door) col = '#3ef0ff';
        else if (t === T.Low || t === T.Glass) col = '#1a3040';
        else col = '#0e1a22';
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x * px, y * px, px, px);
      }
    const dot = (x: number, z: number, color: string, r = px * 0.45) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc((x / CELL) * px, (z / CELL) * px, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const it of w.interactables) {
      const n = it.constructor.name;
      const [gx, gy] = L.cellOf(it.pos.x, it.pos.z);
      if (!L.explored[L.idx(gx, gy)] && !w.safe) continue;
      const col = n === 'SavePoint' ? '#7dff8a' : n === 'Exit' ? '#3ef0ff' : n === 'EvidencePickup' ? '#ff5fd2' : n === 'Station' ? '#ffd84a' : n === 'GloomyPickup' ? '#60a0ff' : '';
      if (col) dot(it.pos.x, it.pos.z, col);
    }
    for (const n of w.npcs) dot(n.pos.x, n.pos.z, CAST[n.id].color, px * 0.4);
    const p = w.player;
    ctx.save();
    ctx.translate((p.pos.x / CELL) * px, (p.pos.z / CELL) * px);
    ctx.rotate(-p.yaw);
    ctx.fillStyle = '#ff4d3d';
    ctx.beginPath();
    ctx.moveTo(0, px * 0.9);
    ctx.lineTo(-px * 0.5, -px * 0.5);
    ctx.lineTo(px * 0.5, -px * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    this.body.innerHTML = `<div class="mapc"></div><p style="text-align:center;font:600 11px var(--ui);letter-spacing:.2em;color:var(--dim);margin:8px 0 0">${w.def.name.toUpperCase()} · <span style="color:#7dff8a">■</span> SHRINE <span style="color:#3ef0ff">■</span> EXIT <span style="color:#ff5fd2">■</span> EVIDENCE <span style="color:#ffd84a">■</span> STATION <span style="color:#60a0ff">■</span> GLOOMY</p>`;
    this.body.querySelector('.mapc')!.appendChild(c);
  }

  private r_net() {
    const chNum = this.chapterNum();
    let html = '<div>';
    for (const p of GLOOMNET.filter((x) => x.chapter <= chNum).reverse()) {
      html += `<div class="ad"><span class="tag">${p.kind === 'podcast' ? 'UNDERNET PODCAST' : p.kind === 'banner' ? 'SPONSORED' : 'GLOOMTECH™ AD'}</span><h4>${p.title}</h4>`;
      if (p.removed) html += `<p>${p.body}</p><div class="removed">AD REMOVED · GLOOMY SAYS SHHH</div>`;
      else html += `<p>${p.body}</p>`;
      for (const [u, t, del] of p.comments) html += `<div class="comment ${del ? 'del' : ''}"><b>${u}</b> ${t}</div>`;
      html += '</div>';
    }
    html += '</div>';
    this.body.innerHTML = html;
  }

  private r_missions() {
    const st = this.game.state;
    const obj = this.game.ui.hud.objectiveText;
    let html = `<div class="card sel" style="margin-bottom:14px"><h4>${icon('info')}Current Objective</h4><p style="color:var(--text);font-size:14px">${obj || 'Explore.'}</p></div>`;
    html += '<div class="grid">';
    for (const id of SURVIVORS) {
      const c = CAST[id];
      const alive = st.alive[id];
      html += `<div class="card ${alive ? '' : 'locked'}"><h4 style="color:${c.color}">${c.name}${alive ? '' : '<span class="n" style="color:#ff2a4a">CAST OFF</span>'}</h4><p><b style="color:var(--text)">${c.title}</b> · ${c.traits}</p><p>${c.bio}</p></div>`;
    }
    html += '</div>';
    this.body.innerHTML = html;
  }

  private chapterNum() {
    const map: Record<string, number> = { prologue: 1, ch1: 1, ch2: 2, trial1: 2, ch3: 3, trial2: 3, ch4: 4, trial3: 4, ch5: 5, trial4: 5, ch6: 6, trial5: 6, ch7: 7, trial6: 7, ch8: 8, end: 8 };
    return map[this.game.state.chapter] ?? 1;
  }
}
