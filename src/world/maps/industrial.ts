import { MapGrid } from './MapGrid';
import type { LevelDef, EntSpec } from '../LevelDef';

const m = new MapGrid(48, 38, '#');
// dock (start)
m.fill(2, 30, 10, 36, ';');
m.fill(5, 22, 7, 29, '.');
// assembly hall
m.fill(2, 9, 22, 21, '.');
m.fill(2, 9, 22, 9, ',').fill(2, 21, 22, 21, ',');
// foreman's office
m.fill(9, 2, 16, 7, ';');
m.set(12, 8, '+');
// armory (red keycard)
m.fill(24, 9, 30, 14, ';');
m.set(23, 11, 'K');
// furnace room
m.fill(32, 2, 46, 14, '.');
m.fill(32, 2, 46, 3, ',');
m.set(31, 12, '+');
// storage
m.fill(12, 24, 22, 36, ';');
m.set(11, 33, '+').set(17, 23, '+');
m.fill(17, 22, 17, 22, '.');
// boiler corridor
m.fill(23, 28, 29, 29, ',');
// boss arena
m.fill(31, 18, 46, 36, '.');
m.fill(31, 18, 46, 19, '_').fill(31, 35, 46, 36, '_');
m.set(30, 28, 'D').set(30, 29, '#');
m.put(35, 23, '@').put(42, 23, '@').put(35, 31, '@').put(42, 31, '@');
// ---- entities ----
m.put(4, 33, 'P').put(2, 36, 'X').put(45, 35, 'E');
m.put(8, 31, 'S').put(26, 29, 'S');
// hazards
m.put(3, 12, 'v').put(21, 17, 'w');
for (const x of [6, 10, 14, 18]) m.set(x, 14, 'p');
for (const [x, y] of [[4, 19], [10, 19], [16, 19], [25, 28], [28, 29], [6, 25]] as [number, number][]) m.set(x, y, 's');
// furnace switches & machines
m.put(34, 3, '1').put(39, 3, '2').put(44, 3, '3');
m.put(34, 6, 'F').put(39, 6, 'F').put(44, 6, 'F');
// items
m.put(14, 3, 'k').put(20, 35, 'V').put(29, 10, 'G').put(25, 13, 'h').put(45, 13, 'A');
m.put(13, 4, '4').put(21, 25, '5').put(45, 9, '6');
m.put(10, 4, 'C').put(28, 13, 'C').put(13, 35, 'C').put(33, 13, 'C').put(21, 10, 'C');
m.put(3, 20, 'a').put(19, 27, 'b').put(40, 9, 'c').put(9, 35, 'd');
m.put(4, 10, 'g').put(16, 6, 'i').put(22, 33, 'j').put(46, 2, 'n').put(27, 28, 'o');
// enemies
m.put(8, 11, 'z').put(15, 11, 'z').put(19, 13, 'W').put(5, 17, 'z').put(12, 18, 'W').put(20, 20, 'r').put(9, 20, 'B');
m.put(6, 24, 'Z').put(10, 3, 'W').put(15, 5, 'z');
m.put(14, 27, 'H').put(20, 30, 'z').put(16, 33, 'W').put(13, 30, 'Z').put(21, 26, 'B');
m.put(26, 10, 'W').put(28, 12, 'z');
m.put(36, 8, 'H').put(42, 10, 'W').put(38, 12, 'r').put(33, 9, 'z').put(45, 6, 'W').put(40, 2, 'Z');
m.put(24, 29, 'r');
// arena boss & trigger
m.put(39, 27, 'O').put(34, 28, 'u');
m.put(16, 15, 'T');
// props
m.sprinkle(2, 9, 22, 21, 'm', 6, '.', 31).sprinkle(12, 24, 22, 36, 'q', 10, ';', 32).sprinkle(2, 30, 10, 36, 'q', 5, ';', 33);
m.sprinkle(32, 4, 46, 14, 'q', 5, '.', 34).sprinkle(31, 20, 46, 34, 'Q', 6, '.', 35);
m.put(2, 30, 'Y').put(10, 36, 'Y').put(23, 9, 'y');
for (const [x, y] of [[5, 11], [12, 11], [19, 11], [5, 17], [12, 17], [19, 20], [6, 33], [9, 30], [6, 26], [12, 4], [16, 26], [20, 33], [14, 31], [27, 11], [35, 10], [41, 7], [45, 11], [26, 28], [34, 21], [43, 21], [34, 33], [43, 33], [38, 27]] as [number, number][])
  if (m.get(x, y) === '.' || m.get(x, y) === ';' || m.get(x, y) === ',') m.set(x, y, m.get(x, y) === ';' ? 'L' : m.get(x, y) === ',' ? 'M' : 'l');

const en = (kind: any, extra: Partial<EntSpec> = {}) => ({ t: 'enemy', kind, ...extra }) as EntSpec;

