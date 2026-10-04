import * as THREE from 'three';
import { BONES, BoneName, CharacterModel, HoundModel, HBONES, HBone } from './CharacterBuilder';
import { clamp, clamp01, damp, lerp, smooth, easeOut } from '../core/math';

export type WeaponPose = 'none' | 'melee' | 'pistol' | 'long';

export interface AnimParams {
  speed: number;
  forward: number; // local movement dir (-1..1)
  strafe: number;
  run: number;
  aim: number;
  aimPitch: number;
  weapon: WeaponPose;
  attack: number; // -1 or 0..1
  attackType: number;
  recoil: number;
  crouch: number;
  roll: number; // -1 or 0..1
  hurt: number;
  dead: number; // 0 alive, >0 death progress
  deadDir: number; // 1 backward, -1 forward
  talk: number;
  pose: string | null;
  poseW: number;
  zombie: number;
  lookYaw: number;
  lookPitch: number;
  interact: number;
  heal: number;
  throwT: number; // -1 or 0..1
  stiff: number; // frozen
  lunge: number; // zombie lunge 0..1
  float: number; // hologram hover
}

export function defaultParams(): AnimParams {
  return {
    speed: 0, forward: 1, strafe: 0, run: 0, aim: 0, aimPitch: 0, weapon: 'none', attack: -1, attackType: 0, recoil: 0,
    crouch: 0, roll: -1, hurt: 0, dead: 0, deadDir: 1, talk: 0, pose: null, poseW: 0, zombie: 0, lookYaw: 0, lookPitch: 0,
    interact: 0, heal: 0, throwT: -1, stiff: 0, lunge: 0, float: 0,
  };
}

type Rot = [number, number, number];
type PoseDef = Partial<Record<BoneName, Rot>> & { hipsY?: number; hipsZ?: number };

