export type Action =
  | 'forward' | 'back' | 'left' | 'right'
  | 'sprint' | 'sneak' | 'dodge'
  | 'attack' | 'aim' | 'reload' | 'interact' | 'flashlight'
  | 'heal' | 'throw' | 'band' | 'pause' | 'map'
  | 'w1' | 'w2' | 'w3' | 'w4' | 'swap'
  | 'confirm' | 'cancel' | 'up' | 'down' | 'skip';

const KEYMAP: Record<Action, string[]> = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  sneak: ['ControlLeft', 'KeyC'],
  dodge: ['Space'],
  attack: ['Mouse0'],
  aim: ['Mouse2'],
  reload: ['KeyR'],
  interact: ['KeyE'],
  flashlight: ['KeyF'],
  heal: ['KeyH'],
  throw: ['KeyG'],
  band: ['Tab', 'KeyI'],
  pause: ['Escape', 'KeyP'],
  map: ['KeyM'],
  w1: ['Digit1'],
  w2: ['Digit2'],
  w3: ['Digit3'],
  w4: ['Digit4'],
  swap: ['KeyQ'],
  confirm: ['Enter', 'Space', 'KeyE', 'Mouse0'],
  cancel: ['Escape', 'Backspace'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  skip: ['Escape'],
};

// Standard gamepad mapping
const PADMAP: Partial<Record<Action, number[]>> = {
  interact: [0], dodge: [1], reload: [2], swap: [3],
  throw: [4], heal: [5], aim: [6], attack: [7],
  band: [8], pause: [9], sprint: [10], flashlight: [11, 12],
  map: [13], confirm: [0], cancel: [1], w1: [14], w2: [15], skip: [9],
};

export class Input {
  private down = new Set<string>();
  private pressedSet = new Set<string>();
  private releasedSet = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  locked = false;
  lockAllowed = true;
  hasPad = false;
  padMove = { x: 0, y: 0 };
  padLook = { x: 0, y: 0 };
  private padPrev: boolean[] = [];
  private padDown: boolean[] = [];
  lastDevice: 'kbm' | 'pad' = 'kbm';
  /** When true, keyboard events go to DOM (text inputs etc). */
  enabled = true;
  onLockChange: ((locked: boolean) => void) | null = null;
  onAnyKey: (() => void) | null = null;

  constructor(private el: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!e.repeat) {
        this.down.add(e.code);
        this.pressedSet.add(e.code);
      }
      this.lastDevice = 'kbm';
      this.onAnyKey?.();
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.releasedSet.add(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
    });
    el.addEventListener('mousedown', (e) => {
      const c = 'Mouse' + e.button;
      this.down.add(c);
      this.pressedSet.add(c);
      this.lastDevice = 'kbm';
      this.onAnyKey?.();
    });
    window.addEventListener('mouseup', (e) => {
      const c = 'Mouse' + e.button;
      this.down.delete(c);
      this.releasedSet.add(c);
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (this.locked || this.dragLook) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    });
    window.addEventListener(
      'wheel',
      (e) => {
        this.wheel += Math.sign(e.deltaY);
      },
      { passive: true },
    );
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.el;
      this.onLockChange?.(this.locked);
    });
    window.addEventListener('gamepadconnected', () => (this.hasPad = true));
  }

  /** Fallback look when pointer lock isn't available (e.g. sandboxed iframes). */
  dragLook = false;
  lockFailed = false;

  requestLock() {
    if (!this.lockAllowed || this.locked) return;
    try {
      const r = (this.el as any).requestPointerLock?.();
      if (r && typeof r.catch === 'function')
        r.catch(() => {
          this.lockFailed = true;
          this.dragLook = true;
        });
    } catch {
      this.lockFailed = true;
      this.dragLook = true;
    }
  }
  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  isDown(a: Action) {
    const k = KEYMAP[a];
    for (const c of k) if (this.down.has(c)) return true;
    const p = PADMAP[a];
    if (p) for (const b of p) if (this.padDown[b]) return true;
    return false;
  }
  pressed(a: Action) {
    const k = KEYMAP[a];
    for (const c of k) if (this.pressedSet.has(c)) return true;
    const p = PADMAP[a];
    if (p) for (const b of p) if (this.padDown[b] && !this.padPrev[b]) return true;
    return false;
  }
  released(a: Action) {
    const k = KEYMAP[a];
    for (const c of k) if (this.releasedSet.has(c)) return true;
    const p = PADMAP[a];
    if (p) for (const b of p) if (!this.padDown[b] && this.padPrev[b]) return true;
    return false;
  }
  keyPressed(code: string) {
    return this.pressedSet.has(code);
  }
  /** Consume a pressed action so later checks this frame don't see it. */
  consume(a: Action) {
    for (const c of KEYMAP[a]) this.pressedSet.delete(c);
    const p = PADMAP[a];
    if (p) for (const b of p) this.padPrev[b] = this.padDown[b];
  }

  moveVector() {
    let x = 0, y = 0;
    if (this.isDown('forward')) y += 1;
    if (this.isDown('back')) y -= 1;
    if (this.isDown('right')) x += 1;
    if (this.isDown('left')) x -= 1;
    if (Math.abs(this.padMove.x) > 0.15 || Math.abs(this.padMove.y) > 0.15) {
      x = this.padMove.x;
      y = -this.padMove.y;
    }
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y };
  }

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp: Gamepad | null = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    this.padPrev = this.padDown.slice();
    if (!gp) {
      this.padDown = [];
      this.padMove.x = this.padMove.y = 0;
      this.padLook.x = this.padLook.y = 0;
      return;
    }
    this.hasPad = true;
    const dz = (v: number) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
    this.padMove.x = dz(gp.axes[0] ?? 0);
    this.padMove.y = dz(gp.axes[1] ?? 0);
    this.padLook.x = dz(gp.axes[2] ?? 0);
    this.padLook.y = dz(gp.axes[3] ?? 0);
    this.padDown = gp.buttons.map((b) => b.pressed || b.value > 0.5);
    if (this.padDown.some((b) => b) || Math.abs(this.padMove.x) + Math.abs(this.padMove.y) + Math.abs(this.padLook.x) > 0) {
      if (this.lastDevice !== 'pad') this.lastDevice = 'pad';
      if (this.padDown.some((b, i) => b && !this.padPrev[i])) this.onAnyKey?.();
    }
  }

  endFrame() {
    this.pressedSet.clear();
    this.releasedSet.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}
