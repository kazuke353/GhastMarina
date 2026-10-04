import { MapGrid } from './MapGrid';
import type { LevelDef, EntSpec } from '../LevelDef';

const m = new MapGrid(46, 40, '#');
// airlock (start)
m.fill(2, 32, 9, 37, ';');
// aquarium tunnel
m.fill(3, 16, 7, 31, '.');
// flooded atrium
m.fill(9, 14, 27, 30, '~');
m.fill(9, 14, 27, 15, ';').fill(17, 14, 19, 30, ';').fill(9, 22, 27, 22, ';');
m.fill(8, 19, 8, 21, '.');
// gift shop
m.fill(9, 2, 20, 11, ',');
m.set(14, 12, '+').set(14, 13, ';');
// maintenance & vet office
m.fill(29, 14, 36, 20, ';');
m.set(28, 17, '+');
m.vline(34, 16, 18, '#');
// pump station
m.fill(29, 23, 43, 37, '.');
m.fill(29, 23, 43, 23, ',').fill(37, 30, 43, 37, ',');
m.set(32, 21, '+').set(32, 22, '.').set(28, 27, '+');
// bulkhead corridor (Hana trapped)
m.fill(11, 32, 27, 37, '~');
m.fill(11, 32, 27, 32, ';');
m.set(10, 34, 'H');
// arena (Finn's tank)
m.fill(29, 2, 44, 12, '.');
m.fill(29, 2, 44, 2, ',');
m.fill(33, 4, 40, 9, '=');
m.set(33, 13, 'A');
// ---- entities ----
m.put(4, 35, 'P').put(2, 37, 'X').put(43, 3, 'E');
m.put(8, 33, 'S').put(31, 19, 'S').put(30, 12, 'S');
// aquariums
for (const [x, y] of [[3, 18], [7, 21], [3, 24], [7, 27], [3, 30]] as [number, number][]) m.set(x, y, 'Q');
m.put(10, 4, 'Q').put(19, 9, 'q').put(29, 36, 'q');
// electric hazards
m.put(12, 18, 'e').put(24, 26, 'e').put(21, 19, 'e').put(13, 27, 'e');
// breaker & pumps
m.put(35, 15, 'B').put(31, 25, '1').put(36, 25, '2').put(41, 25, '3').put(39, 33, 'T');
m.put(31, 28, 'M').put(36, 28, 'M').put(41, 28, 'M');
// items / evidence
m.put(26, 22, 'v').put(34, 18, 'c').put(24, 34, 'd');
m.put(12, 3, 'L').put(35, 17, 'K').put(40, 36, 'J');
m.put(11, 8, 'C').put(30, 15, 'C').put(42, 35, 'C').put(5, 17, 'C').put(26, 15, 'C');
m.put(18, 25, 'a').put(9, 15, 'b').put(43, 24, 'h').put(30, 32, 'i');
m.put(2, 32, 'g').put(20, 2, 'j').put(27, 30, 'k').put(36, 19, 'n').put(44, 12, 'o');
// enemies
m.put(12, 25, 'D').put(15, 17, 'D').put(23, 28, 'D').put(25, 18, 'D').put(21, 27, 'D').put(13, 20, 'w');
m.put(9, 15, 'W').put(18, 26, 'r').put(25, 22, 'W');
m.put(5, 23, 'Z').put(5, 28, 'z').put(15, 6, 'Z').put(18, 4, 'Z').put(12, 10, 'R');
m.put(30, 18, 'Z').put(35, 19, 'R');
m.put(33, 31, 'O').put(40, 31, 'z').put(34, 35, 'r').put(42, 33, 'O').put(30, 26, 'Y');
m.put(15, 35, 'D').put(22, 36, 'w');
// boss
m.put(36, 6, 'F').put(32, 11, 'f');
// props
m.sprinkle(9, 16, 27, 30, 'm', 10, '~', 51).sprinkle(9, 3, 20, 11, 'N', 5, ',', 52).sprinkle(29, 24, 43, 37, 'u', 5, '.', 53);
for (const [x, y] of [[5, 34], [5, 19], [5, 26], [14, 5], [18, 7], [11, 14], [18, 18], [10, 22], [26, 22], [18, 29], [31, 17], [35, 16], [32, 24], [40, 24], [33, 34], [40, 33], [30, 5], [43, 5], [30, 10], [43, 10], [18, 33], [24, 32]] as [number, number][]) {
  const c = m.get(x, y);
  if (c === '.' || c === ';' || c === ',') m.set(x, y, c === '.' ? 'l' : c === ';' ? '!' : '?');
}

const en = (kind: any, extra: Partial<EntSpec> = {}) => ({ t: 'enemy', kind, ...extra }) as EntSpec;

