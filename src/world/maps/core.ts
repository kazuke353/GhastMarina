import { MapGrid } from './MapGrid';
import type { LevelDef } from '../LevelDef';

// The Polaris Core: a circular platform around the reactor, suspended over the frozen sea.
const m = new MapGrid(46, 46, ' ');
const cx = 22, cy = 20;
for (let y = 0; y < 46; y++)
  for (let x = 0; x < 46; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d <= 12.5) m.set(x, y, d > 10.5 ? ',' : d < 4 ? ';' : '.');
  }
// lift bridge (south) and lifeboat dock (east)
m.fill(20, 32, 24, 42, ';');
m.fill(34, 18, 42, 22, ';');
// cover
for (const [x, y] of [[15, 13], [29, 13], [15, 27], [29, 27], [12, 20], [32, 20], [22, 10]] as [number, number][]) m.set(x, y, '@');
m.set(22, 20, 'R');
// entities
m.put(22, 40, 'P').put(22, 41, 's').put(22, 35, 'S');
m.put(22, 12, 'c').put(22, 26, 'a').put(39, 20, 'L').put(37, 20, 'b').put(21, 14, 'G');
m.put(16, 20, 'w').put(28, 20, 'w').put(22, 30, 'w').put(18, 15, 'w').put(26, 25, 'w');
m.put(17, 24, 'C').put(27, 16, 'C').put(24, 33, '1').put(13, 17, '2').put(31, 23, '3');
for (const [x, y] of [[13, 13], [31, 13], [13, 27], [31, 27], [22, 9], [22, 31], [10, 20], [34, 20], [22, 38], [40, 20]] as [number, number][]) {
  const c = m.get(x, y);
  if (c !== ' ' && c !== '@') m.set(x, y, c === ',' ? '!' : c === ';' ? '?' : 'l');
}

export const CORE: LevelDef = {
  id: 'core',
  name: 'Polaris Core',
  theme: 'core',
  map: m.rows(),
  beam: [22.5, 20.5],
  legend: {
    P: { floor: ';', ent: { t: 'player' } },
    s: { floor: ';', ent: { t: 'spawn', id: 'lift' } },
    S: { floor: ';', ent: { t: 'save', id: 'core_s' } },
    R: { floor: ';', ent: { t: 'prop', kind: 'reactor' } },
    c: { floor: '.', ent: { t: 'spawn', id: 'captain' } },
    a: { floor: '.', ent: { t: 'spawn', id: 'arena' } },
    L: { floor: ';', ent: { t: 'spawn', id: 'lifeboat' } }, // the boat itself is built (and launched) by the ch8 script
    b: { floor: ';', ent: { t: 'spawn', id: 'dock' } },
    G: { floor: '.', ent: { t: 'boss', kind: 'apex' } },
    w: { floor: '.', ent: { t: 'prop', kind: 'barrel', opts: { toxic: true } } },
    C: { floor: '.', ent: { t: 'crate' } },
    '1': { floor: ';', ent: { t: 'log', id: 'core_log1' } },
    '2': { floor: '.', ent: { t: 'log', id: 'core_log2' } },
    '3': { floor: '.', ent: { t: 'log', id: 'core_log3' } },
    l: { floor: '.', ent: { t: 'light', color: 0x60e0ff, intensity: 18, range: 14 } },
    '!': { floor: ',', ent: { t: 'light', color: 0x60e0ff, intensity: 18, range: 14 } },
    '?': { floor: ';', ent: { t: 'light', color: 0x60e0ff, intensity: 18, range: 14 } },
  },
};
