import * as THREE from 'three';
import { rand } from '../core/math';

const PVERT = /* glsl */ `
attribute vec4 pcolor; attribute float psize;
uniform float uScale;
varying vec4 vColor; varying float vFade;
void main(){
  vColor = pcolor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = psize * uScale / max(0.1, -mv.z);
  vFade = 1.0 - smoothstep(40.0, 70.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const PFRAG = /* glsl */ `
varying vec4 vColor; varying float vFade; uniform float uSoft;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = 1.0 - smoothstep(0.5 - uSoft * 0.5, 0.5, d);
  if (a <= 0.0) discard;
  gl_FragColor = vec4(vColor.rgb, vColor.a * a * vFade);
}`;

export interface EmitOpts {
  pos: THREE.Vector3 | { x: number; y: number; z: number };
  vel?: { x: number; y: number; z: number };
  spread?: number; // random velocity spread
  life?: number;
  size?: number;
  size1?: number;
  color?: THREE.Color | number;
  color1?: THREE.Color | number;
  alpha?: number;
  alpha1?: number;
  gravity?: number;
  drag?: number;
  count?: number;
  jitter?: number; // position jitter
}

export class ParticleSystem {
  points: THREE.Points;
  private max: number;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private s0: Float32Array;
  private s1: Float32Array;
  private c0: Float32Array;
  private c1: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  private alive = 0;
  private geo: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  private tmpC = new THREE.Color();
  private tmpC1 = new THREE.Color();

  constructor(max: number, additive: boolean) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.c0 = new Float32Array(max * 4);
    this.c1 = new Float32Array(max * 4);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('psize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      vertexShader: PVERT,
      fragmentShader: PFRAG,
      uniforms: { uScale: { value: 500 }, uSoft: { value: additive ? 1 : 0.6 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 20 : 19;
  }

  emit(o: EmitOpts) {
    const n = o.count ?? 1;
    const c0 = this.tmpC.set((o.color ?? 0xffffff) as any);
    const c1 = this.tmpC1.set((o.color1 ?? o.color ?? 0xffffff) as any);
    for (let k = 0; k < n; k++) {
      let i: number;
      if (this.alive < this.max) i = this.alive++;
      else i = Math.floor(Math.random() * this.max);
      const j = o.jitter ?? 0;
      this.pos[i * 3] = o.pos.x + (j ? rand(-j, j) : 0);
      this.pos[i * 3 + 1] = o.pos.y + (j ? rand(-j, j) : 0);
      this.pos[i * 3 + 2] = o.pos.z + (j ? rand(-j, j) : 0);
      const sp = o.spread ?? 0;
      this.vel[i * 3] = (o.vel?.x ?? 0) + (sp ? rand(-sp, sp) : 0);
      this.vel[i * 3 + 1] = (o.vel?.y ?? 0) + (sp ? rand(-sp, sp) : 0);
      this.vel[i * 3 + 2] = (o.vel?.z ?? 0) + (sp ? rand(-sp, sp) : 0);
      const life = (o.life ?? 1) * rand(0.75, 1.25);
      this.life[i] = life;
      this.maxLife[i] = life;
      const s = o.size ?? 0.2;
      this.s0[i] = s * rand(0.8, 1.2);
      this.s1[i] = o.size1 ?? s;
      this.c0[i * 4] = c0.r;
      this.c0[i * 4 + 1] = c0.g;
      this.c0[i * 4 + 2] = c0.b;
      this.c0[i * 4 + 3] = o.alpha ?? 1;
      this.c1[i * 4] = c1.r;
      this.c1[i * 4 + 1] = c1.g;
      this.c1[i * 4 + 2] = c1.b;
      this.c1[i * 4 + 3] = o.alpha1 ?? 0;
      this.grav[i] = o.gravity ?? 0;
      this.drag[i] = o.drag ?? 0;
    }
  }

  update(dt: number, camera: THREE.PerspectiveCamera, viewportH: number) {
    this.material.uniforms.uScale.value = viewportH / (2 * Math.tan((camera.fov * Math.PI) / 360));
    let i = 0;
    while (i < this.alive) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // swap with last
        const last = --this.alive;
        if (i !== last) this.copy(last, i);
        continue;
      }
      const t = 1 - this.life[i] / this.maxLife[i];
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      for (let c = 0; c < 4; c++) this.col[i * 4 + c] = this.c0[i * 4 + c] + (this.c1[i * 4 + c] - this.c0[i * 4 + c]) * t;
      i++;
    }
    this.geo.setDrawRange(0, this.alive);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.pcolor as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.psize as THREE.BufferAttribute).needsUpdate = true;
  }

  private copy(from: number, to: number) {
    for (let c = 0; c < 3; c++) {
      this.pos[to * 3 + c] = this.pos[from * 3 + c];
      this.vel[to * 3 + c] = this.vel[from * 3 + c];
    }
    for (let c = 0; c < 4; c++) {
      this.col[to * 4 + c] = this.col[from * 4 + c];
      this.c0[to * 4 + c] = this.c0[from * 4 + c];
      this.c1[to * 4 + c] = this.c1[from * 4 + c];
    }
    this.size[to] = this.size[from];
    this.life[to] = this.life[from];
    this.maxLife[to] = this.maxLife[from];
    this.s0[to] = this.s0[from];
    this.s1[to] = this.s1[from];
    this.grav[to] = this.grav[from];
    this.drag[to] = this.drag[from];
  }

  clear() {
    this.alive = 0;
    this.geo.setDrawRange(0, 0);
  }
}

export type WeatherKind = 'none' | 'ash' | 'snow' | 'spores' | 'bubbles' | 'embers' | 'dust' | 'motes';

const WVERT = /* glsl */ `
attribute float seed;
uniform float uTime; uniform vec3 uCam; uniform float uBox; uniform float uScale; uniform float uSize;
uniform vec3 uVel; uniform float uWobble;
varying float vA;
void main(){
  vec3 p = position + uVel * uTime;
  p.x += sin(uTime * 0.7 + seed * 6.28) * uWobble;
  p.z += cos(uTime * 0.5 + seed * 12.0) * uWobble;
  // wrap around camera
  p = mod(p - uCam + uBox * 0.5, uBox) + uCam - uBox * 0.5;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  vA = (1.0 - smoothstep(uBox * 0.3, uBox * 0.5, dist)) * smoothstep(0.3, 1.5, dist);
  gl_PointSize = uSize * (0.6 + seed * 0.8) * uScale / max(0.1, dist);
  gl_Position = projectionMatrix * mv;
}`;
const WFRAG = /* glsl */ `
uniform vec3 uColor; uniform float uAlpha;
varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = 1.0 - smoothstep(0.2, 0.5, d);
  gl_FragColor = vec4(uColor, a * vA * uAlpha);
}`;

export class Weather {
  points: THREE.Points;
  material: THREE.ShaderMaterial;
  kind: WeatherKind = 'none';
  private baseAlpha = 0.8;
  private fadeK = 1;
  /** 0..1 visibility multiplier (e.g. faded out under roofs) */
  setFade(k: number, dt: number) {
    this.fadeK += (k - this.fadeK) * Math.min(1, dt * 3);
    this.material.uniforms.uAlpha.value = this.baseAlpha * this.fadeK;
  }
  constructor(count = 2500) {
    const box = 40;
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random() * box;
      pos[i * 3 + 1] = Math.random() * box;
      pos[i * 3 + 2] = Math.random() * box;
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader: WVERT,
      fragmentShader: WFRAG,
      uniforms: {
        uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: box }, uScale: { value: 500 },
        uSize: { value: 0.08 }, uVel: { value: new THREE.Vector3(0, -1, 0) }, uWobble: { value: 0.5 },
        uColor: { value: new THREE.Color(0.6, 0.6, 0.65) }, uAlpha: { value: 0.8 },
      },
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.points.renderOrder = 18;
  }
  set(kind: WeatherKind) {
    this.kind = kind;
    const u = this.material.uniforms;
    this.points.visible = kind !== 'none';
    this.material.blending = THREE.NormalBlending;
    switch (kind) {
      case 'ash':
        u.uVel.value.set(0.4, -0.9, 0.2);
        u.uColor.value.setRGB(0.55, 0.55, 0.58);
        u.uSize.value = 0.07;
        u.uWobble.value = 0.6;
        u.uAlpha.value = 0.75;
        break;
      case 'snow':
        u.uVel.value.set(0.8, -1.4, 0.3);
        u.uColor.value.setRGB(0.85, 0.9, 1.0);
        u.uSize.value = 0.07;
        u.uWobble.value = 0.4;
        u.uAlpha.value = 0.8;
        break;
      case 'spores':
        u.uVel.value.set(0.1, 0.25, 0.05);
        u.uColor.value.setRGB(0.6, 1.4, 0.5);
        u.uSize.value = 0.06;
        u.uWobble.value = 1.0;
        u.uAlpha.value = 0.7;
        this.material.blending = THREE.AdditiveBlending;
        break;
      case 'bubbles':
        u.uVel.value.set(0, 0.6, 0);
        u.uColor.value.setRGB(0.4, 0.8, 1.0);
        u.uSize.value = 0.05;
        u.uWobble.value = 0.3;
        u.uAlpha.value = 0.5;
        this.material.blending = THREE.AdditiveBlending;
        break;
      case 'embers':
        u.uVel.value.set(0.2, 0.9, 0.1);
        u.uColor.value.setRGB(2.5, 0.9, 0.3);
        u.uSize.value = 0.04;
        u.uWobble.value = 0.8;
        u.uAlpha.value = 0.9;
        this.material.blending = THREE.AdditiveBlending;
        break;
      case 'dust':
        u.uVel.value.set(0.05, -0.05, 0.02);
        u.uColor.value.setRGB(0.6, 0.6, 0.6);
        u.uSize.value = 0.03;
        u.uWobble.value = 0.6;
        u.uAlpha.value = 0.35;
        break;
      case 'motes':
        u.uVel.value.set(0.02, 0.15, 0.02);
        u.uColor.value.setRGB(0.4, 1.6, 2.4);
        u.uSize.value = 0.04;
        u.uWobble.value = 1.2;
        u.uAlpha.value = 0.6;
        this.material.blending = THREE.AdditiveBlending;
        break;
    }
    this.material.needsUpdate = true;
    this.baseAlpha = u.uAlpha.value;
    u.uAlpha.value = this.baseAlpha * this.fadeK;
  }
  update(time: number, camera: THREE.PerspectiveCamera, viewportH: number) {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uCam.value.copy(camera.position);
    u.uScale.value = viewportH / (2 * Math.tan((camera.fov * Math.PI) / 360));
  }
}
