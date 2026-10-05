import type { ItemId } from '../world/LevelDef';
import type { SkillId, WeaponId } from './State';

export type ItemCat = 'ammo' | 'heal' | 'material' | 'key' | 'throw' | 'weapon' | 'currency';
export interface ItemDef {
  id: ItemId;
  name: string;
  desc: string;
  cat: ItemCat;
  icon: string; // key into ICONS
  color: number;
  max?: number;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  pistolAmmo: { id: 'pistolAmmo', name: '9mm Rounds', desc: 'Ammunition for the GT-9 Warden.', cat: 'ammo', icon: 'ammo', color: 0xffd060, max: 120 },
  shells: { id: 'shells', name: 'Shotgun Shells', desc: 'Buckshot for the Breaker.', cat: 'ammo', icon: 'shell', color: 0xff6040, max: 40 },
  cells: { id: 'cells', name: 'Polaris Cells', desc: 'Volatile energy cells. Hum faintly. Feed the Arc.', cat: 'ammo', icon: 'cell', color: 0x60e0ff, max: 120 },
  medkit: { id: 'medkit', name: 'Medkit', desc: 'GloomTech field medkit. Restores 60 health.', cat: 'heal', icon: 'medkit', color: 0xff5050, max: 6 },
  bandage: { id: 'bandage', name: 'Bandage', desc: 'Clean-ish cloth. Restores 25 health.', cat: 'heal', icon: 'bandage', color: 0xf0e8d8, max: 10 },
  pills: { id: 'pills', name: 'Calm Pills', desc: '“GloomCalm™ — Feel Less, Live More.” Restores 40 sanity.', cat: 'heal', icon: 'pills', color: 0xb06cff, max: 8 },
  scrap: { id: 'scrap', name: 'Scrap', desc: 'Bolts, springs and wire. Used for crafting and weapon upgrades.', cat: 'material', icon: 'scrap', color: 0xa0a8b0, max: 99 },
  chem: { id: 'chem', name: 'Chemicals', desc: 'Unlabeled reagents. Probably flammable.', cat: 'material', icon: 'chem', color: 0x80ff60, max: 30 },
  cloth: { id: 'cloth', name: 'Cloth', desc: 'Torn fabric. Useful for bandages and flares.', cat: 'material', icon: 'cloth', color: 0xe0d0b0, max: 30 },
  flare: { id: 'flare', name: 'Flare', desc: 'Lights the dark, lures and burns the dead.', cat: 'throw', icon: 'flare', color: 0xff4030, max: 8 },
  pipebomb: { id: 'pipebomb', name: 'Pipe Bomb', desc: 'Crude. Effective. Loud.', cat: 'throw', icon: 'bomb', color: 0x8a8a8a, max: 6 },
  pistol: { id: 'pistol', name: 'GT-9 Warden', desc: 'GloomTech security sidearm. Reliable, precise.', cat: 'weapon', icon: 'pistol', color: 0x3ef0ff },
  shotgun: { id: 'shotgun', name: 'Breaker', desc: 'Pump-action riot gun. Devastating up close.', cat: 'weapon', icon: 'shotgun', color: 0xff8040 },
  arc: { id: 'arc', name: 'Polaris Arc', desc: 'Experimental lightning projector. Chains between targets.', cat: 'weapon', icon: 'arc', color: 0x60e0ff },
  axe: { id: 'axe', name: 'Fire Axe', desc: 'Heavy, slow, and final.', cat: 'weapon', icon: 'axe', color: 0xff3030 },
  credits: { id: 'credits', name: 'Gloom Credits', desc: 'Undernet tips from viewers who enjoy your suffering.', cat: 'currency', icon: 'credit', color: 0xffd84a },
  fuse: { id: 'fuse', name: 'Grid Fuse', desc: 'Ceramic power fuse stamped “CITY GRID — DO NOT REMOVE”.', cat: 'key', icon: 'fuse', color: 0xffc040 },
  keyRed: { id: 'keyRed', name: 'Red Keycard', desc: 'GloomTech clearance: Foreman.', cat: 'key', icon: 'card', color: 0xff4040 },
  keyBlue: { id: 'keyBlue', name: 'Blue Keycard', desc: 'GloomTech clearance: Research.', cat: 'key', icon: 'card', color: 0x4080ff },
  keyGreen: { id: 'keyGreen', name: 'Green Keycard', desc: 'GloomTech clearance: Agriculture.', cat: 'key', icon: 'card', color: 0x40ff80 },
  valve: { id: 'valve', name: 'Valve Wheel', desc: 'A pump valve handle. Fits standard GloomTech couplings.', cat: 'key', icon: 'valve', color: 0xd08040 },
  uvBulb: { id: 'uvBulb', name: 'UV Lamp Core', desc: 'High-intensity grow-lamp core. The vines hate it.', cat: 'key', icon: 'bulb', color: 0xb070ff },
  thermal: { id: 'thermal', name: 'Thermal Coil', desc: 'A heating element. Still warm. Barely.', cat: 'key', icon: 'coil', color: 0xff8040 },
  labKey: { id: 'labKey', name: 'Specimen Key', desc: 'Opens the containment wing. Someone scratched “E.” into it.', cat: 'key', icon: 'card', color: 0xff5fd2 },
  coreKey: { id: 'coreKey', name: 'Captain’s Key', desc: 'A brass key on a red lanyard. It is warm.', cat: 'key', icon: 'key', color: 0xff2a4a },
};

