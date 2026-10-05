import * as THREE from 'three';
import { Renderer } from '../gfx/Renderer';
import { buildHumanoid, buildHound } from '../chars/CharacterBuilder';
import { Animator, HoundAnimator } from '../chars/Animator';
import { CAST, SURVIVORS } from '../chars/Cast';
import { toon } from '../gfx/Materials';
import { Exterior } from '../gfx/Exterior';

export function charTest(app: HTMLElement) {
  const r = new Renderer(app);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070c);
  scene.fog = new THREE.FogExp2(0x05070c, 0.02);
  const cam = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 1500);
  const q = new URLSearchParams(location.search);
  const cx = +(q.get('cx') ?? 0), cz = +(q.get('cz') ?? 9), cy = +(q.get('cy') ?? 2.2);
  cam.position.set(cx, cy, cz);
  cam.lookAt(cx, +(q.get('ly') ?? 1.0), 0);
  scene.add(new THREE.HemisphereLight(0x8090b0, 0x202018, 0.9));
  const d = new THREE.DirectionalLight(0xffffff, 1.6);
  d.position.set(3, 6, 5);
  scene.add(d);
  const pl = new THREE.PointLight(0x40e0ff, 30, 12, 1.5);
  pl.position.set(-3, 2, 2);
  scene.add(pl);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), toon({ map: 'metal', repeat: 1 }));
  scene.add(floor);
  const ext = new Exterior({ sea: false, beam: true, beamPos: new THREE.Vector3(0, -10, -120) });
  scene.add(ext.group);
  const anims: Animator[] = [];
  const ids = [...SURVIVORS, 'captain'] as const;
  const poses = ['point', 'think', 'cross', 'hips', 'shrug', 'fight', 'typing', 'wave', 'meditate', 'band', null, 'salute', null];
  ids.forEach((id, i) => {
    const m = buildHumanoid(CAST[id].look);
    m.root.position.set((i - 6) * 0.85, 0, (i % 2) * -0.6);
    scene.add(m.root);
    const a = new Animator(m);
    a.p.pose = poses[i] as any;
    a.p.poseW = poses[i] ? 1 : 0;
    if (i === 10) { a.p.speed = 3; a.p.run = 0.5; }
    if (id === 'captain') a.p.float = 1;
    anims.push(a);
  });
  const z = buildHumanoid({ skin: 0x8a9a7a, hair: 0x2a2a20, hairStyle: 'messy', top: 0x3a3a40, topStyle: 'rags', bottom: 0x2a2a30, shoes: 0x1a1a1a, zombie: true, eyeGlow: true, eye: 0xb0ff40, mutations: ['tumor', 'claws'], band: false, seed: 77 });
  z.root.position.set(3, 0, 2);
  z.root.rotation.y = -0.6;
  scene.add(z.root);
  const za = new Animator(z);
  za.p.zombie = 1; za.p.speed = 1;
  anims.push(za);
  const h = buildHound({ skin: 0x7a5a50, glow: 0xff5020 });
  h.root.position.set(-3, 0, 2);
  h.root.rotation.y = 0.8;
  scene.add(h.root);
  const ha = new HoundAnimator(h);
  ha.speed = 4;
  let t = 0;
  const loop = () => {
    t += 0.016;
    anims.forEach((a) => a.tick(0.016));
    ha.tick(0.016);
    ext.update(0.016, t, cam);
    r.render(scene, cam, t);
    requestAnimationFrame(loop);
  };
  loop();
  document.getElementById('boot')?.remove();
}
