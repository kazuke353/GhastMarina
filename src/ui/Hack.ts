import type { Game } from '../game/Game';
import { audio } from '../core/Audio';

const CODES = ['1C', '55', 'BD', 'E9', '7A', 'FF'];

export class HackUI {
  el: HTMLDivElement;
  private resolve: ((ok: boolean) => void) | null = null;
  private grid: string[][] = [];
  private used: boolean[][] = [];
  private n = 5;
  private bufSize = 6;
  private buffer: string[] = [];
  private seqs: string[][] = [];
  private mode: 'row' | 'col' = 'row';
  private line = 0;
  private time = 30;
  private maxTime = 30;
  private done = false;
  open = false;

  constructor(private game: Game, root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'overlay hidden';
    root.appendChild(this.el);
  }

  start(diff: number): Promise<boolean> {
    this.n = diff >= 3 ? 6 : 5;
    this.bufSize = diff >= 3 ? 8 : diff >= 2 ? 7 : 6;
    this.maxTime = this.time = (diff >= 3 ? 26 : diff >= 2 ? 30 : 34) * (this.game.state.difficulty === 'story' ? 1.6 : 1);
    this.grid = Array.from({ length: this.n }, () => Array.from({ length: this.n }, () => CODES[Math.floor(Math.random() * CODES.length)]));
    this.used = Array.from({ length: this.n }, () => Array(this.n).fill(false));
    // build a guaranteed path for the main sequence
    const mainLen = diff >= 3 ? 4 : 3;
    const path: [number, number][] = [];
    let r = 0, c = Math.floor(Math.random() * this.n);
    let m: 'row' | 'col' = 'row';
    const taken = new Set<string>();
    // a couple of "free" picks before the sequence makes it less obvious
    const lead = Math.floor(Math.random() * Math.min(2, this.bufSize - mainLen));
    for (let i = 0; i < lead + mainLen; i++) {
      let tries = 0;
      do {
        if (m === 'row') c = Math.floor(Math.random() * this.n);
        else r = Math.floor(Math.random() * this.n);
        tries++;
      } while (taken.has(r + ',' + c) && tries < 50);
      taken.add(r + ',' + c);
      path.push([r, c]);
      m = m === 'row' ? 'col' : 'row';
    }
    const main = path.slice(lead).map(([pr, pc]) => this.grid[pr][pc]);
    this.seqs = [main];
    if (diff >= 2) {
      const extra = Array.from({ length: diff >= 3 ? 3 : 2 }, () => CODES[Math.floor(Math.random() * CODES.length)]);
      this.seqs.push(extra);
    }
    this.buffer = [];
    this.mode = 'row';
    this.line = 0;
    this.done = false;
    this.open = true;
    this.el.classList.remove('hidden');
    this.render();
    audio.play('uiOpen', { vol: 0.5 });
    return new Promise((res) => (this.resolve = res));
  }

  private contains(seq: string[]) {
    const b = this.buffer.join(' ');
    return b.includes(seq.join(' '));
  }

  private pick(r: number, c: number) {
    if (this.done) return;
    const ok = this.mode === 'row' ? r === this.line : c === this.line;
    if (!ok || this.used[r][c]) return;
    this.used[r][c] = true;
    this.buffer.push(this.grid[r][c]);
    audio.play('hackTick', { vol: 0.6, pitch: 0.8 + this.buffer.length * 0.1 });
    if (this.mode === 'row') {
      this.mode = 'col';
      this.line = c;
    } else {
      this.mode = 'row';
      this.line = r;
    }
    if (this.contains(this.seqs[0])) {
      const bonus = this.seqs.slice(1).filter((s) => this.contains(s)).length;
      this.finish(true, bonus);
      return;
    }
    if (this.buffer.length >= this.bufSize) this.finish(false, 0);
    else this.render();
  }

  private finish(ok: boolean, bonus: number) {
    this.done = true;
    this.render(ok ? `ACCESS GRANTED${bonus ? ` · BONUS DAEMON +${bonus * 60}¢` : ''}` : 'BREACH FAILED — TRACE DETECTED');
    audio.play(ok ? 'hackOk' : 'hackFail', { vol: 0.7 });
    if (ok && bonus) this.game.tip(bonus * 60, 'DAEMON');
    setTimeout(() => {
      this.close();
      const r = this.resolve;
      this.resolve = null;
      r?.(ok);
    }, ok ? 1000 : 1300);
  }

  close() {
    this.open = false;
    this.el.classList.add('hidden');
    this.el.innerHTML = '';
  }

  private render(msg = '') {
    let cells = '';
    for (let r = 0; r < this.n; r++)
      for (let c = 0; c < this.n; c++) {
        const active = !this.done && (this.mode === 'row' ? r === this.line : c === this.line) && !this.used[r][c];
        cells += `<div class="cell ${this.used[r][c] ? 'used' : active ? 'active' : 'dim'}" data-r="${r}" data-c="${c}">${this.grid[r][c]}</div>`;
      }
    const seqs = this.seqs
      .map((s, i) => {
        const done = this.contains(s);
        return `<div class="seq ${done ? 'done' : ''}"><b style="width:120px;font:600 11px var(--ui);letter-spacing:.15em;color:${i ? 'var(--gold)' : 'var(--cyan)'}">${i ? 'BONUS DAEMON' : 'MAIN DAEMON'}</b>${s.map((x) => `<span>${x}</span>`).join('')}</div>`;
      })
      .join('');
    const buf = Array.from({ length: this.bufSize }, (_, i) => `<span>${this.buffer[i] ?? ''}</span>`).join('');
    this.el.innerHTML = `<div class="panel hack">
      <h2>GLOOMOS BREACH PROTOCOL</h2>
      <p style="margin:4px 0 0;font:400 12px var(--ui);color:var(--dim)">Pick codes alternating <b style="color:var(--text)">row → column → row</b>, starting in the top row. Enter the main daemon sequence before the buffer fills.</p>
      <div class="row"><div class="matrix" style="grid-template-columns:repeat(${this.n}, 52px)">${cells}</div>
      <div class="seqs"><div style="font:600 11px var(--ui);letter-spacing:.2em;color:var(--dim)">BUFFER</div><div class="buffer">${buf}</div>${seqs}
      <div class="timer"><i style="transform:scaleX(${Math.max(0, this.time / this.maxTime)})"></i></div><div class="msg">${msg}</div>
      <button class="btn small abort" style="margin-top:12px">Abort <span class="kbd">Esc</span></button></div></div></div>`;
    this.el.querySelectorAll('.cell').forEach((el) =>
      el.addEventListener('mousedown', () => this.pick(+(el as HTMLElement).dataset.r!, +(el as HTMLElement).dataset.c!)),
    );
    this.el.querySelector('.abort')?.addEventListener('click', () => !this.done && this.finish(false, 0));
  }

  update(dt: number) {
    if (!this.open || this.done) return;
    this.time -= dt;
    const t = this.el.querySelector('.timer i') as HTMLElement | null;
    if (t) t.style.transform = `scaleX(${Math.max(0, this.time / this.maxTime)})`;
    if (this.time <= 0) this.finish(false, 0);
    if (this.game.input.keyPressed('Escape')) this.finish(false, 0);
  }
}
