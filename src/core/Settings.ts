export interface SettingsData {
  sensitivity: number; // 0.2..3
  invertY: boolean;
  fov: number;
  master: number;
  music: number;
  sfx: number;
  voice: number;
  quality: 'low' | 'medium' | 'high';
  textSpeed: number; // chars/sec multiplier 0.5..3
  shake: number; // 0..1
  outlines: boolean;
  grain: boolean;
  showHints: boolean;
  difficulty: 'story' | 'survivor' | 'nightmare';
}

const DEFAULTS: SettingsData = {
  sensitivity: 1,
  invertY: false,
  fov: 70,
  master: 0.8,
  music: 0.6,
  sfx: 0.85,
  voice: 0.6,
  quality: 'medium',
  textSpeed: 1,
  shake: 1,
  outlines: true,
  grain: true,
  showHints: true,
  difficulty: 'survivor',
};

const KEY = 'ghastmarina.settings.v1';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* storage unavailable */
  }
}
export function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}
export { safeGet, safeSet };

export class Settings {
  data: SettingsData;
  listeners: ((s: SettingsData) => void)[] = [];
  constructor() {
    let d: Partial<SettingsData> = {};
    try {
      d = JSON.parse(safeGet(KEY) || '{}');
    } catch {
      d = {};
    }
    this.data = { ...DEFAULTS, ...d };
    if (!safeGet(KEY)) {
      // pick sensible default quality from device
      const lowEnd = (navigator.hardwareConcurrency || 4) <= 4 || /Mobi|Android/i.test(navigator.userAgent);
      this.data.quality = lowEnd ? 'low' : 'medium';
    }
  }
  set<K extends keyof SettingsData>(k: K, v: SettingsData[K]) {
    this.data[k] = v;
    safeSet(KEY, JSON.stringify(this.data));
    for (const l of this.listeners) l(this.data);
  }
  onChange(fn: (s: SettingsData) => void) {
    this.listeners.push(fn);
  }
  reset() {
    this.data = { ...DEFAULTS };
    safeSet(KEY, JSON.stringify(this.data));
    for (const l of this.listeners) l(this.data);
  }
}
