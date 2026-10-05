import type { Game } from '../game/Game';
import { CAST, CastId, SURVIVORS } from '../chars/Cast';
import { EVIDENCE } from '../story/Lore';
import { audio } from '../core/Audio';
import { icon } from './icons';
import { markup } from './Dialogue';

export interface Stmt {
  who: CastId | 'captain';
  text: string; // [weak] {agree}
}

function stmtHtml(s: Stmt, idx: number) {
  const c = (CAST as any)[s.who];
  let t = s.text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let wi = 0;
  t = t.replace(/\[([^\]]+)\]/g, (_, x) => `<span class="wp" data-s="${idx}" data-w="${wi++}">${x}</span>`);
  t = t.replace(/\{([^}]+)\}/g, (_, x) => `<span class="wp ag" data-s="${idx}" data-w="${wi++}" data-agree="1">${x}</span>`);
  return `<span class="who" style="color:${c?.color ?? '#ff5fd2'}">${c?.name ?? s.who}</span>${t}`;
}

export class TrialUI {
  el: HTMLDivElement;
  private hp: HTMLElement;
  private phase: HTMLElement;
  private susp: HTMLElement;
  private layer: HTMLElement;
  private debateState: {
    stmts: Stmt[];
    idx: number;
    t: number;
    each: number;
    time: number;
    max: number;
    bullets: string[];
    sel: number;
    resolve: (r: { stmt: number; ev: string; agree: boolean } | 'timeout') => void;
    onShow: (i: number) => void;
    el: HTMLElement;
    cur: HTMLElement | null;
  } | null = null;

  constructor(private game: Game, root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'trial hidden';
    this.el.innerHTML = `<div class="hpbar"></div><div class="phase"></div><div class="susp"><div>SUSPICION ON NOAH</div><div class="bar"><i></i></div></div><div class="layer"></div>`;
    root.appendChild(this.el);
    this.hp = this.el.querySelector('.hpbar')!;
    this.phase = this.el.querySelector('.phase')!;
    this.susp = this.el.querySelector('.susp .bar i')!;
    this.layer = this.el.querySelector('.layer')!;
  }

  show(on: boolean) {
    this.el.classList.toggle('hidden', !on);
    if (!on) this.layer.innerHTML = '';
  }
  setHP(cur: number, max: number) {
    this.hp.innerHTML = `<b>INFLUENCE</b>` + Array.from({ length: max }, (_, i) => `<i class="${i < cur ? '' : 'off'}"></i>`).join('');
  }
  setPhase(t: string) {
    this.phase.textContent = t;
  }
  setSuspicion(v: number) {
    this.susp.style.transform = `scaleX(${Math.max(0, Math.min(1, v / 100))})`;
  }

  shout(text: string, kind: 'refute' | 'agree' | 'wrong' = 'refute'): Promise<void> {
    const s = document.createElement('div');
    s.className = 'shout ' + (kind === 'agree' ? 'agree' : kind === 'wrong' ? 'wrong' : '');
    s.textContent = text;
    this.layer.appendChild(s);
    if (kind !== 'wrong') {
      const f = document.createElement('div');
      f.className = 'shatter';
      this.layer.appendChild(f);
      setTimeout(() => f.remove(), 600);
      audio.play('objection', { vol: 0.8 });
    } else audio.play('wrong', { vol: 0.6 });
    return new Promise((r) =>
      setTimeout(() => {
        s.remove();
        r();
      }, 1300),
    );
  }

  /** Nonstop debate. Resolves with the player's shot or 'timeout'. */
  debate(stmts: Stmt[], bullets: string[], timeLimit: number, onShow: (i: number) => void): Promise<{ stmt: number; ev: string; agree: boolean } | 'timeout'> {
    this.game.input.exitLock();
    const el = document.createElement('div');
    el.className = 'debate';
    el.innerHTML = `<div class="debate-help">NONSTOP DEBATE — select a Truth Bullet <span class="kbd">1-${Math.min(9, bullets.length)}</span>/<span class="kbd">Wheel</span>, then click a <span style="color:#ffd84a">yellow weak point</span> to refute (or <span style="color:#7dff8a">green</span> to agree)</div><div class="dtimer"><i></i></div><div class="bullets"></div>`;
    this.layer.appendChild(el);
    const bl = el.querySelector('.bullets')!;
    bullets.forEach((id, i) => {
      const b = document.createElement('div');
      b.className = 'bullet' + (i === 0 ? ' on' : '');
      const e = EVIDENCE[id];
      b.innerHTML = `<small>TRUTH BULLET ${i + 1}</small>${e?.name ?? id}`;
      b.title = e?.desc ?? '';
      b.addEventListener('mousedown', (ev) => {
        ev.stopPropagation();
        this.selectBullet(i);
      });
      bl.appendChild(b);
    });
    return new Promise((resolve) => {
      this.debateState = { stmts, idx: -1, t: 0, each: 5.2, time: timeLimit, max: timeLimit, bullets, sel: 0, resolve, onShow, el, cur: null };
      this.nextStatement();
    });
  }

