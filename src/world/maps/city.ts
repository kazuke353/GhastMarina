import { MapGrid } from './MapGrid';
import type { LevelDef, EntSpec } from '../LevelDef';

const m = new MapGrid(46, 40, ' ');
m.fill(1, 1, 44, 38, '#');
// alternate brick blocks
m.fill(23, 21, 34, 27, '&').fill(9, 31, 19, 36, '&').fill(38, 11, 42, 17, '&');
// promenades
m.fill(1, 37, 44, 38, ',').fill(1, 1, 2, 38, ',').fill(1, 1, 24, 2, ',').fill(43, 11, 44, 38, ',');
// plaza (north-east)
m.fill(26, 1, 42, 9, ',');
m.fill(28, 3, 31, 5, ';').fill(37, 5, 40, 7, ';');
m.vline(25, 1, 10, '#').hline(25, 43, 10, '#').vline(43, 1, 10, '#');
// avenues & streets
m.fill(6, 3, 8, 36, '.').fill(20, 3, 22, 36, '.').fill(35, 11, 37, 36, '.');
m.fill(3, 8, 22, 10, '.').fill(3, 18, 42, 20, '.').fill(3, 28, 42, 30, '.');
// moss creeping over the asphalt
m.sprinkle(3, 3, 42, 36, ';', 40, '.', 11);
// alley
m.fill(23, 14, 34, 14, '.');
// police station
m.room(9, 11, 19, 17, ';');
m.vline(14, 12, 14, '#');
m.set(14, 17, '+');
// subway concourse
m.room(23, 21, 34, 27, ';');
m.set(28, 21, '+').put(26, 24, '@').put(31, 24, '@');
// apartment courtyard
m.room(9, 31, 19, 36, ';');
m.set(14, 31, '+');
// plaza gate
m.set(36, 10, 'D');
// ---- entities ----
m.put(2, 36, 'P').put(1, 38, 'X');
m.put(41, 1, 'E');
m.put(4, 35, 'S').put(36, 15, 'S');
m.put(35, 12, 'F').put(37, 12, 'T');
m.put(34, 4, 'B').put(36, 8, 'b');
// fuses, pistol
m.put(16, 13, '1').put(32, 22, '2').put(17, 34, '3');
m.put(18, 16, 'p');
// logs
m.put(11, 33, '4').put(11, 15, '5').put(27, 2, '6');
// gloomies
m.put(7, 4, 'g').put(21, 35, 'h').put(33, 26, 'i').put(41, 36, 'j').put(12, 16, 'k');
// crates
m.put(17, 12, 'C').put(24, 26, 'C').put(10, 35, 'C').put(42, 19, 'Q').put(3, 29, 'Q');
// items on streets
m.put(21, 12, 'a').put(7, 27, 'm').put(36, 31, 'a').put(26, 30, 'n');
// enemies
const Z = (s: string) => s; // readability
m.put(7, 30, 'z').put(6, 24, 'z').put(8, 15, 'z').put(7, 12, 'r');
m.put(12, 29, 'z').put(26, 28, 'z').put(31, 30, 'z').put(17, 29, 'o');
m.put(10, 19, 'z').put(25, 19, 'z').put(32, 20, 'z').put(40, 18, 'r').put(38, 19, 'u').put(39, 20, 'u');
m.put(21, 25, 'z').put(20, 13, 'z').put(22, 6, 'u');
m.put(12, 13, 'R').put(17, 15, 'R').put(11, 16, 'Z');
m.put(25, 23, 'U').put(30, 25, 'U').put(33, 23, 'Y').put(25, 25, 'O');
m.put(12, 33, 'Z').put(16, 35, 'Z').put(18, 32, 'W').put(11, 34, 'd');
m.put(36, 22, 'v').put(35, 27, 'z').put(37, 32, 'r');
m.put(10, 37, 'y').put(30, 38, 'y').put(40, 37, 'x');
m.put(12, 9, 'z').put(16, 8, 'z').put(14, 1, 'w');
void Z;
// props
m.put(13, 19, 'c').put(29, 29, 'c').put(21, 16, 'K').put(36, 25, 'K').put(7, 33, 'K').put(40, 29, 'c').put(17, 9, 'c').put(4, 9, 'K');
m.put(30, 2, 'K').put(39, 3, 'c').put(33, 7, 'c');
m.put(28, 19, 'V');
for (const [x, y] of [[5, 8], [19, 10], [5, 18], [19, 20], [23, 18], [34, 20], [38, 18], [5, 28], [19, 30], [23, 28], [34, 30], [42, 30], [23, 8], [9, 3], [19, 3], [34, 13], [38, 36], [9, 38], [29, 37], [3, 14], [3, 24]] as [number, number][]) m.set(x, y, 'l');
for (const [x, y] of [[27, 9], [41, 9], [27, 1], [33, 1]] as [number, number][]) m.set(x, y, 'L');
for (const [x, y] of [[8, 8], [22, 18], [35, 28], [8, 28]] as [number, number][]) m.set(x, y, 't');
m.put(12, 34, 'e').put(15, 33, 'e').put(18, 35, 'e').put(13, 35, 'f');
m.sprinkle(1, 1, 44, 38, 'e', 10, ',', 21).sprinkle(1, 1, 44, 38, 'q', 14, '.', 22).sprinkle(1, 1, 44, 38, 'G', 10, '.', 23);
m.sprinkle(26, 1, 42, 9, 'q', 6, ',', 24).sprinkle(26, 1, 42, 9, 'e', 5, ',', 25);
m.sprinkle(10, 12, 18, 16, 'H', 4, ';', 26).sprinkle(24, 22, 33, 26, 'H', 4, ';', 27);

