import type { Look, Mutation, TopStyle, HairStyle } from '../chars/CharacterBuilder';
import type { EnemyKind, ItemId } from '../world/LevelDef';
import { rng, rpick, rrange } from '../core/math';

export interface EnemyDef {
  name: string;
  hp: number;
  walk: number;
  run: number;
  dmg: number;
  reach: number;
  windup: number;
  cooldown: number;
  sight: number;
  hearing: number;
  fov: number; // radians
  radius: number;
  scale: [number, number];
  hound?: boolean;
  blood: number; // ichor color
  stagger: number;
  credits: number;
  sanity: number; // sanity damage on hit
  loot: [ItemId, number, number, number][]; // id, chance, min, max
  ranged?: { range: [number, number]; speed: number; dmg: number; cd: number; kind: 'acid' | 'spark' | 'ice' | 'spore' };
  lunge?: { range: number; speed: number; cd: number };
  explode?: { radius: number; dmg: number; kind: 'toxic' | 'ice' | 'spore' | 'fire'; fuse: number };
  ambush?: boolean;
  phantom?: boolean;
  swim?: boolean;
  freeze?: number;
  shield?: boolean;
  armor?: number; // damage reduction 0..1
  dodge?: number; // dodge chance when aimed at
  look: (seed: number) => Look;
  pitch: number;
}

const ZSKIN = [0x8a9a7a, 0x9a9a88, 0x7a8a7a, 0xa09a8a, 0x8a8a7a, 0x7a7a6a];
const ZCLOTH = [0x3a3a40, 0x4a3a30, 0x2a3a4a, 0x5a4a3a, 0x3a4a3a, 0x4a4a4a, 0x6a3a30];
const HAIRS: HairStyle[] = ['messy', 'short', 'none', 'long', 'buzz', 'wild'];

function zombie(seed: number, o: { top?: TopStyle; tops?: number[]; muts?: Mutation[]; skin?: number[]; glow?: number; hair?: HairStyle[]; extra?: Partial<Look> }): Look {
  const r = rng(seed);
  return {
    skin: rpick(r, o.skin ?? ZSKIN),
    hair: rpick(r, [0x1a1a14, 0x3a2a1a, 0x5a5a50, 0x2a2018]),
    hairStyle: rpick(r, o.hair ?? HAIRS),
    top: rpick(r, o.tops ?? ZCLOTH),
    topStyle: o.top ?? rpick(r, ['rags', 'tshirt', 'jacket', 'jumpsuit'] as TopStyle[]),
    under: rpick(r, ZCLOTH),
    bottom: rpick(r, ZCLOTH),
    shoes: 0x1a1a1a,
    female: r() < 0.4,
    zombie: true,
    eyeGlow: true,
    eye: o.glow ?? 0xb8ff40,
    glowColor: o.glow ?? 0xb8ff40,
    band: false,
    mutations: o.muts ?? [],
    build: rrange(r, 0.9, 1.15),
    seed,
    ...o.extra,
  };
}

