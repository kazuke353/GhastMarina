import type { CastId } from '../chars/Cast';
import type { ItemId } from '../world/LevelDef';
import { safeGet, safeSet, safeRemove } from '../core/Settings';

export type WeaponId = 'pipe' | 'axe' | 'pistol' | 'shotgun' | 'arc';
export type SkillId =
  | 'tough' | 'wind' | 'scavenger'
  | 'steady' | 'heavy' | 'quickhands'
  | 'iron' | 'silver' | 'nighteyes';

export interface Message {
  from: string;
  text: string;
  t: number;
  read?: boolean;
}

export interface GameState {
  version: number;
  chapter: string;
  level: string;
  spawn: string;
  pos: [number, number] | null;
  yaw: number;
  flags: Record<string, boolean | number | string>;
  alive: Record<string, boolean>;
  hp: number;
  maxHp: number;
  sanity: number;
  inv: Partial<Record<ItemId, number>>;
  weapons: Partial<Record<WeaponId, boolean>>;
  mag: Partial<Record<WeaponId, number>>;
  upgrades: Partial<Record<WeaponId, { dmg: number; mag: number; reload: number }>>;
  equipped: WeaponId;
  lastGun: WeaponId | null;
  skills: Partial<Record<SkillId, number>>;
  insight: number;
  evidence: string[];
  logs: string[];
  gloomy: string[];
  messages: Message[];
  journal: { t: string; text: string }[];
  credits: number;
  viewers: number;
  killed: string[];
  picked: string[];
  suspicion: number;
  conscience: number;
  mask: number;
  playTime: number;
  difficulty: 'story' | 'survivor' | 'nightmare';
  deaths: number;
  kills: number;
  savedAt: number;
}

export function newState(difficulty: GameState['difficulty'] = 'survivor'): GameState {
  return {
    version: 1,
    chapter: 'prologue',
    level: 'hub',
    spawn: 'container',
    pos: null,
    yaw: 0,
    flags: {},
    alive: { noah: true, elise: true, leo: true, aria: true, dexter: true, fiona: true, grant: true, hana: true, isaac: true, jade: true, kai: true, luna: true },
    hp: 100,
    maxHp: 100,
    sanity: 100,
    inv: { bandage: 1 },
    weapons: { pipe: true },
    mag: {},
    upgrades: {},
    equipped: 'pipe',
    lastGun: null,
    skills: {},
    insight: 0,
    evidence: [],
    logs: [],
    gloomy: [],
    messages: [],
    journal: [],
    credits: 0,
    viewers: 1200,
    killed: [],
    picked: [],
    suspicion: 10,
    conscience: 0,
    mask: 0,
    playTime: 0,
    difficulty,
    deaths: 0,
    kills: 0,
    savedAt: 0,
  };
}

const SLOT = 'ghastmarina.save.v1';
const CHAPTERS = 'ghastmarina.chapters.v1';

export function saveGame(s: GameState) {
  s.savedAt = Date.now();
  safeSet(SLOT, JSON.stringify(s));
  // unlock chapter select
  const ch = unlockedChapters();
  if (!ch.includes(s.chapter)) {
    ch.push(s.chapter);
    safeSet(CHAPTERS, JSON.stringify(ch));
  }
}
export function loadGame(): GameState | null {
  try {
    const raw = safeGet(SLOT);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (!s || s.version !== 1) return null;
    return { ...newState(), ...s };
  } catch {
    return null;
  }
}
export function hasSave() {
  return !!safeGet(SLOT);
}
export function deleteSave() {
  safeRemove(SLOT);
}
export function unlockedChapters(): string[] {
  try {
    return JSON.parse(safeGet(CHAPTERS) || '[]');
  } catch {
    return [];
  }
}
export function unlockChapter(id: string) {
  const ch = unlockedChapters();
  if (!ch.includes(id)) {
    ch.push(id);
    safeSet(CHAPTERS, JSON.stringify(ch));
  }
}

export const ALIVE_ORDER: CastId[] = ['noah', 'elise', 'leo', 'aria', 'dexter', 'fiona', 'grant', 'hana', 'isaac', 'jade', 'kai', 'luna'];
