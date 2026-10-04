import type { Game } from '../game/Game';
import { CAST } from '../chars/Cast';
import { audio } from '../core/Audio';

export interface ChoiceOpt {
  text: string;
  kind?: 'mask' | 'conscience' | 'normal';
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
export function markup(s: string) {
  return esc(s)
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<i>$1</i>');
}

const SPECIAL: Record<string, { name: string; color: string; pitch: number; timbre: number; style?: string }> = {
  band: { name: 'GloomBand', color: '#ffd84a', pitch: 900, timbre: 1, style: 'system' },
  narrator: { name: '', color: '#ffffff', pitch: 160, timbre: 0, style: 'system' },
  voice: { name: '???', color: '#a8b4ff', pitch: 140, timbre: 0.3, style: 'thought' },
  crowd: { name: 'Survivors', color: '#ffffff', pitch: 180, timbre: 0.3 },
  podcast: { name: 'UNDERNET PODCAST', color: '#ff5fd2', pitch: 190, timbre: 0.6 },
  ad: { name: 'GloomTech™', color: '#3ef0ff', pitch: 260, timbre: 0.8, style: 'system' },
  monokid: { name: 'Gloomy', color: '#60c0ff', pitch: 520, timbre: 0.9 },
};

export class DialogueUI {
  el: HTMLDivElement;
  private box: HTMLElement;
  private nameEl: HTMLElement;
  private textEl: HTMLElement;
  private nextEl: HTMLElement;
  private choicesEl: HTMLElement;
  private typing = false;
  private full = '';
  private shown = 0;
  private acc = 0;
  private resolve: (() => void) | null = null;
  private choiceResolve: ((i: number) => void) | null = null;
  private pitch = 140;
  private timbre = 0;
  private blipN = 0;
  open = false;
  choosing = false;
  private sel = 0;
  private opts: ChoiceOpt[] = [];
  autoT = -1;