export const POSES: Record<string, PoseDef> = {
  point: { upperArmR: [-1.55, 0, 0.15], foreArmR: [-0.05, 0, 0], chest: [0, -0.25, 0], head: [-0.05, -0.15, 0], upperArmL: [0.1, 0, 0.15], foreArmL: [-0.3, 0, 0] },
  think: { upperArmR: [-0.45, 0, 0.35], foreArmR: [-2.35, 0, 0], head: [0.15, 0.15, 0.08], upperArmL: [-0.35, 0, -0.45], foreArmL: [-1.5, 0, 0] },
  cross: { upperArmL: [-0.5, 0, -0.35], foreArmL: [-1.75, -0.2, -0.4], upperArmR: [-0.5, 0, 0.35], foreArmR: [-1.75, 0.2, 0.4], head: [-0.05, 0, 0] },
  shock: { upperArmL: [-2.3, 0, 0.5], foreArmL: [-0.8, 0, 0], upperArmR: [-2.3, 0, -0.5], foreArmR: [-0.8, 0, 0], spine: [-0.18, 0, 0], head: [-0.2, 0, 0] },
  hips: { upperArmL: [0.15, 0, 0.75], foreArmL: [-1.3, 0, 0], upperArmR: [0.15, 0, -0.75], foreArmR: [-1.3, 0, 0], chest: [-0.05, 0, 0] },
  despair: { spine: [0.35, 0, 0], chest: [0.2, 0, 0], head: [0.55, 0, 0], upperArmL: [0.1, 0, 0.05], upperArmR: [0.1, 0, -0.05], foreArmL: [-0.2, 0, 0], foreArmR: [-0.2, 0, 0] },
  laugh: { spine: [-0.15, 0, 0], head: [-0.35, 0, 0], upperArmL: [-0.2, 0, 0.3], foreArmL: [-1.6, 0, 0], upperArmR: [0.1, 0, -0.25], foreArmR: [-0.5, 0, 0] },
  shrug: { upperArmL: [-0.1, 0, 0.45], foreArmL: [-1.4, 0.6, 0], upperArmR: [-0.1, 0, -0.45], foreArmR: [-1.4, -0.6, 0], head: [0, 0, 0.18], neck: [0, 0, 0.05] },
  sit: { thighL: [-1.55, 0, 0.05], thighR: [-1.55, 0, -0.05], shinL: [1.5, 0, 0], shinR: [1.5, 0, 0], hipsY: -0.48, upperArmL: [-0.3, 0, 0.1], upperArmR: [-0.3, 0, -0.1], foreArmL: [-1.0, 0, 0], foreArmR: [-1.0, 0, 0], spine: [0.1, 0, 0] },
  sitFloor: { thighL: [-1.4, 0, 0.25], thighR: [-1.4, 0, -0.25], shinL: [2.2, 0, 0], shinR: [2.2, 0, 0], hipsY: -0.82, spine: [0.3, 0, 0], head: [0.3, 0, 0], upperArmL: [-0.9, 0, 0.1], upperArmR: [-0.9, 0, -0.1], foreArmL: [-0.6, 0, 0], foreArmR: [-0.6, 0, 0] },
  lie: { hips: [-1.5, 0, 0], hipsY: -0.8, thighL: [0, 0, 0.1], thighR: [0, 0, -0.1], upperArmL: [-0.2, 0, 0.5], upperArmR: [-0.3, 0, -0.4], head: [0, 0.4, 0] },
  lieSide: { hips: [-1.45, 0, 1.4], hipsY: -0.78, thighL: [-0.6, 0, 0], thighR: [-0.9, 0, 0], shinL: [1.0, 0, 0], shinR: [1.2, 0, 0], upperArmL: [-1.2, 0, 0.2], upperArmR: [-1.0, 0, -0.2], foreArmL: [-1.2, 0, 0], head: [0.3, 0, 0] },
  kneel: { thighL: [-1.4, 0, 0.05], shinL: [1.45, 0, 0], thighR: [0.1, 0, -0.05], shinR: [1.6, 0, 0], footR: [0.4, 0, 0], hipsY: -0.42, spine: [0.15, 0, 0] },
  wave: { upperArmR: [-2.6, 0, -0.3], foreArmR: [-0.6, 0, 0], head: [0, -0.1, 0.05] },
  salute: { upperArmR: [-1.4, 0.6, -1.2], foreArmR: [-2.4, 0, 0], head: [-0.05, 0, 0] },
  fight: { upperArmL: [-1.1, 0, 0.1], foreArmL: [-1.9, 0, 0], upperArmR: [-0.9, 0, -0.1], foreArmR: [-2.1, 0, 0], spine: [0.12, 0, 0], thighL: [-0.25, 0, 0.1], thighR: [0.15, 0, -0.1], shinL: [0.3, 0, 0], shinR: [0.3, 0, 0], hipsY: -0.04 },
  typing: { upperArmL: [-0.8, 0, -0.15], foreArmL: [-0.9, 0, 0], upperArmR: [-0.8, 0, 0.15], foreArmR: [-0.9, 0, 0], head: [0.35, 0, 0], spine: [0.15, 0, 0] },
  meditate: { upperArmL: [-0.5, 0, 0.3], foreArmL: [-1.6, 0, 0.8], upperArmR: [-0.5, 0, -0.3], foreArmR: [-1.6, 0, -0.8], head: [0.15, 0, 0] },
  band: { upperArmL: [-1.15, 0, -0.55], foreArmL: [-1.55, 0, 0], head: [0.45, 0.25, 0], chest: [0, 0.15, 0] },
  slump: { spine: [0.6, 0, 0], chest: [0.3, 0, 0], head: [0.7, 0, 0], thighL: [-1.4, 0, 0.25], thighR: [-1.4, 0, -0.25], shinL: [2.4, 0, 0], shinR: [2.4, 0, 0], hipsY: -0.82, upperArmL: [0.2, 0, 0.1], upperArmR: [0.2, 0, -0.1] },
  hold: { upperArmL: [-0.9, 0, -0.3], foreArmL: [-0.9, 0, 0], upperArmR: [-0.9, 0, 0.3], foreArmR: [-0.9, 0, 0] },
  bow: { spine: [0.55, 0, 0], chest: [0.2, 0, 0], head: [0.2, 0, 0], upperArmR: [-0.8, 0, 0.6], foreArmR: [-1.2, 0, 0] },
  arms: { upperArmL: [-0.2, 0, 1.2], foreArmL: [-0.2, 0, 0], upperArmR: [-0.2, 0, -1.2], foreArmR: [-0.2, 0, 0], spine: [-0.1, 0, 0], head: [-0.2, 0, 0] },
  grip: { upperArmL: [-0.6, 0, 0.2], foreArmL: [-1.5, 0, 0], upperArmR: [-0.6, 0, -0.2], foreArmR: [-1.5, 0, 0], head: [0.25, 0, 0], spine: [0.2, 0, 0] },
  nervous: { upperArmL: [-0.4, 0, -0.3], foreArmL: [-1.6, -0.4, 0], upperArmR: [-0.4, 0, 0.3], foreArmR: [-1.6, 0.4, 0], head: [0.25, 0.1, 0], spine: [0.1, 0, 0] },
  clutch: { upperArmL: [-0.4, 0, -0.5], foreArmL: [-2.0, 0, 0], upperArmR: [-0.4, 0, 0.5], foreArmR: [-2.0, 0, 0], head: [0.4, 0, 0], spine: [0.45, 0, 0], hipsY: -0.05 },
};

