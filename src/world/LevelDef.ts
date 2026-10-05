import type { CastId } from '../chars/Cast';

export type ThemeId = 'hub' | 'city' | 'industrial' | 'lab' | 'aquatic' | 'biosphere' | 'cryo' | 'core' | 'ballroom';

export type EnemyKind =
  | 'shambler' | 'runner' | 'brute' | 'riot' | 'hound' | 'welder' | 'hauler' | 'bloater' | 'phantom' | 'thinker'
  | 'spitter' | 'diver' | 'creeper' | 'sporer' | 'vinehound' | 'frostbitten' | 'shatterer' | 'cryobrute' | 'farmer' | 'drowned';
export type BossKind = 'gridlock' | 'foreman' | 'subjectZero' | 'leviathan' | 'motherBloom' | 'warden' | 'apex';

export type ItemId =
  | 'pistolAmmo' | 'shells' | 'cells' | 'medkit' | 'bandage' | 'pills' | 'scrap' | 'chem' | 'cloth' | 'flare' | 'pipebomb'
  | 'pistol' | 'shotgun' | 'arc' | 'axe' | 'credits'
  // key items
  | 'fuse' | 'keyRed' | 'keyBlue' | 'keyGreen' | 'valve' | 'uvBulb' | 'thermal' | 'labKey' | 'coreKey';

export type HazardKind = 'steam' | 'laser' | 'electric' | 'spore' | 'press' | 'conveyor' | 'acid' | 'cold' | 'fire';

export type EntSpec =
  | { t: 'player' }
  | { t: 'spawn'; id: string; yaw?: number }
  | { t: 'enemy'; kind: EnemyKind; id?: string; dormant?: boolean; wake?: string; yaw?: number; elite?: boolean }
  | { t: 'boss'; kind: BossKind; id?: string }
  | { t: 'item'; item: ItemId; n?: number; id?: string }
  | { t: 'crate'; id?: string; loot?: [ItemId, number][] }
  | { t: 'gloomy'; id: string }
  | { t: 'log'; id: string }
  | { t: 'evidence'; id: string; flag?: string }
  | { t: 'save'; id: string }
  | { t: 'npc'; who: CastId; id?: string; pose?: string; yaw?: number; talk?: string; follow?: boolean }
  | { t: 'prop'; kind: string; yaw?: number; opts?: any; dx?: number; dz?: number; solid?: boolean }
  | { t: 'light'; color: number; intensity?: number; range?: number; y?: number; flicker?: number; model?: boolean }
  | { t: 'door'; id?: string; key?: ItemId; flag?: string; msg?: string; auto?: boolean }
  | { t: 'trigger'; id: string; r?: number; once?: boolean }
  | { t: 'switch'; id: string; flag: string; label?: string; model?: 'lever' | 'valve' | 'button' | 'fusebox' | 'panel'; needs?: ItemId; needsN?: number; yaw?: number; msg?: string }
  | { t: 'terminal'; id: string; flag: string; diff?: number; label?: string; yaw?: number; text?: string }
  | { t: 'hazard'; kind: HazardKind; id?: string; dir?: number; period?: number; offset?: number; flag?: string; len?: number }
  | { t: 'exit'; to: string; spawn: string; label: string; flag?: string; yaw?: number }
  | { t: 'station'; kind: 'workbench' | 'vendor' | 'medbay' | 'bed' | 'board'; yaw?: number }
  | { t: 'scatter' };

export interface LevelDef {
  id: string;
  name: string;
  theme: ThemeId;
  map: string[];
  legend: Record<string, EntSpec | EntSpec[] | { floor: string; ent?: EntSpec | EntSpec[] }>;
  /** Optional per-level overrides */
  music?: string;
  seed?: number;
  /** cell coords of the Polaris beam (hub/core) */
  beam?: [number, number];
}