const en = (kind: any, extra: Partial<EntSpec> = {}) => ({ t: 'enemy', kind, ...extra }) as EntSpec;

export const CITY: LevelDef = {
  id: 'city',
  name: 'Forgotten City Vessel',
  theme: 'city',
  map: m.rows(),
  legend: {
    P: { floor: ',', ent: { t: 'player' } },
    X: { floor: ',', ent: { t: 'exit', to: 'hub', spawn: 'gate_city', label: 'Polaris Gangway' } },
    E: { floor: ',', ent: { t: 'exit', to: 'hub', spawn: 'gate_city', label: 'Return to Polaris', flag: 'boss_gridlock_dead' } },
    S: { floor: '.', ent: { t: 'save', id: 'city_s1' } },
    D: { floor: '.', ent: { t: 'door', id: 'plaza_gate', flag: 'city_power', msg: 'Plaza gate — no power. Restore the grid at the relay.' } },
    F: { t: 'switch', id: 'relay', flag: 'city_power', label: 'Insert Grid Fuses', model: 'fusebox', needs: 'fuse', needsN: 3, msg: 'The relay needs three Grid Fuses.' },
    T: { t: 'terminal', id: 'relay_term', flag: 'city_relay_hacked', diff: 1, label: 'Relay Terminal', text: 'GRID RELAY 7 — EVENT LOG\n\n02:14  BACKUP LINE SEVERED (PHYSICAL)\n02:14  MANUAL OVERRIDE — BAND #0█\n02:15  GATE SAFETY INTERLOCK DISABLED\n\n[ENTRY CORRUPTED]' },
    B: { floor: ',', ent: { t: 'boss', kind: 'gridlock' } },
    b: { floor: ',', ent: { t: 'trigger', id: 'boss_gridlock', r: 1.6 } },
    '1': { floor: ';', ent: { t: 'item', item: 'fuse', id: 'fuse1' } },
    '2': { floor: ';', ent: { t: 'item', item: 'fuse', id: 'fuse2' } },
    '3': { floor: ';', ent: { t: 'item', item: 'fuse', id: 'fuse3' } },
    p: { floor: ';', ent: [{ t: 'item', item: 'pistol', id: 'pistol' }, { t: 'trigger', id: 'pistol_room', r: 1.5 }] },
    '4': { floor: ';', ent: { t: 'log', id: 'city_log1' } },
    '5': { floor: ';', ent: { t: 'log', id: 'city_log2' } },
    '6': { floor: ',', ent: { t: 'log', id: 'city_log3' } },
    g: { floor: '.', ent: { t: 'gloomy', id: 'g_city1' } },
    h: { floor: '.', ent: { t: 'gloomy', id: 'g_city2' } },
    i: { floor: ';', ent: { t: 'gloomy', id: 'g_city3' } },
    j: { floor: ',', ent: { t: 'gloomy', id: 'g_city4' } },
    k: { floor: ';', ent: { t: 'gloomy', id: 'g_city5' } },
    C: { floor: ';', ent: { t: 'crate' } },
    Q: { floor: '.', ent: { t: 'crate' } },
    a: { floor: '.', ent: { t: 'item', item: 'pistolAmmo', n: 10 } },
    m: { floor: '.', ent: { t: 'item', item: 'bandage', n: 1 } },
    n: { floor: '.', ent: { t: 'item', item: 'cloth', n: 2 } },
    z: { floor: '.', ent: en('shambler') },
    Z: { floor: ';', ent: en('shambler') },
    y: { floor: ',', ent: en('shambler') },
    w: { floor: ',', ent: en('shambler', { dormant: true }) },
    d: { floor: ';', ent: en('shambler', { dormant: true }) },
    r: { floor: '.', ent: en('runner') },
    Y: { floor: ';', ent: en('runner') },
    u: { floor: '.', ent: en('hound') },
    U: { floor: ';', ent: en('hound') },
    x: { floor: ',', ent: en('hound') },
    o: { floor: '.', ent: en('bloater') },
    O: { floor: ';', ent: en('bloater') },
    W: { floor: ';', ent: en('bloater') },
    R: { floor: ';', ent: en('riot') },
    v: { floor: '.', ent: en('riot') },
    c: { floor: '.', ent: { t: 'prop', kind: 'car', yaw: 90 } },
    K: { floor: '.', ent: { t: 'prop', kind: 'car', yaw: 0 } },
    V: { floor: '.', ent: { t: 'prop', kind: 'bus', yaw: 90 } },
    l: { floor: '.', ent: { t: 'light', color: 0xffb060, intensity: 22, range: 15 } },
    L: { floor: ',', ent: { t: 'light', color: 0xffb060, intensity: 22, range: 15 } },
    t: { floor: '.', ent: { t: 'prop', kind: 'trafficLight' } },
    e: { floor: ',', ent: { t: 'prop', kind: 'tree' } },
    f: { floor: ';', ent: { t: 'prop', kind: 'bench' } },
    q: { floor: '.', ent: { t: 'scatter' } },
    G: { floor: '.', ent: { t: 'prop', kind: 'debris' } },
    H: { floor: ';', ent: { t: 'prop', kind: 'desk' } },
  },
};
