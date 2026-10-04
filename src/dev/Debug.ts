import * as THREE from 'three';
import type { Game } from '../game/Game';
import type { ItemId } from '../world/LevelDef';
import { giveItem } from '../entities/Interactables';

/** Debug / automated-test helpers, exposed as window.__GM.dbg when ?debug is set. */
export function installDebug(g: Game) {
  const w = () => g.world!;
  const dbg = {
    /** compact snapshot of the game state */
    s() {
      const st = g.state;
      const ww = g.world;
      return {
        ch: st.chapter,
        lvl: ww?.def.id,
        pos: ww ? [+ww.player.pos.x.toFixed(1), +ww.player.pos.z.toFixed(1)] : null,
        hp: Math.round(st.hp),
        cine: g.cinematic,
        mode: g.mode,
        obj: (document.querySelector('.objective') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').slice(0, 140),
        dlg: g.ui.dlg.open ? (document.querySelector('.dlg .text') as HTMLElement | null)?.innerText.slice(0, 80) : null,
        enemies: ww ? ww.enemies.filter((e) => !e.dead).length : 0,
        boss: ww?.bosses.filter((b) => !b.dead).map((b) => b.bossKind + (b.started ? '*' : '')),
        overlay: g.ui.anyOverlay(),
        trial: g.ui.trial.el.classList.contains('hidden') ? null : (g.ui.trial.el.innerText || '').replace(/\s+/g, ' ').slice(0, 160),
      };
    },
    tp(a: string | number, b?: number) {
      const ww = w();
      if (typeof a === 'string') {
        const sp = ww.level.spawns[a];
        if (!sp) return 'no spawn ' + a + ' — have: ' + Object.keys(ww.level.spawns).join(',');
        ww.player.pos.copy(sp.pos);
      } else ww.player.pos.set(a, 0, b ?? 0);
      ww.player.vel.set(0, 0, 0);
      return dbg.s().pos;
    },
    flag(name: string, v: boolean | number | string = true) {
      g.setFlag(name, v);
      return g.flag(name);
    },
    emit(ev: string) {
      g.director.emit(ev);
    },
    kill(radius = 1e9) {
      let n = 0;
      for (const e of w().enemies) {
        if (e.dead || (e as any).isBoss) continue;
        if (e.pos.distanceTo(w().player.pos) > radius) continue;
        e.damage(1e6, new THREE.Vector3(0, 0, 1), {});
        n++;
      }
      return n;
    },
    killBoss() {
      let n = 0;
      for (const b of w().bosses) {
        if (b.dead) continue;
        if (!b.started) w().startBoss(b.bossKind);
        b.die({});
        n++;
      }
      return n;
    },
    god(on = true) {
      (g as any).__god = on;
      return on;
    },
    give(id: ItemId, n = 1) {
      giveItem(w(), id, n, true);
      return g.state.inv[id];
    },
    ints() {
      return w().interactables.filter((i) => !i.removed).map((i) => `${i.id} @${i.pos.x.toFixed(0)},${i.pos.z.toFixed(0)} [${i.label()}]`);
    },
    /** teleport next to an interactable whose id contains `q` and use it */
    async use(q: string) {
      const it = w().interactables.find((i) => !i.removed && i.id.includes(q));
      if (!it) return 'not found: ' + q;
      const ww = w();
      const dir = ww.player.pos.clone().sub(it.pos).setY(0);
      if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
      dir.normalize();
      ww.player.pos.copy(it.pos).addScaledVector(dir, 1.2).setY(0);
      await it.interact();
      return it.id + ' -> ' + it.label();
    },
    doors() {
      return w().doors.map((d) => `${d.id} ${d.locked ? 'L' : ''}${d.key ? ' key=' + d.key : ''}${d.flag ? ' flag=' + d.flag : ''} @${d.pos.x.toFixed(0)},${d.pos.z.toFixed(0)}`);
    },
    unlock() {
      for (const d of w().doors) (d as any).locked = false;
    },
    triggers() {
      return w().triggers.map((t) => `${t.id} @${t.pos.x.toFixed(0)},${t.pos.z.toFixed(0)} ${t.fired ? 'fired' : ''}`);
    },
    trig(id: string) {
      const t = w().triggers.find((x) => x.id === id);
      if (!t) return 'no trigger ' + id;
      w().player.pos.copy(t.pos).setY(0);
      return 'at ' + id;
    },
    flags() {
      return Object.keys(g.state.flags).filter((k) => g.state.flags[k]);
    },
    chapter(id: string) {
      return g.newGame(g.state.difficulty, id);
    },
    load(level: string, spawn: string) {
      return g.loadLevel(level, spawn);
    },
  };
  (g as any).dbg = dbg;
  return dbg;
}
