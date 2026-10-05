import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

const VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BRIGHT = /* glsl */ `
uniform sampler2D tIn; uniform float uThreshold; uniform float uKnee;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(tIn, vUv).rgb;
  float br = max(c.r, max(c.g, c.b));
  float soft = br - uThreshold + uKnee;
  soft = clamp(soft, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
  gl_FragColor = vec4(min(c * contrib, vec3(30.0)), 1.0);
}`;

const DOWN = /* glsl */ `
uniform sampler2D tIn; uniform vec2 uTexel;
varying vec2 vUv;
void main(){
  vec2 t = uTexel;
  vec3 a = texture2D(tIn, vUv + t*vec2(-2.0, 2.0)).rgb;
  vec3 b = texture2D(tIn, vUv + t*vec2( 0.0, 2.0)).rgb;
  vec3 c = texture2D(tIn, vUv + t*vec2( 2.0, 2.0)).rgb;
  vec3 d = texture2D(tIn, vUv + t*vec2(-2.0, 0.0)).rgb;
  vec3 e = texture2D(tIn, vUv).rgb;
  vec3 f = texture2D(tIn, vUv + t*vec2( 2.0, 0.0)).rgb;
  vec3 g = texture2D(tIn, vUv + t*vec2(-2.0,-2.0)).rgb;
  vec3 h = texture2D(tIn, vUv + t*vec2( 0.0,-2.0)).rgb;
  vec3 i = texture2D(tIn, vUv + t*vec2( 2.0,-2.0)).rgb;
  vec3 j = texture2D(tIn, vUv + t*vec2(-1.0, 1.0)).rgb;
  vec3 k = texture2D(tIn, vUv + t*vec2( 1.0, 1.0)).rgb;
  vec3 l = texture2D(tIn, vUv + t*vec2(-1.0,-1.0)).rgb;
  vec3 m = texture2D(tIn, vUv + t*vec2( 1.0,-1.0)).rgb;
  vec3 o = e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125;
  gl_FragColor = vec4(o, 1.0);
}`;

const UP = /* glsl */ `
uniform sampler2D tIn; uniform sampler2D tPrev; uniform vec2 uTexel; uniform float uRadius;
varying vec2 vUv;
void main(){
  vec2 t = uTexel * uRadius;
  vec3 s = texture2D(tIn, vUv).rgb * 4.0;
  s += (texture2D(tIn, vUv + vec2(-t.x, 0.0)).rgb + texture2D(tIn, vUv + vec2(t.x, 0.0)).rgb +
        texture2D(tIn, vUv + vec2(0.0, -t.y)).rgb + texture2D(tIn, vUv + vec2(0.0, t.y)).rgb) * 2.0;
  s += texture2D(tIn, vUv + vec2(-t.x, -t.y)).rgb + texture2D(tIn, vUv + vec2(t.x, -t.y)).rgb +
       texture2D(tIn, vUv + vec2(-t.x, t.y)).rgb + texture2D(tIn, vUv + vec2(t.x, t.y)).rgb;
  s /= 16.0;
  gl_FragColor = vec4(s + texture2D(tPrev, vUv).rgb, 1.0);
}`;