export const INDUSTRIAL: LevelDef = {
  id: 'industrial',
  name: 'Industrial Complex Vessel',
  theme: 'industrial',
  map: m.rows(),
  legend: {
    P: { floor: ';', ent: { t: 'player' } },
    X: { floor: ';', ent: { t: 'exit', to: 'hub', spawn: 'gate_ind', label: 'Polaris Gangway' } },
    E: { floor: '.', ent: { t: 'exit', to: 'hub', spawn: 'gate_ind', label: 'Return to Polaris', flag: 'boss_foreman_dead' } },
    S: { floor: ';', ent: { t: 'save', id: 'ind_s' } },
    K: { floor: ';', ent: { t: 'door', id: 'armory', key: 'keyRed' } },
    D: { floor: ',', ent: { t: 'door', id: 'arena', flag: 'furnace_lit', msg: 'Sealed. “LINE 7 OFFLINE — RELIGHT FURNACES TO RESUME SHIFT.”' } },
    v: { floor: '.', ent: { t: 'hazard', kind: 'conveyor', yaw: 90, len: 8 } as any },
    w: { floor: '.', ent: { t: 'hazard', kind: 'conveyor', yaw: -90, len: 8 } as any },
    p: { floor: '.', ent: { t: 'hazard', kind: 'press', period: 3.6, yaw: 0 } as any },
    s: { floor: '.', ent: { t: 'hazard', kind: 'steam', period: 4.5 } },
    '1': { floor: ',', ent: { t: 'switch', id: 'furnace1', flag: 'furnace1', label: 'Attach Valve & Open Gas', model: 'valve', needs: 'valve', msg: 'The gas valve is missing its wheel.' } },
    '2': { floor: ',', ent: { t: 'switch', id: 'furnace2', flag: 'furnace2', label: 'Ignite Furnace 2', model: 'lever' } },
    '3': { floor: ',', ent: { t: 'switch', id: 'furnace3', flag: 'furnace3', label: 'Ignite Furnace 3', model: 'lever' } },
    F: { floor: '.', ent: [{ t: 'prop', kind: 'machine', opts: { w: 3, d: 2.4, h: 4, color: 0x5a3a2a } }, { t: 'light', color: 0xff6a20, intensity: 18, range: 10, model: false, y: 2, flicker: 0.4 }] },
    k: { floor: ';', ent: { t: 'item', item: 'keyRed', id: 'keyRed' } },
    V: { floor: ';', ent: [{ t: 'item', item: 'valve', id: 'valve' }] },
    G: { floor: ';', ent: { t: 'item', item: 'shotgun', id: 'shotgun' } },
    h: { floor: ';', ent: { t: 'item', item: 'shells', n: 6 } },
    A: { floor: '.', ent: { t: 'item', item: 'axe', id: 'axe' } },
    '4': { floor: ';', ent: { t: 'log', id: 'ind_log1' } },
    '5': { floor: ';', ent: { t: 'log', id: 'ind_log2' } },
    '6': { floor: '.', ent: { t: 'log', id: 'ind_log3' } },
    C: { floor: ';', ent: { t: 'crate' } },
    a: { floor: ',', ent: { t: 'item', item: 'pistolAmmo', n: 12 } },
    b: { floor: ';', ent: { t: 'item', item: 'chem', n: 2 } },
    c: { floor: '.', ent: { t: 'item', item: 'medkit', n: 1 } },
    d: { floor: ';', ent: { t: 'item', item: 'scrap', n: 4 } },
    g: { floor: '.', ent: { t: 'gloomy', id: 'g_ind1' } },
    i: { floor: ';', ent: { t: 'gloomy', id: 'g_ind2' } },
    j: { floor: ';', ent: { t: 'gloomy', id: 'g_ind3' } },
    n: { floor: ',', ent: { t: 'gloomy', id: 'g_ind4' } },
    o: { floor: ',', ent: { t: 'gloomy', id: 'g_ind5' } },
    z: { floor: '.', ent: en('shambler') },
    Z: { floor: ';', ent: en('shambler') },
    W: { floor: '.', ent: en('welder') },
    H: { floor: ';', ent: en('hauler') },
    r: { floor: '.', ent: en('runner') },
    B: { floor: '.', ent: en('bloater') },
    O: { floor: '.', ent: { t: 'boss', kind: 'foreman' } },
    u: { floor: '.', ent: { t: 'trigger', id: 'boss_foreman', r: 1.5 } },
    T: { floor: '.', ent: { t: 'trigger', id: 'press_scene', r: 2 } },
    m: { floor: '.', ent: { t: 'prop', kind: 'machine' } },
    q: { floor: ';', ent: { t: 'scatter' } },
    Q: { floor: '.', ent: { t: 'prop', kind: 'barrel' } },
    Y: { floor: ';', ent: { t: 'prop', kind: 'tank', opts: { r: 1.2, h: 4 } } },
    y: { floor: '.', ent: { t: 'prop', kind: 'generator' } },
    l: { floor: '.', ent: { t: 'light', color: 0xffa050, intensity: 22, range: 13 } },
    L: { floor: ';', ent: { t: 'light', color: 0xffa050, intensity: 22, range: 13 } },
    M: { floor: ',', ent: { t: 'light', color: 0xffa050, intensity: 22, range: 13 } },
  },
};
