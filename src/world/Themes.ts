import * as THREE from 'three';
import { toon, glow } from '../gfx/Materials';
import type { Surface } from '../core/Audio';
import type { WeatherKind } from '../gfx/Particles';
import type { ThemeId } from './LevelDef';

export interface FloorSpec {
  mat: THREE.Material;
  surface: Surface;
  uvScale: number;
}
export interface Grade {
  tint: [number, number, number];
  lift: [number, number, number];
  sat: number;
  contrast: number;
  exposure: number;
  bloom: number;
  vignette: number;
}
export interface Theme {
  id: ThemeId;
  name: string;
  open: boolean;
  wallH: number;
  wallHVar?: [number, number]; // open themes: random building heights
  floors: Record<string, FloorSpec>; // '.', ',', ';', '_', '~'
  wall: THREE.Material;
  wallAlt: THREE.Material;
  wallTop: THREE.Material;
  wallUV: number;
  ceiling: THREE.Material | null;
  ceilingOn: string[]; // floor chars that get a ceiling
  low: THREE.Material;
  lowH: number;
  edge: 'rail' | 'none';
  fog: [number, number];
  bg: number;
  hemi: [number, number, number];
  dir?: [number, number, [number, number, number]]; // color, intensity, direction
  grade: Grade;
  weather: WeatherKind;
  ambience: string;
  music: string;
  sea: boolean;
  beam: boolean;
  vessels: boolean;
  scatter: string[];
  lamp: { kind: string; color: number };
  wallDeco: string[]; // decoration kinds applied on wall faces
  decoChance: number;
}

let cache: Partial<Record<ThemeId, Theme>> = {};

const F = (map: string, color: number, surface: Surface, uvScale = 1): FloorSpec => ({
  mat: toon({ map, color, vertexColors: true, key: `floor-${map}-${color}` }),
  surface,
  uvScale,
});
const W = (map: string, color: number, extra: Partial<Parameters<typeof toon>[0]> = {}) =>
  toon({ map, color, vertexColors: true, key: `wall-${map}-${color}-${JSON.stringify(extra)}`, ...extra });