  private selectBullet(i: number) {
    const d = this.debateState;
    if (!d) return;
    d.sel = (i + d.bullets.length) % d.bullets.length;
    d.el.querySelectorAll('.bullet').forEach((b, k) => b.classList.toggle('on', k === d.sel));
    audio.play('uiHover', { vol: 0.4 });
  }

  private nextStatement() {
    const d = this.debateState!;
    d.idx = (d.idx + 1) % d.stmts.length;
    d.t = 0;
    if (d.cur) {
      const old = d.cur;
      old.style.transition = 'opacity .35s, transform .35s';
      old.style.opacity = '0';
      setTimeout(() => old.remove(), 400);
    }
    const s = document.createElement('div');
    s.className = 'stmt';
    s.innerHTML = stmtHtml(d.stmts[d.idx], d.idx);
    const variants = [
      { from: 'translate(60vw, 0) rotate(-3deg)', to: 'translate(-8vw, 0) rotate(-3deg)', left: '30%', top: '30%' },
      { from: 'translate(-60vw, 0) rotate(2deg)', to: 'translate(6vw, 0) rotate(2deg)', left: '20%', top: '46%' },
      { from: 'scale(2.2)', to: 'scale(1)', left: '24%', top: '38%' },
      { from: 'translate(0, -30vh) rotate(4deg)', to: 'translate(0, 0) rotate(4deg)', left: '28%', top: '58%' },
    ];
    const v = variants[d.idx % variants.length];
    s.style.left = v.left;
    s.style.top = v.top;
    s.style.transform = v.from;
    s.style.opacity = '0';
    d.el.appendChild(s);
    d.cur = s;
    requestAnimationFrame(() => {
      s.style.transition = `transform ${d.each}s cubic-bezier(.15,.7,.3,1), opacity .4s`;
      s.style.transform = v.to;
      s.style.opacity = '1';
    });
    s.querySelectorAll('.wp').forEach((w) =>
      w.addEventListener('mousedown', (ev) => {
        ev.stopPropagation();
        const st = this.debateState;
        if (!st) return;
        const agree = (w as HTMLElement).dataset.agree === '1';
        const res = { stmt: +(w as HTMLElement).dataset.s!, ev: st.bullets[st.sel], agree };
        this.endDebate();
        st.resolve(res);
      }),
    );
    audio.voiceBlip((CAST as any)[d.stmts[d.idx].who]?.pitch ?? 140, 0.3, 1);
    d.onShow(d.idx);
  }

  private endDebate() {
    const d = this.debateState;
    if (!d) return;
    d.el.remove();
    this.debateState = null;
  }

  update(dt: number) {
    const d = this.debateState;
    if (!d) return;
    d.t += dt;
    d.time -= dt;
    const bar = d.el.querySelector('.dtimer i') as HTMLElement;
    if (bar) bar.style.transform = `scaleX(${Math.max(0, d.time / d.max)})`;
    if (d.t >= d.each) this.nextStatement();
    const inp = this.game.input;
    for (let i = 0; i < Math.min(9, d.bullets.length); i++) if (inp.keyPressed('Digit' + (i + 1))) this.selectBullet(i);
    if (inp.wheel) this.selectBullet(d.sel + (inp.wheel > 0 ? 1 : -1));
    if (d.time <= 0) {
      const r = d.resolve;
      this.endDebate();
      r('timeout');
    }
  }

  present(q: string, evidence: string[]): Promise<string> {
    this.game.input.exitLock();
    return new Promise((res) => {
      const o = document.createElement('div');
      o.className = 'overlay';
      o.style.background = 'rgba(10,0,8,.6)';
      o.innerHTML = `<div class="panel window" style="height:auto;max-height:86vh;width:min(900px,94vw)"><header>${icon('evidence', '#ff5fd2')}<h2 style="font-family:var(--shout)">PRESENT EVIDENCE</h2></header><div class="body"><p style="font:600 16px var(--ui);margin:0 0 14px;color:#fff">${markup(q)}</p><div class="grid"></div></div></div>`;
      const grid = o.querySelector('.grid')!;
      for (const id of evidence) {
        const e = EVIDENCE[id];
        if (!e) continue;
        const c = document.createElement('div');
        c.className = 'card';
        c.style.cursor = 'pointer';
        c.innerHTML = `<h4>${icon('evidence', e.self ? '#ff2a4a' : '#ff5fd2')}${e.name}</h4><p>${e.desc}</p>`;
        c.addEventListener('mouseenter', () => audio.play('uiHover', { vol: 0.3 }));
        c.addEventListener('click', () => {
          o.remove();
          res(id);
        });
        grid.appendChild(c);
      }
      this.layer.appendChild(o);
    });
  }

