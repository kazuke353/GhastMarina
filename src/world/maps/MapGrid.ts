/** Small helper to compose ASCII level maps from rectangles. Coordinates are inclusive. */
export class MapGrid {
  g: string[][];
  constructor(public w: number, public h: number, fill = ' ') {
    this.g = Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
  }
  set(x: number, y: number, ch: string) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.g[y][x] = ch;
    return this;
  }
  get(x: number, y: number) {
    return this.g[y]?.[x] ?? ' ';
  }
  fill(x0: number, y0: number, x1: number, y1: number, ch: string) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, ch);
    return this;
  }
  /** walls on the border, floor inside */
  room(x0: number, y0: number, x1: number, y1: number, floor = '.', wall = '#') {
    this.fill(x0, y0, x1, y1, wall);
    this.fill(x0 + 1, y0 + 1, x1 - 1, y1 - 1, floor);
    return this;
  }
  hline(x0: number, x1: number, y: number, ch: string) {
    return this.fill(x0, y, x1, y, ch);
  }
  vline(x: number, y0: number, y1: number, ch: string) {
    return this.fill(x, y0, x, y1, ch);
  }
  /** place a string of entity chars starting at x,y (spaces skipped) */
  put(x: number, y: number, s: string) {
    for (let i = 0; i < s.length; i++) if (s[i] !== ' ') this.set(x + i, y, s[i]);
    return this;
  }
  /** scatter a char onto cells currently equal to `onto` */
  sprinkle(x0: number, y0: number, x1: number, y1: number, ch: string, n: number, onto = '.', seed = 1) {
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    let placed = 0, tries = 0;
    while (placed < n && tries < n * 40) {
      tries++;
      const x = x0 + Math.floor(rnd() * (x1 - x0 + 1));
      const y = y0 + Math.floor(rnd() * (y1 - y0 + 1));
      if (this.get(x, y) === onto) {
        this.set(x, y, ch);
        placed++;
      }
    }
    return this;
  }
  rows() {
    return this.g.map((r) => r.join(''));
  }
}