export function getTheme(id: ThemeId): Theme {
  const c = cache[id];
  if (c) return c;
  let t: Theme;
  const water = F('glassTile', 0x406a80, 'water');
  switch (id) {
    case 'hub':
      t = {
        id, name: 'Polaris Vessel', open: true, wallH: 6,
        floors: { '.': F('plate', 0x8a909a, 'metal'), ',': F('carpet', 0xffffff, 'carpet'), ';': F('metal', 0x9aa0aa, 'metal'), '_': F('ice', 0xffffff, 'ice'), '~': water },
        wall: W('panel', 0xb0b8c4, { emissiveMap: 'panelGlow', emissiveIntensity: 2.2 }), wallAlt: W('metal', 0x8a909a), wallTop: W('plate', 0x60666e), wallUV: 1,
        ceiling: toon({ map: 'metal', color: 0x50565e }), ceilingOn: [',', ';'],
        low: W('hazard', 0xffffff), lowH: 1.1, edge: 'rail',
        fog: [0x0a0d14, 0.012], bg: 0x05070c, hemi: [0x5a6a8a, 0x1a1a22, 0.75],
        grade: { tint: [0.95, 1.0, 1.08], lift: [0.005, 0.008, 0.015], sat: 1.0, contrast: 1.08, exposure: 1.1, bloom: 1.0, vignette: 1 },
        weather: 'ash', ambience: 'hub', music: 'hub', sea: true, beam: true, vessels: true,
        scatter: ['crate', 'barrel', 'gtCrate', 'crateStack'], lamp: { kind: 'streetlamp', color: 0x9fe8ff },
        wallDeco: ['poster', 'pipeRun'], decoChance: 0.08,
      };
      break;
    case 'city':
      t = {
        id, name: 'Forgotten City Vessel', open: true, wallH: 14, wallHVar: [9, 26],
        floors: { '.': F('asphalt', 0xffffff, 'concrete'), ',': F('sidewalk', 0xffffff, 'concrete'), ';': F('moss', 0xffffff, 'grass'), '_': F('concrete', 0xffffff, 'concrete'), '~': water },
        wall: W('facade', 0xa8a4a0, { emissiveMap: 'facadeLit', emissiveIntensity: 2.2 }), wallAlt: W('brick', 0xffffff), wallTop: W('concrete', 0x6a6a6a), wallUV: 1 / 2,
        ceiling: null, ceilingOn: [],
        low: W('concrete', 0x9a9a94), lowH: 1.0, edge: 'rail',
        fog: [0x14120f, 0.022], bg: 0x0a0908, hemi: [0x8a7a6a, 0x1a1c14, 0.6],
        grade: { tint: [1.08, 0.98, 0.88], lift: [0.012, 0.008, 0.004], sat: 0.85, contrast: 1.1, exposure: 1.15, bloom: 1.0, vignette: 1.05 },
        weather: 'ash', ambience: 'city', music: 'explore', sea: true, beam: true, vessels: false,
        scatter: ['car', 'debris', 'trash', 'bench', 'barrel', 'bush', 'crate'], lamp: { kind: 'streetlamp', color: 0xffb060 },
        wallDeco: ['vinesHang', 'poster'], decoChance: 0.12,
      };
      break;
    case 'industrial':
      t = {
        id, name: 'Industrial Complex Vessel', open: false, wallH: 7,
        floors: { '.': F('plate', 0x9a8a7a, 'metal'), ',': F('grate', 0xffffff, 'metal'), ';': F('concrete', 0x8a8070, 'concrete'), '_': F('hazard', 0xffffff, 'metal'), '~': water },
        wall: W('rust', 0xb09a88), wallAlt: W('metal', 0x8a7a6a), wallTop: W('rust', 0x6a5a4a), wallUV: 1 / 2,
        ceiling: toon({ map: 'grate', color: 0x6a6a6a }), ceilingOn: ['.', ',', ';', '_', '~'],
        low: W('hazard', 0xffffff), lowH: 1.1, edge: 'none',
        fog: [0x140c08, 0.03], bg: 0x0a0604, hemi: [0x8a6a4a, 0x1a120a, 0.55],
        grade: { tint: [1.12, 0.95, 0.8], lift: [0.015, 0.006, 0.0], sat: 0.95, contrast: 1.12, exposure: 1.15, bloom: 1.1, vignette: 1.1 },
        weather: 'embers', ambience: 'industrial', music: 'explore', sea: false, beam: false, vessels: false,
        scatter: ['barrel', 'crate', 'pallet', 'machine', 'crateStack', 'barrelFire'], lamp: { kind: 'lampCage', color: 0xffa050 },
        wallDeco: ['pipesV', 'poster'], decoChance: 0.15,
      };
      break;
    case 'lab':
      t = {
        id, name: 'Subterranean Lab Vessel', open: false, wallH: 4.5,
        floors: { '.': F('tile', 0xffffff, 'tile'), ',': F('labPanel', 0xb8c4cc, 'tile'), ';': F('grate', 0xd0d8e0, 'metal'), '_': F('tile', 0xc0e0d8, 'tile'), '~': water },
        wall: W('labPanel', 0xe8eef4), wallAlt: W('panel', 0xd0d8e0, { emissiveMap: 'panelGlow', emissiveIntensity: 2.0 }), wallTop: W('labPanel', 0xc0c8d0), wallUV: 1,
        ceiling: toon({ map: 'labPanel', color: 0xa0a8b0 }), ceilingOn: ['.', ',', ';', '_', '~'],
        low: W('labPanel', 0xd8e0e8), lowH: 1.0, edge: 'none',
        fog: [0x081214, 0.035], bg: 0x040808, hemi: [0x8ab0b8, 0x101818, 0.55],
        grade: { tint: [0.9, 1.05, 1.05], lift: [0.0, 0.01, 0.012], sat: 0.85, contrast: 1.1, exposure: 1.05, bloom: 1.1, vignette: 1.1 },
        weather: 'dust', ambience: 'lab', music: 'explore', sea: false, beam: false, vessels: false,
        scatter: ['labTable', 'serverRack', 'console', 'specimen', 'crate'], lamp: { kind: 'ceilingLamp', color: 0xd0f8ff },
        wallDeco: ['poster', 'monitor'], decoChance: 0.12,
      };
      break;
    case 'aquatic':
      t = {
        id, name: 'Aquatic Habitat Vessel', open: false, wallH: 5.5,
        floors: { '.': F('glassTile', 0xffffff, 'tile'), ',': F('sand', 0xffffff, 'concrete'), ';': F('grate', 0x9ab0b8, 'metal'), '_': F('tile', 0x80a8b8, 'tile'), '~': water },
        wall: W('panel', 0x7aa0b0, { emissiveMap: 'panelGlow', emissiveIntensity: 2.4 }), wallAlt: W('coral', 0xffffff), wallTop: W('metal', 0x5a7078), wallUV: 1,
        ceiling: toon({ map: 'metal', color: 0x3a5058 }), ceilingOn: ['.', ',', ';', '_', '~'],
        low: W('metal', 0x5a7a88), lowH: 1.0, edge: 'none',
        fog: [0x041218, 0.04], bg: 0x02080c, hemi: [0x4a8aa8, 0x081418, 0.6],
        grade: { tint: [0.82, 1.0, 1.12], lift: [0.0, 0.01, 0.02], sat: 0.95, contrast: 1.08, exposure: 1.12, bloom: 1.2, vignette: 1.1 },
        weather: 'bubbles', ambience: 'aquatic', music: 'explore', sea: false, beam: false, vessels: false,
        scatter: ['coral', 'kelp', 'crate', 'barrel', 'aquariumSmall'], lamp: { kind: 'ceilingLamp', color: 0x60d0ff },
        wallDeco: ['porthole', 'poster'], decoChance: 0.18,
      };
      break;
    case 'biosphere':
      t = {
        id, name: 'Agricultural Biosphere Vessel', open: true, wallH: 6, wallHVar: [4, 7],
        floors: { '.': F('grass', 0xffffff, 'grass'), ',': F('soil', 0xffffff, 'grass'), ';': F('concrete', 0x8a8a80, 'concrete'), '_': F('moss', 0xffffff, 'grass'), '~': water },
        wall: W('leaves', 0x7aa86a), wallAlt: W('bark', 0xffffff), wallTop: W('leaves', 0x5a8a4a), wallUV: 1,
        ceiling: null, ceilingOn: [],
        low: W('concrete', 0x8a8a80), lowH: 0.9, edge: 'rail',
        fog: [0x0a140c, 0.028], bg: 0x040a06, hemi: [0x7aa070, 0x141a0a, 0.65],
        grade: { tint: [0.95, 1.08, 0.9], lift: [0.004, 0.012, 0.004], sat: 1.05, contrast: 1.08, exposure: 1.15, bloom: 1.1, vignette: 1.05 },
        weather: 'spores', ambience: 'biosphere', music: 'explore', sea: true, beam: true, vessels: false,
        scatter: ['bush', 'tree', 'crops', 'giantFlower', 'planter', 'barrel'], lamp: { kind: 'uvLamp', color: 0xb070ff },
        wallDeco: ['vinesHang'], decoChance: 0.1,
      };
      break;
    case 'cryo':
      t = {
        id, name: 'Cryo-Preservation Vessel', open: false, wallH: 6,
        floors: { '.': F('frost', 0xe0ecf8, 'ice'), ',': F('snow', 0xffffff, 'ice'), ';': F('grate', 0xb8c8d8, 'metal'), '_': F('ice', 0xffffff, 'ice'), '~': water },
        wall: W('frost', 0xd8e8f8), wallAlt: W('panel', 0xa8c0d8, { emissiveMap: 'panelGlow', emissiveIntensity: 2.2 }), wallTop: W('snow', 0xffffff), wallUV: 1 / 2,
        ceiling: toon({ map: 'frost', color: 0x9aacbc }), ceilingOn: ['.', ',', ';', '_', '~'],
        low: W('frost', 0xc8d8e8), lowH: 1.0, edge: 'none',
        fog: [0x0c1420, 0.035], bg: 0x060a12, hemi: [0x9ab8e0, 0x101828, 0.7],
        grade: { tint: [0.88, 0.98, 1.15], lift: [0.006, 0.01, 0.02], sat: 0.75, contrast: 1.1, exposure: 1.15, bloom: 1.15, vignette: 1.1 },
        weather: 'snow', ambience: 'cryo', music: 'explore', sea: false, beam: false, vessels: false,
        scatter: ['cryoPod', 'iceBlock', 'crate', 'serverRack', 'console'], lamp: { kind: 'ceilingLamp', color: 0xa0d8ff },
        wallDeco: ['icicles', 'poster'], decoChance: 0.15,
      };
      break;
    case 'core':
      t = {
        id, name: 'Polaris Core', open: true, wallH: 8,
        floors: { '.': F('plate', 0x7a808a, 'metal'), ',': F('grate', 0xffffff, 'metal'), ';': F('metal', 0x8a909a, 'metal'), '_': F('ice', 0xffffff, 'ice'), '~': water },
        wall: W('panel', 0x8a94a4, { emissiveMap: 'panelGlow', emissiveIntensity: 2.6 }), wallAlt: W('metal', 0x6a707a), wallTop: W('plate', 0x50565e), wallUV: 1,
        ceiling: null, ceilingOn: [],
        low: W('hazard', 0xffffff), lowH: 1.1, edge: 'rail',
        fog: [0x060a14, 0.012], bg: 0x03050a, hemi: [0x5a7aaa, 0x101420, 0.7],
        grade: { tint: [0.92, 1.0, 1.12], lift: [0.004, 0.008, 0.018], sat: 1.05, contrast: 1.1, exposure: 1.1, bloom: 1.25, vignette: 1 },
        weather: 'embers', ambience: 'core', music: 'finale', sea: true, beam: true, vessels: true,
        scatter: ['barrel', 'gtCrate', 'machine'], lamp: { kind: 'streetlamp', color: 0x60e0ff },
        wallDeco: ['poster'], decoChance: 0.1,
      };
      break;
    case 'ballroom':
    default:
      t = {
        id: 'ballroom', name: 'The Ballroom', open: false, wallH: 10,
        floors: { '.': F('marble', 0xffffff, 'tile'), ',': F('carpet', 0xffffff, 'carpet'), ';': F('wood', 0xffffff, 'wood'), '_': F('marble', 0xffffff, 'tile'), '~': water },
        wall: W('brick', 0x8a5a5a), wallAlt: W('wood', 0x8a6a5a), wallTop: W('wood', 0x5a3a2a), wallUV: 1 / 2,
        ceiling: toon({ map: 'wood', color: 0x4a2a24 }), ceilingOn: ['.', ',', ';', '_', '~'],
        low: W('wood', 0x6a4030), lowH: 1.0, edge: 'none',
        fog: [0x0c0608, 0.02], bg: 0x060304, hemi: [0x8a5a5a, 0x1a0a0a, 0.6],
        grade: { tint: [1.1, 0.95, 0.92], lift: [0.012, 0.004, 0.006], sat: 1.05, contrast: 1.12, exposure: 1.1, bloom: 1.1, vignette: 1.15 },
        weather: 'dust', ambience: 'ballroom', music: 'trial', sea: false, beam: false, vessels: false,
        scatter: ['table', 'sofa'], lamp: { kind: 'chandelier', color: 0xffc890 },
        wallDeco: ['poster'], decoChance: 0.06,
      };
  }
  cache[id] = t;
  return t;
}

export const GLOW_EDGE = () => glow(0x3ef0ff, 3);