const FINAL = /* glsl */ `
uniform sampler2D tScene; uniform sampler2D tDepth; uniform sampler2D tBloom;
uniform vec2 uRes; uniform float uTime; uniform float uNear; uniform float uFar;
uniform float uBloom; uniform float uExposure; uniform float uOutline; uniform vec3 uOutlineColor; uniform float uOutlineDist;
uniform float uVignette; uniform float uGrain; uniform float uChroma; uniform float uWarp; uniform float uFade;
uniform vec4 uFlash; uniform vec3 uTint; uniform float uSat; uniform float uContrast; uniform float uGlitch;
uniform float uLetterbox; uniform float uDesat; uniform vec3 uLift; uniform float uPulse;
varying vec2 vUv;

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float linDepth(vec2 uv){
  float z = texture2D(tDepth, uv).x;
  if (z >= 0.99999) return 1e5;
  return (uNear * uFar) / (uFar - z * (uFar - uNear));
}
vec3 aces(vec3 x){
  const float a = 2.51; const float b = 0.03; const float c = 2.43; const float d = 0.59; const float e = 0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}
vec3 toSRGB(vec3 c){
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c));
}
void main(){
  vec2 uv = vUv;
  // sanity warp
  if (uWarp > 0.0) {
    float w = uWarp;
    uv.x += sin(uv.y * 18.0 + uTime * 1.7) * 0.0035 * w;
    uv.y += cos(uv.x * 14.0 + uTime * 1.3) * 0.0030 * w;
    vec2 cc = uv - 0.5;
    uv = 0.5 + cc * (1.0 - 0.02 * w * (0.5 + 0.5 * sin(uTime * 0.9)));
  }
  // glitch bands
  if (uGlitch > 0.0) {
    float band = floor(uv.y * 24.0 + floor(uTime * 15.0) * 3.0);
    float r = hash(vec2(band, floor(uTime * 20.0)));
    if (r < uGlitch * 0.5) uv.x += (hash(vec2(band, 1.7)) - 0.5) * 0.12 * uGlitch;
  }
  vec2 c = uv - 0.5;
  float dist2 = dot(c, c);
  vec3 col;
  float ca = uChroma * (0.4 + dist2 * 4.0);
  if (ca > 0.0001) {
    vec2 off = c * ca * 0.02;
    col.r = texture2D(tScene, uv + off).r;
    col.g = texture2D(tScene, uv).g;
    col.b = texture2D(tScene, uv - off).b;
  } else {
    col = texture2D(tScene, uv).rgb;
  }
  // ink outline from depth discontinuities
  if (uOutline > 0.0) {
    vec2 px = vec2(1.0) / uRes * max(1.25, uRes.y / 720.0);
    float d0 = linDepth(uv);
    if (d0 < uOutlineDist) {
      float d1 = linDepth(uv + vec2(px.x, 0.0));
      float d2 = linDepth(uv - vec2(px.x, 0.0));
      float d3 = linDepth(uv + vec2(0.0, px.y));
      float d4 = linDepth(uv - vec2(0.0, px.y));
      float lap = abs(d1 + d2 + d3 + d4 - 4.0 * d0);
      float e = smoothstep(0.035, 0.12, lap / max(d0, 0.5));
      float fadeD = 1.0 - smoothstep(uOutlineDist * 0.55, uOutlineDist, d0);
      col = mix(col, uOutlineColor, e * uOutline * fadeD);
    }
  }
  col += texture2D(tBloom, uv).rgb * uBloom * 0.22;
  col *= uExposure * (1.0 + uPulse);
  col = aces(col);
  // grade
  col = col * uTint + uLift;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat * (1.0 - uDesat));
  col = (col - 0.5) * uContrast + 0.5;
  // vignette
  float vig = 1.0 - smoothstep(0.12, 0.75, dist2 * 1.7) * 0.8 * clamp(uVignette, 0.0, 1.25);
  col *= max(vig, 0.0);
  // flash (edge-weighted)
  float edge = clamp(dist2 * 3.2 + 0.25, 0.0, 1.0);
  col = mix(col, uFlash.rgb, uFlash.a * edge);
  // grain
  float g = hash(uv * uRes + fract(uTime * 7.13) * 100.0) - 0.5;
  col += g * uGrain;
  col = clamp(col, 0.0, 1.0);
  col *= (1.0 - uFade);
  // letterbox
  float lb = uLetterbox * 0.12;
  if (vUv.y < lb || vUv.y > 1.0 - lb) col = vec3(0.0);
  gl_FragColor = vec4(toSRGB(col), 1.0);
}`;

export interface FXState {
  bloom: number;
  exposure: number;
  outline: number;
  outlineDist: number;
  vignette: number;
  grain: number;
  chroma: number;
  warp: number;
  fade: number;
  flash: THREE.Vector4;
  tint: THREE.Color;
  lift: THREE.Color;
  sat: number;
  contrast: number;
  glitch: number;
  letterbox: number;
  desat: number;
  pulse: number;
}

