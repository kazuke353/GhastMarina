import { MapGrid } from './MapGrid';
import type { LevelDef, EntSpec } from '../LevelDef';

// Open-air greenhouse vessel. '#' = hedge walls (leafy), '&' = bark/root walls.
const m = new MapGrid(46, 42, ' ');
m.fill(1, 1, 44, 40, '.');
// outer hedge ring (leaves a promenade along the deck edge)
// hedge maze sections
m.fill(4, 4, 41, 4, '#').fill(4, 4, 4, 37, '#').fill(41, 4, 41, 37, '#').fill(4, 37, 41, 37, '#');
m.set(4, 20, '.').set(4, 21, '.');
// crop fields (soil) west
m.fill(5, 5, 18, 18, ',');
for (const y of [7, 10, 13, 16]) m.fill(6, y, 17, y, 'c');
// orchard east
m.fill(27, 5, 40, 18, '.');
// inner hedge walls dividing zones
m.fill(19, 5, 19, 26, '#').fill(26, 5, 26, 26, '#');
m.set(19, 11, 'V').set(26, 11, 'W').set(19, 22, '.').set(26, 22, '.');
m.fill(5, 19, 18, 19, '#').fill(27, 19, 40, 19, '#');
m.set(11, 19, '.').set(12, 19, '.').set(33, 19, '.');
// seed vault (bark walls)
m.room(5, 27, 14, 36, ';', '&');
m.set(9, 27, 'U');
// kennel (bark walls)
m.room(31, 27, 40, 36, ';', '&');
m.set(35, 27, '+');
// central dome — Mother Bloom
m.fill(20, 5, 25, 26, ';');
m.fill(15, 27, 30, 36, ';');
m.fill(15, 27, 15, 36, '#').fill(30, 27, 30, 36, '#').fill(15, 27, 30, 27, '#');
// moss & paths
m.sprinkle(5, 20, 40, 26, ';', 30, '.', 61);
// ---- entities ----
m.put(2, 21, 'P').put(1, 22, 'X').put(28, 35, 'E');
m.put(3, 24, 'S').put(12, 22, 'S').put(36, 22, 'S').put(21, 25, 'S');
// UV lamps puzzle: vine barriers V/W and the dome gate Y
m.set(22, 27, 'Y');
m.put(8, 6, '1').put(37, 6, '2').put(9, 34, '3');
m.put(16, 17, 'u').put(29, 17, 'v').put(38, 34, 'w');
// spore pods
for (const [x, y] of [[10, 21], [24, 21], [34, 24], [7, 25], [16, 24], [29, 25], [8, 12], [35, 12]] as [number, number][]) m.set(x, y, 'p');
// evidence & logs
m.put(7, 35, 'F').put(13, 28, 'f').put(39, 35, 'K');
m.put(6, 29, 'L').put(35, 9, 'M').put(16, 5, 'N');
// items
m.put(12, 35, 'G').put(38, 28, 'k');
m.put(10, 9, 'C').put(34, 15, 'C').put(28, 23, 'C').put(5, 22, 'C').put(40, 26, 'C');
m.put(17, 21, 'a').put(30, 21, 'b').put(9, 28, 'd').put(33, 7, 'e');
m.put(2, 38, 'g').put(43, 3, 'h').put(18, 6, 'i').put(39, 18, 'j').put(5, 30, 'o');
// enemies (creepers are disguised as bushes)
m.put(9, 21, 'Q').put(15, 23, 'Q').put(28, 21, 'Q').put(37, 24, 'Q').put(23, 23, 'Q').put(8, 15, 'Q').put(30, 8, 'Q').put(38, 15, 'Q');
m.put(12, 8, 'z').put(15, 14, 'z').put(31, 12, 'z').put(36, 16, 'z').put(10, 24, 'z').put(33, 25, 'z');
m.put(9, 30, 'O').put(12, 33, 'r').put(34, 29, 'H').put(37, 32, 'H').put(36, 34, 'H');
m.put(22, 14, 'B').put(23, 8, 'z').put(2, 20, 'H').put(43, 30, 'H').put(25, 2, 'z').put(30, 38, 'z');
// boss
m.put(22, 32, 'D').put(22, 29, 'T');
// props
m.sprinkle(27, 5, 40, 18, 'R', 12, '.', 62).sprinkle(1, 1, 44, 3, 'R', 8, '.', 63).sprinkle(1, 38, 44, 40, 'R', 6, '.', 64);
m.sprinkle(5, 20, 40, 26, 'b', 10, '.', 65).sprinkle(16, 28, 29, 35, 'n', 5, ';', 66).sprinkle(5, 5, 18, 18, 'Z', 3, ',', 67);
for (const [x, y] of [[11, 3], [33, 3], [2, 12], [43, 12], [2, 30], [43, 30], [12, 39], [33, 39], [12, 20], [33, 20], [22, 20], [8, 23], [37, 23], [22, 10], [23, 17], [10, 31], [35, 30], [18, 29], [27, 33], [22, 29]] as [number, number][]) {
  const c = m.get(x, y);
  if (c === '.' || c === ';' || c === ',') m.set(x, y, c === '.' ? 'l' : c === ';' ? '!' : '?');
}