  recon(title: string, filled: string[], total: number, q: string, options: string[]): Promise<number> {
    this.game.input.exitLock();
    return new Promise((res) => {
      const o = document.createElement('div');
      o.className = 'overlay';
      o.style.background = 'rgba(10,0,8,.55)';
      let panels = '';
      for (let i = 0; i < total; i++) panels += `<div class="pn ${i < filled.length ? 'done' : ''}">${i < filled.length ? markup(filled[i]) : i === filled.length ? '<b>?</b>' : ''}</div>`;
      o.innerHTML = `<div class="panel recon"><h2>CLOSING ARGUMENT</h2><p style="margin:0;font:600 12px var(--ui);letter-spacing:.2em;color:var(--dim)">${title}</p><div class="panels">${panels}</div><div class="q">${markup(q)}</div><div class="menu"></div></div>`;
      const m = o.querySelector('.menu')!;
      options.forEach((op, i) => {
        const b = document.createElement('button');
        b.className = 'btn';
        b.style.textTransform = 'none';
        b.style.letterSpacing = '.02em';
        b.innerHTML = `<span style="color:var(--pink);margin-right:10px">${i + 1}</span>${markup(op)}`;
        b.addEventListener('click', () => {
          o.remove();
          res(i);
        });
        m.appendChild(b);
      });
      this.layer.appendChild(o);
    });
  }

  vote(alive: Record<string, boolean>): Promise<CastId> {
    this.game.input.exitLock();
    return new Promise((res) => {
      const o = document.createElement('div');
      o.className = 'overlay';
      o.style.background = 'rgba(10,0,8,.6)';
      let html = `<div class="panel vote"><h2>VOTE — WHO IS THE MOLE?</h2><div class="roster">`;
      for (const id of SURVIVORS) {
        const c = CAST[id];
        const dead = !alive[id];
        html += `<div class="who ${dead ? 'dead' : ''}" data-id="${id}" style="border-color:${dead ? '' : c.color + '55'}">${c.name}<small>${c.title}</small></div>`;
      }
      html += '</div></div>';
      o.innerHTML = html;
      o.querySelectorAll('.who:not(.dead)').forEach((w) => {
        w.addEventListener('mouseenter', () => audio.play('vote', { vol: 0.4 }));
        w.addEventListener('click', () => {
          o.remove();
          res((w as HTMLElement).dataset.id as CastId);
        });
      });
      this.layer.appendChild(o);
    });
  }

  tally(votes: Record<string, number>, winner: CastId): Promise<void> {
    return new Promise((res) => {
      const o = document.createElement('div');
      o.className = 'overlay';
      o.style.background = 'rgba(10,0,8,.7)';
      o.innerHTML = `<div class="panel vote"><h2>THE VERDICT</h2><div class="slot">???</div><div class="roster" style="margin-top:16px"></div></div>`;
      const slot = o.querySelector('.slot') as HTMLElement;
      const roster = o.querySelector('.roster')!;
      const names = Object.keys(votes);
      let i = 0;
      const spin = setInterval(() => {
        slot.textContent = CAST[names[i++ % names.length] as CastId].name.toUpperCase();
        audio.play('vote', { vol: 0.4, pitch: 1 + (i % 3) * 0.1 });
      }, 90);
      this.layer.appendChild(o);
      setTimeout(() => {
        clearInterval(spin);
        slot.textContent = CAST[winner].name.toUpperCase();
        slot.style.color = '#ff2a4a';
        audio.play('objection', { vol: 0.7 });
        audio.play('crowd', { vol: 0.5 });
        roster.innerHTML = names
          .sort((a, b) => votes[b] - votes[a])
          .map((n) => `<div class="who"><span style="color:${CAST[n as CastId].color}">${CAST[n as CastId].name}</span><small>${votes[n]} vote${votes[n] === 1 ? '' : 's'}</small></div>`)
          .join('');
      }, 2600);
      setTimeout(() => {
        o.remove();
        res();
      }, 6200);
    });
  }

  clear() {
    this.endDebate();
    this.layer.innerHTML = '';
  }
}
