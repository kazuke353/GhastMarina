import { MapGrid } from './MapGrid';
import type { LevelDef, EntSpec } from '../LevelDef';

const m = new MapGrid(46, 40, '#');
// dock (start)
m.fill(2, 33, 10, 37, ';');
// frozen corridor
m.fill(4, 20, 6, 32, '_');
// pod hall A
m.fill(8, 14, 21, 30, ',');
m.sprinkle(8, 14, 21, 30, '_', 30, ',', 71);
m.fill(7, 21, 7, 23, '_');
// archive
m.fill(24, 22, 32, 30, ';');
m.set(22, 26, ',').set(23, 26, '+');
// locker room
m.fill(34, 22, 43, 30, ';');
m.set(33, 26, 'I');
// pod hall B (Board members)
m.fill(23, 2, 43, 18, '.');
m.fill(23, 2, 43, 3, ',');
m.set(38, 20, '+').set(38, 21, ';').set(38, 19, ';');
// arena (Warden)
m.fill(2, 2, 19, 12, '.');
m.fill(2, 2, 19, 2, ',');
m.set(20, 8, 'J').set(21, 8, '.').set(22, 8, '.');
m.put(7, 5, '@').put(14, 5, '@').put(7, 9, '@').put(14, 9, '@');
// ---- entities ----
m.put(4, 35, 'P').put(2, 37, 'X').put(3, 3, 'E');
m.put(9, 34, 'S').put(25, 29, 'S').put(23, 8, 'S');
// cold vents
m.put(5, 24, 'v').put(5, 29, 'v').put(15, 20, 'v').put(30, 10, 'v').put(40, 6, 'v');
// pods
for (const [x, y] of [[10, 16], [13, 16], [16, 16], [19, 16], [10, 28], [13, 28], [16, 28], [19, 28], [10, 22], [19, 22]] as [number, number][]) m.set(x, y, 'O');
for (const [x, y] of [[25, 5], [28, 5], [31, 5], [34, 5], [37, 5], [25, 15], [28, 15], [31, 15], [34, 15], [37, 15]] as [number, number][]) m.set(x, y, 'B');
m.put(42, 4, 'W');
// archive
m.put(28, 23, 'T').put(25, 23, 'R').put(31, 23, 'R').put(25, 27, 'R').put(30, 29, 'F').put(31, 27, 'H');
// locker room
m.put(42, 23, 'L').put(36, 29, 'k').put(40, 29, 'C');
// pod hall B heater (thaw2) + dossier
m.put(23, 12, 'h').put(41, 16, 'D').put(42, 2, '3');
// items
m.put(18, 25, 'c').put(12, 18, 'a').put(30, 17, 'b').put(35, 28, 'd').put(9, 11, 'e').put(17, 3, 'f');
m.put(21, 14, 'C').put(8, 29, 'C').put(32, 2, 'C').put(43, 13, 'C');
m.put(14, 24, '1').put(36, 10, '2');
m.put(2, 32, 'g').put(21, 29, 'i').put(43, 30, 'j').put(24, 3, 'n').put(19, 3, 'o');
// enemies
m.put(5, 21, 'Z').put(11, 19, 'q').put(17, 19, 'q').put(14, 26, 'Q').put(20, 25, 'q').put(9, 25, 'r');
m.put(12, 15, 'z').put(18, 29, 'z');
m.put(27, 26, 'z').put(37, 25, 'Q').put(41, 27, 'q');
m.put(26, 9, 'G').put(34, 11, 'q').put(39, 8, 'Q').put(30, 3, 'q').put(41, 11, 'r').put(27, 12, 'Q').put(36, 17, 'z');
// boss
m.put(10, 6, 'Y').put(18, 7, 'y');
m.put(5, 4, 'w').put(16, 4, 'w').put(5, 10, 'w').put(16, 10, 'w');
// props
m.sprinkle(8, 14, 21, 30, 'm', 5, ',', 72).sprinkle(23, 4, 43, 14, 'M', 6, '.', 73).sprinkle(34, 22, 43, 30, 'N', 4, ';', 74);
for (const [x, y] of [[5, 34], [5, 27], [5, 22], [11, 25], [17, 25], [11, 15], [17, 15], [26, 24], [30, 26], [37, 24], [41, 28], [25, 8], [31, 8], [37, 8], [31, 13], [4, 7], [17, 7], [10, 3], [10, 11]] as [number, number][]) {
  const c = m.get(x, y);
  if (c === '.' || c === ';' || c === ',' || c === '_') m.set(x, y, c === '.' ? 'l' : c === ';' ? '!' : c === ',' ? '?' : ':');
}

const en = (kind: any, extra: Partial<EntSpec> = {}) => ({ t: 'enemy', kind, ...extra }) as EntSpec;