const en = (kind: any, extra: Partial<EntSpec> = {}) => ({ t: 'enemy', kind, ...extra }) as EntSpec;

export const BIOSPHERE: LevelDef = {
  id: 'biosphere',
  name: 'Agricultural Biosphere Vessel',
  theme: 'biosphere',
  map: m.rows(),
  legend: {
    P: { t: 'player' },
    X: { t: 'exit', to: 'hub', spawn: 'gate_bio', label: 'Polaris Gangway' },
    E: { floor: ';', ent: { t: 'exit', to: 'hub', spawn: 'gate_bio', label: 'Return to Polaris', flag: 'boss_motherBloom_dead' } },
    S: { floor: ';', ent: { t: 'save', id: 'bio_s' } },
    V: { floor: ';', ent: { t: 'door', id: 'vineW', flag: 'uv1', msg: 'A wall of thorned vines. They recoil from UV light.' } },
    W: { floor: ';', ent: { t: 'door', id: 'vineE', flag: 'uv2', msg: 'A wall of thorned vines. They recoil from UV light.' } },
    Y: { floor: ';', ent: { t: 'door', id: 'domeGate', flag: 'uv3', msg: 'The dome is sealed by roots thick as pipes. Only intense UV will burn through.' } },
    U: { floor: ';', ent: { t: 'door', id: 'vault', key: 'keyGreen' } },
    '1': { floor: ',', ent: [{ t: 'switch', id: 'uvlamp1', flag: 'uv1', label: 'Install UV Core (West Lamp)', model: 'panel', needs: 'uvBulb' }, { t: 'prop', kind: 'uvLamp', dx: 1.2 }] },
    '2': { floor: '.', ent: [{ t: 'switch', id: 'uvlamp2', flag: 'uv2', label: 'Install UV Core (East Lamp)', model: 'panel', needs: 'uvBulb' }, { t: 'prop', kind: 'uvLamp', dx: -1.2 }] },
    '3': { floor: ';', ent: [{ t: 'switch', id: 'uvlamp3', flag: 'uv3', label: 'Install UV Core (Dome Array)', model: 'panel', needs: 'uvBulb' }, { t: 'prop', kind: 'uvLamp', dx: 1.2 }] },
    u: { floor: ',', ent: { t: 'item', item: 'uvBulb', id: 'uv_a' } },
    v: { floor: '.', ent: { t: 'item', item: 'uvBulb', id: 'uv_b' } },
    w: { floor: ';', ent: { t: 'item', item: 'uvBulb', id: 'uv_c' } },
    k: { floor: ';', ent: { t: 'item', item: 'keyGreen', id: 'keyGreen' } },
    p: { t: 'hazard', kind: 'spore' },
    F: { floor: ';', ent: { t: 'evidence', id: 'spore_vial' } },
    f: { floor: ';', ent: { t: 'log', id: 'bio_log2' } },
    K: { floor: ';', ent: { t: 'trigger', id: 'kennel', r: 1.4 } },
    L: { floor: ';', ent: { t: 'log', id: 'bio_log1' } },
    M: { t: 'log', id: 'bio_log3' },
    N: { floor: ',', ent: { t: 'trigger', id: 'bio_intro', r: 2 } },
    G: { floor: ';', ent: { t: 'item', item: 'medkit', n: 1 } },
    C: { t: 'crate' },
    a: { t: 'item', item: 'shells', n: 6 },
    b: { t: 'prop', kind: 'bush', solid: false },
    d: { floor: ';', ent: { t: 'item', item: 'cells', n: 25 } },
    e: { t: 'item', item: 'flare', n: 2 },
    g: { t: 'gloomy', id: 'g_bio1' },
    h: { t: 'gloomy', id: 'g_bio2' },
    i: { floor: ',', ent: { t: 'gloomy', id: 'g_bio3' } },
    j: { t: 'gloomy', id: 'g_bio4' },
    o: { floor: ';', ent: { t: 'gloomy', id: 'g_bio5' } },
    Q: { t: 'enemy', kind: 'creeper' },
    z: { t: 'enemy', kind: 'farmer' },
    O: { floor: ';', ent: en('sporer') },
    B: { floor: ';', ent: en('sporer') },
    r: { floor: ';', ent: en('farmer') },
    H: { floor: ';', ent: en('vinehound') },
    D: { floor: ';', ent: { t: 'boss', kind: 'motherBloom' } },
    T: { floor: ';', ent: { t: 'trigger', id: 'boss_motherBloom', r: 1.6 } },
    c: { floor: ',', ent: { t: 'prop', kind: 'crops', solid: false } },
    R: { t: 'prop', kind: 'tree' },
    Z: { floor: ',', ent: { t: 'prop', kind: 'giantFlower' } },
    n: { floor: ';', ent: { t: 'prop', kind: 'giantFlower', opts: { color: 0xc04080 } } },
    l: { t: 'light', color: 0xb070ff, intensity: 18, range: 13 },
    '!': { floor: ';', ent: { t: 'light', color: 0xb070ff, intensity: 18, range: 13 } },
    '?': { floor: ',', ent: { t: 'light', color: 0xb070ff, intensity: 18, range: 13 } },
  },
};