const tq = new THREE.Quaternion();
const te = new THREE.Euler();

export class Animator {
  private phase = 0;
  private t = Math.random() * 10;
  private target: Record<string, THREE.Vector3> = {};
  private hipsY = 0;
  private hipsZ = 0;
  private hipsX = 0;
  p: AnimParams = defaultParams();
  /** smoothing speed */
  stiffness = 16;
  private seed = Math.random() * 100;

  constructor(public model: CharacterModel) {
    for (const b of BONES) this.target[b] = new THREE.Vector3();
  }

  private set(b: BoneName, x: number, y: number, z: number) {
    this.target[b].set(x, y, z);
  }
  private add(b: BoneName, x: number, y: number, z: number) {
    this.target[b].x += x;
    this.target[b].y += y;
    this.target[b].z += z;
  }
  private blend(b: BoneName, x: number, y: number, z: number, w: number) {
    const v = this.target[b];
    v.x = lerp(v.x, x, w);
    v.y = lerp(v.y, y, w);
    v.z = lerp(v.z, z, w);
  }

  update(dt: number) {
    const p = this.p;
    this.t += dt;
    const t = this.t;
    for (const b of BONES) this.target[b].set(0, 0, 0);
    let hipsY = 0, hipsX = 0, hipsZ = 0;

    // ---- locomotion ----
    const sp = p.speed;
    const moving = clamp01(sp / 1.2);
    const runW = clamp01(p.run);
    const stepLen = lerp(1.25, 2.1, runW) * (p.zombie > 0.5 ? 0.8 : 1);
    this.phase += (dt * sp * Math.PI) / stepLen;
    const ph = this.phase;
    const s = Math.sin(ph), c = Math.cos(ph);
    const amp = moving * (p.zombie > 0.5 ? 0.7 : 1);
    const legA = (0.45 + 0.35 * runW) * amp;
    // direction-aware legs: when strafing, reduce forward swing and add side swing
    const fwd = p.forward, str = p.strafe;
    const fs = Math.abs(fwd) > 0.2 ? Math.sign(fwd) : 1;
    const fwdW = clamp01(Math.abs(fwd) + 0.2);
    this.set('thighL', -s * legA * fs * fwdW, 0, 0.04 + s * str * 0.25 * amp);
    this.set('thighR', s * legA * fs * fwdW, 0, -0.04 - s * str * 0.25 * amp);
    const kneeA = (0.35 + 0.9 * runW) * amp;
    this.set('shinL', Math.max(0, -Math.sin(ph - 0.9)) * kneeA + 0.05, 0, 0);
    this.set('shinR', Math.max(0, Math.sin(ph - 0.9)) * kneeA + 0.05, 0, 0);
    this.set('footL', -this.target.shinL.x * 0.3 + this.target.thighL.x * -0.2, 0, 0);
    this.set('footR', -this.target.shinR.x * 0.3 + this.target.thighR.x * -0.2, 0, 0);
    const armA = (0.35 + 0.55 * runW) * amp;
    this.set('upperArmL', s * armA, 0, 0.08);
    this.set('upperArmR', -s * armA, 0, -0.08);
    this.set('foreArmL', -0.15 - 0.25 * amp - 1.0 * runW * amp, 0, 0);
    this.set('foreArmR', -0.15 - 0.25 * amp - 1.0 * runW * amp, 0, 0);
    this.set('spine', 0.03 + 0.18 * runW * amp, 0, 0);
    this.set('chest', Math.sin(t * 1.6) * 0.02, s * 0.12 * amp, 0);
    this.set('hips', 0, -s * 0.1 * amp, 0);
    this.set('head', 0, -s * 0.05 * amp, 0);
    hipsY = -Math.abs(c) * 0.035 * amp - 0.01 * amp;
    // idle sway
    const idle = 1 - moving;
    this.add('upperArmL', Math.sin(t * 0.9) * 0.03 * idle, 0, 0.03 * idle);
    this.add('upperArmR', Math.sin(t * 0.9 + 1) * 0.03 * idle, 0, -0.03 * idle);
    this.add('head', Math.sin(t * 0.37) * 0.04 * idle, Math.sin(t * 0.23 + this.seed) * 0.12 * idle, 0);

    // ---- zombie shamble ----
    if (p.zombie > 0) {
      const z = p.zombie;
      const sway = Math.sin(t * 2.1 + this.seed);
      this.blend('spine', 0.35 + 0.1 * Math.sin(ph * 0.5), 0, 0.1 * sway, z);
      this.blend('chest', 0.15, 0.15 * Math.sin(ph), 0.08 * sway, z);
      this.blend('head', -0.25 + 0.15 * Math.sin(t * 1.7 + this.seed), 0.2 * Math.sin(t * 0.8 + this.seed), 0.35 * Math.sin(t * 0.5 + this.seed * 2), z);
      const reach = 1.2 + 0.25 * Math.sin(t * 2 + this.seed) + p.lunge * 0.5;
      this.blend('upperArmL', -reach + s * 0.15, 0, 0.18 - p.lunge * 0.3, z * 0.85);
      this.blend('upperArmR', -reach * 0.9 - s * 0.15, 0, -0.18 + p.lunge * 0.3, z * 0.85);
      this.blend('foreArmL', -0.3, 0, 0, z);
      this.blend('foreArmR', -0.45, 0, 0, z);
      this.add('thighL', 0, 0, 0.08 * z);
      this.add('thighR', 0, 0, -0.08 * z);
      this.add('shinL', 0.15 * z, 0, 0);
      this.add('shinR', 0.15 * z, 0, 0);
      hipsY -= 0.06 * z;
      hipsZ = sway * 0.03 * z;
    }

    // ---- crouch / sneak ----
    if (p.crouch > 0) {
      const k = p.crouch;
      this.add('thighL', -0.6 * k, 0, 0);
      this.add('thighR', -0.6 * k, 0, 0);
      this.add('shinL', 1.0 * k, 0, 0);
      this.add('shinR', 1.0 * k, 0, 0);
      this.add('footL', -0.4 * k, 0, 0);
      this.add('footR', -0.4 * k, 0, 0);
      this.add('spine', 0.35 * k, 0, 0);
      this.add('head', -0.3 * k, 0, 0);
      hipsY -= 0.22 * k;
    }

    // ---- upper body: weapons ----
    if (p.weapon === 'pistol' || p.weapon === 'long') {
      // low ready
      const lr = 1 - p.aim;
      if (lr > 0.01 && p.zombie === 0) {
        if (p.weapon === 'long') {
          this.blend('upperArmR', -0.35, 0, 0.25, lr * 0.85);
          this.blend('foreArmR', -1.2, 0, 0, lr * 0.85);
          this.blend('upperArmL', -0.75, 0, -0.35, lr * 0.85);
          this.blend('foreArmL', -1.0, 0, 0, lr * 0.85);
        } else {
          this.blend('upperArmR', -0.15 - s * armA * 0.4, 0, -0.1, lr * 0.6);
          this.blend('foreArmR', -0.55, 0, 0, lr * 0.6);
        }
      }
      if (p.aim > 0.01) {
        const a = p.aim, pit = p.aimPitch;
        const rc = p.recoil;
        this.blend('upperArmR', -Math.PI / 2 - pit - rc * 0.35, 0, p.weapon === 'long' ? 0.12 : 0.22, a);
        this.blend('foreArmR', p.weapon === 'long' ? -0.25 : -rc * 0.3, 0, 0, a);
        this.blend('upperArmL', -Math.PI / 2 - pit * 0.9 - rc * 0.3, 0, p.weapon === 'long' ? -0.25 : -0.5, a);
        this.blend('foreArmL', p.weapon === 'long' ? -0.1 : -0.35, 0, p.weapon === 'long' ? 0 : -0.2, a);
        this.blend('chest', -pit * 0.3, -0.12, 0, a);
        this.blend('spine', 0.05, -0.05, 0, a);
        this.blend('head', -pit * 0.4, 0.1, 0, a);
      }
    } else if (p.weapon === 'melee' && p.attack < 0) {
      // relaxed grip, weapon down
      this.blend('foreArmR', -0.5, 0, 0, 0.5);
    }

    // melee swing
    if (p.attack >= 0) {
      const a = p.attack;
      const typ = p.attackType % 3;
      // phases: windup 0-0.3, strike 0.3-0.55, recover 0.55-1
      const wind = smooth(clamp01(a / 0.3));
      const strike = smooth(clamp01((a - 0.3) / 0.25));
      const rec = smooth(clamp01((a - 0.55) / 0.45));
      let ux: number, uz: number, fx: number, cy: number, sx: number;
      if (typ === 0) {
        // diagonal right-to-left
        ux = lerp(lerp(-0.2, -2.3, wind), -0.8, strike);
        uz = lerp(lerp(-0.1, -0.9, wind), 0.7, strike);
        fx = lerp(lerp(-0.4, -1.2, wind), -0.15, strike);
        cy = lerp(lerp(0, 0.6, wind), -0.55, strike);
        sx = lerp(0, 0.25, strike);
      } else if (typ === 1) {
        // backhand left-to-right
        ux = lerp(lerp(-0.2, -1.4, wind), -1.3, strike);
        uz = lerp(lerp(-0.1, 1.1, wind), -1.0, strike);
        fx = lerp(lerp(-0.4, -1.8, wind), -0.2, strike);
        cy = lerp(lerp(0, -0.5, wind), 0.6, strike);
        sx = 0.1;
      } else {
        // overhead
        ux = lerp(lerp(-0.2, -3.0, wind), -0.6, strike);
        uz = lerp(-0.1, 0.15, strike);
        fx = lerp(lerp(-0.4, -1.0, wind), -0.1, strike);
        cy = 0;
        sx = lerp(lerp(0, -0.15, wind), 0.45, strike);
      }
      const w = 1 - rec;
      this.blend('upperArmR', ux, 0, uz, w);
      this.blend('foreArmR', fx, 0, 0, w);
      this.blend('chest', 0, cy, 0, w);
      this.blend('spine', sx, cy * 0.4, 0, w);
      this.blend('upperArmL', -0.4, 0, 0.3, w * 0.6);
      if (p.zombie > 0) {
        // zombie claw swipe both arms
        this.blend('upperArmL', lerp(-1.2, -2.0, wind) + strike * 1.2, 0, lerp(0.2, -0.3, strike), w);
        this.blend('foreArmL', -0.3, 0, 0, w);
      }
    }
    // throw
    if (p.throwT >= 0) {
      const a = p.throwT;
      const wind = smooth(clamp01(a / 0.4));
      const rel = smooth(clamp01((a - 0.4) / 0.25));
      const rec = smooth(clamp01((a - 0.7) / 0.3));
      const w = 1 - rec;
      this.blend('upperArmR', lerp(lerp(0, -2.6, wind), -1.4, rel), 0, lerp(-0.3, 0.1, rel), w);
      this.blend('foreArmR', lerp(-1.4, -0.1, rel), 0, 0, w);
      this.blend('chest', 0, lerp(0.4, -0.4, rel), 0, w);
      this.blend('upperArmL', -1.2 + rel, 0, 0.3, w * 0.7);
    }
    // interact / reach
    if (p.interact > 0) {
      const k = p.interact;
      this.blend('upperArmR', -1.2, 0, 0.1, k);
      this.blend('foreArmR', -0.3, 0, 0, k);
      this.blend('spine', 0.25, 0, 0, k * 0.6);
    }
    // heal (inject / bandage)
    if (p.heal > 0) {
      const k = p.heal;
      this.blend('upperArmL', -0.9, 0, -0.4, k);
      this.blend('foreArmL', -1.4, 0, 0, k);
      this.blend('upperArmR', -0.8, 0, 0.5, k);
      this.blend('foreArmR', -1.3, 0, 0, k);
      this.blend('head', 0.4, 0, 0, k);
    }
    // talk gestures
    if (p.talk > 0) {
      const k = p.talk;
      this.add('head', Math.sin(t * 7.3) * 0.05 * k, Math.sin(t * 2.1) * 0.08 * k, 0);
      const g = Math.sin(t * 2.7 + this.seed);
      this.blend('upperArmR', -0.45 + g * 0.15, 0, -0.15, k * 0.5);
      this.blend('foreArmR', -1.1 - g * 0.3, 0, 0, k * 0.5);
    }
    // named pose
    if (p.pose && p.poseW > 0) {
      const pd = POSES[p.pose];
      if (pd) {
        for (const k of Object.keys(pd) as (keyof PoseDef)[]) {
          if (k === 'hipsY' || k === 'hipsZ') continue;
          const r = pd[k as BoneName]!;
          this.blend(k as BoneName, r[0], r[1], r[2], p.poseW);
        }
        if (pd.hipsY !== undefined) hipsY = lerp(hipsY, pd.hipsY, p.poseW);
        // slight life
        this.add('chest', Math.sin(t * 1.4) * 0.015, 0, 0);
      }
    }
    // hover (hologram)
    if (p.float > 0) hipsY += Math.sin(t * 1.3) * 0.03 * p.float;
    // head look
    this.add('head', -p.lookPitch * 0.6, clamp(p.lookYaw, -1.1, 1.1) * 0.7, 0);
    this.add('neck', 0, clamp(p.lookYaw, -1.1, 1.1) * 0.3, 0);
    // hurt flinch
    if (p.hurt > 0) {
      const h = p.hurt;
      this.add('spine', -0.3 * h, 0, 0.1 * h);
      this.add('head', -0.35 * h, 0, 0);
      this.add('upperArmL', -0.3 * h, 0, 0.3 * h);
      this.add('upperArmR', -0.3 * h, 0, -0.3 * h);
    }
    // roll
    if (p.roll >= 0) {
      const a = p.roll;
      const k = Math.sin(Math.PI * a);
      hipsX = a * Math.PI * 2;
      hipsY = -0.5 * k;
      for (const [b, v] of [['thighL', -1.6], ['thighR', -1.6], ['shinL', 2.2], ['shinR', 2.2], ['upperArmL', -1.6], ['upperArmR', -1.6], ['foreArmL', -1.6], ['foreArmR', -1.6], ['spine', 0.6], ['head', 0.6]] as [BoneName, number][]) {
        this.blend(b, v, 0, 0, k + 0.3 * (1 - Math.abs(0.5 - a) * 2));
      }
    }
    // frozen stiffness
    if (p.stiff > 0) {
      for (const b of BONES) this.target[b].multiplyScalar(1 - p.stiff * 0.9);
    }
    // death
    if (p.dead > 0) {
      const d = easeOut(clamp01(p.dead));
      const dir = p.deadDir;
      hipsX = lerp(hipsX, dir > 0 ? -1.5 : 1.45, d);
      hipsY = lerp(hipsY, -0.82, d);
      hipsZ = lerp(hipsZ, 0.15 * dir, d);
      const pose: Partial<Record<BoneName, Rot>> = {
        spine: [0.1 * dir, 0, 0], chest: [0.05, 0.2, 0], head: [0.2 * dir, 0.6, 0.1],
        upperArmL: [-0.5, 0, 0.9], upperArmR: [-0.2, 0, -1.1], foreArmL: [-0.4, 0, 0], foreArmR: [-0.6, 0, 0],
        thighL: [-0.2, 0, 0.15], thighR: [0.1, 0, -0.2], shinL: [0.4, 0, 0], shinR: [0.1, 0, 0],
      };
      for (const b of BONES) {
        const r = pose[b];
        this.blend(b, r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0, d);
      }
    }

    // ---- apply ----
    const k = damp(p.dead > 0 ? 9 : this.stiffness, dt);
    const bones = this.model.bones;
    for (const b of BONES) {
      if (b === 'root') continue;
      const v = this.target[b];
      te.set(v.x, v.y, v.z, 'XYZ');
      tq.setFromEuler(te);
      bones[b].quaternion.slerp(tq, k);
    }
    // hips root motion (position + extra rotation)
    this.hipsY = lerp(this.hipsY, hipsY, damp(p.roll >= 0 || p.dead > 0 ? 30 : 14, dt));
    this.hipsX = p.roll >= 0 ? hipsX : lerp(this.hipsX, hipsX, damp(10, dt));
    this.hipsZ = lerp(this.hipsZ, hipsZ, damp(10, dt));
    const hips = bones.hips;
    const rest = this.model.rest.hips;
    hips.position.set(rest.x, rest.y + this.hipsY, rest.z);
    // compose hips extra rotation (roll/death) on top of target
    if (Math.abs(this.hipsX) > 1e-3 || Math.abs(this.hipsZ) > 1e-3) {
      te.set(this.hipsX, 0, this.hipsZ, 'XYZ');
      tq.setFromEuler(te);
      hips.quaternion.premultiply(tq);
      // keep the premultiplied extra stable across frames by removing it before next slerp
      this.extraApplied = true;
      this.extraQ.copy(tq);
    } else this.extraApplied = false;
  }
  private extraApplied = false;
  private extraQ = new THREE.Quaternion();
  /** Call before update next frame to strip the extra hips rotation (keeps slerp stable). */
  preUpdate() {
    if (this.extraApplied) {
      const inv = this.extraQ.clone().invert();
      this.model.bones.hips.quaternion.premultiply(inv);
      this.extraApplied = false;
    }
  }
  tick(dt: number) {
    this.preUpdate();
    this.update(dt);
  }
  snap() {
    // apply current target instantly
    const s = this.stiffness;
    this.stiffness = 1e5;
    this.tick(0.016);
    this.stiffness = s;
  }
}

