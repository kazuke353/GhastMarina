import { rand, pick, clamp } from './math';

export type Surface = 'metal' | 'concrete' | 'water' | 'ice' | 'grass' | 'carpet' | 'tile' | 'wood';

interface PlayOpts {
  pos?: { x: number; y: number; z: number };
  vol?: number;
  pitch?: number;
  rev?: number; // reverb send
  max?: number; // max distance
}

type AmbienceId =
  | 'none' | 'deck' | 'hub' | 'city' | 'industrial' | 'lab' | 'aquatic' | 'biosphere' | 'cryo' | 'core' | 'ballroom' | 'container' | 'title';

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  ambBus!: GainNode;
  voiceBus!: GainNode;
  revIn!: GainNode;
  private comp!: DynamicsCompressorNode;
  private white!: AudioBuffer;
  private pink!: AudioBuffer;
  private brown!: AudioBuffer;
  private distCurve!: Float32Array<ArrayBuffer>;
  listener = { x: 0, y: 0, z: 0, yaw: 0 };
  private vols = { master: 0.8, music: 0.6, sfx: 0.85, voice: 0.6 };
  muffled = false;
  private lowpass!: BiquadFilterNode;
  private ambience: { id: AmbienceId; gain: GainNode; stop: () => void; tick?: (dt: number) => void } | null = null;
  private loops = new Map<string, { gain: GainNode; stop: () => void }>();
  private lastPlay = new Map<string, number>();

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx: AudioContext = new AC();
    this.ctx = ctx;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 12;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.2;
    this.master = ctx.createGain();
    this.lowpass = ctx.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = 20000;
    this.master.connect(this.lowpass).connect(this.comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.ambBus = ctx.createGain();
    this.voiceBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.ambBus.connect(this.master);
    this.voiceBus.connect(this.master);
    // reverb
    const conv = ctx.createConvolver();
    conv.buffer = this.makeImpulse(2.8, 2.2);
    this.revIn = ctx.createGain();
    this.revIn.gain.value = 0.55;
    const revOut = ctx.createGain();
    revOut.gain.value = 0.9;
    this.revIn.connect(conv).connect(revOut).connect(this.master);
    // noise
    this.white = this.makeNoise('white', 2);
    this.pink = this.makeNoise('pink', 2);
    this.brown = this.makeNoise('brown', 3);
    const n = 1024;
    this.distCurve = new Float32Array(new ArrayBuffer(n * 4));
    for (let i = 0; i < n; i++) {
      const x = (i / n) * 2 - 1;
      this.distCurve[i] = Math.tanh(x * 3.5);
    }
    this.applyVolumes();
  }

  get t() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  setVolumes(v: { master: number; music: number; sfx: number; voice: number }) {
    this.vols = { ...v };
    this.applyVolumes();
  }
  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vols.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vols.music * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vols.sfx, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.vols.sfx * 0.7, t, 0.05);
    this.voiceBus.gain.setTargetAtTime(this.vols.voice * 0.5, t, 0.05);
  }

  setMuffle(on: boolean) {
    if (!this.ctx || this.muffled === on) return;
    this.muffled = on;
    this.lowpass.frequency.setTargetAtTime(on ? 700 : 20000, this.ctx.currentTime, 0.15);
  }

  private makeNoise(kind: 'white' | 'pink' | 'brown', secs: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * secs);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    return buf;
  }
  private makeImpulse(secs: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * secs);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // ---------- building blocks ----------
  private out(o: PlayOpts, bus?: AudioNode): { node: GainNode; ok: boolean } {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    let vol = o.vol ?? 1;
    let pan = 0;
    if (o.pos) {
      const dx = o.pos.x - this.listener.x, dz = o.pos.z - this.listener.z, dy = o.pos.y - this.listener.y;
      const d = Math.sqrt(dx * dx + dz * dz + dy * dy);
      const max = o.max ?? 45;
      if (d > max) return { node: g, ok: false };
      vol *= clamp(1 / (1 + (d / 6) * (d / 6) * 0.35), 0, 1) * (1 - d / max);
      // listener faces -Z rotated by yaw: right vector = (cos yaw, 0, -sin yaw)
      const rx = Math.cos(this.listener.yaw), rz = -Math.sin(this.listener.yaw);
      pan = d > 0.01 ? clamp((dx * rx + dz * rz) / d, -1, 1) * 0.85 : 0;
    }
    g.gain.value = vol;
    let last: AudioNode = g;
    if (pan !== 0) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      last = p;
    }
    last.connect(bus ?? this.sfxBus);
    if (o.rev) {
      const s = ctx.createGain();
      s.gain.value = o.rev;
      last.connect(s).connect(this.revIn);
    }
    return { node: g, ok: true };
  }
  private noise(kind: 'white' | 'pink' | 'brown' = 'white', loop = false) {
    const s = this.ctx!.createBufferSource();
    s.buffer = kind === 'white' ? this.white : kind === 'pink' ? this.pink : this.brown;
    s.loop = loop;
    if (!loop) s.loopStart = 0;
    return s;
  }
  private filt(type: BiquadFilterType, freq: number, q = 1) {
    const f = this.ctx!.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }
  private osc(type: OscillatorType, freq: number) {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    return o;
  }
  private envGain(t: number, a: number, d: number, peak = 1, curve: 'exp' | 'lin' = 'exp') {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    else g.gain.linearRampToValueAtTime(0.0001, t + a + d);
    return g;
  }
  /** Noise burst helper */
  private burst(dest: AudioNode, t: number, dur: number, ftype: BiquadFilterType, f0: number, f1: number, vol: number, q = 1, kind: 'white' | 'pink' | 'brown' = 'white', attack = 0.002) {
    const n = this.noise(kind);
    const f = this.filt(ftype, f0, q);
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.envGain(t, attack, dur, vol);
    n.connect(f).connect(g).connect(dest);
    n.start(t, Math.random() * 1.5);
    n.stop(t + dur + attack + 0.05);
  }
  private tone(dest: AudioNode, t: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, attack = 0.003) {
    const o = this.osc(type, f0);
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    const g = this.envGain(t, attack, dur, vol);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
    return o;
  }
  private formantVoice(dest: AudioNode, t: number, pitch0: number, pitch1: number, dur: number, vol: number, formants: number[], opts: { type?: OscillatorType; vib?: number; dist?: boolean; breath?: number } = {}) {
    const ctx = this.ctx!;
    const src = this.osc(opts.type ?? 'sawtooth', pitch0);
    src.frequency.setValueAtTime(pitch0, t);
    src.frequency.linearRampToValueAtTime(pitch1, t + dur);
    if (opts.vib) {
      const lfo = this.osc('sine', 5 + Math.random() * 3);
      const lg = ctx.createGain();
      lg.gain.value = opts.vib;
      lfo.connect(lg).connect(src.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.1);
    }
    let input: AudioNode = src;
    if (opts.dist) {
      const ws = ctx.createWaveShaper();
      ws.curve = this.distCurve;
      src.connect(ws);
      input = ws;
    }
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(vol, t + Math.min(0.08, dur * 0.2));
    env.gain.setValueAtTime(vol * 0.85, t + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const f of formants) {
      const bp = this.filt('bandpass', f, 6);
      input.connect(bp).connect(env);
    }
    env.connect(dest);
    src.start(t);
    src.stop(t + dur + 0.05);
    if (opts.breath) this.burst(dest, t, dur, 'bandpass', 1400, 900, opts.breath * vol, 1.5, 'pink', 0.05);
  }

  private throttle(id: string, ms: number) {
    const now = performance.now();
    const last = this.lastPlay.get(id) || 0;
    if (now - last < ms) return false;
    this.lastPlay.set(id, now);
    return true;
  }

  // ---------- public sfx ----------
  play(id: string, o: PlayOpts = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.005;
    const p = o.pitch ?? 1;
    const { node: d, ok } = this.out(o);
    if (!ok) return;
    switch (id) {
      case 'pistol': {
        this.burst(d, t, 0.22, 'lowpass', 5000 * p, 600, 0.9);
        this.burst(d, t, 0.05, 'highpass', 3000, 3000, 0.4);
        this.tone(d, t, 'sine', 160 * p, 45, 0.14, 0.9);
        break;
      }
      case 'shotgun': {
        this.burst(d, t, 0.5, 'lowpass', 3500 * p, 250, 1.1, 0.8, 'pink');
        this.burst(d, t, 0.08, 'highpass', 2500, 2500, 0.5);
        this.tone(d, t, 'sine', 110, 35, 0.25, 1.2);
        this.burst(d, t + 0.42, 0.05, 'bandpass', 2200, 1800, 0.35, 3);
        this.burst(d, t + 0.55, 0.06, 'bandpass', 1500, 1300, 0.4, 3);
        break;
      }
      case 'arc': {
        const o1 = this.tone(d, t, 'sawtooth', 1400 * p, 180, 0.3, 0.35);
        const fm = this.osc('square', 63);
        const fg = ctx.createGain();
        fg.gain.value = 400;
        fm.connect(fg).connect(o1.frequency);
        fm.start(t);
        fm.stop(t + 0.35);
        this.burst(d, t, 0.25, 'highpass', 4000, 2000, 0.5);
        this.tone(d, t, 'sine', 90, 40, 0.2, 0.6);
        break;
      }
      case 'swing':
        this.burst(d, t, 0.2, 'bandpass', 350 * p, 1800 * p, 0.35, 2, 'white', 0.05);
        break;
      case 'hit':
        this.tone(d, t, 'sine', 110 * p, 40, 0.12, 0.9);
        this.burst(d, t, 0.08, 'lowpass', 1500, 400, 0.7);
        break;
      case 'flesh':
        this.burst(d, t, 0.14, 'bandpass', 700 * p, 300, 0.7, 3);
        this.burst(d, t + 0.02, 0.1, 'lowpass', 600, 200, 0.5, 1, 'brown');
        break;
      case 'headshot':
        this.burst(d, t, 0.18, 'bandpass', 1000, 300, 0.8, 2);
        this.tone(d, t, 'triangle', 2400, 1800, 0.08, 0.25);
        break;
      case 'metal':
        this.tone(d, t, 'sine', 1800 * p, 1750 * p, 0.35, 0.3);
        this.tone(d, t, 'sine', 2650 * p, 2600 * p, 0.25, 0.2);
        this.burst(d, t, 0.04, 'highpass', 3000, 3000, 0.5);
        break;
      case 'ricochet':
        this.tone(d, t, 'sine', 3200 * p, 1400, 0.18, 0.12);
        break;
      case 'reload':
        this.burst(d, t, 0.04, 'bandpass', 2400, 2000, 0.5, 4);
        this.burst(d, t + 0.32, 0.05, 'bandpass', 1300, 1100, 0.7, 4);
        this.burst(d, t + 0.55, 0.12, 'bandpass', 3000, 1500, 0.4, 3);
        break;
      case 'shell':
        this.burst(d, t, 0.05, 'bandpass', 1800, 1500, 0.55, 4);
        break;
      case 'empty':
        this.burst(d, t, 0.03, 'bandpass', 3500, 3500, 0.5, 5);
        break;
      case 'pickup':
        this.tone(d, t, 'sine', 880 * p, 880 * p, 0.08, 0.25);
        this.tone(d, t + 0.07, 'sine', 1320 * p, 1320 * p, 0.12, 0.25);
        break;
      case 'coin':
        this.tone(d, t, 'square', 1567, 1567, 0.05, 0.08);
        this.tone(d, t + 0.05, 'square', 2093, 2093, 0.15, 0.08);
        break;
      case 'uiHover':
        this.tone(d, t, 'sine', 2200, 2000, 0.025, 0.06);
        break;
      case 'uiConfirm':
        this.tone(d, t, 'triangle', 660, 660, 0.05, 0.18);
        this.tone(d, t + 0.05, 'triangle', 990, 990, 0.09, 0.18);
        break;
      case 'uiBack':
        this.tone(d, t, 'triangle', 520, 380, 0.1, 0.15);
        break;
      case 'uiOpen':
        this.tone(d, t, 'sine', 400, 1200, 0.12, 0.12);
        this.burst(d, t, 0.15, 'bandpass', 1500, 4000, 0.06, 3);
        break;
      case 'chime': {
        const notes = [1318.5, 1975.5, 2637];
        notes.forEach((f, i) => this.tone(d, t + i * 0.09, 'sine', f, f, 0.9, 0.16));
        this.tone(d, t, 'sine', 659, 659, 1.2, 0.08);
        break;
      }
      case 'captain': {
        const fs = [55, 82.4, 110, 116.5];
        for (const f of fs) {
          const o1 = this.osc('sawtooth', f);
          const lp = this.filt('lowpass', 200, 2);
          lp.frequency.setValueAtTime(150, t);
          lp.frequency.exponentialRampToValueAtTime(1600, t + 0.5);
          lp.frequency.exponentialRampToValueAtTime(200, t + 1.6);
          const g = this.envGain(t, 0.3, 1.5, 0.12);
          o1.connect(lp).connect(g).connect(d);
          o1.start(t);
          o1.stop(t + 2);
        }
        this.burst(d, t, 1.2, 'bandpass', 300, 3000, 0.08, 2, 'white', 0.4);
        break;
      }
      case 'heartbeat':
        this.tone(d, t, 'sine', 62, 40, 0.14, 0.9);
        this.tone(d, t + 0.2, 'sine', 55, 36, 0.16, 0.7);
        break;
      case 'thud': {
        this.burst(d, t, 2.2, 'lowpass', 400, 40, 1.4, 0.7, 'brown', 0.005);
        this.tone(d, t, 'sine', 60, 22, 1.4, 1.3);
        [173, 247, 331, 412].forEach((f, i) => this.tone(d, t + 0.01 * i, 'sine', f, f * 0.97, 1.6 + i * 0.3, 0.12));
        this.burst(d, t, 0.25, 'highpass', 1500, 600, 0.5);
        break;
      }
      case 'fall':
        this.burst(d, t, 2.6, 'bandpass', 200, 2400, 0.7, 1.2, 'pink', 2.4);
        break;
      case 'machinery': {
        const o1 = this.osc('sawtooth', 48);
        const lp = this.filt('lowpass', 300, 3);
        const g = this.envGain(t, 0.4, 2.6, 0.25, 'lin');
        o1.connect(lp).connect(g).connect(d);
        o1.start(t);
        o1.stop(t + 3.1);
        for (let i = 0; i < 6; i++) this.play('clank', { vol: 0.6 * (o.vol ?? 1), pitch: rand(0.7, 1.2) });
        this.burst(d, t, 3, 'bandpass', 900, 600, 0.25, 4, 'pink', 0.4);
        break;
      }
      case 'clank': {
        const tt = t + rand(0, 2.5);
        const f = rand(300, 700) * p;
        this.tone(d, tt, 'square', f, f * 0.98, 0.25, 0.08);
        this.tone(d, tt, 'sine', f * 2.76, f * 2.7, 0.3, 0.1);
        this.burst(d, tt, 0.05, 'bandpass', 2000, 1500, 0.3, 2);
        break;
      }
      case 'door':
        this.burst(d, t, 0.6, 'highpass', 1200, 3000, 0.25, 0.8, 'white', 0.08);
        this.tone(d, t + 0.55, 'sine', 90, 50, 0.15, 0.5);
        break;
      case 'doorLocked':
        this.tone(d, t, 'square', 220, 220, 0.08, 0.12);
        this.tone(d, t + 0.12, 'square', 180, 180, 0.12, 0.12);
        break;
      case 'zombieMoan': {
        if (!this.throttle('moan', 220)) break;
        const pitch = rand(70, 120) * p;
        const v = pick([[650, 1080], [500, 900], [400, 800], [700, 1200]]);
        this.formantVoice(d, t, pitch, pitch * rand(0.75, 0.95), rand(0.9, 1.7), 0.55, v, { vib: 6, breath: 0.4 });
        break;
      }
      case 'zombieAlert': {
        const pitch = rand(170, 230) * p;
        this.formantVoice(d, t, pitch, pitch * 1.5, 0.7, 0.6, [800, 1300, 2500], { vib: 20, dist: true, breath: 0.5 });
        break;
      }
      case 'zombieAttack': {
        const pitch = rand(110, 150) * p;
        this.formantVoice(d, t, pitch * 1.3, pitch, 0.35, 0.55, [700, 1150], { dist: true, breath: 0.6 });
        break;
      }
      case 'zombieDie': {
        const pitch = rand(90, 130) * p;
        this.formantVoice(d, t, pitch, pitch * 0.45, 1.1, 0.5, [600, 1000], { vib: 10, breath: 0.5 });
        this.burst(d, t + 0.3, 0.8, 'lowpass', 500, 120, 0.4, 2, 'brown');
        break;
      }
      case 'bossRoar': {
        const pitch = rand(55, 70) * p;
        this.formantVoice(d, t, pitch, pitch * 0.7, 2.2, 1.0, [400, 700, 1100], { vib: 8, dist: true, breath: 1.0 });
        this.tone(d, t, 'sine', 45, 30, 2, 0.8);
        break;
      }
      case 'hurt': {
        if (!this.throttle('hurt', 150)) break;
        const pitch = rand(140, 170);
        this.formantVoice(d, t, pitch * 1.2, pitch, 0.22, 0.5, [700, 1200], { breath: 0.8 });
        this.tone(d, t, 'sine', 90, 40, 0.15, 0.6);
        break;
      }
      case 'heal':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(d, t + i * 0.07, 'sine', f, f, 0.5, 0.12));
        break;
      case 'levelUp':
        [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(d, t + i * 0.06, 'triangle', f, f, 0.6, 0.12));
        break;
      case 'explosion': {
        this.burst(d, t, 1.6, 'lowpass', 2400, 60, 1.6, 0.7, 'brown', 0.003);
        this.burst(d, t, 0.4, 'lowpass', 6000, 800, 0.9, 0.7, 'white');
        this.tone(d, t, 'sine', 80, 25, 0.8, 1.4);
        for (let i = 0; i < 8; i++) this.burst(d, t + 0.1 + Math.random() * 0.9, 0.04, 'highpass', 2000, 2000, 0.25);
        break;
      }
      case 'splash':
        this.burst(d, t, 0.45, 'bandpass', 2500, 400, 0.6, 1.5);
        for (let i = 0; i < 4; i++) this.tone(d, t + 0.05 + i * 0.06, 'sine', rand(400, 800), rand(1000, 1600), 0.05, 0.08);
        break;
      case 'glass':
        this.burst(d, t, 0.4, 'highpass', 4000, 6000, 0.6);
        for (let i = 0; i < 7; i++) {
          const f = rand(2500, 6000);
          this.tone(d, t + Math.random() * 0.3, 'sine', f, f * 0.98, rand(0.1, 0.4), 0.1);
        }
        break;
      case 'steam':
        this.burst(d, t, 1.1, 'highpass', 2000, 3500, 0.35, 0.7, 'white', 0.06);
        break;
      case 'zap': {
        const o1 = this.osc('square', 110);
        const g = this.envGain(t, 0.005, 0.35, 0.18);
        const lp = this.filt('lowpass', 3000);
        o1.connect(lp).connect(g).connect(d);
        o1.start(t);
        o1.stop(t + 0.4);
        for (let i = 0; i < 5; i++) this.burst(d, t + Math.random() * 0.3, 0.02, 'highpass', 3000, 3000, 0.35);
        break;
      }
      case 'lightning':
        this.burst(d, t, 0.08, 'highpass', 2000, 2000, 0.6);
        this.burst(d, t + 0.05, 2.2, 'lowpass', 900, 60, 0.7, 0.7, 'brown', 0.05);
        break;
      case 'objection':
        this.play('glass', { vol: 0.8 });
        [261.6, 311.1, 392, 466.2].forEach((f) => {
          const o1 = this.osc('sawtooth', f);
          const lp = this.filt('lowpass', 4000, 2);
          lp.frequency.setValueAtTime(5000, t);
          lp.frequency.exponentialRampToValueAtTime(300, t + 0.6);
          const g = this.envGain(t, 0.005, 0.7, 0.12);
          o1.connect(lp).connect(g).connect(d);
          o1.start(t);
          o1.stop(t + 0.8);
        });
        this.tone(d, t, 'sine', 90, 40, 0.3, 1);
        break;
      case 'wrong':
        this.tone(d, t, 'square', 300, 300, 0.14, 0.12);
        this.tone(d, t + 0.16, 'square', 200, 200, 0.3, 0.12);
        break;
      case 'tranq':
        this.burst(d, t, 0.25, 'highpass', 3000, 6000, 0.4);
        this.tone(d, t + 0.2, 'sine', 220, 55, 2.5, 0.3);
        break;
      case 'whisper': {
        const n = this.noise('pink');
        const bp = this.filt('bandpass', 1200, 8);
        const dur = rand(1.2, 2.2);
        for (let i = 0; i < 12; i++) bp.frequency.setValueAtTime(rand(600, 2600), t + (i * dur) / 12);
        const g = this.envGain(t, 0.3, dur, 0.35, 'lin');
        const pn = ctx.createStereoPanner();
        pn.pan.value = rand(-1, 1);
        n.connect(bp).connect(g).connect(pn).connect(d);
        n.start(t, Math.random());
        n.stop(t + dur + 0.4);
        break;
      }
      case 'iceCrack':
        this.burst(d, t, 0.12, 'highpass', 2500, 5000, 0.6);
        this.tone(d, t, 'sine', 3000 * p, 600, 0.3, 0.12);
        break;
      case 'spore':
        this.burst(d, t, 0.5, 'lowpass', 900, 200, 0.5, 1, 'pink', 0.02);
        break;
      case 'hackTick':
        this.tone(d, t, 'square', 1800 * p, 1800 * p, 0.02, 0.05);
        break;
      case 'hackOk':
        [880, 1108, 1318, 1760].forEach((f, i) => this.tone(d, t + i * 0.05, 'square', f, f, 0.08, 0.06));
        break;
      case 'hackFail':
        this.tone(d, t, 'sawtooth', 160, 90, 0.4, 0.15);
        break;
      case 'type':
        this.burst(d, t, 0.02, 'bandpass', rand(1500, 2500), 1500, 0.25, 3);
        break;
      case 'stomp':
        this.tone(d, t, 'sine', 70, 30, 0.35, 1.2);
        this.burst(d, t, 0.5, 'lowpass', 600, 80, 0.9, 1, 'brown');
        break;
      case 'spit':
        this.burst(d, t, 0.25, 'bandpass', 900, 2000, 0.5, 3, 'pink');
        break;
      case 'acid':
        this.burst(d, t, 0.6, 'highpass', 1500, 4000, 0.3, 1, 'white', 0.02);
        break;
      case 'teleport':
        this.tone(d, t, 'sine', 200, 2400, 0.3, 0.25);
        this.burst(d, t, 0.3, 'bandpass', 600, 5000, 0.3, 4);
        break;
      case 'freeze':
        this.burst(d, t, 0.6, 'highpass', 4000, 8000, 0.35);
        this.tone(d, t, 'sine', 2600, 3400, 0.4, 0.08);
        break;
      case 'flare':
        this.burst(d, t, 1.2, 'bandpass', 3000, 2500, 0.25, 1, 'white', 0.05);
        break;
      case 'takedown':
        this.tone(d, t, 'sine', 70, 30, 0.2, 1);
        this.burst(d, t, 0.25, 'bandpass', 500, 200, 0.8, 2, 'pink');
        break;
      case 'bell': {
        const f = 220 * p;
        [1, 2.76, 5.4].forEach((m, i) => this.tone(d, t, 'sine', f * m, f * m, 2.5 - i * 0.6, 0.18 / (i + 1)));
        break;
      }
      case 'dodge':
        this.burst(d, t, 0.25, 'bandpass', 700, 300, 0.3, 1, 'pink', 0.02);
        break;
      case 'blackout':
        this.tone(d, t, 'sawtooth', 120, 30, 1.5, 0.25);
        this.burst(d, t, 1.5, 'lowpass', 3000, 100, 0.5, 1, 'white');
        this.tone(d, t, 'sine', 3800, 3800, 1.2, 0.06);
        break;
      case 'glitch':
        for (let i = 0; i < 6; i++) this.tone(d, t + i * 0.035, 'square', rand(200, 2000), rand(200, 2000), 0.03, 0.08);
        break;
      case 'crowd':
        for (let i = 0; i < 20; i++) this.burst(d, t + Math.random() * 1.5, rand(0.08, 0.25), 'bandpass', rand(500, 1500), rand(500, 1500), 0.1, 4, 'pink');
        break;
      case 'vote':
        this.tone(d, t, 'square', 1046, 1046, 0.04, 0.07);
        break;
      default:
        break;
    }
  }

  /** Footstep based on surface */
  step(surface: Surface, pos: { x: number; y: number; z: number }, vol = 0.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const { node: d, ok } = this.out({ pos, vol, max: 25 });
    if (!ok) return;
    switch (surface) {
      case 'metal':
        this.burst(d, t, 0.07, 'bandpass', 2400, 1800, 0.5, 3);
        this.tone(d, t, 'sine', rand(500, 700), 400, 0.08, 0.1);
        break;
      case 'water':
        this.burst(d, t, 0.18, 'bandpass', 1600, 500, 0.5, 2);
        this.tone(d, t + 0.03, 'sine', rand(500, 700), rand(1100, 1500), 0.05, 0.06);
        break;
      case 'ice':
        this.burst(d, t, 0.06, 'highpass', 3500, 5000, 0.45);
        break;
      case 'grass':
        this.burst(d, t, 0.14, 'bandpass', 2600, 1800, 0.3, 1.2);
        break;
      case 'carpet':
        this.burst(d, t, 0.08, 'lowpass', 500, 200, 0.6);
        break;
      case 'tile':
        this.burst(d, t, 0.05, 'bandpass', 1800, 1400, 0.5, 2);
        break;
      case 'wood':
        this.burst(d, t, 0.07, 'lowpass', 900, 400, 0.6);
        this.tone(d, t, 'sine', 180, 140, 0.06, 0.15);
        break;
      default:
        this.burst(d, t, 0.06, 'lowpass', 1100, 500, 0.6);
    }
  }

  /** Dialogue babble: a short formant blip */
  voiceBlip(pitch: number, timbre = 0, vol = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const { node: d } = this.out({ vol }, this.voiceBus);
    const vowels = [[730, 1090], [270, 2290], [530, 1840], [300, 870], [660, 1720], [490, 1350]];
    const v = pick(vowels);
    const p = pitch * rand(0.9, 1.15);
    this.formantVoice(d, t, p, p * rand(0.9, 1.05), 0.075, 0.9, [v[0] * (1 + timbre * 0.1), v[1]], {
      type: timbre > 0.5 ? 'square' : 'sawtooth',
    });
  }

  // ---------- loops ----------
  startLoop(id: string, kind: 'helicopter' | 'beam' | 'alarm' | 'rain' | 'fire' | 'conveyor', vol = 1) {
    if (!this.ctx || this.loops.has(id)) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(vol, ctx.currentTime, 0.6);
    g.connect(this.sfxBus);
    const nodes: AudioScheduledSourceNode[] = [];
    if (kind === 'helicopter') {
      const n = this.noise('brown', true);
      const lp = this.filt('lowpass', 380, 1.5);
      const am = ctx.createGain();
      am.gain.value = 0.2;
      const lfo = this.osc('square', 4.6);
      const lfoG = ctx.createGain();
      lfoG.gain.value = 0.8;
      lfo.connect(lfoG).connect(am.gain);
      n.connect(lp).connect(am).connect(g);
      const whine = this.osc('sine', 1180);
      const wg = ctx.createGain();
      wg.gain.value = 0.015;
      whine.connect(wg).connect(g);
      nodes.push(n, lfo, whine);
    } else if (kind === 'beam') {
      const o1 = this.osc('sawtooth', 55);
      const o2 = this.osc('sine', 110.5);
      const lp = this.filt('lowpass', 260, 4);
      const lfo = this.osc('sine', 0.2);
      const lg = ctx.createGain();
      lg.gain.value = 120;
      lfo.connect(lg).connect(lp.frequency);
      const og = ctx.createGain();
      og.gain.value = 0.18;
      o1.connect(lp);
      o2.connect(lp);
      lp.connect(og).connect(g);
      nodes.push(o1, o2, lfo);
    } else if (kind === 'alarm') {
      const o1 = this.osc('square', 600);
      const lfo = this.osc('sine', 1.2);
      const lg = ctx.createGain();
      lg.gain.value = 250;
      lfo.connect(lg).connect(o1.frequency);
      const lp = this.filt('lowpass', 1500);
      const og = ctx.createGain();
      og.gain.value = 0.05;
      o1.connect(lp).connect(og).connect(g);
      nodes.push(o1, lfo);
    } else if (kind === 'fire' || kind === 'rain' || kind === 'conveyor') {
      const n = this.noise(kind === 'fire' ? 'brown' : 'pink', true);
      const f = this.filt(kind === 'rain' ? 'highpass' : 'lowpass', kind === 'rain' ? 2000 : kind === 'conveyor' ? 500 : 900);
      const og = ctx.createGain();
      og.gain.value = 0.3;
      n.connect(f).connect(og).connect(g);
      nodes.push(n);
    }
    nodes.forEach((n) => n.start());
    this.loops.set(id, {
      gain: g,
      stop: () => {
        const tt = ctx.currentTime;
        g.gain.cancelScheduledValues(tt);
        g.gain.setTargetAtTime(0, tt, 0.4);
        nodes.forEach((n) => {
          try {
            n.stop(tt + 2);
          } catch {
            /* already stopped */
          }
        });
      },
    });
  }
  setLoopVol(id: string, v: number) {
    const l = this.loops.get(id);
    if (l && this.ctx) l.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2);
  }
  stopLoop(id: string) {
    const l = this.loops.get(id);
    if (l) {
      l.stop();
      this.loops.delete(id);
    }
  }
  stopAllLoops() {
    for (const id of [...this.loops.keys()]) this.stopLoop(id);
  }

  // ---------- ambience ----------
  private ambTimer = 0;
  setAmbience(id: AmbienceId) {
    if (!this.ctx) return;
    if (this.ambience?.id === id) return;
    const ctx = this.ctx;
    if (this.ambience) {
      const old = this.ambience;
      old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
      setTimeout(() => old.stop(), 4000);
      this.ambience = null;
    }
    if (id === 'none') return;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
    g.connect(this.ambBus);
    const srcs: AudioScheduledSourceNode[] = [];
    const wind = (lp: number, vol: number, rate = 0.07) => {
      const n = this.noise('pink', true);
      const f = this.filt('lowpass', lp, 0.8);
      const lfo = this.osc('sine', rate);
      const lg = ctx.createGain();
      lg.gain.value = lp * 0.5;
      lfo.connect(lg).connect(f.frequency);
      const wg = ctx.createGain();
      wg.gain.value = vol;
      const lfo2 = this.osc('sine', rate * 1.7);
      const lg2 = ctx.createGain();
      lg2.gain.value = vol * 0.4;
      lfo2.connect(lg2).connect(wg.gain);
      n.connect(f).connect(wg).connect(g);
      srcs.push(n, lfo, lfo2);
    };
    const hum = (f0: number, vol: number, lp = 200) => {
      const o1 = this.osc('sawtooth', f0);
      const o2 = this.osc('sine', f0 * 2.01);
      const f = this.filt('lowpass', lp, 1);
      const hg = ctx.createGain();
      hg.gain.value = vol;
      o1.connect(f);
      o2.connect(f);
      f.connect(hg).connect(g);
      srcs.push(o1, o2);
    };
    const bed = (kind: 'white' | 'pink' | 'brown', type: BiquadFilterType, freq: number, vol: number, q = 1) => {
      const n = this.noise(kind, true);
      const f = this.filt(type, freq, q);
      const bg = ctx.createGain();
      bg.gain.value = vol;
      n.connect(f).connect(bg).connect(g);
      srcs.push(n);
    };
    let events: { every: [number, number]; fn: () => void }[] = [];
    const ev = (a: number, b: number, fn: () => void) => events.push({ every: [a, b], fn });
    const randPos = () => ({ x: this.listener.x + rand(-20, 20), y: this.listener.y, z: this.listener.z + rand(-20, 20) });
    switch (id) {
      case 'deck':
      case 'title':
        wind(500, 0.5);
        wind(1400, 0.12, 0.13);
        hum(41, 0.05, 120);
        ev(6, 14, () => this.play('iceCrack', { vol: 0.25, pitch: rand(0.4, 0.8), rev: 0.8 }));
        ev(10, 25, () => this.play('zombieMoan', { vol: 0.12, pitch: 0.8, rev: 1 }));
        break;
      case 'hub':
        hum(55, 0.06, 180);
        bed('pink', 'bandpass', 120, 0.25, 0.5);
        ev(8, 18, () => this.play('clank', { vol: 0.15, pos: randPos(), rev: 0.6 }));
        ev(15, 30, () => this.play('zombieMoan', { vol: 0.08, pitch: 0.7, rev: 1 }));
        break;
      case 'container':
        hum(38, 0.06, 90);
        bed('brown', 'lowpass', 140, 0.35);
        ev(5, 9, () => this.play('clank', { vol: 0.2, rev: 0.7 }));
        break;
      case 'city':
        wind(600, 0.45);
        ev(4, 10, () => this.play('zombieMoan', { vol: 0.2, pos: randPos(), rev: 1 }));
        ev(6, 14, () => this.play('clank', { vol: 0.1, pitch: 0.5, pos: randPos(), rev: 0.8 }));
        ev(20, 40, () => this.play('glass', { vol: 0.08, pos: randPos(), rev: 1 }));
        break;
      case 'industrial':
        hum(46, 0.1, 250);
        bed('pink', 'bandpass', 300, 0.25, 2);
        ev(1.5, 4, () => this.play('clank', { vol: 0.25, pos: randPos(), rev: 0.6 }));
        ev(5, 12, () => this.play('steam', { vol: 0.15, pos: randPos(), rev: 0.5 }));
        ev(12, 25, () => this.play('zombieMoan', { vol: 0.15, pitch: 0.75, pos: randPos(), rev: 1 }));
        break;
      case 'lab':
        hum(120, 0.025, 1800);
        hum(60, 0.04, 200);
        ev(3, 8, () => this.play('hackTick', { vol: 0.15, pitch: rand(0.6, 1.4), pos: randPos() }));
        ev(8, 18, () => this.play('whisper', { vol: 0.2, rev: 0.8 }));
        ev(10, 22, () => this.play('zombieMoan', { vol: 0.12, pitch: 1.2, pos: randPos(), rev: 1 }));
        break;
      case 'aquatic':
        bed('pink', 'lowpass', 300, 0.4);
        bed('white', 'bandpass', 800, 0.06, 6);
        ev(0.6, 2.5, () => this.play('splash', { vol: 0.06, pos: randPos(), rev: 1 }));
        ev(2, 6, () => this.dropDrip());
        ev(10, 22, () => this.play('zombieMoan', { vol: 0.12, pitch: 0.6, pos: randPos(), rev: 1.2 }));
        break;
      case 'biosphere':
        wind(800, 0.2);
        bed('white', 'bandpass', 5200, 0.03, 12);
        ev(0.3, 1.5, () => this.insect());
        ev(8, 18, () => this.play('spore', { vol: 0.2, pos: randPos() }));
        ev(12, 24, () => this.play('zombieMoan', { vol: 0.12, pitch: 0.9, pos: randPos(), rev: 0.8 }));
        break;
      case 'cryo':
        wind(300, 0.35, 0.05);
        bed('white', 'highpass', 6000, 0.03);
        hum(36, 0.05, 100);
        ev(3, 8, () => this.play('iceCrack', { vol: 0.3, pitch: rand(0.4, 1), pos: randPos(), rev: 1 }));
        ev(12, 24, () => this.play('zombieMoan', { vol: 0.12, pitch: 0.55, pos: randPos(), rev: 1.2 }));
        break;
      case 'core':
        hum(55, 0.12, 300);
        hum(27.5, 0.12, 120);
        wind(900, 0.25);
        ev(2, 6, () => this.play('zap', { vol: 0.2, pos: randPos(), rev: 0.6 }));
        ev(8, 16, () => this.play('lightning', { vol: 0.35, rev: 1 }));
        break;
      case 'ballroom':
        bed('brown', 'lowpass', 150, 0.3);
        hum(48, 0.03, 140);
        ev(10, 20, () => this.play('zombieMoan', { vol: 0.07, pitch: 0.7, rev: 1.4 }));
        break;
    }
    const timers = events.map((e) => rand(e.every[0], e.every[1]) * 0.5);
    const tick = (dt: number) => {
      for (let i = 0; i < events.length; i++) {
        timers[i] -= dt;
        if (timers[i] <= 0) {
          timers[i] = rand(events[i].every[0], events[i].every[1]);
          events[i].fn();
        }
      }
    };
    srcs.forEach((s) => s.start());
    this.ambience = {
      id,
      gain: g,
      tick,
      stop: () => {
        srcs.forEach((s) => {
          try {
            s.stop();
          } catch {
            /* noop */
          }
        });
        g.disconnect();
        events = [];
      },
    };
  }
  private dropDrip() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const { node: d } = this.out({ vol: 0.15, rev: 1.2 });
    const f = rand(900, 1600);
    this.tone(d, t, 'sine', f, f * 0.5, 0.08, 0.3);
  }
  private insect() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const { node: d } = this.out({ vol: 0.05, pos: { x: this.listener.x + rand(-15, 15), y: 0, z: this.listener.z + rand(-15, 15) } });
    const f = rand(3500, 6000);
    for (let i = 0; i < 6; i++) this.tone(d, t + i * 0.045, 'sine', f, f * 1.02, 0.03, 0.4);
  }

  update(dt: number) {
    this.ambience?.tick?.(dt);
  }
}

export const audio = new AudioEngine();
