import { AudioEngine } from './Audio';
import { rng } from './math';

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

type Inst = (out: AudioNode, t: number, note: number, dur: number, vel: number) => void;

interface Layer {
  gain: number;
  /** intensity window in which the layer is audible */
  window?: [number, number];
  step: (s: number, bar: number, t: number, sd: number, out: AudioNode) => void;
}
interface SongDef {
  bpm: number;
  bars: number; // loop length in bars (16 steps per bar)
  layers: Layer[];
}

export type SongId =
  | 'title' | 'hub' | 'explore' | 'combat' | 'boss' | 'trial' | 'debate' | 'execution' | 'ending' | 'tension' | 'credits' | 'container' | 'finale';

export class Music {
  private cur: { id: string; def: SongDef; gain: GainNode; layerGains: GainNode[]; next: number; step: number } | null = null;
  private dying: { gain: GainNode; until: number }[] = [];
  intensity = 0;
  private targetIntensity = 0;
  private insts!: Record<string, Inst>;
  private drums!: Record<string, (out: AudioNode, t: number, vel: number) => void>;
  constructor(private a: AudioEngine) {}

  private build() {
    const ctx = this.a.ctx!;
    const env = (g: GainNode, t: number, a: number, d: number, s: number, r: number, peak: number, dur: number) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.linearRampToValueAtTime(peak * s, t + a + d);
      g.gain.setValueAtTime(peak * s, t + Math.max(a + d, dur));
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + d, dur) + r);
      return t + Math.max(a + d, dur) + r;
    };
    const noiseBuf = (() => {
      const len = ctx.sampleRate;
      const b = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return b;
    })();
    this.insts = {
      bass: (out, t, n, dur, vel) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(n);
        const s = ctx.createOscillator();
        s.type = 'sine';
        s.frequency.value = mtof(n - 12);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.Q.value = 6;
        f.frequency.setValueAtTime(1400 * vel + 200, t);
        f.frequency.exponentialRampToValueAtTime(180, t + Math.min(0.25, dur));
        const g = ctx.createGain();
        const end = env(g, t, 0.005, 0.1, 0.6, 0.06, 0.35 * vel, dur);
        const sg = ctx.createGain();
        sg.gain.value = 0.8;
        o.connect(f).connect(g).connect(out);
        s.connect(sg).connect(g);
        o.start(t);
        s.start(t);
        o.stop(end + 0.05);
        s.stop(end + 0.05);
      },
      sub: (out, t, n, dur, vel) => {
        const s = ctx.createOscillator();
        s.type = 'sine';
        s.frequency.value = mtof(n);
        const g = ctx.createGain();
        const end = env(g, t, 0.05, 0.2, 0.8, 0.4, 0.5 * vel, dur);
        s.connect(g).connect(out);
        s.start(t);
        s.stop(end + 0.05);
      },
      pad: (out, t, n, dur, vel) => {
        const g = ctx.createGain();
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(400, t);
        f.frequency.linearRampToValueAtTime(1100, t + dur * 0.5);
        f.frequency.linearRampToValueAtTime(500, t + dur);
        const end = env(g, t, Math.min(1.2, dur * 0.4), 0.3, 0.8, 1.2, 0.07 * vel, dur);
        for (const det of [-9, 0, 8]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = mtof(n);
          o.detune.value = det;
          o.connect(f);
          o.start(t);
          o.stop(end + 0.05);
        }
        f.connect(g).connect(out);
      },
      choir: (out, t, n, dur, vel) => {
        const g = ctx.createGain();
        const end = env(g, t, Math.min(1.5, dur * 0.5), 0.3, 0.8, 1.5, 0.06 * vel, dur);
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(n);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5;
        const lg = ctx.createGain();
        lg.gain.value = 3;
        lfo.connect(lg).connect(o.frequency);
        for (const fq of [650, 1100, 2700]) {
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = fq;
          bp.Q.value = 8;
          o.connect(bp).connect(g);
        }
        g.connect(out);
        o.start(t);
        lfo.start(t);
        o.stop(end + 0.05);
        lfo.stop(end + 0.05);
      },
      bell: (out, t, n, dur, vel) => {
        const car = ctx.createOscillator();
        car.frequency.value = mtof(n);
        const mod = ctx.createOscillator();
        mod.frequency.value = mtof(n) * 3.5;
        const mg = ctx.createGain();
        mg.gain.setValueAtTime(mtof(n) * 2.5, t);
        mg.gain.exponentialRampToValueAtTime(1, t + 1.2);
        mod.connect(mg).connect(car.frequency);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.12 * vel, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(1.2, dur * 2));
        car.connect(g).connect(out);
        car.start(t);
        mod.start(t);
        car.stop(t + Math.max(1.2, dur * 2) + 0.1);
        mod.stop(t + Math.max(1.2, dur * 2) + 0.1);
      },
      pluck: (out, t, n, dur, vel) => {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = mtof(n);
        const o2 = ctx.createOscillator();
        o2.type = 'square';
        o2.frequency.value = mtof(n) * 1.002;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(3000, t);
        f.frequency.exponentialRampToValueAtTime(300, t + 0.4);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.13 * vel, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(1.2, dur + 0.5));
        const g2 = ctx.createGain();
        g2.gain.value = 0.25;
        o.connect(f);
        o2.connect(g2).connect(f);
        f.connect(g).connect(out);
        o.start(t);
        o2.start(t);
        o.stop(t + 1.3);
        o2.stop(t + 1.3);
      },
      stab: (out, t, n, dur, vel) => {
        const g = ctx.createGain();
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.Q.value = 3;
        f.frequency.setValueAtTime(4000, t);
        f.frequency.exponentialRampToValueAtTime(500, t + 0.18);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.07 * vel, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        for (const det of [-7, 7]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = mtof(n);
          o.detune.value = det;
          o.connect(f);
          o.start(t);
          o.stop(t + 0.3);
        }
        f.connect(g).connect(out);
      },
      lead: (out, t, n, dur, vel) => {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = mtof(n);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 6;
        const lg = ctx.createGain();
        lg.gain.setValueAtTime(0, t);
        lg.gain.linearRampToValueAtTime(6, t + 0.3);
        lfo.connect(lg).connect(o.frequency);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 2200;
        const g = ctx.createGain();
        const end = env(g, t, 0.01, 0.1, 0.7, 0.12, 0.07 * vel, dur);
        o.connect(f).connect(g).connect(out);
        o.start(t);
        lfo.start(t);
        o.stop(end + 0.05);
        lfo.stop(end + 0.05);
      },
      arp: (out, t, n, dur, vel) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(n);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.Q.value = 8;
        f.frequency.setValueAtTime(2600, t);
        f.frequency.exponentialRampToValueAtTime(400, t + 0.12);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.06 * vel, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(f).connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.2);
      },
      musicbox: (out, t, n, dur, vel) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = mtof(n);
        o.detune.value = Math.random() * 30 - 15;
        const o2 = ctx.createOscillator();
        o2.type = 'sine';
        o2.frequency.value = mtof(n) * 4.01;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.1 * vel, t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
        const g2 = ctx.createGain();
        g2.gain.value = 0.15;
        o.connect(g).connect(out);
        o2.connect(g2).connect(g);
        o.start(t);
        o2.start(t);
        o.stop(t + 1.6);
        o2.stop(t + 1.6);
      },
    };
    const noise = (out: AudioNode, t: number, dur: number, type: BiquadFilterType, freq: number, vol: number, q = 1) => {
      const s = ctx.createBufferSource();
      s.buffer = noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(out);
      s.start(t, Math.random() * 0.5);
      s.stop(t + dur + 0.02);
    };
    this.drums = {
      kick: (out, t, vel) => {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.7 * vel, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.4);
      },
      snare: (out, t, vel) => {
        noise(out, t, 0.18, 'highpass', 1500, 0.35 * vel);
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(220, t);
        o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.25 * vel, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.12);
      },
      clap: (out, t, vel) => {
        for (let i = 0; i < 3; i++) noise(out, t + i * 0.012, 0.08 + i * 0.03, 'bandpass', 1200, 0.3 * vel, 1.5);
      },
      hat: (out, t, vel) => noise(out, t, 0.04, 'highpass', 7000, 0.12 * vel),
      ohat: (out, t, vel) => noise(out, t, 0.22, 'highpass', 6500, 0.1 * vel),
      tom: (out, t, vel) => {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(110, t);
        o.frequency.exponentialRampToValueAtTime(60, t + 0.3);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.4 * vel, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.45);
      },
      heart: (out, t, vel) => {
        for (const [dt, v] of [[0, 1], [0.16, 0.7]] as const) {
          const o = ctx.createOscillator();
          o.frequency.setValueAtTime(70, t + dt);
          o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.12);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.6 * vel * v, t + dt);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.2);
          o.connect(g).connect(out);
          o.start(t + dt);
          o.stop(t + dt + 0.25);
        }
      },
      boom: (out, t, vel) => {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(80, t);
        o.frequency.exponentialRampToValueAtTime(28, t + 1.2);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.7 * vel, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 2.1);
        noise(out, t, 1.5, 'lowpass', 300, 0.25 * vel);
      },
    };
  }

  private songs(id: string): SongDef {
    const I = this.insts, D = this.drums;
    // chord helpers: progression of [root, ...chord tones] in midi
    const prog = (chords: number[][]) => (bar: number) => chords[bar % chords.length];
    switch (id) {
      case 'title': {
        const ch = prog([[50, 57, 62, 65], [46, 53, 58, 62], [41, 53, 57, 60], [48, 55, 60, 64]]);
        const arpN = [0, 2, 3, 1, 2, 3, 1, 0];
        return {
          bpm: 72, bars: 8, layers: [
            { gain: 1, step: (s, bar, t, sd, o) => { if (s === 0) ch(bar).slice(1).forEach((n) => I.pad(o, t, n, sd * 16, 1)); } },
            { gain: 1, step: (s, bar, t, sd, o) => { if (s === 0) I.sub(o, t, ch(bar)[0] - 12, sd * 15, 1); } },
            { gain: 1, step: (s, bar, t, sd, o) => { if (s % 2 === 0 && bar % 8 >= 2) { const c = ch(bar); I.bell(o, t, c[1 + (arpN[(s / 2) % 8] % 3)] + 12, sd * 2, 0.6); } } },
            { gain: 1, step: (s, bar, t, sd, o) => { if (s === 0 && bar % 4 === 2) I.choir(o, t, ch(bar)[2] + 12, sd * 30, 1); } },
          ],
        };
      }
      case 'hub': {
        const ch = prog([[40, 52, 55, 59, 62], [36, 52, 55, 59], [45, 52, 57, 60, 64], [47, 51, 54, 57]]);
        const mel = [76, -1, 74, 71, -1, -1, 72, -1, 71, -1, 67, -1, 69, -1, -1, -1];
        return {
          bpm: 64, bars: 8, layers: [
            { gain: 0.8, step: (s, bar, t, sd, o) => { if (s === 0) ch(bar).slice(1).forEach((n) => I.pad(o, t, n, sd * 16, 0.8)); } },
            { gain: 1, step: (s, bar, t, sd, o) => { if (s === 0 || s === 10) I.sub(o, t, ch(bar)[0] - 12, sd * 6, 0.8); } },
            { gain: 1, step: (s, bar, t, sd, o) => { if (bar % 2 === 1 && s % 2 === 0) { const n = mel[(s / 2 + (bar % 4) * 2) % 16]; if (n > 0) I.musicbox(o, t, n, sd * 2, 0.5); } } },
          ],
        };
      }
      case 'container':
      case 'tension': {
        return {
          bpm: 60, bars: 4, layers: [
            { gain: 1, step: (s, bar, t, sd, o) => { if (s === 0) { I.pad(o, t, 38, sd * 16, 1); I.pad(o, t, 39 + (bar % 2), sd * 16, 0.6); } } },
            { gain: 1, step: (s, bar, t, sd, o) => { if (s === 0 || s === 8) D.heart(o, t, 0.6); } },
            { gain: 1, step: (s, bar, t, sd, o) => { if (s === 6 && bar % 2 === 1) I.bell(o, t, 86 + (bar % 3), sd * 4, 0.3); } },
          ],
        };
      }
      case 'explore':
      case 'combat': {
        const r = rng(7);
        const scale = [0, 1, 3, 5, 7, 8, 10];
        const notes = Array.from({ length: 64 }, () => (r() < 0.22 ? 62 + scale[Math.floor(r() * 7)] + (r() < 0.3 ? 12 : 0) : -1));
        const roots = [38, 38, 34, 36];
        return {
          bpm: 96, bars: 4, layers: [
            { gain: 1, step: (s, bar, t, sd, o) => { if (s === 0) { I.pad(o, t, roots[bar] + 12, sd * 16, 0.8); I.pad(o, t, roots[bar] + 19, sd * 16, 0.6); I.sub(o, t, roots[bar] - 12, sd * 16, 0.7); } } },
            { gain: 0.8, window: [0, 0.6], step: (s, bar, t, sd, o) => { const n = notes[(bar * 16 + s) % 64]; if (n > 0 && s % 2 === 0) I.pluck(o, t, n, sd * 3, 0.5); } },
            // combat layers
            { gain: 1, window: [0.25, 1], step: (s, bar, t, sd, o) => { if (s % 2 === 0) I.bass(o, t, roots[bar] + (s % 8 === 6 ? 3 : 0), sd * 1.5, 0.9); } },
            { gain: 1, window: [0.25, 1], step: (s, bar, t, sd, o) => { if (s % 4 === 0) D.kick(o, t, 0.9); if (s % 8 === 4) D.snare(o, t, 0.8); if (s % 2 === 1) D.hat(o, t, 0.5); } },
            { gain: 1, window: [0.5, 1], step: (s, bar, t, sd, o) => { if ([0, 3, 6, 10, 12].includes(s)) I.stab(o, t, roots[bar] + 24 + (s === 12 ? 1 : 0), sd, 0.8); } },
          ],
        };
      }
      case 'boss':
      case 'finale': {
        const riff = [40, 40, 52, 40, 41, 40, 50, 40, 40, 52, 40, 43, 41, 40, 38, 40];
        const lead = [64, -1, 67, -1, 65, 64, -1, 62, 64, -1, -1, 71, 70, -1, 67, -1];
        const fin = id === 'finale';
        return {
          bpm: fin ? 160 : 150, bars: 4, layers: [
            { gain: 1, step: (s, bar, t, sd, o) => I.bass(o, t, riff[s] + (bar === 3 && s > 11 ? 1 : 0), sd * 0.9, 1) },
            { gain: 1, step: (s, bar, t, sd, o) => { if (s % 4 === 0) D.kick(o, t, 1); if (s % 8 === 4) D.snare(o, t, 1); D.hat(o, t, s % 2 ? 0.4 : 0.7); if (s === 14 && bar === 3) D.tom(o, t, 1); } },
            { gain: 1, step: (s, bar, t, sd, o) => { if (bar >= 2) { const n = lead[s]; if (n > 0) I.lead(o, t, n + (bar === 3 ? 2 : 0), sd * 2, 1); } } },
            { gain: 1, step: (s, bar, t, sd, o) => { if (bar < 2) I.arp(o, t, [64, 67, 71, 76][s % 4] + (bar % 2), sd, 0.8); } },
            { gain: 1, step: (s, bar, t, sd, o) => { if (s === 0) I.choir(o, t, fin ? 64 : 52, sd * 16, 1); } },
          ],
        };
      }
      case 'trial':
      case 'debate': {
        const fast = id === 'debate';
        // C minor groove
        const chords = [[48, 60, 63, 67], [44, 60, 63, 68], [46, 58, 62, 65], [43, 59, 62, 67]];
        const bassP = [0, -1, 0, 12, -1, 0, 10, -1, 0, -1, 0, 7, -1, 10, 12, -1];
        const hook = [72, -1, 75, -1, 79, -1, 77, 75, -1, 74, -1, 72, -1, 67, -1, -1];
        const hook2 = [68, -1, 72, -1, 75, -1, 74, 72, -1, 70, -1, 67, -1, -1, 71, -1];
        return {
          bpm: fast ? 138 : 118, bars: 4, layers: [
            { gain: 1, step: (s, bar, t, sd, o) => { const b = bassP[s]; if (b >= 0) I.bass(o, t, chords[bar][0] - 12 + b, sd * 0.9, 1); } },
            { gain: 1, step: (s, bar, t, sd, o) => { if (s % 4 === 0) D.kick(o, t, 0.9); if (s % 8 === 4) D.clap(o, t, 0.9); D.hat(o, t, s % 4 === 2 ? 0.8 : 0.35); if (s === 14) D.ohat(o, t, 0.6); } },
            { gain: 1, step: (s, bar, t, sd, o) => { if (s % 4 === 2) chords[bar].slice(1).forEach((n) => I.stab(o, t, n, sd, 0.7)); } },
            { gain: 1, step: (s, bar, t, sd, o) => { const h = bar % 2 === 0 ? hook : hook2; const n = h[s]; if (n > 0 && (fast || bar >= 2 || true)) I.lead(o, t, n, sd * 1.6, 0.8); } },
            { gain: 0.8, step: (s, bar, t, sd, o) => { if (fast) I.arp(o, t, chords[bar][1 + (s % 3)] + 12, sd, 0.6); } },
          ],
        };
      }
      case 'execution': {
        const mel = [79, 78, 79, 74, 75, -1, 72, -1, 74, 72, 71, -1, 67, -1, -1, -1];
        return {
          bpm: 70, bars: 4, layers: [
            { gain: 1, step: (s, bar, t, sd, o) => { if (s === 0) { I.pad(o, t, 36, sd * 16, 1); I.pad(o, t, 43, sd * 16, 0.7); D.boom(o, t, 0.8); } } },
            { gain: 1, step: (s, bar, t, sd, o) => { const n = mel[s]; if (n > 0) I.musicbox(o, t, n - (bar % 2) * 2, sd * 2, 0.7); } },
            { gain: 1, step: (s, bar, t, sd, o) => { if (s % 8 === 0) D.heart(o, t, 0.5); } },
          ],
        };
      }
      case 'ending':
      case 'credits': {
        const ch = prog([[45, 57, 60, 64], [41, 57, 60, 65], [48, 55, 60, 64], [43, 55, 59, 62]]);
        const mel = [76, -1, -1, 74, 72, -1, 71, -1, 72, -1, 74, -1, 67, -1, -1, -1];
        const cred = id === 'credits';
        return {
          bpm: 76, bars: 8, layers: [
            { gain: 1, step: (s, bar, t, sd, o) => { if (s === 0) ch(bar).slice(1).forEach((n) => I.pad(o, t, n, sd * 16, 0.7)); } },
            { gain: 1, step: (s, bar, t, sd, o) => { if (s % 4 === 0) I.pluck(o, t, ch(bar)[1 + ((s / 4) % 3)] + 12, sd * 4, 0.6); } },
            { gain: 1, step: (s, bar, t, sd, o) => { if (s === 0) I.sub(o, t, ch(bar)[0] - 12, sd * 16, 0.8); } },
            { gain: 1, step: (s, bar, t, sd, o) => { if (bar >= 4 || cred) { const n = mel[s]; if (n > 0) I.bell(o, t, n + (bar % 4 === 3 ? -2 : 0), sd * 3, 0.6); } } },
            { gain: 1, step: (s, bar, t, sd, o) => { if (cred) { if (s % 8 === 0) D.kick(o, t, 0.5); if (s % 8 === 4) D.snare(o, t, 0.35); } } },
          ],
        };
      }
    }
    return { bpm: 60, bars: 1, layers: [] };
  }

  play(id: SongId | 'none', fade = 1.5) {
    const a = this.a;
    if (!a.ctx) return;
    if (!this.insts) this.build();
    const songKey = id === 'combat' ? 'explore' : id;
    if (this.cur && this.cur.id === songKey) {
      if (id === 'combat') this.setIntensity(1);
      return;
    }
    const ctx = a.ctx;
    if (this.cur) {
      const g = this.cur.gain;
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
      this.dying.push({ gain: g, until: ctx.currentTime + fade + 3 });
      this.cur = null;
    }
    if (id === 'none') return;
    const def = this.songs(songKey);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + Math.max(0.05, fade));
    gain.connect(a.musicBus);
    const rev = ctx.createGain();
    rev.gain.value = 0.25;
    gain.connect(rev).connect(a.revIn);
    const layerGains = def.layers.map((l) => {
      const g = ctx.createGain();
      g.gain.value = this.layerVol(l, this.intensity);
      g.connect(gain);
      return g;
    });
    this.cur = { id: songKey, def, gain, layerGains, next: ctx.currentTime + 0.1, step: 0 };
    if (id === 'combat') this.setIntensity(1);
  }
  get current() {
    return this.cur?.id ?? 'none';
  }

  private layerVol(l: Layer, i: number) {
    if (!l.window) return l.gain;
    const [a, b] = l.window;
    const edge = 0.15;
    let v = 1;
    if (i < a) v = Math.max(0, 1 - (a - i) / edge);
    else if (i > b) v = Math.max(0, 1 - (i - b) / edge);
    return l.gain * v;
  }

  setIntensity(v: number) {
    this.targetIntensity = v;
  }

  update(dt: number) {
    const a = this.a;
    if (!a.ctx || !this.cur) return;
    const ctx = a.ctx;
    // intensity smoothing
    const k = this.targetIntensity > this.intensity ? 2.5 : 0.35;
    this.intensity += (this.targetIntensity - this.intensity) * Math.min(1, dt * k);
    const c = this.cur;
    c.def.layers.forEach((l, i) => {
      if (l.window) c.layerGains[i].gain.setTargetAtTime(this.layerVol(l, this.intensity), ctx.currentTime, 0.3);
    });
    const sd = 60 / c.def.bpm / 4;
    const total = c.def.bars * 16;
    if (c.next < ctx.currentTime - 0.5) c.next = ctx.currentTime + 0.05; // recovered from suspend
    while (c.next < ctx.currentTime + 0.15) {
      const s = c.step % 16;
      const bar = Math.floor(c.step / 16) % c.def.bars;
      c.def.layers.forEach((l, i) => {
        if (c.layerGains[i].gain.value > 0.001 || !l.window) l.step(s, bar, c.next, sd, c.layerGains[i]);
      });
      c.next += sd;
      c.step = (c.step + 1) % total;
    }
    this.dying = this.dying.filter((d) => {
      if (ctx.currentTime > d.until) {
        d.gain.disconnect();
        return false;
      }
      return true;
    });
  }
}