export class Renderer {
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  private sceneRT!: THREE.WebGLRenderTarget;
  private brightRT!: THREE.WebGLRenderTarget;
  private mips: THREE.WebGLRenderTarget[] = [];
  private ups: THREE.WebGLRenderTarget[] = [];
  private quad = new FullScreenQuad();
  private brightMat: THREE.ShaderMaterial;
  private downMat: THREE.ShaderMaterial;
  private upMat: THREE.ShaderMaterial;
  private finalMat: THREE.ShaderMaterial;
  private blackTex: THREE.DataTexture;
  width = 1;
  height = 1;
  pixelRatio = 1;
  bloomEnabled = true;
  samples = 4;
  fx: FXState = {
    bloom: 0.9,
    exposure: 1.0,
    outline: 0.85,
    outlineDist: 70,
    vignette: 1,
    grain: 0.035,
    chroma: 0.15,
    warp: 0,
    fade: 0,
    flash: new THREE.Vector4(0.6, 0, 0, 0),
    tint: new THREE.Color(1, 1, 1),
    lift: new THREE.Color(0, 0, 0),
    sat: 1,
    contrast: 1.05,
    glitch: 0,
    letterbox: 0,
    desat: 0,
    pulse: 0,
  };
  quality: 'low' | 'medium' | 'high' = 'medium';

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    this.canvas = this.renderer.domElement;
    this.canvas.tabIndex = 0;
    container.appendChild(this.canvas);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = true;
    this.blackTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.blackTex.needsUpdate = true;
    this.brightMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: BRIGHT,
      uniforms: { tIn: { value: null }, uThreshold: { value: 1.6 }, uKnee: { value: 0.8 } },
      depthTest: false, depthWrite: false,
    });
    this.downMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: DOWN,
      uniforms: { tIn: { value: null }, uTexel: { value: new THREE.Vector2() } },
      depthTest: false, depthWrite: false,
    });
    this.upMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: UP,
      uniforms: { tIn: { value: null }, tPrev: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1.0 } },
      depthTest: false, depthWrite: false,
    });
    this.finalMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FINAL,
      uniforms: {
        tScene: { value: null }, tDepth: { value: null }, tBloom: { value: null },
        uRes: { value: new THREE.Vector2() }, uTime: { value: 0 }, uNear: { value: 0.1 }, uFar: { value: 1000 },
        uBloom: { value: 1 }, uExposure: { value: 1 }, uOutline: { value: 1 }, uOutlineColor: { value: new THREE.Color(0.01, 0.012, 0.02) },
        uOutlineDist: { value: 70 },
        uVignette: { value: 1 }, uGrain: { value: 0.04 }, uChroma: { value: 0.2 }, uWarp: { value: 0 }, uFade: { value: 0 },
        uFlash: { value: new THREE.Vector4() }, uTint: { value: new THREE.Color(1, 1, 1) }, uSat: { value: 1 }, uContrast: { value: 1 },
        uGlitch: { value: 0 }, uLetterbox: { value: 0 }, uDesat: { value: 0 }, uLift: { value: new THREE.Color(0, 0, 0) }, uPulse: { value: 0 },
      },
      depthTest: false, depthWrite: false,
    });
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setQuality(q: 'low' | 'medium' | 'high') {
    this.quality = q;
    this.samples = q === 'low' ? 0 : 4;
    this.bloomEnabled = true;
    this.renderer.shadowMap.type = q === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.resize(true);
  }

  resize(force = false) {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    const dpr = window.devicePixelRatio || 1;
    const pr = this.quality === 'low' ? Math.min(dpr, 1) * 0.75 : this.quality === 'medium' ? Math.min(dpr, 1.25) : Math.min(dpr, 2);
    if (!force && w === this.width && h === this.height && pr === this.pixelRatio) return;
    this.width = w;
    this.height = h;
    this.pixelRatio = pr;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, true);
    const W = Math.floor(w * pr), H = Math.floor(h * pr);
    this.sceneRT?.dispose();
    this.sceneRT = new THREE.WebGLRenderTarget(W, H, {
      type: THREE.HalfFloatType,
      samples: this.samples,
      depthBuffer: true,
    });
    const dt = new THREE.DepthTexture(W, H);
    dt.type = THREE.UnsignedIntType;
    this.sceneRT.depthTexture = dt;
    this.brightRT?.dispose();
    this.mips.forEach((m) => m.dispose());
    this.ups.forEach((m) => m.dispose());
    this.mips = [];
    this.ups = [];
    let bw = Math.max(1, Math.floor(W / 2)), bh = Math.max(1, Math.floor(H / 2));
    const opts = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter } as const;
    this.brightRT = new THREE.WebGLRenderTarget(bw, bh, opts);
    for (let i = 0; i < 5; i++) {
      bw = Math.max(1, Math.floor(bw / 2));
      bh = Math.max(1, Math.floor(bh / 2));
      this.mips.push(new THREE.WebGLRenderTarget(bw, bh, opts));
      this.ups.push(new THREE.WebGLRenderTarget(bw, bh, opts));
    }
    this.finalMat.uniforms.uRes.value.set(W, H);
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, time: number) {
    const r = this.renderer;
    r.setRenderTarget(this.sceneRT);
    r.render(scene, camera);
    // bloom
    let bloomTex: THREE.Texture = this.blackTex;
    if (this.bloomEnabled && this.fx.bloom > 0) {
      this.quad.material = this.brightMat;
      this.brightMat.uniforms.tIn.value = this.sceneRT.texture;
      r.setRenderTarget(this.brightRT);
      this.quad.render(r);
      let src: THREE.WebGLRenderTarget = this.brightRT;
      this.quad.material = this.downMat;
      for (const m of this.mips) {
        this.downMat.uniforms.tIn.value = src.texture;
        this.downMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
        r.setRenderTarget(m);
        this.quad.render(r);
        src = m;
      }
      this.quad.material = this.upMat;
      let prev: THREE.Texture = this.blackTex;
      for (let i = this.mips.length - 1; i >= 0; i--) {
        // upsample mip[i+1] (or start) into ups[i] combining with mip[i]
        const inTex = i === this.mips.length - 1 ? this.mips[i].texture : this.ups[i + 1].texture;
        this.upMat.uniforms.tIn.value = inTex;
        this.upMat.uniforms.tPrev.value = i === this.mips.length - 1 ? prev : this.mips[i].texture;
        const ref = i === this.mips.length - 1 ? this.mips[i] : this.ups[i + 1];
        this.upMat.uniforms.uTexel.value.set(1 / ref.width, 1 / ref.height);
        this.upMat.uniforms.uRadius.value = 1.0;
        r.setRenderTarget(this.ups[i]);
        this.quad.render(r);
      }
      bloomTex = this.ups[0].texture;
    }
    const u = this.finalMat.uniforms, f = this.fx;
    u.tScene.value = this.sceneRT.texture;
    u.tDepth.value = this.sceneRT.depthTexture;
    u.tBloom.value = bloomTex;
    u.uTime.value = time;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uBloom.value = f.bloom;
    u.uExposure.value = f.exposure;
    u.uOutline.value = f.outline;
    u.uOutlineDist.value = f.outlineDist;
    u.uVignette.value = f.vignette;
    u.uGrain.value = f.grain;
    u.uChroma.value = f.chroma;
    u.uWarp.value = f.warp;
    u.uFade.value = f.fade;
    u.uFlash.value.copy(f.flash);
    u.uTint.value.copy(f.tint);
    u.uLift.value.copy(f.lift);
    u.uSat.value = f.sat;
    u.uContrast.value = f.contrast;
    u.uGlitch.value = f.glitch;
    u.uLetterbox.value = f.letterbox;
    u.uDesat.value = f.desat;
    u.uPulse.value = f.pulse;
    this.quad.material = this.finalMat;
    r.setRenderTarget(null);
    this.quad.render(r);
  }
}