  constructor(private game: Game, root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'dlg hidden';
    this.el.innerHTML = `<div class="choices"></div><div class="box"><div class="name"><span></span></div><div class="text"></div><div class="next">▼</div></div>`;
    root.appendChild(this.el);
    this.box = this.el.querySelector('.box')!;
    this.nameEl = this.el.querySelector('.name span')!;
    this.textEl = this.el.querySelector('.text')!;
    this.nextEl = this.el.querySelector('.next')!;
    this.choicesEl = this.el.querySelector('.choices')!;
    this.box.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.advance();
    });
  }

  say(who: string, text: string, opts: { style?: string; title?: string; auto?: number } = {}): Promise<void> {
    // a line that is superseded must still release whoever was waiting on it
    if (this.resolve) {
      const prev = this.resolve;
      this.resolve = null;
      prev();
    }
    const c = (CAST as any)[who] ?? SPECIAL[who] ?? { name: who, color: '#3ef0ff', pitch: 150, timbre: 0.2 };
    this.open = true;
    this.el.classList.remove('hidden');
    this.el.className = 'dlg ' + (opts.style ?? (who === 'captain' ? 'captain' : c.style ?? ''));
    const nm = c.name;
    this.nameEl.innerHTML = nm ? `${nm}${opts.title ? `<small>${opts.title}</small>` : ''}` : '';
    (this.nameEl.parentElement as HTMLElement).style.display = nm ? '' : 'none';
    (this.nameEl.parentElement as HTMLElement).style.background = who === 'captain' ? '' : c.color;
    this.pitch = c.pitch;
    this.timbre = c.timbre;
    this.full = text;
    this.shown = 0;
    this.acc = 0;
    this.typing = true;
    this.textEl.innerHTML = '';
    this.nextEl.style.visibility = 'hidden';
    this.choicesEl.innerHTML = '';
    this.autoT = opts.auto ?? -1;
    if (who === 'captain') audio.play('captain', { vol: 0.35 });
    return new Promise((r) => (this.resolve = r));
  }

  choose(opts: ChoiceOpt[]): Promise<number> {
    if (this.choiceResolve) {
      const prev = this.choiceResolve;
      this.choiceResolve = null;
      prev(0);
    }
    this.open = true;
    this.choosing = true;
    this.autoT = 0;
    this.opts = opts;
    this.sel = 0;
    this.el.classList.remove('hidden');
    if (!this.full) this.box.style.display = 'none';
    this.renderChoices();
    audio.play('uiOpen', { vol: 0.4 });
    return new Promise((r) => (this.choiceResolve = r));
  }

  private renderChoices() {
    this.choicesEl.innerHTML = '';
    this.opts.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'btn ' + (o.kind ?? '') + (i === this.sel ? ' sel' : '');
      b.innerHTML = `<span class="k">${i + 1}</span>${markup(o.text)}`;
      b.addEventListener('mouseenter', () => {
        this.sel = i;
        this.highlight();
        audio.play('uiHover', { vol: 0.3 });
      });
      b.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.pick(i);
      });
      this.choicesEl.appendChild(b);
    });
  }
  private highlight() {
    Array.from(this.choicesEl.children).forEach((c, i) => c.classList.toggle('sel', i === this.sel));
  }
  private pick(i: number) {
    if (!this.choosing) return;
    this.choosing = false;
    audio.play('uiConfirm', { vol: 0.5 });
    this.choicesEl.innerHTML = '';
    this.box.style.display = '';
    const r = this.choiceResolve;
    this.choiceResolve = null;
    r?.(i);
  }

  private advance() {
    if (this.choosing) return;
    if (this.typing) {
      this.shown = this.full.length;
      this.typing = false;
      this.textEl.innerHTML = markup(this.full);
      this.nextEl.style.visibility = 'visible';
      return;
    }
    if (this.resolve) {
      const r = this.resolve;
      this.resolve = null;
      audio.play('uiHover', { vol: 0.25 });
      r();
    }
  }

  hide() {
    this.open = false;
    this.full = '';
    this.el.classList.add('hidden');
    this.box.style.display = '';
  }

  update(dt: number) {
    if (!this.open) return;
    const input = this.game.input;
    const auto = this.game.autoplay;
    if (this.choosing) {
      const n = this.opts.length;
      if (auto >= 0) {
        this.autoT -= dt;
        if (this.autoT < -0.4) this.pick(Math.min(n - 1, this.game.autoChoice));
        return;
      }
      if (input.pressed('up')) {
        this.sel = (this.sel - 1 + n) % n;
        this.highlight();
        audio.play('uiHover', { vol: 0.3 });
      }
      if (input.pressed('down')) {
        this.sel = (this.sel + 1) % n;
        this.highlight();
        audio.play('uiHover', { vol: 0.3 });
      }
      for (let i = 0; i < Math.min(9, n); i++) if (input.keyPressed('Digit' + (i + 1))) this.pick(i);
      if (input.keyPressed('Enter') || input.keyPressed('Space') || input.keyPressed('KeyE')) this.pick(this.sel);
      return;
    }
    if (this.typing) {
      const speed = 48 * this.game.settings.data.textSpeed * (auto >= 0 ? 20 : 1);
      this.acc += dt * speed;
      const n = Math.floor(this.acc);
      if (n > 0) {
        this.acc -= n;
        const prev = this.shown;
        this.shown = Math.min(this.full.length, this.shown + n);
        for (let i = prev; i < this.shown; i++) {
          const ch = this.full[i];
          if (/[a-z0-9]/i.test(ch) && this.blipN++ % 3 === 0) audio.voiceBlip(this.pitch, this.timbre, 0.8);
        }
        this.textEl.innerHTML = markup(this.full.slice(0, this.shown));
        if (this.shown >= this.full.length) {
          this.typing = false;
          this.nextEl.style.visibility = 'visible';
        }
      }
    } else if (this.autoT > 0) {
      this.autoT -= dt;
      if (this.autoT <= 0) this.advance();
    } else if (auto >= 0) {
      this.autoT -= dt;
      if (this.autoT < -auto) this.advance();
    }
    if (input.pressed('confirm')) this.advance();
  }
}
