import type { LevelDef } from '../LevelDef';
import { HUB } from './hub';
import { CITY } from './city';
import { INDUSTRIAL } from './industrial';
import { LAB } from './lab';
import { AQUATIC } from './aquatic';
import { BIOSPHERE } from './biosphere';
import { CRYO } from './cryo';
import { CORE } from './core';
import { BALLROOM } from './ballroom';

export const LEVELS: Record<string, LevelDef> = {
  hub: HUB,
  city: CITY,
  industrial: INDUSTRIAL,
  lab: LAB,
  aquatic: AQUATIC,
  biosphere: BIOSPHERE,
  cryo: CRYO,
  core: CORE,
  ballroom: BALLROOM,
};