// ---------------- hound ----------------
export class HoundAnimator {
  private ph = 0;
  private t = Math.random() * 10;
  speed = 0;
  attack = -1;
  dead = 0;
  hurt = 0;
  constructor(public m: HoundModel) {}
  tick(dt: number) {
    this.t += dt;
    this.ph += dt * this.speed * 3.2;
    const b = this.m.bones;
    const s = Math.sin(this.ph), c = Math.cos(this.ph);
    const a = clamp01(this.speed / 3);
    const set = (n: HBone, x: number, y = 0, z = 0) => {
      te.set(x, y, z);
      tq.setFromEuler(te);
      b[n].quaternion.slerp(tq, damp(18, dt));
    };
    set('flU', s * 0.7 * a);
    set('flL', Math.max(0, -c) * 0.8 * a - 0.1);
    set('frU', -s * 0.7 * a);
    set('frL', Math.max(0, c) * 0.8 * a - 0.1);
    set('blU', -s * 0.7 * a);
    set('blL', Math.max(0, c) * 0.9 * a + 0.2);
    set('brU', s * 0.7 * a);
    set('brL', Math.max(0, -c) * 0.9 * a + 0.2);
    set('tail', Math.sin(this.t * 6) * 0.2, Math.sin(this.t * 8) * 0.5, 0);
    const atk = this.attack >= 0 ? Math.sin(Math.PI * this.attack) : 0;
    set('neck', -0.2 - atk * 0.6 + Math.sin(this.t * 2) * 0.05, 0, 0);
    set('head', 0.2 + atk * 0.4, Math.sin(this.t * 1.3) * 0.2, 0);
    set('jaw', 0.15 + atk * 0.7 + Math.max(0, Math.sin(this.t * 9)) * 0.1);
    set('body', Math.sin(this.ph * 2) * 0.04 * a - this.hurt * 0.3, 0, 0);
    set('chest', -atk * 0.3);
    const d = easeOut(clamp01(this.dead));
    b.root.rotation.z = d * 1.5;
    b.root.position.y = -d * 0.2;
  }
}