export interface WeaponDef {
  id: WeaponId;
  name: string;
  kind: 'melee' | 'gun';
  pose: 'melee' | 'pistol' | 'long';
  dmg: number;
  rate: number;
  range: number;
  spreadAim: number;
  spreadHip: number;
  mag: number;
  ammo: ItemId | null;
  reload: number;
  pellets: number;
  auto: boolean;
  noise: number;
  knock: number;
  arc?: number; // melee arc (radians)
  chain?: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pipe: { id: 'pipe', name: 'Lead Pipe', kind: 'melee', pose: 'melee', dmg: 30, rate: 0.5, range: 2.3, spreadAim: 0, spreadHip: 0, mag: 0, ammo: null, reload: 0, pellets: 1, auto: false, noise: 6, knock: 3, arc: 1.9 },
  axe: { id: 'axe', name: 'Fire Axe', kind: 'melee', pose: 'melee', dmg: 62, rate: 0.75, range: 2.5, spreadAim: 0, spreadHip: 0, mag: 0, ammo: null, reload: 0, pellets: 1, auto: false, noise: 6, knock: 5, arc: 1.7 },
  pistol: { id: 'pistol', name: 'GT-9 Warden', kind: 'gun', pose: 'pistol', dmg: 26, rate: 0.26, range: 60, spreadAim: 0.008, spreadHip: 0.05, mag: 12, ammo: 'pistolAmmo', reload: 1.35, pellets: 1, auto: false, noise: 22, knock: 1.2 },
  shotgun: { id: 'shotgun', name: 'Breaker', kind: 'gun', pose: 'long', dmg: 15, rate: 0.85, range: 28, spreadAim: 0.06, spreadHip: 0.1, mag: 6, ammo: 'shells', reload: 2.2, pellets: 9, auto: false, noise: 30, knock: 6 },
  arc: { id: 'arc', name: 'Polaris Arc', kind: 'gun', pose: 'long', dmg: 16, rate: 0.11, range: 26, spreadAim: 0.02, spreadHip: 0.04, mag: 40, ammo: 'cells', reload: 1.9, pellets: 1, auto: true, noise: 26, knock: 0.8, chain: 3 },
};

export interface SkillDef {
  id: SkillId;
  name: string;
  branch: 'Survival' | 'Combat' | 'Mind';
  desc: string;
  max: number;
}
export const SKILLS: SkillDef[] = [
  { id: 'tough', name: 'Toughness', branch: 'Survival', desc: '+20 max health per rank.', max: 3 },
  { id: 'wind', name: 'Second Wind', branch: 'Survival', desc: '+30% stamina regeneration per rank.', max: 2 },
  { id: 'scavenger', name: 'Scavenger', branch: 'Survival', desc: 'Find more ammo and materials in crates.', max: 2 },
  { id: 'steady', name: 'Steady Hands', branch: 'Combat', desc: 'Tighter spread, less recoil per rank.', max: 2 },
  { id: 'heavy', name: 'Heavy Swing', branch: 'Combat', desc: '+25% melee damage per rank. Rank 2 staggers brutes.', max: 2 },
  { id: 'quickhands', name: 'Quick Hands', branch: 'Combat', desc: '25% faster reloads and item use per rank.', max: 2 },
  { id: 'iron', name: 'Iron Will', branch: 'Mind', desc: 'Sanity drains 30% slower per rank.', max: 2 },
  { id: 'silver', name: 'Silver Tongue', branch: 'Mind', desc: '+1 Influence in Deck Trials per rank.', max: 2 },
  { id: 'nighteyes', name: 'Night Eyes', branch: 'Mind', desc: 'Wider, brighter GloomBand light. Reveals Phantoms.', max: 1 },
];

export interface Recipe {
  out: ItemId;
  n: number;
  cost: Partial<Record<ItemId, number>>;
}
export const RECIPES: Recipe[] = [
  { out: 'bandage', n: 1, cost: { cloth: 2 } },
  { out: 'medkit', n: 1, cost: { cloth: 1, chem: 2 } },
  { out: 'pistolAmmo', n: 12, cost: { scrap: 2, chem: 1 } },
  { out: 'shells', n: 4, cost: { scrap: 3, chem: 1 } },
  { out: 'flare', n: 1, cost: { chem: 1, cloth: 1 } },
  { out: 'pipebomb', n: 1, cost: { scrap: 3, chem: 2 } },
  { out: 'pills', n: 1, cost: { chem: 3 } },
];

export const VENDOR: { id: ItemId; n: number; price: number }[] = [
  { id: 'pistolAmmo', n: 15, price: 60 },
  { id: 'shells', n: 6, price: 90 },
  { id: 'cells', n: 20, price: 120 },
  { id: 'medkit', n: 1, price: 140 },
  { id: 'pills', n: 1, price: 80 },
  { id: 'flare', n: 2, price: 50 },
  { id: 'pipebomb', n: 1, price: 110 },
  { id: 'scrap', n: 5, price: 70 },
];

export const UPGRADE_COST = [6, 12, 20];
