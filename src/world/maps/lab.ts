import { MapGrid } from './MapGrid';
import type { LevelDef, EntSpec } from '../LevelDef';

const m = new MapGrid(47, 40, '#');
// reception
m.fill(2, 30, 13, 37, ',');
m.put(4, 32, '@').put(11, 32, '@');
// main corridor
m.fill(6, 10, 8, 29, '.');
// cross corridor
m.fill(6, 7, 41, 9, '.');
// armory (blue key)
m.fill(2, 12, 4, 19, ';');
m.set(5, 15, 'K');
// server room
m.fill(10, 12, 18, 19, ';');
m.set(9, 15, '+');
// office (Dr. Marlow)
m.fill(10, 22, 18, 28, ',');
m.set(9, 25, '+');
m.vline(14, 22, 24, '#');
// specimen hall
m.fill(20, 11, 33, 28, '.');
m.fill(20, 11, 33, 11, ';').fill(20, 28, 33, 28, ';');
m.set(26, 10, '+').set(27, 10, '+');
// containment wing (glass cells)
m.fill(36, 11, 44, 28, ',');
m.vline(38, 12, 27, '#').vline(42, 12, 27, '#');
m.fill(39, 11, 41, 28, '.');
for (const y of [13, 17, 21, 25]) {
  m.set(38, y, '|').set(38, y + 1, '|');
  m.set(42, y, '|').set(42, y + 1, '|');
  m.hline(36, 37, y + 2, '#');
  m.hline(43, 44, y + 2, '#');
}
m.set(40, 10, 'L');
// vault arena (Subject Zero)
m.fill(30, 30, 44, 37, '.');
m.fill(30, 30, 44, 30, ';');
m.set(40, 29, '+');
m.put(33, 33, '@').put(41, 33, '@');
// ---- entities ----
m.put(5, 35, 'P').put(2, 37, 'X').put(43, 37, 'E');
m.put(11, 35, 'S').put(40, 27, 'S').put(24, 9, 'S');
// lasers
m.put(6, 24, 'v').put(7, 24, 'v').put(8, 24, 'v').put(6, 18, 'v').put(7, 18, 'v').put(8, 18, 'v');
m.put(30, 7, 'w').put(30, 8, 'w').put(30, 9, 'w');
// server terminal & racks
m.put(17, 15, 'T').put(12, 13, 'R').put(14, 13, 'R').put(16, 13, 'R').put(12, 18, 'R').put(14, 18, 'R');
// office
m.put(12, 27, '1').put(17, 23, '2').put(16, 27, 'k').put(10, 22, 'b').put(13, 23, 'H');
// armory
m.put(3, 13, 'A').put(3, 18, 'c').put(2, 16, 'c');
// specimen hall tanks
for (const [x, y] of [[22, 13], [25, 13], [28, 13], [31, 13], [22, 26], [25, 26], [28, 26], [31, 26], [23, 19], [30, 19]] as [number, number][]) m.set(x, y, 'Q');
m.put(26, 19, 'D').put(27, 20, 'j');
// containment
m.put(37, 14, 'Y').put(43, 18, 'Y').put(37, 22, 'Y').put(43, 26, 'Y');
m.put(40, 12, '3').put(39, 27, 'e').put(41, 28, 'F');
// vault
m.put(37, 34, 'O').put(37, 31, 'o');
m.put(43, 31, 'f').put(31, 36, 'h');
// items & crates
m.put(7, 28, 'a').put(19, 9, 'a').put(33, 22, 'n').put(39, 20, 'n');
m.put(13, 36, 'C').put(18, 17, 'C').put(20, 27, 'C').put(44, 15, 'C').put(10, 8, 'C');
// gloomies
m.put(2, 30, 'g').put(10, 19, 'i').put(33, 11, 'J').put(44, 11, 'u').put(30, 37, 'x');
// enemies
m.put(7, 21, 'z').put(7, 13, 'z').put(12, 8, 'r').put(36, 8, 'z').put(18, 8, 'p');
m.put(11, 16, 'Z').put(15, 25, 's').put(17, 26, 'Z');
m.put(22, 16, 'p').put(30, 16, 'p').put(26, 23, 'q').put(21, 21, 'W').put(32, 24, 'W').put(28, 15, 'Z');
m.put(40, 15, 'G').put(40, 23, 'G').put(37, 16, 'p').put(43, 22, 'p').put(39, 12, 'W');
m.put(3, 15, 'Z');
// props
m.sprinkle(10, 12, 18, 19, 'm', 3, ';', 41).sprinkle(20, 12, 33, 27, 'M', 4, '.', 42).sprinkle(2, 30, 13, 37, 'N', 4, ',', 43);
for (const [x, y] of [[7, 26], [7, 20], [7, 12], [12, 9], [20, 8], [33, 8], [40, 8], [5, 31], [10, 36], [12, 15], [16, 16], [12, 24], [16, 24], [21, 13], [32, 13], [21, 24], [32, 24], [27, 16], [40, 13], [40, 18], [40, 24], [33, 32], [41, 35], [37, 36]] as [number, number][]) {
  const c = m.get(x, y);
  if (c === '.' || c === ';' || c === ',') m.set(x, y, c === '.' ? 'l' : c === ';' ? '!' : '?');
}

const en = (kind: any, extra: Partial<EntSpec> = {}) => ({ t: 'enemy', kind, ...extra }) as EntSpec;

