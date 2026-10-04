import * as THREE from 'three';
import { toon, glow } from './Materials';
import { rng, rrange } from '../core/math';
import { glowTexture, tex } from './Textures';

const SKY_V = /* glsl */ `
varying vec3 vDir;
void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`;
const SKY_F = /* glsl */ `
uniform float uTime; uniform vec3 uBeamDir; uniform float uFlash; uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uGlow; uniform float uBeamOn;
varying vec3 vDir;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col = mix(uHorizon, uTop, smoothstep(-0.05, 0.6, y));
  // clouds
  vec2 cp = d.xz / (abs(y) + 0.25) * 1.6 + vec2(uTime * 0.01, uTime * 0.004);
  float c = fbm(cp);
  float c2 = fbm(cp * 2.3 + 7.0);
  float clouds = smoothstep(0.35, 0.8, c * 0.7 + c2 * 0.4);
  // beam glow & hole
  vec3 bd = normalize(uBeamDir);
  float az = max(0.0, dot(normalize(vec3(d.x, 0.0, d.z) + 1e-5), normalize(vec3(bd.x, 0.0, bd.z) + 1e-5)));
  float bg = pow(az, 48.0) * smoothstep(-0.1, 0.5, y) * uBeamOn;
  float hole = smoothstep(0.75, 0.98, y) * uBeamOn;
  vec3 cloudCol = mix(uHorizon * 1.6, uGlow * 0.6, bg) + uGlow * uFlash * 1.5;
  col = mix(col, cloudCol, clouds * (1.0 - hole * 0.7));
  col += uGlow * bg * 0.25;
  // stars in the hole
  vec2 sp = d.xz / (y + 0.01) * 40.0;
  float st = step(0.985, h(floor(sp))) * hole * (0.6 + 0.4 * sin(uTime * 3.0 + h(floor(sp)) * 40.0));
  col += vec3(st) * 1.5;
  col += uGlow * uFlash * 0.25 * smoothstep(0.0, 0.5, y);
  gl_FragColor = vec4(col, 1.0);
}`;

const SEA_V = /* glsl */ `
varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const SEA_F = /* glsl */ `
uniform sampler2D tIce; uniform vec3 uCam; uniform vec3 uBeam; uniform vec3 uGlow; uniform vec3 uFog; uniform float uFogD; uniform float uTime; uniform float uFlash; uniform float uBeamOn;
varying vec3 vW;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
vec2 vor(vec2 p){ vec2 i=floor(p), f=fract(p); float m=8.0, m2=8.0;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y); vec2 o=vec2(h(i+g), h(i+g+3.1)); float d=length(g+o-f); if(d<m){m2=m;m=d;} else if(d<m2) m2=d; }
  return vec2(m, m2); }