const L = (id: ItemId, c: number, a: number, b: number): [ItemId, number, number, number] => [id, c, a, b];
const COMMON = [L('pistolAmmo', 0.22, 3, 7), L('scrap', 0.2, 1, 2), L('cloth', 0.12, 1, 1), L('chem', 0.08, 1, 1)];

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  shambler: {
    name: 'Shambler', hp: 70, walk: 0.8, run: 2.3, dmg: 14, reach: 1.5, windup: 0.55, cooldown: 1.3, sight: 15, hearing: 1, fov: 2.2, radius: 0.4,
    scale: [0.92, 1.08], blood: 0x4a6a20, stagger: 30, credits: 6, sanity: 2, loot: COMMON, pitch: 1,
    look: (s) => zombie(s, {}),
  },
  runner: {
    name: 'Runner', hp: 50, walk: 1.2, run: 4.6, dmg: 10, reach: 1.4, windup: 0.35, cooldown: 0.9, sight: 18, hearing: 1.3, fov: 2.4, radius: 0.38,
    scale: [0.9, 1.0], blood: 0x4a6a20, stagger: 22, credits: 8, sanity: 2, loot: COMMON, pitch: 1.3,
    lunge: { range: 5, speed: 9, cd: 3 },
    look: (s) => zombie(s, { top: 'tshirt', muts: ['claws'] }),
  },
  brute: {
    name: 'Brute', hp: 260, walk: 0.9, run: 2.6, dmg: 28, reach: 2.0, windup: 0.85, cooldown: 1.8, sight: 14, hearing: 0.8, fov: 2.0, radius: 0.65,
    scale: [1.35, 1.5], blood: 0x4a6a20, stagger: 90, credits: 25, sanity: 4, loot: [L('pistolAmmo', 0.5, 6, 10), L('scrap', 0.6, 2, 4), L('medkit', 0.15, 1, 1)], pitch: 0.6,
    look: (s) => zombie(s, { top: 'rags', muts: ['tumor'], extra: { build: 1.4 } }),
  },
  riot: {
    name: 'Riot Husk', hp: 120, walk: 0.8, run: 2.4, dmg: 18, reach: 1.6, windup: 0.6, cooldown: 1.4, sight: 16, hearing: 1, fov: 2.0, radius: 0.48,
    scale: [1.05, 1.15], blood: 0x4a6a20, stagger: 60, credits: 15, sanity: 2, shield: true, loot: [L('pistolAmmo', 0.6, 6, 12), L('shells', 0.2, 2, 3)], pitch: 0.85,
    look: (s) => zombie(s, { top: 'tactical', tops: [0x1a2030, 0x202838], muts: ['shield', 'riotHelmet'], hair: ['none'] }),
  },
  hound: {
    name: 'Hound', hp: 45, walk: 1.5, run: 6.2, dmg: 9, reach: 1.3, windup: 0.3, cooldown: 0.8, sight: 20, hearing: 1.6, fov: 2.6, radius: 0.45,
    scale: [0.95, 1.15], hound: true, blood: 0x6a2a20, stagger: 20, credits: 7, sanity: 2, loot: [L('cloth', 0.2, 1, 1)], pitch: 1.5,
    lunge: { range: 4.5, speed: 10, cd: 2.5 },
    look: (s) => zombie(s, {}),
  },
  welder: {
    name: 'Welder', hp: 90, walk: 0.85, run: 2.5, dmg: 16, reach: 1.6, windup: 0.5, cooldown: 1.2, sight: 15, hearing: 1, fov: 2.2, radius: 0.42,
    scale: [1.0, 1.1], blood: 0x6a4a20, stagger: 35, credits: 9, sanity: 2, loot: [...COMMON, L('chem', 0.25, 1, 2)], pitch: 0.9,
    ranged: { range: [4, 9], speed: 14, dmg: 10, cd: 3.5, kind: 'spark' },
    look: (s) => zombie(s, { top: 'overalls', tops: [0x6a5030, 0x4a4a3a], muts: ['torch', 'mask'], glow: 0xffa040 }),
  },
  hauler: {
    name: 'Hauler', hp: 320, walk: 0.8, run: 2.2, dmg: 30, reach: 2.1, windup: 0.9, cooldown: 2.0, sight: 13, hearing: 0.8, fov: 2.0, radius: 0.7,
    scale: [1.45, 1.6], blood: 0x6a4a20, stagger: 120, credits: 28, sanity: 4, armor: 0.3, loot: [L('scrap', 0.9, 3, 5), L('shells', 0.4, 2, 4)], pitch: 0.55,
    look: (s) => zombie(s, { top: 'overalls', tops: [0xb08a20, 0x6a5030], muts: ['pipes', 'claws'], extra: { build: 1.5 } }),
  },
  bloater: {
    name: 'Bloater', hp: 60, walk: 0.7, run: 1.9, dmg: 8, reach: 1.4, windup: 0.6, cooldown: 1.5, sight: 12, hearing: 0.9, fov: 2.0, radius: 0.55,
    scale: [1.05, 1.2], blood: 0x80c020, stagger: 999, credits: 10, sanity: 3, loot: [L('chem', 0.6, 1, 2)], pitch: 0.7,
    explode: { radius: 3.4, dmg: 32, kind: 'toxic', fuse: 0.9 },
    look: (s) => zombie(s, { top: 'rags', muts: ['bloat', 'tumor'], glow: 0xc0ff40 }),
  },
  phantom: {
    name: 'Phantom', hp: 85, walk: 1.4, run: 4.0, dmg: 18, reach: 1.5, windup: 0.4, cooldown: 1.1, sight: 18, hearing: 1.4, fov: 2.6, radius: 0.4,
    scale: [1.0, 1.1], blood: 0x60c0ff, stagger: 40, credits: 16, sanity: 6, phantom: true, loot: [L('cells', 0.35, 4, 8), L('chem', 0.3, 1, 1)], pitch: 1.4,
    look: (s) => zombie(s, { top: 'jumpsuit', tops: [0xd0d8e0, 0xc0c8d0], skin: [0xc8d0d8, 0xb8c0c8], muts: ['claws'], glow: 0x60e0ff, hair: ['none'] }),
  },
  thinker: {
    name: 'Thinker', hp: 110, walk: 1.2, run: 3.8, dmg: 16, reach: 1.5, windup: 0.4, cooldown: 1.0, sight: 20, hearing: 1.5, fov: 2.8, radius: 0.42,
    scale: [0.95, 1.05], blood: 0xff70c0, stagger: 45, credits: 18, sanity: 4, dodge: 0.55, loot: [L('cells', 0.4, 4, 10), L('pills', 0.15, 1, 1)], pitch: 1.6,
    look: (s) => zombie(s, { top: 'labcoat', tops: [0xd8dce0], muts: ['bigHead', 'brain'], glow: 0xff70c0, hair: ['none'] }),
  },
  spitter: {
    name: 'Spitter', hp: 70, walk: 0.9, run: 2.6, dmg: 10, reach: 1.4, windup: 0.5, cooldown: 1.3, sight: 20, hearing: 1.2, fov: 2.4, radius: 0.42,
    scale: [0.95, 1.05], blood: 0x80ff40, stagger: 30, credits: 12, sanity: 2, loot: [...COMMON, L('chem', 0.4, 1, 2)], pitch: 1.2,
    ranged: { range: [5, 15], speed: 12, dmg: 12, cd: 2.6, kind: 'acid' },
    look: (s) => zombie(s, { muts: ['gills', 'tumor'], glow: 0x80ff40 }),
  },
  diver: {
    name: 'Diver', hp: 75, walk: 1.0, run: 3.2, dmg: 14, reach: 1.5, windup: 0.4, cooldown: 1.0, sight: 16, hearing: 1.4, fov: 2.4, radius: 0.42,
    scale: [0.95, 1.1], blood: 0x2a8a8a, stagger: 30, credits: 10, sanity: 3, swim: true, loot: [...COMMON, L('shells', 0.15, 2, 3)], pitch: 1.1,
    lunge: { range: 5, speed: 9, cd: 3 },
    look: (s) => zombie(s, { top: 'jumpsuit', tops: [0x1a3a4a, 0x2a4a5a], skin: [0x6a9a9a, 0x5a8a8a], muts: ['fins', 'gills'], glow: 0x40ffd0 }),
  },
  drowned: {
    name: 'Drowned', hp: 95, walk: 0.8, run: 2.3, dmg: 15, reach: 1.5, windup: 0.55, cooldown: 1.3, sight: 14, hearing: 1, fov: 2.2, radius: 0.42,
    scale: [1.0, 1.1], blood: 0x2a8a8a, stagger: 35, credits: 8, sanity: 3, swim: true, loot: COMMON, pitch: 0.8,
    look: (s) => zombie(s, { skin: [0x7a9a98, 0x6a8a8a], muts: ['lantern', 'gills'], glow: 0x60ffd0 }),
  },
  creeper: {
    name: 'Creeper', hp: 80, walk: 1.0, run: 3.4, dmg: 15, reach: 1.6, windup: 0.4, cooldown: 1.1, sight: 6, hearing: 0.6, fov: 3.0, radius: 0.42,
    scale: [1.0, 1.1], blood: 0x3a8a20, stagger: 30, credits: 12, sanity: 4, ambush: true, loot: [L('cloth', 0.4, 1, 2), L('chem', 0.2, 1, 1)], pitch: 0.9,
    look: (s) => zombie(s, { skin: [0x5a7a4a, 0x4a6a3a], muts: ['vines', 'leaves'], glow: 0xd0ff40, top: 'rags', tops: [0x3a4a2a] }),
  },
  sporer: {
    name: 'Sporer', hp: 55, walk: 0.7, run: 1.8, dmg: 8, reach: 1.4, windup: 0.6, cooldown: 1.5, sight: 12, hearing: 0.9, fov: 2.0, radius: 0.5,
    scale: [1.0, 1.15], blood: 0xd0ff40, stagger: 999, credits: 10, sanity: 4, loot: [L('chem', 0.5, 1, 2)], pitch: 0.75,
    explode: { radius: 3.6, dmg: 24, kind: 'spore', fuse: 1.0 },
    look: (s) => zombie(s, { skin: [0x7a8a5a], muts: ['spores', 'bloat', 'leaves'], glow: 0xd0ff40 }),
  },
  vinehound: {
    name: 'Vine Hound', hp: 60, walk: 1.5, run: 6.0, dmg: 10, reach: 1.3, windup: 0.3, cooldown: 0.8, sight: 18, hearing: 1.5, fov: 2.6, radius: 0.45,
    scale: [1.0, 1.2], hound: true, blood: 0x3a8a20, stagger: 22, credits: 8, sanity: 2, loot: [L('cloth', 0.3, 1, 1)], pitch: 1.4,
    lunge: { range: 4.5, speed: 10, cd: 2.5 },
    look: (s) => zombie(s, {}),
  },
  farmer: {
    name: 'Field Hand', hp: 80, walk: 0.85, run: 2.4, dmg: 15, reach: 1.6, windup: 0.5, cooldown: 1.3, sight: 15, hearing: 1, fov: 2.2, radius: 0.42,
    scale: [1.0, 1.1], blood: 0x4a6a20, stagger: 32, credits: 7, sanity: 2, loot: [...COMMON, L('cloth', 0.25, 1, 2)], pitch: 0.95,
    look: (s) => zombie(s, { top: 'overalls', tops: [0x3a5a7a, 0x5a4a2a], muts: ['vines'], extra: { hat: 'cap', hatColor: 0x6a5a3a } }),
  },
  frostbitten: {
    name: 'Frostbitten', hp: 170, walk: 0.6, run: 1.7, dmg: 18, reach: 1.6, windup: 0.75, cooldown: 1.6, sight: 14, hearing: 1, fov: 2.0, radius: 0.45,
    scale: [1.05, 1.2], blood: 0x80c8ff, stagger: 70, credits: 14, sanity: 3, freeze: 2.0, armor: 0.2, loot: [...COMMON, L('cells', 0.25, 4, 8)], pitch: 0.6,
    look: (s) => zombie(s, { skin: [0xa8c0d8, 0x98b0c8], muts: ['ice'], glow: 0x80e0ff, top: 'jumpsuit', tops: [0x8aa0b8, 0x6a8098] }),
  },
  shatterer: {
    name: 'Shatterer', hp: 60, walk: 0.9, run: 3.0, dmg: 10, reach: 1.4, windup: 0.5, cooldown: 1.3, sight: 15, hearing: 1.1, fov: 2.2, radius: 0.42,
    scale: [0.95, 1.05], blood: 0x80c8ff, stagger: 999, credits: 12, sanity: 3, loot: [L('cells', 0.3, 4, 6)], pitch: 1.0,
    explode: { radius: 3.2, dmg: 26, kind: 'ice', fuse: 0.8 },
    look: (s) => zombie(s, { skin: [0xb8d0e8], muts: ['ice', 'crystalSpine'], glow: 0xa0f0ff }),
  },
  cryobrute: {
    name: 'Cryo Brute', hp: 380, walk: 0.7, run: 2.0, dmg: 32, reach: 2.1, windup: 0.95, cooldown: 2.0, sight: 13, hearing: 0.8, fov: 2.0, radius: 0.7,
    scale: [1.5, 1.65], blood: 0x80c8ff, stagger: 140, credits: 30, sanity: 5, armor: 0.4, freeze: 2.5, loot: [L('cells', 0.7, 8, 14), L('medkit', 0.2, 1, 1), L('scrap', 0.6, 2, 4)], pitch: 0.5,
    look: (s) => zombie(s, { skin: [0x98b0c8], muts: ['armor', 'ice'], glow: 0x80e0ff, extra: { build: 1.5 } }),
  },
};