export const CRYO: LevelDef = {
  id: 'cryo',
  name: 'Cryo-Preservation Vessel',
  theme: 'cryo',
  map: m.rows(),
  legend: {
    P: { floor: ';', ent: { t: 'player' } },
    X: { floor: ';', ent: { t: 'exit', to: 'hub', spawn: 'gate_cryo', label: 'Polaris Gangway' } },
    E: { floor: '.', ent: { t: 'exit', to: 'hub', spawn: 'gate_cryo', label: 'Return to Polaris', flag: 'boss_warden_dead' } },
    S: { floor: ';', ent: { t: 'save', id: 'cryo_s' } },
    I: { floor: ';', ent: { t: 'door', id: 'ice1', flag: 'thaw1', msg: 'Frozen solid. A heater coil could thaw it.' } },
    J: { floor: '.', ent: { t: 'door', id: 'ice2', flag: 'thaw2', msg: 'Frozen solid. A heater coil could thaw it.' } },
    v: { floor: '_', ent: { t: 'hazard', kind: 'cold', period: 3.5 } },
    O: { floor: ',', ent: { t: 'prop', kind: 'cryoPod' } },
    B: { floor: '.', ent: { t: 'prop', kind: 'cryoPod', opts: { broken: true } } },
    W: { floor: '.', ent: { t: 'prop', kind: 'cryoPod', opts: { empty: false } } },
    T: { floor: ';', ent: { t: 'terminal', id: 'archive', flag: 'archive_hacked', diff: 3, label: 'Project MOLE Archive', text: 'PROJECT MOLE — CANDIDATE #07\n\nSTATUS: ACTIVE\nCARRIER: GLOOMBAND FIRMWARE 9.1 (SUBLIMINAL)\nINCIDENTS LOGGED: 5\n  · GRID RELAY 7 — BACKUP SEVERED\n  · LINE 7 PRESS — CYCLE REPROGRAMMED\n  · LAB — ANTIDOTE FORMULA DESTROYED\n  · HABITAT — PUMP 3 REVERSED\n  · BIOSPHERE — KENNEL RELEASED\n\nFOOTAGE: ATTACHED (5 FILES)' } },
    R: { floor: ';', ent: { t: 'prop', kind: 'serverRack' } },
    F: { floor: ';', ent: { t: 'evidence', id: 'aria_backdoor' } },
    H: { floor: ';', ent: { t: 'switch', id: 'heater1', flag: 'thaw1', label: 'Install Thermal Coil', model: 'panel', needs: 'thermal', msg: 'The heater housing is empty.' } },
    h: { floor: '.', ent: { t: 'switch', id: 'heater2', flag: 'thaw2', label: 'Install Thermal Coil', model: 'panel', needs: 'thermal', msg: 'The heater housing is empty.' } },
    L: { floor: ';', ent: { t: 'log', id: 'cryo_log1' } },
    k: { floor: ';', ent: { t: 'item', item: 'thermal', id: 'coilB' } },
    D: { floor: '.', ent: { t: 'evidence', id: 'captain_dossier' } },
    '3': { floor: ',', ent: { t: 'log', id: 'cryo_log3' } },
    '1': { floor: ',', ent: { t: 'item', item: 'thermal', id: 'coilA' } },
    '2': { floor: '.', ent: { t: 'log', id: 'cryo_log2' } },
    C: { floor: '.', ent: { t: 'crate' } },
    a: { floor: ',', ent: { t: 'item', item: 'cells', n: 25 } },
    b: { floor: '.', ent: { t: 'item', item: 'shells', n: 6 } },
    c: { floor: ',', ent: { t: 'item', item: 'flare', n: 2 } },
    d: { floor: ';', ent: { t: 'item', item: 'pipebomb', n: 2 } },
    e: { floor: '.', ent: { t: 'item', item: 'medkit', n: 1 } },
    f: { floor: ',', ent: { t: 'item', item: 'flare', n: 2 } },
    g: { floor: ';', ent: { t: 'gloomy', id: 'g_cryo1' } },
    i: { floor: ',', ent: { t: 'gloomy', id: 'g_cryo2' } },
    j: { floor: ';', ent: { t: 'gloomy', id: 'g_cryo3' } },
    n: { floor: ',', ent: { t: 'gloomy', id: 'g_cryo4' } },
    o: { floor: ',', ent: { t: 'gloomy', id: 'g_cryo5' } },
    z: { floor: ',', ent: en('frostbitten') },
    Z: { floor: '_', ent: en('frostbitten') },
    q: { floor: ',', ent: en('shatterer') },
    Q: { floor: ',', ent: en('frostbitten') },
    r: { floor: ',', ent: en('runner') },
    G: { floor: '.', ent: en('cryobrute') },
    Y: { floor: '.', ent: { t: 'boss', kind: 'warden' } },
    y: { floor: '.', ent: { t: 'trigger', id: 'boss_warden', r: 1.6 } },
    w: { floor: '.', ent: { t: 'hazard', kind: 'fire' } },
    m: { floor: ',', ent: { t: 'prop', kind: 'iceBlock' } },
    M: { floor: '.', ent: { t: 'scatter' } },
    N: { floor: ';', ent: { t: 'prop', kind: 'locker' } },
    l: { floor: '.', ent: { t: 'light', color: 0xa0d8ff, intensity: 16, range: 12 } },
    '!': { floor: ';', ent: { t: 'light', color: 0xa0d8ff, intensity: 16, range: 12 } },
    '?': { floor: ',', ent: { t: 'light', color: 0xa0d8ff, intensity: 16, range: 12 } },
    ':': { floor: '_', ent: { t: 'light', color: 0xa0d8ff, intensity: 16, range: 12 } },
  },
};