export const AQUATIC: LevelDef = {
  id: 'aquatic',
  name: 'Aquatic Habitat Vessel',
  theme: 'aquatic',
  map: m.rows(),
  legend: {
    P: { floor: ';', ent: { t: 'player' } },
    X: { floor: ';', ent: { t: 'exit', to: 'hub', spawn: 'gate_aqua', label: 'Polaris Gangway' } },
    E: { floor: ',', ent: { t: 'exit', to: 'hub', spawn: 'gate_aqua', label: 'Return to Polaris', flag: 'boss_leviathan_dead' } },
    S: { floor: ';', ent: { t: 'save', id: 'aqua_s' } },
    H: { floor: ';', ent: { t: 'door', id: 'bulkheadC', flag: 'aqua_drained', msg: 'BULKHEAD C — SEALED (FLOOD PROTOCOL). Drain the habitat.' } },
    A: { floor: ';', ent: { t: 'door', id: 'arena', flag: 'aqua_drained', msg: 'Tank access sealed until water levels normalize.' } },
    Q: { floor: '.', ent: { t: 'prop', kind: 'aquarium' } },
    q: { floor: ',', ent: { t: 'prop', kind: 'aquariumSmall' } },
    e: { floor: '~', ent: { t: 'hazard', kind: 'electric', flag: 'breaker_off' } },
    B: { floor: ';', ent: { t: 'switch', id: 'breaker', flag: 'breaker_off', label: 'Cut Atrium Power', model: 'panel' } },
    '1': { floor: ',', ent: { t: 'switch', id: 'pump1', flag: 'pump1', label: 'Start Pump 1', model: 'lever' } },
    '2': { floor: ',', ent: { t: 'switch', id: 'pump2', flag: 'pump2', label: 'Start Pump 2', model: 'lever' } },
    '3': { floor: ',', ent: { t: 'switch', id: 'pump3', flag: 'pump3', label: 'Attach Valve to Pump 3', model: 'valve', needs: 'valve', msg: 'Pump 3’s valve wheel is missing.' } },
    T: { floor: ',', ent: { t: 'terminal', id: 'pump_term', flag: 'pump_term_read', diff: 2, label: 'Pump Control', text: 'PUMP CONTROL — EVENT LOG\n\n09:41  PUMP 3 FLOW REVERSED\n09:41  REMOTE OVERRIDE SOURCE: GLOOMBAND #07\n09:42  FLOOD LEVEL RISING\n14:32  BULKHEAD C SEALED — BAND #05 (FLOOD PROTOCOL)\n\nPersonnel behind Bulkhead C: 1' } },
    M: { floor: '.', ent: { t: 'prop', kind: 'machine', opts: { w: 2.4, d: 2, h: 3, color: 0x3a5a6a } } },
    v: { floor: ';', ent: { t: 'item', item: 'valve', id: 'valve_aqua' } },
    L: { floor: ',', ent: { t: 'log', id: 'aqua_log1' } },
    K: { floor: ';', ent: [{ t: 'log', id: 'aqua_log2' }, { t: 'evidence', id: 'protocol_card' }] },
    J: { floor: ',', ent: { t: 'log', id: 'aqua_log3' } },
    c: { floor: ';', ent: { t: 'item', item: 'shells', n: 6 } },
    d: { floor: '~', ent: { t: 'evidence', id: 'dog_tag' } },
    C: { floor: ';', ent: { t: 'crate' } },
    a: { floor: ';', ent: { t: 'item', item: 'cells', n: 20 } },
    b: { floor: ';', ent: { t: 'item', item: 'pistolAmmo', n: 12 } },
    h: { floor: ',', ent: { t: 'item', item: 'medkit', n: 1 } },
    i: { floor: '.', ent: { t: 'item', item: 'flare', n: 2 } },
    g: { floor: ';', ent: { t: 'gloomy', id: 'g_aqua1' } },
    j: { floor: ',', ent: { t: 'gloomy', id: 'g_aqua2' } },
    k: { floor: ';', ent: { t: 'gloomy', id: 'g_aqua3' } },
    n: { floor: ';', ent: { t: 'gloomy', id: 'g_aqua4' } },
    o: { floor: '.', ent: { t: 'gloomy', id: 'g_aqua5' } },
    D: { floor: '~', ent: en('diver') },
    w: { floor: '~', ent: en('drowned') },
    W: { floor: ';', ent: en('spitter') },
    r: { floor: ';', ent: en('runner') },
    z: { floor: '.', ent: en('drowned') },
    Z: { floor: '.', ent: en('shambler') },
    R: { floor: ',', ent: en('runner') },
    O: { floor: '.', ent: en('bloater') },
    Y: { floor: ',', ent: en('spitter') },
    F: { floor: '=', ent: { t: 'boss', kind: 'leviathan' } },
    f: { floor: '.', ent: { t: 'trigger', id: 'boss_leviathan', r: 1.6 } },
    m: { floor: '~', ent: { t: 'prop', kind: 'kelp', solid: false } },
    N: { floor: ',', ent: { t: 'prop', kind: 'coral', solid: false } },
    u: { floor: '.', ent: { t: 'scatter' } },
    l: { floor: '.', ent: { t: 'light', color: 0x60d0ff, intensity: 16, range: 12 } },
    '!': { floor: ';', ent: { t: 'light', color: 0x60d0ff, intensity: 16, range: 12 } },
    '?': { floor: ',', ent: { t: 'light', color: 0x60d0ff, intensity: 16, range: 12 } },
  },
};
