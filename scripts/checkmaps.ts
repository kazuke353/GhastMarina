// Static connectivity check for every level map: every interactive entity must be reachable from the player start.
// Run: npx esbuild scripts/checkmaps.ts --bundle --platform=node --format=esm --outfile=/tmp/checkmaps.mjs && node /tmp/checkmaps.mjs
import { LEVELS } from '../src/world/maps';

const PASS: Record<string, boolean> = { '.': true, ',': true, ';': true, '_': true, '~': true, '+': true, '@': false, '#': false, '&': false, ' ': false, '=': false, '%': false, '|': false };
let bad = 0;
for (const [id, def] of Object.entries(LEVELS)) {
  const rows = def.map;
  const H = rows.length, W = Math.max(...rows.map((r) => r.length));
  const pass = new Uint8Array(W * H);
  const ents: { x: number; y: number; t: string; desc: string }[] = [];
  let start: [number, number] | null = null;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ch = rows[y][x] ?? ' ';
      if (ch in PASS) { pass[y * W + x] = PASS[ch] ? 1 : 0; continue; }
      const L: any = def.legend[ch];
      if (!L) { console.log(`[${id}] unknown char '${ch}' at ${x},${y}`); bad++; continue; }
      let floor = '.';
      let specs: any[] = [];
      if (Array.isArray(L)) specs = L;
      else if ('floor' in L) { floor = L.floor; specs = L.ent ? (Array.isArray(L.ent) ? L.ent : [L.ent]) : []; }
      else specs = [L];
      pass[y * W + x] = PASS[floor] ? 1 : 0;
      for (const s of specs) {
        if (s.t === 'player') start = [x, y];
        if (['prop', 'light', 'scatter', 'hazard'].includes(s.t)) continue;
        ents.push({ x, y, t: s.t, desc: `${s.t}:${s.id ?? s.kind ?? s.item ?? s.to ?? s.who ?? ''}` });
      }
    }
  if (!start) { console.log(`[${id}] no player start`); bad++; continue; }
  const seen = new Uint8Array(W * H);
  const q = [start];
  seen[start[1] * W + start[0]] = 1;
  while (q.length) {
    const [x, y] = q.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const i = ny * W + nx;
      if (seen[i] || !pass[i]) continue;
      seen[i] = 1;
      q.push([nx, ny]);
    }
  }
  const unreachable = ents.filter((e) => !seen[e.y * W + e.x]);
  // entities standing on blocked cells are reachable if a neighbour is
  const really = unreachable.filter((e) => ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(e.y + dy) * W + e.x + dx]));
  for (const e of really) { console.log(`[${id}] UNREACHABLE ${e.desc} at ${e.x},${e.y}`); bad++; }
  console.log(`[${id}] ${W}x${H}, ${ents.length} entities, ${really.length} unreachable`);
}
console.log(bad ? `${bad} problems` : 'all maps OK');
