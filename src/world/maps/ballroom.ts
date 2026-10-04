import { MapGrid } from './MapGrid';
import type { LevelDef } from '../LevelDef';

const m = new MapGrid(24, 24, '#');
m.fill(1, 1, 22, 22, '.');
for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) if (Math.hypot(x - 11.5, y - 12.5) < 6.5 && m.get(x, y) === '.') m.set(x, y, ',');
m.fill(2, 1, 21, 1, ';');
m.put(11, 12, 'c').put(11, 2, 'T').put(11, 4, 'k');
m.put(6, 6, 'L').put(17, 6, 'L').put(6, 18, 'L').put(17, 18, 'L').put(11, 12, 'c');
m.put(3, 3, 'p').put(20, 3, 'p').put(3, 21, 'p').put(20, 21, 'p');
m.put(11, 21, 'x');

export const BALLROOM: LevelDef = {
  id: 'ballroom',
  name: 'The Ballroom',
  theme: 'ballroom',
  map: m.rows(),
  legend: {
    c: { floor: ',', ent: [{ t: 'spawn', id: 'center' }, { t: 'prop', kind: 'chandelier', opts: { y: 7.5 }, solid: false }] },
    T: { floor: ';', ent: { t: 'prop', kind: 'throne', solid: false } },
    k: { floor: '.', ent: { t: 'spawn', id: 'captain' } },
    L: { floor: '.', ent: { t: 'prop', kind: 'chandelier', opts: { y: 7 }, solid: false } },
    p: { floor: '.', ent: { t: 'prop', kind: 'gloomyCluster', opts: { n: 6, scale: 1.4 }, solid: false } },
    x: { floor: '.', ent: { t: 'spawn', id: 'door' } },
  },
};
