import { MapGrid } from './MapGrid';
import type { LevelDef } from '../LevelDef';

const m = new MapGrid(40, 38, ' ');
// deck
m.fill(1, 1, 38, 36, '.');
// spire (beam emitter)
m.fill(16, 2, 21, 5, '&');
// superstructure
m.room(4, 9, 35, 33, ';');
// hall
m.fill(13, 10, 26, 22, ',');
m.vline(12, 10, 22, '#');
m.vline(27, 10, 22, '#');
// west wing
m.hline(5, 11, 16, '#');
// east wing
m.hline(28, 34, 16, '#');
m.fill(28, 17, 34, 22, ',');
// south band
m.hline(5, 34, 23, '#');
m.fill(5, 24, 11, 32, ',');
m.vline(12, 23, 33, '#');
m.vline(27, 23, 33, '#');
m.fill(13, 24, 26, 25, ';');
m.hline(13, 26, 26, '#');
m.vline(16, 26, 32, '#');
m.vline(20, 26, 32, '#');
m.vline(24, 26, 32, '#');
// doors
for (const [x, y] of [[8, 9], [19, 9], [20, 9], [31, 9], [12, 13], [8, 16], [12, 19], [27, 12], [31, 16], [27, 20], [8, 23], [19, 23], [20, 23], [31, 23], [14, 26], [18, 26], [22, 26], [25, 26], [4, 19], [35, 20], [8, 33], [31, 33]] as [number, number][])
  m.set(x, y, '+');
// ---- entities ----
// exits
m.put(2, 1, 'Y').put(37, 1, 'C').put(38, 13, 'I').put(38, 28, 'L').put(1, 28, 'Q').put(1, 13, 'B').put(18, 6, 'Z').put(26, 24, 'T');
// return spawns
m.put(3, 2, 'y').put(36, 2, 'k').put(37, 13, 'j').put(37, 28, 'n').put(2, 28, 'q').put(2, 13, 'b').put(18, 7, 'z').put(25, 25, 't');
// container spawn & deck spawn
m.put(9, 3, 'a').put(12, 7, 'd');
// hall
m.put(19, 16, 'H').put(14, 11, 'S').put(16, 10, 'O').put(22, 10, 'O').put(17, 19, 'h');
m.put(25, 11, '[');
// stations
m.put(5, 13, 'M').put(5, 21, 'W').put(34, 18, 'V').put(18, 32, 'R').put(17, 29, 'r');
// mess tables / lounge
m.put(30, 11, 'e').put(33, 11, 'e').put(30, 14, 'e').put(33, 14, 'e');
m.put(29, 22, 'f').put(32, 22, 'f').put(29, 21, ']');
// chapel benches
for (const y of [26, 28, 30]) m.put(7, y, 'v').put(10, y, 'v');
m.put(8, 32, 'G');
// cargo
m.put(29, 25, '*').put(33, 25, '*').put(29, 27, 'x').put(34, 27, '*').put(30, 32, '*');
// quarters (decor beds)
m.put(14, 31, 'u').put(22, 31, 'u');
// medbay / workshop decor
m.put(9, 11, 'm').put(10, 21, 's');
// deck containers & crane
m.put(6, 6, 'X').put(29, 4, 'X').put(33, 6, 'X').put(3, 34, 'X').put(35, 35, 'X');
m.put(26, 3, 'K').put(13, 34, 'A');
m.put(24, 34, '{');
// deck lights
for (const [x, y] of [[4, 4], [13, 3], [24, 2], [35, 4], [9, 8], [28, 8], [2, 20], [37, 20], [2, 33], [37, 33], [18, 35], [24, 6]] as [number, number][]) m.set(x, y, '!');
// interior lights
for (const [x, y] of [[15, 13], [23, 13], [15, 20], [23, 20], [19, 11], [30, 19], [33, 20], [8, 27], [8, 31]] as [number, number][]) m.set(x, y, '?');
for (const [x, y] of [[8, 12], [8, 19], [30, 12], [33, 13], [30, 28], [33, 30], [15, 24], [24, 25], [14, 28], [18, 28], [22, 28]] as [number, number][]) m.set(x, y, ':');
// npc spots
m.put(5, 8, '4').put(24, 7, '7').put(34, 8, '0').put(7, 11, '1').put(8, 20, '8').put(16, 13, '3').put(31, 13, '5').put(30, 19, '6').put(33, 21, '2').put(32, 29, '9').put(7, 25, '$');
// evidence spots
m.put(33, 31, '^').put(5, 24, '<').put(28, 18, '>').put(14, 30, '/').put(37, 35, '\\');
// gloomy deco
m.put(3, 7, 'G').put(36, 9, 'G').put(21, 36, 'G').put(26, 12, 'G').put(13, 21, 'G');
// scatter
m.sprinkle(2, 10, 3, 35, 'w', 6, '.', 3).sprinkle(36, 10, 37, 35, 'w', 6, '.', 5).sprinkle(5, 34, 34, 36, 'w', 5, '.', 7);