export const LAB: LevelDef = {
  id: 'lab',
  name: 'Subterranean Lab Vessel',
  theme: 'lab',
  map: m.rows(),
  legend: {
    P: { floor: ',', ent: { t: 'player' } },
    X: { floor: ',', ent: { t: 'exit', to: 'hub', spawn: 'gate_lab', label: 'Polaris Gangway' } },
    E: { floor: '.', ent: { t: 'exit', to: 'hub', spawn: 'gate_lab', label: 'Return to Polaris', flag: 'boss_subjectZero_dead' } },
    S: { floor: '.', ent: { t: 'save', id: 'lab_s' } },
    K: { floor: ';', ent: { t: 'door', id: 'armory', key: 'keyBlue' } },
    L: { floor: '.', ent: { t: 'door', id: 'containment', key: 'labKey' } },
    v: { floor: '.', ent: { t: 'hazard', kind: 'laser', yaw: 0, period: 3, flag: 'lasers_off' } as any },
    w: { floor: '.', ent: { t: 'hazard', kind: 'laser', yaw: 90, period: 2.6, flag: 'lasers_off' } as any },
    T: { floor: ';', ent: { t: 'terminal', id: 'server', flag: 'lasers_off', diff: 2, label: 'Security Mainframe', text: 'SECURITY GRID — DISABLED\n\nLASER CURTAINS: OFFLINE\nCONTAINMENT WING: KEY REQUIRED (SPECIMEN KEY)\n\nNOTE FROM NIGHT SHIFT: someone keeps leaving the containment wing unlocked. Dr. Thorne says it\'s "the subject." Subjects can\'t pick locks. Right?' } },
    R: { floor: ';', ent: { t: 'prop', kind: 'serverRack' } },
    '1': { floor: ',', ent: { t: 'log', id: 'lab_log1' } },
    '2': { floor: ',', ent: { t: 'log', id: 'lab_log2' } },
    '3': { floor: '.', ent: { t: 'log', id: 'lab_log3' } },
    k: { floor: ',', ent: { t: 'item', item: 'keyBlue', id: 'keyBlue' } },
    b: { floor: ',', ent: { t: 'trigger', id: 'lab_office', r: 1.6 } },
    H: { floor: ',', ent: { t: 'prop', kind: 'desk' } },
    A: { floor: ';', ent: { t: 'item', item: 'arc', id: 'arc' } },
    c: { floor: ';', ent: { t: 'item', item: 'cells', n: 25 } },
    Q: { floor: '.', ent: { t: 'prop', kind: 'specimen' } },
    D: { floor: '.', ent: { t: 'prop', kind: 'labTable' } },
    j: { floor: '.', ent: { t: 'item', item: 'labKey', id: 'labKey' } },
    Y: { floor: ',', ent: { t: 'prop', kind: 'specimen', opts: { color: 0xff50a0 } } },
    e: { floor: '.', ent: { t: 'terminal', id: 'cell_term', flag: 'cell_record_read', diff: 1, label: 'Containment Log', text: 'CONTAINMENT — CELL 0\n\n01:12  DOOR OPENED (MANUAL — NO KEYCARD, NO OVERRIDE)\n01:13  VAULT 0-B OPENED (MANUAL)\n01:13  ITEM REMOVED: “GLOOMHEART” PROTOTYPE CORE\n01:14  SUBJECT 000: NOT IN CELL\n\nSecurity note: lock shows tool marks. Someone very, very good.' } },
    F: { floor: '.', ent: { t: 'evidence', id: 'lockpick' } },
    O: { floor: '.', ent: { t: 'boss', kind: 'subjectZero' } },
    o: { floor: ';', ent: [{ t: 'trigger', id: 'boss_subjectZero', r: 1.5 }, { t: 'evidence', id: 'broken_chain' }] },
    f: { floor: '.', ent: { t: 'item', item: 'medkit', n: 1 } },
    h: { floor: '.', ent: { t: 'item', item: 'cells', n: 20 } },
    a: { floor: '.', ent: { t: 'item', item: 'pistolAmmo', n: 12 } },
    n: { floor: '.', ent: { t: 'item', item: 'pills', n: 1 } },
    C: { floor: '.', ent: { t: 'crate' } },
    g: { floor: ',', ent: { t: 'gloomy', id: 'g_lab1' } },
    i: { floor: ';', ent: { t: 'gloomy', id: 'g_lab2' } },
    J: { floor: ';', ent: { t: 'gloomy', id: 'g_lab3' } },
    u: { floor: ',', ent: { t: 'gloomy', id: 'g_lab4' } },
    x: { floor: '.', ent: { t: 'gloomy', id: 'g_lab5' } },
    z: { floor: '.', ent: en('shambler') },
    Z: { floor: ';', ent: en('shambler') },
    r: { floor: '.', ent: en('runner') },
    p: { floor: '.', ent: en('phantom') },
    q: { floor: '.', ent: en('phantom', { elite: true }) },
    W: { floor: '.', ent: en('spitter') },
    G: { floor: '.', ent: en('thinker') },
    s: { floor: ',', ent: en('thinker') },
    m: { floor: ';', ent: { t: 'prop', kind: 'console' } },
    M: { floor: '.', ent: { t: 'prop', kind: 'labTable' } },
    N: { floor: ',', ent: { t: 'scatter' } },
    l: { floor: '.', ent: { t: 'light', color: 0xd0f8ff, intensity: 16, range: 11 } },
    '!': { floor: ';', ent: { t: 'light', color: 0xd0f8ff, intensity: 16, range: 11 } },
    '?': { floor: ',', ent: { t: 'light', color: 0xd0f8ff, intensity: 16, range: 11 } },
  },
};
