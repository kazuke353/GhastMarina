import * as THREE from 'three';
import type { World } from '../game/World';
import type { ItemId } from '../world/LevelDef';
import { CELL } from '../world/Level';
import { PM, part } from '../world/Props';
import { compact } from './Models';
import { audio } from '../core/Audio';
import { ITEMS } from '../game/Items';
import { clamp01 } from '../core/math';

export class Door {
  panel: THREE.Object3D;
  open = 0;
  target = 0;
  closeT = 0;
  locked: boolean;
  private light: THREE.Mesh;
  constructor(public w: World, public gx: number, public gy: number, public axis: 'x' | 'z', public pos: THREE.Vector3, public key?: ItemId, public flag?: string, public msg?: string, public id = `${gx},${gy}`) {
    const P = PM();
    const h = Math.min(w.theme.wallH, 4.5) - 0.4;
    const g = new THREE.Group();
    const lockedLook = !!(key || flag);
    g.add(compact(new THREE.Group().add(
      part(new THREE.BoxGeometry(1, 1, 1), P.metal, lockedLook ? 0x4a3a3a : 0x3a4250, [0, h / 2, 0], [CELL - 0.8, h, 0.2]),
      part(new THREE.BoxGeometry(1, 1, 1), P.hazard, 0xffffff, [0, 0.25, 0.105], [CELL - 0.8, 0.3, 0.01]),
      part(new THREE.BoxGeometry(1, 1, 1), P.hazard, 0xffffff, [0, 0.25, -0.105], [CELL - 0.8, 0.3, 0.01]),
    )));
    const lm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 3, 0.8) });
    this.light = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.24), lm);
    this.light.position.set(0, h - 0.3, 0);
    g.add(this.light);
    g.position.copy(pos);
    g.rotation.y = axis === 'x' ? 0 : Math.PI / 2;
    this.panel = g;
    w.scene.add(g);
    this.locked = this.isLocked();
    this.updateLight();
  }
  isLocked() {
    if (this.flag && !this.w.game.flag(this.flag)) return true;
    if (this.key && !this.w.game.state.picked.includes(this.w.key('door:' + this.id))) return true;
    return false;
  }
  private updateLight() {
    (this.light.material as THREE.MeshBasicMaterial).color.setRGB(this.locked ? 3 : 0.3, this.locked ? 0.2 : 3, this.locked ? 0.2 : 0.8);
  }
  label() {
    if (!this.locked) return '';
    if (this.key) {
      const have = (this.w.game.state.inv[this.key] ?? 0) > 0;
      return have ? `Unlock with ${ITEMS[this.key].name}` : `Locked — requires ${ITEMS[this.key].name}`;
    }
    return this.msg ?? 'Locked';
  }
  tryUnlock() {
    if (!this.locked) return;
    if (this.key && (this.w.game.state.inv[this.key] ?? 0) > 0) {
      this.w.game.state.picked.push(this.w.key('door:' + this.id));
      this.locked = this.isLocked();
      audio.play('uiConfirm', { vol: 0.5 });
      this.w.game.ui.hud.toast(`Unlocked with ${ITEMS[this.key].name}`, 'key');
      this.updateLight();
    } else {
      audio.play('doorLocked', { pos: this.pos });
      this.w.game.ui.hud.toast(this.label(), 'warn');
    }
  }
  update(dt: number) {
    if (this.locked && this.flag && this.w.game.flag(this.flag)) {
      this.locked = this.isLocked();
      this.updateLight();
    }
    let near = false;
    if (!this.locked) {
      const check = (p: THREE.Vector3) => Math.abs(p.x - this.pos.x) < 2.8 && Math.abs(p.z - this.pos.z) < 2.8;
      if (check(this.w.player.pos)) near = true;
      if (!near) for (const e of this.w.enemies) if (!e.dead && e.state === 'chase' && check(e.pos)) near = true;
      if (!near) for (const n of this.w.npcs) if (check(n.pos)) near = true;
    }
    if (near) {
      this.closeT = 1.5;
      if (this.target === 0) audio.play('door', { pos: this.pos, vol: 0.6 });
      this.target = 1;
    } else {
      this.closeT -= dt;
      if (this.closeT <= 0 && this.target === 1) {
        // don't close on something
        const blocked = Math.abs(this.w.player.pos.x - this.pos.x) < 1.7 && Math.abs(this.w.player.pos.z - this.pos.z) < 1.7;
        if (!blocked) {
          this.target = 0;
          audio.play('door', { pos: this.pos, vol: 0.4, pitch: 0.9 });
        }
      }
    }
    this.open = clamp01(this.open + (this.target ? dt * 3 : -dt * 3));
    const slide = this.open * (CELL - 0.9);
    const child = this.panel.children[0];
    child.position.x = slide;
    this.light.position.x = slide;
    const passable = this.open > 0.7;
    this.w.level.setSolid(this.gx, this.gy, !passable, this.open < 0.3);
  }
}