const sp = (id: string) => ({ t: 'spawn' as const, id });
const npc = (id: string) => ({ t: 'spawn' as const, id: 'n_' + id });

export const HUB: LevelDef = {
  id: 'hub',
  name: 'Polaris Vessel',
  theme: 'hub',
  map: m.rows(),
  beam: [19, 4],
  legend: {
    Y: { t: 'exit', to: 'cryo', spawn: 'start', label: 'Cryo Vessel', flag: 'open_cryo' },
    C: { t: 'exit', to: 'city', spawn: 'start', label: 'City Vessel', flag: 'open_city' },
    I: { t: 'exit', to: 'industrial', spawn: 'start', label: 'Industrial Vessel', flag: 'open_ind' },
    L: { t: 'exit', to: 'lab', spawn: 'start', label: 'Lab Vessel', flag: 'open_lab' },
    Q: { t: 'exit', to: 'aquatic', spawn: 'start', label: 'Aquatic Vessel', flag: 'open_aqua' },
    B: { t: 'exit', to: 'biosphere', spawn: 'start', label: 'Biosphere Vessel', flag: 'open_bio' },
    Z: { t: 'exit', to: 'core', spawn: 'start', label: 'Polaris Core Lift', flag: 'open_core', yaw: 0 },
    T: { floor: ';', ent: { t: 'exit', to: 'ballroom', spawn: 'center', label: 'Ballroom', flag: 'trial_ready' } },
    y: sp('gate_cryo'), k: sp('gate_city'), j: sp('gate_ind'), n: sp('gate_lab'), q: sp('gate_aqua'), b: sp('gate_bio'), z: sp('gate_core'),
    t: { floor: ';', ent: sp('from_trial') },
    a: sp('container'), d: sp('deck'),
    h: { floor: ',', ent: sp('hall') },
    r: { floor: ';', ent: sp('room237') },
    H: { floor: ',', ent: [{ t: 'prop', kind: 'holoPillar' }, sp('captain')] },
    S: { floor: ',', ent: { t: 'save', id: 'hub_shrine' } },
    O: { floor: ',', ent: { t: 'prop', kind: 'coreWindow', solid: false } },
    '[': { floor: ',', ent: { t: 'log', id: 'hub_log1' } },
    ']': { floor: ',', ent: { t: 'log', id: 'hub_log2' } },
    '{': { t: 'log', id: 'hub_log3' },
    M: { floor: ';', ent: { t: 'station', kind: 'medbay' } },
    W: { floor: ';', ent: { t: 'station', kind: 'workbench' } },
    V: { floor: ',', ent: { t: 'station', kind: 'vendor' } },
    R: { floor: ';', ent: { t: 'station', kind: 'bed' } },
    e: { floor: ';', ent: { t: 'prop', kind: 'table' } },
    f: { floor: ',', ent: { t: 'prop', kind: 'sofa' } },
    v: { floor: ',', ent: { t: 'prop', kind: 'bench', yaw: 180 } },
    G: { t: 'prop', kind: 'gloomyCluster', solid: false },
    '*': { floor: ';', ent: { t: 'prop', kind: 'crateStack' } },
    x: { floor: ';', ent: { t: 'prop', kind: 'gtCrate' } },
    u: { floor: ';', ent: { t: 'prop', kind: 'bed' } },
    m: { floor: ';', ent: { t: 'prop', kind: 'medbed' } },
    s: { floor: ';', ent: { t: 'prop', kind: 'locker' } },
    X: { t: 'prop', kind: 'shippingContainer', yaw: 90 },
    K: { t: 'prop', kind: 'crane', yaw: 180 },
    A: { t: 'prop', kind: 'antenna' },
    w: { t: 'prop', kind: 'barrel' },
    '!': { t: 'light', color: 0x9fe8ff, intensity: 20, range: 14 },
    '?': { floor: ',', ent: { t: 'light', color: 0xffd8a8, intensity: 14, range: 11, model: false, y: 5.4 } },
    ':': { floor: ';', ent: { t: 'light', color: 0xc8e8ff, intensity: 12, range: 10, model: false, y: 5.4 } },
    '1': { floor: ';', ent: npc('elise') }, '2': { floor: ',', ent: npc('leo') }, '3': { floor: ',', ent: npc('aria') }, '4': npc('dexter'),
    '5': { floor: ';', ent: npc('fiona') }, '6': { floor: ',', ent: npc('grant') }, '7': npc('hana'), '8': { floor: ';', ent: npc('isaac') },
    '9': { floor: ';', ent: npc('jade') }, '0': npc('kai'), $: { floor: ',', ent: npc('luna') },
    '^': { floor: ';', ent: sp('ev_cargo') }, '<': { floor: ',', ent: sp('ev_chapel') }, '>': { floor: ',', ent: sp('ev_lounge') },
    '/': { floor: ';', ent: sp('ev_quarters') }, '\\': sp('ev_intake'),
  },
};