void main(){
  vec2 uv = vW.xz * 0.02;
  vec3 ice = texture2D(tIce, vW.xz * 0.05).rgb;
  vec2 v = vor(vW.xz * 0.06);
  float crack = 1.0 - smoothstep(0.0, 0.05, v.y - v.x);
  vec3 base = ice * vec3(0.05, 0.07, 0.1) + crack * vec3(0.06, 0.12, 0.16);
  vec3 V = normalize(vW - uCam);
  vec3 R = reflect(V, vec3(0.0, 1.0, 0.0));
  vec3 L = normalize(uBeam - vW);
  float spec = pow(max(dot(R, L), 0.0), 40.0) * 2.0 + pow(max(dot(R, L), 0.0), 6.0) * 0.25;
  vec3 col = base + uGlow * spec * (0.6 + 0.4 * h(floor(vW.xz * 2.0))) * uBeamOn;
  float dist = length(vW - uCam);
  // glow pool near the beam base
  float bd = length(vW.xz - uBeam.xz);
  col += uGlow * 0.6 * exp(-bd * 0.012) * uBeamOn;
  col += uGlow * uFlash * 0.08;
  float f = 1.0 - exp(-dist * uFogD);
  col = mix(col, uFog, clamp(f, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}`;

const BEAM_V = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const BEAM_F = /* glsl */ `
uniform float uTime; uniform vec3 uColor; uniform float uPower; uniform float uOn;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
float h(float p){ return fract(sin(p*127.1)*43758.5453); }
void main(){
  float f = pow(abs(dot(vN, vV)), 2.5);
  float bands = 0.75 + 0.25 * sin(vUv.y * 180.0 - uTime * 14.0) * sin(vUv.y * 41.0 - uTime * 5.0);
  float fadeTop = 1.0 - smoothstep(0.55, 1.0, vUv.y);
  float a = f * bands * fadeTop * uPower * uOn;
  gl_FragColor = vec4(uColor * a, a);
}`;

export interface ExteriorOpts {
  sea?: boolean;
  beam?: boolean;
  vessels?: boolean;
  seaLevel?: number;
  beamPos?: THREE.Vector3;
  fogColor?: THREE.Color;
  fogDensity?: number;
}

export class Exterior {
  group = new THREE.Group();
  sky: THREE.Mesh;
  sea: THREE.Mesh | null = null;
  beam: THREE.Group | null = null;
  bolts: THREE.LineSegments | null = null;
  beamPos = new THREE.Vector3(0, 0, 0);
  flash = 0;
  private skyMat: THREE.ShaderMaterial;
  private seaMat: THREE.ShaderMaterial | null = null;
  private beamMats: THREE.ShaderMaterial[] = [];
  private beamBase: number[] = [];
  private flare: THREE.Sprite | null = null;
  private boltTimer = 0;
  beamOn = 1;
  vessels: THREE.Group | null = null;
  glowColor = new THREE.Color(0.35, 0.85, 1.4);
  onLightning: (() => void) | null = null;

  constructor(o: ExteriorOpts) {
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_V,
      fragmentShader: SKY_F,
      uniforms: {
        uTime: { value: 0 }, uBeamDir: { value: new THREE.Vector3(0, 0, -1) }, uFlash: { value: 0 },
        uTop: { value: new THREE.Color(0.004, 0.006, 0.014) }, uHorizon: { value: new THREE.Color(0.03, 0.028, 0.032) },
        uGlow: { value: this.glowColor }, uBeamOn: { value: 1 },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.skyMat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.group.add(this.sky);
    if (o.beamPos) this.beamPos.copy(o.beamPos);
    if (o.sea) {
      this.seaMat = new THREE.ShaderMaterial({
        vertexShader: SEA_V,
        fragmentShader: SEA_F,
        uniforms: {
          tIce: { value: tex('ice') }, uCam: { value: new THREE.Vector3() }, uBeam: { value: this.beamPos.clone().setY(200) },
          uGlow: { value: this.glowColor }, uFog: { value: o.fogColor ?? new THREE.Color(0.02, 0.022, 0.03) },
          uFogD: { value: o.fogDensity ?? 0.004 }, uTime: { value: 0 }, uFlash: { value: 0 }, uBeamOn: { value: 1 },
        },
      });
      const seaGeo = new THREE.PlaneGeometry(3000, 3000, 1, 1);
      seaGeo.rotateX(-Math.PI / 2);
      this.sea = new THREE.Mesh(seaGeo, this.seaMat);
      this.sea.position.y = o.seaLevel ?? -14;
      this.sea.renderOrder = -5;
      this.group.add(this.sea);
    }
    if (o.beam) this.buildBeam();
    if (o.vessels) this.buildVessels();
  }

  private buildBeam() {
    const g = new THREE.Group();
    g.position.copy(this.beamPos);
    const mk = (r: number, power: number, color: THREE.Color) => {
      const m = new THREE.ShaderMaterial({
        vertexShader: BEAM_V,
        fragmentShader: BEAM_F,
        uniforms: { uTime: { value: 0 }, uColor: { value: color }, uPower: { value: power }, uOn: { value: 1 } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.beamMats.push(m);
      const geo = new THREE.CylinderGeometry(r, r * 1.3, 1400, 24, 1, true);
      geo.translate(0, 700, 0);
      const mesh = new THREE.Mesh(geo, m);
      mesh.frustumCulled = false;
      mesh.renderOrder = 15;
      return mesh;
    };
    g.add(mk(1.5, 7, new THREE.Color(0.85, 1.6, 2.3)));
    g.add(mk(3.6, 1.0, new THREE.Color(0.3, 0.8, 1.6)));
    g.add(mk(9, 0.2, new THREE.Color(0.2, 0.5, 1.2)));
    this.beamBase = this.beamMats.map((m) => m.uniforms.uPower.value);
    // base flare
    const sm = new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(0.5, 1.1, 1.7), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const sp = new THREE.Sprite(sm);
    sp.scale.set(22, 22, 1);
    this.flare = sp;
    sp.position.y = 4;
    sp.renderOrder = 16;
    g.add(sp);
    // lightning
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(400 * 3), 3));
    const bm = new THREE.LineBasicMaterial({ color: new THREE.Color(2.5, 4, 6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.bolts = new THREE.LineSegments(bg, bm);
    this.bolts.frustumCulled = false;
    this.bolts.renderOrder = 17;
    g.add(this.bolts);
    this.beam = g;
    this.group.add(g);
  }

  private regenBolts() {
    if (!this.bolts) return;
    const arr = (this.bolts.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    let k = 0;
    const nb = 2 + Math.floor(Math.random() * 3);
    for (let b = 0; b < nb && k < 390; b++) {
      let x = 0, y = 60 + Math.random() * 260, z = 0;
      const ang = Math.random() * Math.PI * 2;
      const len = 30 + Math.random() * 90;
      const steps = 14;
      for (let s = 0; s < steps && k < 398; s++) {
        const nx = x + Math.cos(ang) * (len / steps) + (Math.random() - 0.5) * 8;
        const ny = y + (Math.random() - 0.6) * 12;
        const nz = z + Math.sin(ang) * (len / steps) + (Math.random() - 0.5) * 8;
        arr[k * 3] = x; arr[k * 3 + 1] = y; arr[k * 3 + 2] = z; k++;
        arr[k * 3] = nx; arr[k * 3 + 1] = ny; arr[k * 3 + 2] = nz; k++;
        x = nx; y = ny; z = nz;
      }
    }
    this.bolts.geometry.setDrawRange(0, k);
    (this.bolts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  private buildVessels() {
    const g = new THREE.Group();
    const r = rng(1234);
    const hullMat = toon({ color: 0x2a2f38, map: 'metal', repeat: 1 });
    const deckMat = toon({ color: 0x3a3d44 });
    const themes = ['city', 'industrial', 'lab', 'aquatic', 'biosphere', 'cryo'];
    const lightCols = [0xffb060, 0xff6a30, 0x60f0ff, 0x40a0ff, 0x90ff70, 0xc0e8ff];
    const R = 260;
    themes.forEach((th, i) => {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const v = new THREE.Group();
      v.position.set(Math.cos(a) * R + this.beamPos.x, 0, Math.sin(a) * R + this.beamPos.z);
      v.rotation.y = -a + Math.PI / 2;
      const L = 140, W = 44;
      const hull = new THREE.Mesh(new THREE.BoxGeometry(W, 22, L), hullMat);
      hull.position.y = -6;
      v.add(hull);
      const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.1, W / 2, 30, 4, 1), hullMat);
      bow.rotation.x = Math.PI / 2;
      bow.rotation.y = Math.PI / 4;
      bow.scale.set(1, 1, 0.7);
      bow.position.set(0, -6, L / 2 + 14);
      v.add(bow);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(W - 2, 1, L - 4), deckMat);
      deck.position.y = 5.5;
      v.add(deck);
      const lc = lightCols[i];
      const lm = glow(lc, 4);
      const addLights = (n: number, h0: number, h1: number) => {
        for (let k = 0; k < n; k++) {
          const s = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), lm);
          s.position.set(rrange(r, -W / 2, W / 2), rrange(r, h0, h1), rrange(r, -L / 2, L / 2));
          v.add(s);
        }
      };
      if (th === 'city') {
        for (let k = 0; k < 9; k++) {
          const h = rrange(r, 20, 70);
          const b = new THREE.Mesh(new THREE.BoxGeometry(rrange(r, 8, 14), h, rrange(r, 8, 14)), toon({ color: 0x3b3a40, map: 'facade', repeat: 2, emissiveMap: 'facadeLit', emissiveIntensity: 2.5 }));
          b.position.set(rrange(r, -14, 14), 6 + h / 2, -55 + k * 13);
          v.add(b);
        }
      } else if (th === 'industrial') {
        for (let k = 0; k < 4; k++) {
          const s = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 50, 10), toon({ color: 0x5a3a2a, map: 'rust' }));
          s.position.set(-10 + (k % 2) * 20, 30, -40 + k * 22);
          v.add(s);
        }
        const blk = new THREE.Mesh(new THREE.BoxGeometry(36, 18, 70), toon({ color: 0x4a4038, map: 'rust' }));
        blk.position.set(0, 15, 0);
        v.add(blk);
        addLights(16, 8, 50);
      } else if (th === 'lab') {
        const d = new THREE.Mesh(new THREE.SphereGeometry(20, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon({ color: 0xc8d0d8 }));
        d.position.set(0, 6, 10);
        v.add(d);
        const t = new THREE.Mesh(new THREE.BoxGeometry(14, 30, 14), toon({ color: 0xd0d8e0, map: 'labPanel' }));
        t.position.set(0, 21, -40);
        v.add(t);
        addLights(14, 8, 36);
      } else if (th === 'aquatic') {
        for (let k = 0; k < 4; k++) {
          const tk = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 22, 16), glow(0x1a6a9a, 1.2, { transparent: true, opacity: 0.7 }));
          tk.position.set(k % 2 ? 10 : -10, 17, -40 + k * 26);
          v.add(tk);
        }
        addLights(10, 8, 30);
      } else if (th === 'biosphere') {
        const d = new THREE.Mesh(new THREE.SphereGeometry(26, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glow(0x2a6a3a, 0.9, { transparent: true, opacity: 0.6 }));
        d.position.set(0, 6, 0);
        d.scale.z = 2;
        v.add(d);
        addLights(12, 8, 26);
      } else {
        for (let k = 0; k < 6; k++) {
          const t = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, rrange(r, 20, 44), 6), toon({ color: 0xb8d0e8, map: 'frost' }));
          t.position.set(rrange(r, -14, 14), 22, -50 + k * 20);
          v.add(t);
        }
        addLights(12, 8, 40);
      }
      // bridge toward hub
      const br = new THREE.Mesh(new THREE.BoxGeometry(5, 2, R - 90), toon({ color: 0x30343c, map: 'grate', repeat: 6 }));
      br.position.set(0, 3, -(R - 90) / 2 - L / 2 + 10);
      v.add(br);
      // bridge lights
      for (let k = 0; k < 10; k++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), glow(0x60e0ff, 5));
        s.position.set(k % 2 ? 2.6 : -2.6, 4.4, -L / 2 - k * ((R - 100) / 10));
        v.add(s);
      }
      g.add(v);
    });
    this.vessels = g;
    this.group.add(g);
  }

  update(dt: number, time: number, camera: THREE.Camera) {
    this.sky.position.copy(camera.position);
    const u = this.skyMat.uniforms;
    u.uTime.value = time;
    u.uBeamDir.value.copy(this.beamPos).sub(camera.position).setY(0).normalize();
    u.uBeamOn.value = this.beam ? this.beamOn : 0;
    this.flash = Math.max(0, this.flash - dt * 3);
    if (this.beam && this.beamOn > 0.1) {
      this.boltTimer -= dt;
      if (this.boltTimer <= 0) {
        if (Math.random() < 0.25) {
          this.regenBolts();
          this.flash = 1;
          this.onLightning?.();
          this.boltTimer = 0.08;
        } else {
          this.bolts?.geometry.setDrawRange(0, 0);
          this.boltTimer = 0.4 + Math.random() * 2.5;
        }
      }
      // up close the outer halo layers would wash the whole screen out; fade them with distance
      const dx = camera.position.x - this.beamPos.x, dz = camera.position.z - this.beamPos.z;
      const k = THREE.MathUtils.smoothstep(Math.hypot(dx, dz), 15, 120);
      this.beamMats.forEach((m, i) => {
        m.uniforms.uTime.value = time;
        m.uniforms.uOn.value = this.beamOn;
        m.uniforms.uPower.value = this.beamBase[i] * (i === 0 ? 0.22 + 0.78 * k : 0.08 + 0.92 * k);
      });
      if (this.flare) (this.flare.material as THREE.SpriteMaterial).opacity = 0.35 + 0.65 * k;
    } else if (this.bolts) this.bolts.geometry.setDrawRange(0, 0);
    if (this.beam) this.beam.visible = this.beamOn > 0.01;
    u.uFlash.value = this.flash;
    if (this.seaMat) {
      this.seaMat.uniforms.uCam.value.copy(camera.position);
      this.seaMat.uniforms.uTime.value = time;
      this.seaMat.uniforms.uFlash.value = this.flash;
      this.seaMat.uniforms.uBeamOn.value = this.beam ? this.beamOn : 0;
      if (this.sea) {
        this.sea.position.x = camera.position.x;
        this.sea.position.z = camera.position.z;
      }
    }
  }

  setFog(color: THREE.Color, density: number) {
    if (this.seaMat) {
      this.seaMat.uniforms.uFog.value.copy(color);
      this.seaMat.uniforms.uFogD.value = density;
    }
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}
