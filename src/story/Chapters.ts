import * as THREE from 'three';
import type { Director, Script } from './Director';
import type { World } from '../game/World';
import type { CastId } from '../chars/Cast';
import { SURVIVORS, CAST } from '../chars/Cast';
import { CHAPTERS } from './Lore';
import { audio } from '../core/Audio';
import { PM, part, buildProp } from '../world/Props';
import { compact } from '../entities/Models';
import { NPC } from '../entities/NPC';
import { T } from '../world/Level';
import type { EnemyKind } from '../world/LevelDef';
import { saveGame } from '../game/State';

export interface ChapterDef {
  start(S: Script): Promise<void>;
  resume?(S: Script): Promise<void>;
  levels?: Record<string, (S: Script, w: World) => Promise<void>>;
  objective?(d: Director): string;
  beforeTravel?(d: Director, to: string, spawn: string): Promise<boolean>;
  canSleep?(d: Director): boolean;
  hubAbsent?: CastId[];
  hubPose?: Partial<Record<CastId, string | null>>;
}

// ------------------------------------------------------------------ helpers
async function card(S: Script, id: string) {
  const c = CHAPTERS.find((x) => x.id === id);
  if (!c) return;
  await S.guard(S.g.ui.chapterCard(c.num, c.title, c.sub));
}

function V(x: number, y: number, z: number) {
  return new THREE.Vector3(x, y, z);
}

/** The shipping container the twelve wake up in. */
function buildContainer(w: World, closed: boolean) {
  const sp = w.level.spawns.container.pos;
  const c = sp.clone().add(V(0, 0, 4.6));
  const P = PM();
  const g = new THREE.Group();
  const col = 0x8a2e22;
  g.add(compact(new THREE.Group().add(
    part(new THREE.BoxGeometry(1, 1, 1), P.metal, 0x2a2a2a, [0, 0.05, 0], [2.45, 0.1, 12.2]),
    part(new THREE.BoxGeometry(1, 1, 1), P.container, col, [1.22, 1.3, 0], [0.08, 2.6, 12.2]),
    part(new THREE.BoxGeometry(1, 1, 1), P.container, col, [-1.22, 1.3, 0], [0.08, 2.6, 12.2]),
    part(new THREE.BoxGeometry(1, 1, 1), P.container, col, [0, 1.3, -6.1], [2.45, 2.6, 0.08]),
    part(new THREE.BoxGeometry(1, 1, 1), P.container, col, [0, 2.62, 0], [2.52, 0.08, 12.3]),
    part(new THREE.BoxGeometry(1, 1, 1), P.metal, 0x1a1a1a, [0, 2.58, 0], [2.3, 0.04, 12]),
    part(new THREE.CylinderGeometry(1, 1, 1, 8), P.glowV, 0xffa860, [0, 2.45, -1], [0.07, 0.12, 0.07]),
    part(new THREE.CylinderGeometry(1, 1, 1, 8), P.glowV, 0xff8a50, [0, 2.45, 3.5], [0.06, 0.1, 0.06]),
  )));
  const leaves: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const piv = new THREE.Group();
    piv.position.set(1.22 * s, 0, 6.1);
    const leaf = compact(new THREE.Group().add(part(new THREE.BoxGeometry(1, 1, 1), P.container, col, [-0.61 * s, 1.3, 0], [1.22, 2.55, 0.08])));
    piv.add(leaf);
    if (!closed) piv.rotation.y = s * 1.9;
    g.add(piv);
    leaves.push(piv);
  }
  g.position.copy(c);
  w.scene.add(g);
  w.level.group.add(g);
  const bx = (x0: number, x1: number, z0: number, z1: number) => w.level.addBox({ minX: c.x + x0, maxX: c.x + x1, minZ: c.z + z0, maxZ: c.z + z1, h: 2.6 });
  bx(1.18, 1.3, -6.1, 6.1);
  bx(-1.3, -1.18, -6.1, 6.1);
  bx(-1.25, 1.25, -6.2, -6.05);
  const door = bx(-1.25, 1.25, 6.05, 6.2);
  door.active = closed;
  w.level.lights.push({ pos: c.clone().add(V(0, 2.3, -1)), color: new THREE.Color(0xffa060), intensity: 14, range: 9, flicker: 0.25 });
  w.level.lights.push({ pos: c.clone().add(V(0, 2.3, 3.5)), color: new THREE.Color(0xff8a50), intensity: 8, range: 7, flicker: 0.1 });
  return {
    center: c,
    doorZ: c.z + 6.1,
    async open() {
      audio.play('door', { pos: c, vol: 1, pitch: 0.6 });
      audio.play('machinery', { vol: 0.6 });
      const t0 = performance.now();
      await new Promise<void>((res) => {
        const tick = () => {
          const k = Math.min(1, (performance.now() - t0) / 1800);
          const e = 1 - Math.pow(1 - k, 3);
          leaves[0].rotation.y = e * 1.9;
          leaves[1].rotation.y = -e * 1.9;
          if (k < 1) requestAnimationFrame(tick);
          else res();
        };
        tick();
      });
      door.active = false;
    },
  };
}

function captainHolo(S: Script, at: THREE.Vector3, scale = 1.5, yaw = 0) {
  const w = S.w;
  let n = w.npc('captain');
  if (!n) {
    n = new NPC(w, 'captain');
    w.scene.add(n.root);
    w.npcs.push(n);
  }
  n.place(at, yaw);
  n.root.scale.setScalar(scale);
  n.interactable = false;
  n.lookAtPlayer = false;
  audio.play('teleport', { pos: at, vol: 0.6, pitch: 0.5 });
  S.g.fx.explosion(at.clone().setY(1.5), 'psychic', 1.2);
  return n;
}
function removeCaptain(S: Script) {
  const w = S.w;
  const n = w.npc('captain');
  if (!n) return;
  S.g.fx.explosion(n.pos.clone().setY(1.5), 'psychic', 1);
  audio.play('glitch', { vol: 0.5 });
  n.dispose();
  w.npcs = w.npcs.filter((x) => x !== n);
}

/** Survivors gather around the hologram pillar, the Captain speaks. */
async function hubBriefing(S: Script, lines: [string, string, string?][], afterFlag?: string) {
  const w = S.w;
  const hall = w.level.spawns.hall.pos;
  const pillar = w.level.spawns.captain.pos;
  await S.cinematic(async () => {
    // gather
    let i = 0;
    const alive = SURVIVORS.filter((s) => s !== 'noah' && S.g.state.alive[s]);
    for (const id of alive) {
      const n = w.npc(id);
      if (!n) continue;
      const a = Math.PI * 0.15 + (i / Math.max(1, alive.length - 1)) * Math.PI * 0.7;
      const p = pillar.clone().add(V(Math.cos(a) * 4.2, 0, Math.sin(a) * 4.2));
      n.teleport(p);
      n.yaw = n.homeYaw = Math.atan2(pillar.x - p.x, pillar.z - p.z);
      n.setPose(null);
      i++;
    }
    w.player.place(hall.clone().add(V(0, 0, 0.5)), Math.PI);
    const cap = captainHolo(S, pillar, 1.6, 0);
    cap.yaw = Math.atan2(hall.x - pillar.x, hall.z - pillar.z);
    S.shot(pillar.clone().add(V(-2.5, 1.2, 6.5)), pillar.clone().setY(2.6), { fov: 50, blend: 0, drift: V(0.25, 0.05, 0) });
    audio.play('captain', { vol: 0.5 });
    await S.wait(0.6);
    for (const l of lines) {
      if (l[0] !== 'captain' && l[0] !== 'noah') S.d.autoCam = true;
      await S.say(l[0], l[1], { pose: l[2], cam: l[0] !== 'captain' });
      if (l[0] === 'captain') S.shot(pillar.clone().add(V(Math.random() * 4 - 2, 1.0, 6)), pillar.clone().setY(2.8), { fov: 46, blend: 0.4 });
    }
    removeCaptain(S);
    if (afterFlag) S.g.setFlag(afterFlag);
  });
  // send everyone home
  for (const id of SURVIVORS) {
    const n = w.npc(id as CastId);
    const sp = w.level.spawns['n_' + id];
    if (n && sp) void n.walkTo(sp.pos, 2.4).then(() => {
      n.homeYaw = sp.yaw;
      n.mode = 'idle';
    });
  }
}

/** Hub investigation phase after a vessel: evidence, then Sunday announcement. */
async function investigation(S: Script, opts: { spawns: [string, string][]; required: string[]; intro: [string, string, string?][]; label: string }) {
  const st = S.g.state;
  for (const [ev, sp] of opts.spawns) S.d.spawnEvidenceAt(ev, sp);
  await S.step('inv_intro_' + st.chapter, async () => {
    await S.cinematic(async () => {
      await S.lines(opts.intro);
    });
    S.journal(opts.label);
  });
  const upd = () => {
    const n = opts.required.filter((e) => st.evidence.includes(e)).length;
    S.objective(`Investigate before Sunday’s Deck Trial — evidence ${n}/${opts.required.length}. Talk to survivors; examine pink markers.`);
    return n >= opts.required.length;
  };
  while (!upd()) await S.waitAny(['evidence', 'talked']);
  await S.step('sunday_' + st.chapter, async () => {
    await S.cinematic(async () => {
      audio.play('bell', { vol: 0.8, pitch: 0.5 });
      await S.wait(0.6);
      audio.play('bell', { vol: 0.8, pitch: 0.5 });
      await S.captain('Ding dong! It’s SUNDAY, my darlings! All passengers to the Ballroom. Bring your evidence. Bring your grudges. Bring snacks.');
      await S.thought('The Ballroom. East end of the crew corridor. Whatever I say in there — someone falls.');
    });
    S.g.setFlag('trial_ready');
  });
  S.objective('Go to the Ballroom (east end of the crew corridor) for the Deck Trial.');
}

/** Standard morning-after for chapters that start after a trial. */
async function morning(S: Script, lines: [string, string, string?][], openFlag: string, gateLabel: string) {
  await S.step('morning_' + S.g.state.chapter, async () => {
    S.g.setFlag('trial_ready', false);
    await hubBriefing(S, lines, openFlag);
    S.g.save();
  });
  S.objective(`Take the ${gateLabel} gangway.`);
}

function companion(S: Script) {
  const w = S.w;
  return w.npcs.find((n) => n.mode === 'follow');
}

async function spawnWave(S: Script, kinds: [EnemyKind, number][], center: THREE.Vector3, r = 5) {
  const w = S.w;
  const out = [];
  for (const [k, n] of kinds)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const p = center.clone().add(V(Math.cos(a) * r, 0, Math.sin(a) * r));
      const [gx, gz] = w.level.cellOf(p.x, p.z);
      if (!w.level.walkable(gx, gz)) {
        const q = w.level.randomFloorNear(center, Math.ceil(r / 3));
        if (q) p.copy(q);
      }
      out.push(w.spawnEnemy(k, p, { rise: true }));
      await S.wait(0.15);
    }
  return out;
}
async function waitClear(S: Script, list: { dead: boolean }[]) {
  await S.waitUntil(() => list.every((e) => e.dead));
}

async function returnHome(S: Script, bossFlag: string) {
  await S.waitFlag(bossFlag);
  await S.wait(2.5);
}

function trialChapter(id: string, next: string): ChapterDef {
  return {
    resume(S) {
      return this.start(S);
    },
    async start(S) {
      await card(S, id);
      for (;;) {
        const r = await S.trial(id);
        if (r.outcome === 'quit') return;
        if (r.outcome !== 'fail') {
          if (r.outcome === 'truth' || r.outcome === 'mask') S.g.state.flags.final = r.outcome;
          S.d.completeChapter(next);
          return;
        }
      }
    },
  };
}

// ------------------------------------------------------------------ chapters
export const CHAPTER_DEFS: Record<string, ChapterDef> = {
  // =================================================================== PROLOGUE
  prologue: {
    resume(S) {
      return this.start(S);
    },
    async start(S) {
      const g = S.g;
      g.mode = 'play';
      g.setFadeInstant(1);
      g.ui.hud.show(false);
      g.cinematic = true;
      g.music.play('none', 1);
      audio.setAmbience('none');
      await S.guard(g.ui.narrate([
        'In a world ravaged by cataclysm — nuclear fire, then the meteors, then the volcanoes — the ash never settled. The night never ended.',
        'Humanity clings on underground, warmed by the geothermal mercy of GloomTech Industries.',
        'Above it all hums the Undernet: a digital realm thriving amidst chaos. A sanctuary for the twisted and the bored.',
        'And through the Undernet, a mysterious invitation circulates among the condemned. A promise of freedom — in a game of survival aboard vessels bound by secrets and despair.',
      ]));
      audio.startLoop('heli', 'helicopter', 0.9);
      await S.wait(4.5);
      audio.play('machinery', { vol: 0.8 });
      await S.wait(2.8);
      audio.play('fall', { vol: 0.9 });
      await S.wait(2.4);
      audio.stopLoop('heli');
      audio.play('thud', { vol: 1.2, rev: 0.6 });
      g.rig.addShake(1.4);
      g.glitch(0.4);
      await S.wait(2.2);
      await S.say('captain', 'Welcome to my game. The ultimate test of wills. Only the cunning will survive.', { style: 'captain', cam: false });
      g.ui.dlg.hide();
      await S.guard(g.ui.chapterCard('A GLOOMTECH™ BROADCAST', 'GHASTMARINA', 'Voyage of the Betrayed'));
      g.cinematic = false;
      S.d.completeChapter('ch1');
    },
  },

  // =================================================================== CHAPTER 1
  ch1: {
    async start(S) {
      S.g.setFadeInstant(1);
      await card(S, 'ch1');
      await S.load('hub', S.done('ch1_wake') ? 'deck' : 'container', { fade: false });
    },
    canSleep: (d) => d.game.flag('step_ch1_deck') && !d.game.flag('step_ch1_night'),
    levels: {
      hub: async (S, w) => {
        const g = S.g;
        const cont = buildContainer(w, !S.done('ch1_wake'));
        await S.step('ch1_wake', async () => {
          g.ui.hud.show(false);
          const pl = w.player;
          const c = cont.center;
          pl.place(c.clone().add(V(0, 0, -4.2)), 0);
          pl.anim.p.pose = 'lie';
          pl.anim.p.poseW = 1;
          pl.anim.snap();
          // everyone inside the container
          const inside: CastId[] = ['hana', 'dexter', 'leo', 'elise', 'aria', 'fiona', 'grant', 'kai', 'jade', 'isaac', 'luna'];
          const poses = ['lie', 'sitFloor', 'lieSide', 'sitFloor', 'lie', 'slump', 'lieSide', 'sitFloor', 'lie', 'slump', 'lieSide'];
          inside.forEach((id, i) => {
            const n = w.npc(id);
            if (!n) return;
            const side = i % 2 ? 0.65 : -0.65;
            n.teleport(c.clone().add(V(side, 0, -2.8 + i * 0.85)));
            n.yaw = n.homeYaw = side > 0 ? -Math.PI / 2 + 0.4 : Math.PI / 2 - 0.4;
            n.setPose(poses[i]);
            n.lookAtPlayer = false;
            n.anim.p.pose = poses[i];
            n.anim.p.poseW = 1;
            n.anim.snap();
          });
          g.rig.ceiling = 2.4;
          await S.cinematic(async () => {
            const face = pl.pos.clone().setY(0.35);
            S.shot(face.clone().add(V(0.9, 0.35, 1.2)), face.clone().add(V(0, 0.05, 0)), { fov: 40, blend: 0, drift: V(0, 0.02, 0.03) });
            audio.setMuffle(true);
            g.music.play('container', 3);
            audio.setAmbience('container');
            await S.wait(1.5);
            await S.fade(0, 3.5);
            await S.thought('Cold metal under my cheek. Copper in my mouth. Somewhere above me, a helicopter fading away…');
            audio.setMuffle(false);
            await S.thought('Where… am I?');
            pl.anim.p.pose = 'sitFloor';
            S.shot(c.clone().add(V(0.9, 1.5, -1.0)), pl.pos.clone().setY(0.8), { fov: 48, blend: 1.4 });
            await S.wait(1.4);
            audio.play('chime', { vol: 0.5 });
            await S.band('GloomOS 9.1 booting… Biometric lock confirmed. Welcome, *Participant #07*.');
            pl.anim.p.pose = 'band';
            await S.wait(1.2);
            pl.anim.p.pose = null;
            pl.anim.p.poseW = 0;
            await S.wait(0.6);
            S.d.autoCam = false;
            // close-ups framed from the centre aisle so nobody else blocks the lens
            const look = (id: CastId) => {
              const n = w.npc(id)!;
              n.setPose(null);
              const side = Math.sign(n.pos.x - c.x) || 1;
              const cam = V(c.x - side * 0.15, 1.25, n.pos.z + 1.35);
              S.shot(cam, n.pos.clone().setY(1.25), { fov: 46, blend: 0.6 });
            };
            look('hana');
            await S.say('hana', 'Hey — hey! Is everyone breathing? Count off! I’m Hana!');
            look('dexter');
            await S.say('dexter', 'Dexter. Stay calm. Nobody panics, nobody gets hurt.', { pose: 'hips' });
            look('leo');
            await S.say('leo', 'Calm? We’re in a box, soldier. A rusty, moving box. I’d say the odds are… not great.');
            look('elise');
            await S.say('elise', 'Don’t stand up too fast. We were sedated — benzodiazepines, maybe something worse. I’m Elise. I’m a doctor.', { pose: 'think' });
            look('aria');
            await S.say('aria', 'These wristbands are networked. Something is broadcasting through them. Right now.', { pose: 'band' });
            look('fiona');
            await S.say('fiona', 'Twelve of us. Twelve bands. Someone planned this down to the number.', { pose: 'cross' });
            look('grant');
            await S.say('grant', 'Let’s all take a breath. Whoever brought us here wants something. That means we have leverage.');
            look('kai');
            await S.say('kai', 'Smell that? Salt. Ice. We’re at sea.');
            look('jade');
            await S.say('jade', 'And the door’s locked from the outside. Cute.', { pose: 'cross' });
            look('isaac');
            await S.say('isaac', 'Hydraulic latch. If I had a screwdriver—');
            look('luna');
            await S.say('luna', 'It isn’t a lock. It’s a curtain. The show hasn’t started yet.', { pose: 'meditate' });
            S.d.autoCam = true;
            S.shot(c.clone().add(V(0, 2.1, 5.4)), c.clone().add(V(0, 1.0, -2)), { fov: 60, blend: 1.0 });
            audio.play('chime', { vol: 0.7 });
            await S.wait(0.15);
            audio.play('chime', { vol: 0.7, pitch: 1.1 });
            for (const id of inside) w.npc(id)?.setPose('band');
            await S.wait(0.8);
            await S.captain('Welcome aboard, inmates. Survive, and you’re free. Fail, and you feed the abyss.');
            await S.captain('Let the voyage begin.');
            for (const id of inside) w.npc(id)?.setPose(null);
            // the doors swing open — the reveal
            S.shot(c.clone().add(V(0, 1.6, 3.5)), c.clone().add(V(0, 1.5, 9)), { fov: 55, blend: 0.6 });
            await S.guard(cont.open());
            g.rig.ceiling = 99;
            S.shot(c.clone().add(V(5, 7, 9)), V(58.5, 22, 13.5), { fov: 58, blend: 2.5, drift: V(0.4, 0.8, 0.3) });
            g.music.play('hub', 4);
            audio.setAmbience('deck');
            await S.wait(3.5);
            await S.thought('Ships. Six of them, chained around a pillar of light that punches straight through the ash. And the sea… the sea is frozen solid.');
          });
          g.ui.hud.show(true);
          g.rig.ceiling = 99;
          for (const id of inside) {
            const n = w.npc(id)!;
            n.lookAtPlayer = true;
          }
        });
        g.ui.hud.show(true);
        await S.step('ch1_deck', async () => {
          S.objective('Step out of the container.');
          S.hint('[W][A][S][D] move · Mouse look · [Shift] sprint · [Ctrl] sneak', 8);
          await S.waitUntil(() => w.player.pos.z > cont.doorZ + 2.5);
          const deck = w.level.spawns.deck.pos;
          const spire = V(57, 0, 19);
          await S.cinematic(async () => {
            for (const id of SURVIVORS) {
              const n = w.npc(id as CastId);
              if (!n) continue;
              n.teleport(deck.clone().add(V(Math.random() * 8 - 4, 0, Math.random() * 3)));
              n.yaw = n.homeYaw = Math.atan2(spire.x - n.pos.x, spire.z - n.pos.z);
              n.setPose(null);
            }
            w.player.place(deck.clone().add(V(0, 0, 2)), Math.atan2(spire.x - deck.x, spire.z - deck.z));
            const cap = captainHolo(S, spire.clone().add(V(0, 2.5, 0)), 4.2, Math.atan2(deck.x - spire.x, deck.z - spire.z));
            void cap;
            S.shot(deck.clone().add(V(-3, 1.4, 6)), spire.clone().setY(8), { fov: 55, blend: 0, drift: V(0.3, 0.1, 0) });
            await S.captain('Ah. My passengers. Death row’s finest — murderers, thieves, liars — plucked from your cells by an offer you were all too eager to accept.');
            await S.captain('You stand aboard the *GhastMarina*. Six vessels chained to the Polaris Core. Each one a little world. Each one… occupied.');
            await S.captain('The rules are simple. Survive. Explore. And every Sunday, gather in the Ballroom for a *Deck Trial*.');
            S.shot(spire.clone().add(V(4, 4, 14)), spire.clone().setY(9), { fov: 40, blend: 1.2 });
            await S.captain('Because one of you is not what you seem. One of you is my *mole*. A saboteur who will see you all fed to the deep.');
            await S.captain('Find the mole. Vote them out. The one you choose will be tranquilized by their wristband and cast into the *Isolation Zone*.');
            await S.captain('Choose wrong… and you’ll keep sharing your bunks with a viper.');
            await S.captain('Oh — and do smile. Twelve thousand viewers on the Undernet are watching. They tip *generously* for spectacle.');
            removeCaptain(S);
            await S.say('dexter', 'A mole. Great. Now we watch each other’s backs AND our own.', { pose: 'hips' });
            await S.say('grant', 'Nobody accuses anybody. Not yet. We find shelter, food, information.', { pose: 'think' });
            await S.say('fiona', 'The bands list room assignments. We’re expected to sleep here. Like guests.', { pose: 'cross' });
            await S.band('Participant #07 — assigned quarters: *Room 237*, crew corridor (south).');
          });
          for (const id of SURVIVORS) {
            const n = w.npc(id as CastId);
            const sp = w.level.spawns['n_' + id];
            if (n && sp) void n.walkTo(sp.pos, 2.2).then(() => {
              n.homeYaw = sp.yaw;
              n.mode = 'idle';
            });
          }
          S.message('captain', 'Explore, mingle, rest. Tomorrow the real fun begins. — C.');
          g.save();
        });
        await S.step('ch1_explore', async () => {
          S.objective('Explore the Polaris Vessel, then rest in Room 237 (crew quarters, south). Optional: talk to the others.');
          S.hint('[Tab] opens your GloomBand · [E] interact · Talk to survivors for supplies', 8);
          S.journal('Woke in a shipping container with eleven strangers. A man called the Captain says one of us is his mole. I keep looking at my hands.');
          await S.waitEvent('sleep');
        });
        await S.step('ch1_night', async () => {
          await S.cinematic(async () => {
            const pl = w.player;
            const bed = w.level.spawns.room237.pos;
            await S.fade(1, 1.2);
            pl.place(bed.clone().add(V(0, 0, 1.5)), 0);
            pl.anim.p.pose = 'sit';
            pl.anim.p.poseW = 1;
            S.shot(bed.clone().add(V(1.4, 1.6, 2.6)), pl.pos.clone().setY(1.0), { fov: 45 });
            g.music.play('tension', 2);
            await S.fade(0, 1.5);
            audio.play('chime', { vol: 0.5, pitch: 0.7 });
            pl.anim.p.pose = 'band';
            await S.band('PRIVATE COMMUNICATION — THE CAPTAIN');
            await S.captain('Hello, Noah. You are wondering why you feel different from the others. Why their words trigger responses you don’t understand.');
            await S.captain('Why you sometimes lose time. Why you find things in your pockets you don’t remember taking.');
            g.glitch(1.2);
            audio.play('glitch', { vol: 0.6 });
            await S.captain('The truth is simple: you are my instrument aboard this vessel. You will not remember these instructions clearly. But you will follow them.');
            await S.captain('Welcome to your true purpose. Sweet dreams.');
            g.glitch(1);
            await S.thought('What… what was that? I read it. I know I read it. But it’s already fading, like a dream at breakfast—');
            g.ui.hud.whisper('…you’re just remembering who you really are…');
            audio.play('whisper', { vol: 0.8 });
            await S.fade(1, 2.5);
            await S.wait(1.5);
            // morning
            audio.startLoop('alarm', 'alarm', 0.6);
            pl.anim.p.pose = null;
            pl.anim.p.poseW = 0;
            await S.fade(0, 0.8);
            await S.band('EMERGENCY. All participants proceed to the Central Deck immediately.');
            await S.thought('My hands are filthy. Grease under the nails. I washed them last night. I’m sure I washed them.');
            audio.stopLoop('alarm');
          });
          await hubBriefing(S, [
            ['captain', 'Good morning, my dear passengers! I trust you slept well. Most of you, anyway.'],
            ['captain', 'Today’s assignment: the *Forgotten City Vessel*. Its power grid has failed, and the gate to the city plaza is dead. Restore it.'],
            ['captain', 'Restore the grid and the GloomMart restocks. Fail, and the lights go out. Everywhere.'],
            ['elise', 'Before anyone goes anywhere — someone robbed my medbay last night. Every antibiotic. Every stim. Gone.', 'think'],
            ['dexter', 'Night one and we already have a thief.', 'hips'],
            ['hana', 'I’ll scout the city! Noah — you’re awake, you’re standing, you’re coming with me.'],
            ['noah', 'Lucky me.'],
            ['captain', 'Splendid! The gangway to the City Vessel is open. North-east deck. Do try not to die in the first ten minutes. The sponsors hate that.'],
          ], 'open_city');
          S.journal('Found grease under my nails this morning. The medbay was robbed overnight. I don’t remember leaving my room.');
        });
        S.d.completeChapter('ch2');
      },
    },
  },

  // =================================================================== CHAPTER 2
  ch2: {
    async start(S) {
      await card(S, 'ch2');
      if (S.d.freshRun || S.g.world?.def.id !== 'hub') await S.load('hub', 'hall');
      else S.d.rerunLevel();
    },
    levels: {
      hub: async (S, w) => {
        if (!S.g.flag('boss_gridlock_dead')) {
          S.objective('Take the City Vessel gangway — north-east corner of the deck. Hana will meet you there.');
          return;
        }
        await investigation(S, {
          spawns: [['poker_chip', 'ev_cargo'], ['gt_keycard', 'ev_cargo']],
          required: ['medbay_list', 'jade_testimony', 'poker_chip', 'gt_keycard'],
          intro: [
            ['hana', 'Home sweet haunted home. You okay? You went somewhere back there. In your head.'],
            ['noah', 'I’m fine. Just tired.'],
            ['band', 'GLOOMTEXT — THE CAPTAIN: “Sunday is almost here! Find my medbay thief before the Deck Trial — or vote blind. Either is good television.”'],
            ['hana', 'Talk to people. Elise, Jade, Leo. Kai said he smelled something in the cargo hold.'],
          ],
          label: 'Back from the City. The relay was sabotaged and I have a cut wire I don’t remember cutting. Someone stole the medbay supplies. Sunday is coming.',
        });
      },
      city: async (S, w) => {
        const g = S.g;
        await S.step('city_intro', async () => {
          await S.cinematic(async () => {
            const h = w.npc('hana');
            await S.say('hana', 'Whoa. A whole city. On a boat. Overgrown, rotting, moaning… but a city!');
            await S.say('hana', 'The plaza gate is dead. The relay that powers it is on the east avenue — it’ll need fuses. Three, if the sign’s right.');
            await S.say('noah', 'And the moaning?');
            await S.say('hana', 'Residents. Former residents. Let’s not ask them for directions.');
            void h;
          });
          S.hint('[LMB] attack · Sneak up behind unaware mutants and press [E] for a silent takedown', 8);
        });
        S.when('trigger:pistol_room', async (S2) => {
          S2.bark('hana', 'Police armory! Is that a GUN? Take it, take it!');
          S2.hint('Hold [RMB] to aim, [LMB] to fire, [R] to reload · Headshots deal massive damage', 8);
        });
        S.when('terminal:relay_term', async (S2) => {
          await S2.evidence('override_log');
        });
        const fuses = () => w.game.state.picked.filter((p) => p.startsWith('city:fuse')).length + (g.flag('city_power') ? 3 : 0);
        while (!g.flag('city_power')) {
          const n = Math.min(3, fuses());
          S.objective(n < 3 ? `Find the Grid Fuses (${n}/3) — try the police station, the subway, and the apartments.` : 'Insert the fuses at the relay fusebox (east avenue, by the plaza gate).');
          await S.waitAny(['pickup:fuse', 'flag:city_power']);
          if (fuses() === 1 && !S.done('city_fuse1')) {
            S.bark('hana', 'One down! I can hear the relay humming already.');
            g.setFlag('step_city_fuse1');
          }
        }
        await S.step('city_blackout', async () => {
          await S.blackout('cut_wire', 'Where— the relay’s sparking. My hands smell like burnt copper. And there’s a wire in my pocket. Cut clean. I don’t remember—');
          S.bark('hana', 'NOAH! Someone cut the backup line — the gate nearly came down on top of me!', 5);
          const center = w.player.pos.clone();
          const wave = await spawnWave(S, [['runner', 3], ['shambler', 3]], center, 9);
          S.objective('Survive the ambush!');
          await waitClear(S, wave);
          await S.cinematic(async () => {
            const h = w.npc('hana');
            if (h) h.teleport(w.player.pos.clone().add(V(1.5, 0, 1)));
            await S.say('hana', 'That was too close. Right before the gate dropped, I saw someone by the relay. A dark jacket. Just a shape.');
            await S.say('noah', '…A dark jacket.');
            await S.say('hana', 'Half this boat wears dark jackets. Come on — the plaza’s open.');
          });
          await S.evidence('hana_testimony');
          S.hint('The relay terminal might have logged who cut the line — hack it.', 6);
        });
        S.objective('Enter the plaza. Something big is waiting.');
        await S.step('city_boss_intro', async () => {
          await S.waitEvent('trigger:boss_gridlock');
          await S.boss('gridlock');
        });
        if (!g.flag('boss_gridlock_dead')) {
          const b = w.bosses.find((x) => x.bossKind === 'gridlock');
          if (b && !b.started) {
            w.startBoss('gridlock');
            g.ui.hud.bossBar(b);
          }
        }
        await returnHome(S, 'boss_gridlock_dead');
        await S.step('city_outro', async () => {
          await S.cinematic(async () => {
            await S.captain('Bravo! The Commuter has finally reached his stop. The viewers are on their FEET.');
            await S.say('hana', 'We did it. We actually did it.');
            await S.say('hana', 'Let’s go home, Noah. Well. “Home.”');
          });
          S.message('viewer', 'ur the best contestant lol. tipped u 50. pls do the thing where u hit them with the pipe again');
          g.state.credits += 50;
        });
        S.objective('Return to the Polaris — the gangway at the north end of the plaza.');
      },
    },
    beforeTravel: async (d, to) => {
      if (to === 'ballroom' && d.game.flag('trial_ready')) {
        d.completeChapter('trial1');
        return false;
      }
      return true;
    },
  },

  trial1: trialChapter('trial1', 'ch3'),

  // =================================================================== CHAPTER 3
  ch3: {
    async start(S) {
      await card(S, 'ch3');
      await S.load('hub', 'hall');
    },
    levels: {
      hub: async (S, w) => {
        await morning(S, [
          ['captain', 'Our first casualty of conscience! Leo enjoyed his trip into the dark. Briefly.'],
          ['grant', 'We voted a man into a pit and you’re making jokes.', 'despair'],
          ['captain', 'I’m making TELEVISION, Grant. Today’s set: the *Industrial Complex*. Its furnaces have gone cold, and the hub is getting chilly.'],
          ['captain', 'Relight them and you get heat. And weapons. Oh, I do love weapons.'],
          ['isaac', 'Furnaces, presses, conveyors… that’s my kind of vessel. I’m going with Noah.', 'point'],
          ['fiona', 'Take care, both of you. The Captain seems to know our plans before we make them.', 'cross'],
        ], 'open_ind', 'Industrial Vessel (east deck)');
        if (!S.g.flag('boss_foreman_dead')) return;
        await investigation(S, {
          spawns: [['transmitter', 'ev_chapel'], ['tie_clip', 'ev_chapel'], ['grant_notes', 'ev_lounge']],
          required: ['transmitter', 'tie_clip', 'grant_notes', 'kai_testimony'],
          intro: [
            ['isaac', 'I still can’t feel two of my fingers. That press was locked out, Noah. LOCKED OUT.', 'despair'],
            ['band', 'GLOOMTEXT — THE CAPTAIN: “Someone has been whispering sweet nothings to me at 2 AM. Shall we find out who before Sunday?”'],
            ['noah', 'Someone’s talking to him. Luna mentioned the chapel organ humming at night…'],
          ],
          label: 'Isaac nearly lost his arm to a reprogrammed press. I blacked out right before it fired and woke with a press key in my boot. Someone has been talking to the Captain.',
        });
      },
      industrial: async (S, w) => {
        const g = S.g;
        await S.step('ind_intro', async () => {
          await S.cinematic(async () => {
            await S.say('isaac', 'Listen to it. Everything still running, nobody at the controls. Beautiful. Horrible.');
            await S.say('isaac', 'Three furnaces in the north-east room. One needs a valve wheel — check storage. The others are just levers.');
            await S.say('isaac', 'Watch the presses and steam vents. And the conveyors will drag you right into them if you let them.');
          });
          S.hint('Hold [Shift] to sprint past presses when their warning light flashes', 6);
        });
        S.when('trigger:press_scene', async (S2) => {
          await S2.step('ind_press', async () => {
            await S2.blackout('press_card', 'I’m by the press panel. Why am I by the press panel? There’s a maintenance key in my boot—');
            const isaac = w.npc('isaac');
            await S2.cinematic(async () => {
              audio.play('stomp', { vol: 1.2 });
              S2.g.rig.addShake(1);
              if (isaac) {
                isaac.teleport(w.player.pos.clone().add(V(2, 0, 0.5)));
                isaac.setPose('clutch');
              }
              await S2.say('isaac', 'AAGH— my ARM! The press — it fired out of cycle! It was locked out, I CHECKED it!');
              await S2.say('noah', 'Are you okay? Can you move it?');
              await S2.say('isaac', 'Two fingers aren’t talking to me. Someone reprogrammed the cycle. From a GloomBand. Seconds before I reached in.');
              isaac?.setPose(null);
            });
          });
        });
        const upd = () => {
          const n = ['furnace1', 'furnace2', 'furnace3'].filter((f) => g.flag(f)).length;
          if (n === 3 && !g.flag('furnace_lit')) {
            g.setFlag('furnace_lit');
            audio.play('explosion', { vol: 0.6, pitch: 0.6 });
            g.rig.addShake(0.5);
          }
          S.objective(n < 3 ? `Relight the furnaces (${n}/3) — north-east furnace room. The armory needs the Foreman’s red keycard.` : 'The furnaces roar. The Line 7 floor is open — go south-east through the boiler corridor.');
          return n;
        };
        while (upd() < 3) await S.waitAny(['flag:furnace1', 'flag:furnace2', 'flag:furnace3']);
        await S.step('ind_lit', async () => {
          S.bark('captain', 'Toasty! Now meet the shift supervisor. He hasn’t clocked out in a very long time.', 5);
        });
        await S.step('ind_boss', async () => {
          await S.waitEvent('trigger:boss_foreman');
          await S.boss('foreman');
        });
        await returnHome(S, 'boss_foreman_dead');
        await S.step('ind_outro', async () => {
          await S.cinematic(async () => {
            await S.say('isaac', 'Shift’s over, boss.');
            await S.captain('Oh, splendid work. The hub is warm, the armory is open, and somebody almost lost an arm. Peak content.');
          });
        });
        S.objective('Return to the Polaris (gangway in the south-east of the Foreman’s floor).');
      },
    },
    beforeTravel: async (d, to) => {
      if (to === 'ballroom' && d.game.flag('trial_ready')) {
        d.completeChapter('trial2');
        return false;
      }
      return true;
    },
  },

  trial2: trialChapter('trial2', 'ch4'),

  // =================================================================== CHAPTER 4
  ch4: {
    async start(S) {
      await card(S, 'ch4');
      await S.load('hub', 'hall');
    },
    levels: {
      hub: async (S, w) => {
        await morning(S, [
          ['captain', 'Grant has negotiated his way into the Isolation Zone. I hear the terms down there are… firm.'],
          ['captain', 'Today: the *Subterranean Lab Vessel*. GloomTech’s finest work lives there. Some of it lives in cages. Some of it doesn’t.'],
          ['captain', 'And Doctor Elise — you’ll feel right at home.'],
          ['elise', '…', 'despair'],
          ['elise', 'I’m going with Noah. There are things in that lab only I will recognize.', 'think'],
        ], 'open_lab', 'Lab Vessel (south-east deck)');
        if (!S.g.flag('boss_subjectZero_dead')) return;
        await investigation(S, {
          spawns: [['heart_core', 'ev_quarters']],
          required: ['lockpick', 'broken_chain', 'cell_record', 'heart_core'],
          intro: [
            ['elise', 'You read my logs, Noah. I know you did. I’ll tell them myself.', 'despair'],
            ['band', 'GLOOMTEXT — THE CAPTAIN: “My vault! My beautiful Gloomheart! And my precious Subject Zero, out for a stroll. Find me the thief, darlings.”'],
            ['noah', 'Jade’s been very quiet. And Room 235 is on the way to mine.'],
          ],
          label: 'My hands tore up Elise’s antidote formula. I found half of it in my pocket. Someone also robbed the lab vault and let Subject Zero out.',
        });
      },
      lab: async (S, w) => {
        const g = S.g;
        await S.step('lab_intro', async () => {
          await S.cinematic(async () => {
            await S.say('elise', 'Reception. Same carpet. Same terrible art. I walked through this lobby every morning for three years.');
            await S.say('noah', 'You worked here.');
            await S.say('elise', 'I’ll explain. Not here. The laser curtains are on — the security mainframe in the server room can shut them down.');
            await S.say('elise', 'And Noah — keep your light on. The things here don’t like being seen.');
          });
          S.hint('Phantoms are nearly invisible — sweep your GloomBand light [F] over them to reveal them', 8);
        });
        S.when('log:lab_log2', async (S2) => {
          await S2.evidence('elise_logs');
        });
        S.when('terminal:cell_term', async (S2) => {
          await S2.evidence('cell_record');
        });
        S.when('trigger:lab_office', async (S2) => {
          await S2.step('lab_blackout', async () => {
            await S2.cinematic(async () => {
              await S2.say('elise', 'My office. They kept it exactly… my notes should be in the desk. The antidote. Everything I—');
              await S2.say('elise', 'Give me a minute. Alone. Please.');
            });
            await S2.blackout('torn_formula', 'Ash in the burner. Paper in my fist. Half a page of formulas in Elise’s handwriting. The other half is smoke. I didn’t— I wouldn’t—');
            await S2.cinematic(async () => {
              await S2.say('elise', 'It’s gone. The formula. Someone burned it. Someone was HERE, Noah — minutes ago!', 'despair');
              await S2.say('noah', '…I didn’t see anyone.');
            });
          });
        });
        const upd = () => {
          if (!g.flag('lasers_off')) S.objective('Disable the laser curtains — hack the security mainframe in the server room (west of the main corridor).');
          else if (!(g.state.inv.labKey ?? 0) && !g.state.picked.includes('lab:door:containment')) S.objective('Find the Specimen Key — the specimen hall north-east. (The armory needs a blue keycard from Dr. Marlow’s office.)');
          else S.objective('Unlock the containment wing (north corridor, east end) and find out what got loose.');
        };
        upd();
        while (!g.flag('boss_subjectZero_dead')) {
          const ev = await S.waitAny(['flag:lasers_off', 'pickup:labKey', 'trigger:boss_subjectZero', 'flag:boss_subjectZero_dead']);
          upd();
          if (ev === 'trigger:boss_subjectZero') {
            await S.step('lab_boss', async () => {
              await S.boss('subjectZero');
            });
            S.objective('Defeat Subject Zero.');
          }
        }
        await S.wait(2.5);
        await S.step('lab_outro', async () => {
          await S.cinematic(async () => {
            await S.say('elise', 'Subject Zero. Thorne’s pet. I signed the order that made it.', 'despair');
            await S.captain('Two monsters in one room, and only one of them is dead! Come home, Doctor. We have SO much to talk about.');
          });
        });
        S.objective('Return to the Polaris (gangway in the vault, south-east).');
      },
    },
    beforeTravel: async (d, to) => {
      if (to === 'ballroom' && d.game.flag('trial_ready')) {
        d.completeChapter('trial3');
        return false;
      }
      return true;
    },
  },

  trial3: trialChapter('trial3', 'ch5'),

  // =================================================================== CHAPTER 5
  ch5: {
    async start(S) {
      await card(S, 'ch5');
      await S.load('hub', 'hall');
    },
    levels: {
      hub: async (S, w) => {
        await morning(S, [
          ['captain', 'Jade picked her last lock. I hear the Isolation Zone has none. She must be so bored.'],
          ['captain', 'Today’s emergency: the *Aquatic Habitat* is flooding. If the water reaches the core, we all go for a very cold swim.'],
          ['dexter', 'I’m on point. Noah, you’re with me. Hana and Kai sweep the lower decks from the other side. We meet at the pumps.', 'hips'],
          ['hana', 'Knee-deep water, he says. It better be knee-deep.'],
        ], 'open_aqua', 'Aquatic Vessel (south-west deck)');
        if (!S.g.flag('boss_leviathan_dead')) return;
        await investigation(S, {
          spawns: [],
          required: ['bulkhead_log', 'dog_tag', 'protocol_card', 'hana_testimony2'],
          intro: [
            ['hana', 'I keep tasting salt water. Every time I breathe.'],
            ['band', 'GLOOMTEXT — THE CAPTAIN: “A sealed door, a drowning Scout, and a soldier who ‘follows orders.’ Sunday writes itself!”'],
            ['noah', 'Dexter sealed that bulkhead. And my band… reversed Pump 3. I need to understand this before Sunday.'],
          ],
          label: 'My band reversed Pump 3 and flooded the habitat. Dexter sealed Hana behind Bulkhead C. I don’t know which of us is worse.',
        });
      },
      aquatic: async (S, w) => {
        const g = S.g;
        await S.step('aqua_intro', async () => {
          await S.cinematic(async () => {
            await S.say('dexter', 'Airlock’s clear. Water’s rising in the atrium. And it’s electrified — cables in the water.', 'hips');
            await S.say('dexter', 'Breaker panel’s in maintenance, east side. Cut the power first, then the pumps. Three of them.');
          });
          S.hint('Divers are fast in water — fight them on the walkways', 6);
        });
        S.when('terminal:pump_term', async (S2) => {
          await S2.step('aqua_term', async () => {
            await S2.blackout('pump_override', '“Remote override source: GloomBand #07.” My band. My band reversed the pump. When? HOW?');
            await S2.evidence('bulkhead_log');
            S2.bark('hana', 'Noah! Can anyone hear me?! I’m behind Bulkhead C — the water is at my CHEST!', 6);
          });
        });
        S.when('pickup:valve', async (S2) => {
          S2.bark('dexter', 'Valve wheel. That’s for Pump 3.');
        });
        const upd = () => {
          const pumps = ['pump1', 'pump2', 'pump3'].filter((f) => g.flag(f)).length;
          if (pumps === 3 && !g.flag('aqua_drained')) {
            g.setFlag('aqua_drained');
            drain(S, w);
          }
          if (!g.flag('breaker_off')) S.objective('Cut the atrium power at the breaker panel (maintenance room, east of the atrium).');
          else if (pumps < 3) S.objective(`Start the pumps (${pumps}/3) in the pump station (south-east). Pump 3 needs a valve wheel.`);
          else S.objective('The habitat is draining. Get to Bulkhead C — Hana is behind it (west, by the airlock).');
          return pumps;
        };
        while (upd() < 3) await S.waitAny(['flag:breaker_off', 'flag:pump1', 'flag:pump2', 'flag:pump3']);
        await S.step('aqua_rescue', async () => {
          const bulk = w.doors.find((d) => d.id === 'bulkheadC');
          const p = bulk ? bulk.pos.clone().add(V(4, 0, 0)) : w.player.pos.clone();
          const hana = S.d.spawnNPC('hana', p, -Math.PI / 2, 'slump');
          await S.waitUntil(() => w.player.pos.distanceTo(hana.pos) < 5);
          await S.cinematic(async () => {
            S.d.autoCam = true;
            await S.say('hana', '*cough*— Noah? Noah. The water was at my chin. I heard someone on the other side. “Sorry, kid. Protocol.”', 'slump');
            hana.setPose(null);
            await S.say('noah', 'You’re okay. I’ve got you.');
            await S.say('hana', 'That voice… I know that voice. Thank you, Noah. I mean it.');
          });
          await S.evidence('hana_testimony2');
          hana.follow(true);
          hana.arm('pistol');
        });
        await S.step('aqua_boss', async () => {
          S.objective('Finn’s tank is open. Find the source of the flooding (north-east).');
          await S.waitEvent('trigger:boss_leviathan');
          await S.boss('leviathan');
        });
        await returnHome(S, 'boss_leviathan_dead');
        await S.step('aqua_outro', async () => {
          await S.cinematic(async () => {
            await S.say('dexter', 'Hana. You made it.', 'hips');
            await S.say('hana', 'No thanks to you.', 'cross');
            await S.captain('A happy reunion! Save the rest for Sunday, children.');
          });
        });
        S.objective('Return to the Polaris (gangway, north-east corner of the tank room).');
      },
    },
    beforeTravel: async (d, to) => {
      if (to === 'ballroom' && d.game.flag('trial_ready')) {
        d.completeChapter('trial4');
        return false;
      }
      return true;
    },
  },

  trial4: trialChapter('trial4', 'ch6'),

  // =================================================================== CHAPTER 6
  ch6: {
    async start(S) {
      await card(S, 'ch6');
      await S.load('hub', 'hall');
    },
    hubPose: { kai: 'slump', isaac: 'despair' },
    levels: {
      hub: async (S, w) => {
        await morning(S, [
          ['captain', 'Dexter followed his last protocol. Salute, everyone. No? Tough crowd.'],
          ['elise', 'Kai and Isaac are sick. Spores — in the water supply. If I hadn’t caught it, Kai would be dead.', 'despair'],
          ['captain', 'The *Agricultural Biosphere* feeds my flotilla. It is also trying to eat it. Go prune something.'],
          ['luna', 'I will walk with Noah. The garden and I have an understanding.', 'meditate'],
        ], 'open_bio', 'Biosphere Vessel (west deck)');
        if (!S.g.flag('boss_motherBloom_dead')) return;
        await investigation(S, {
          spawns: [['vote_notes', 'ev_quarters']],
          required: ['spore_vial', 'water_report', 'luna_testimony', 'vote_notes'],
          intro: [
            ['luna', 'Something weighs on me, Noah. Come find me when you can.', 'meditate'],
            ['band', 'GLOOMTEXT — THE CAPTAIN: “Poison in the well! A classic. Who among you plays the long game?”'],
            ['noah', 'Someone with a plan. Someone who counts moves.'],
          ],
          label: 'Spores in the hub’s water. A kennel key on my ring that I never used — that I don’t remember using.',
        });
      },
      biosphere: async (S, w) => {
        const g = S.g;
        await S.step('bio_intro', async () => {
          await S.cinematic(async () => {
            await S.say('luna', 'Breathe slowly. The pods release spores when you come too close. And the bushes… some of them breathe back.', 'meditate');
            await S.say('luna', 'The vines fear UV light. Install the lamp cores — three of them — and the garden will open.');
          });
          S.hint('Creepers hide as bushes. Flares [G] burn plant mutants — and lure them away', 7);
        });
        S.when('trigger:kennel', async (S2) => {
          await S2.step('bio_kennel', async () => {
            await S2.blackout('kennel_key', 'The kennel gate is open. Wide open. And the key on my ring is still warm.');
            const wave = await spawnWave(S2, [['vinehound', 4]], w.player.pos, 6);
            S2.bark('luna', 'The hounds! Who released the hounds?!');
            await waitClear(S2, wave);
          });
        });
        const upd = () => {
          const n = ['uv1', 'uv2', 'uv3'].filter((f) => g.flag(f)).length;
          if (n < 3) S.objective(`Install UV lamp cores (${n}/3): crop field lamp, orchard lamp, and the dome array in the seed vault (green keycard is in the kennel).`);
          else S.objective('The dome roots are burning away. Enter the central dome.');
          return n;
        };
        while (upd() < 3) await S.waitAny(['flag:uv1', 'flag:uv2', 'flag:uv3']);
        await S.step('bio_boss', async () => {
          await S.waitEvent('trigger:boss_motherBloom');
          await S.boss('motherBloom');
        });
        await returnHome(S, 'boss_motherBloom_dead');
        await S.step('bio_outro', async () => {
          await S.cinematic(async () => {
            await S.say('luna', 'She only wanted to grow. They taught her what to eat.', 'despair');
            await S.captain('The garden is weeded! Come home, little gardeners. Someone among you knows exactly how many spores fit in a water tank.');
          });
        });
        S.objective('Return to the Polaris (gangway inside the dome).');
      },
    },
    beforeTravel: async (d, to) => {
      if (to === 'ballroom' && d.game.flag('trial_ready')) {
        d.completeChapter('trial5');
        return false;
      }
      return true;
    },
  },

  trial5: trialChapter('trial5', 'ch7'),

  // =================================================================== CHAPTER 7
  ch7: {
    async start(S) {
      await card(S, 'ch7');
      await S.load('hub', 'hall');
    },
    levels: {
      hub: async (S, w) => {
        await morning(S, [
          ['captain', 'Fiona saw every move but the last one. Seven of you left. My, how the board has cleared.'],
          ['captain', 'The final vessel: *Cryo-Preservation*. GloomTech keeps things in the cold that it isn’t ready to sell. Or to admit to.'],
          ['captain', 'At its heart sleeps the Warden. It wears a key on its chest. *My* key. Bring it to me.'],
          ['aria', 'The archive servers are on that vessel. If the second channel has a source, it’s there. I’m coming.', 'typing'],
        ], 'open_cryo', 'Cryo Vessel (north-west deck)');
        if (!S.g.flag('boss_warden_dead')) return;
        await S.step('ch7_return', async () => {
          await S.cinematic(async () => {
            const all = SURVIVORS.filter((s) => s !== 'noah' && S.g.state.alive[s]);
            for (const id of all) w.npc(id)?.setPose('cross');
            await S.say('aria', 'I sent them the footage, Noah. All of it. They deserve to know.', 'despair');
            await S.say('hana', 'Is it true? Tell me it’s not true.', 'despair');
            await S.captain('No need for an investigation this time! Everyone already knows *exactly* who to talk about. To the Ballroom. NOW.');
          });
          S.g.setFlag('trial_ready');
        });
        S.objective('Go to the Ballroom for the final Deck Trial.');
      },
      cryo: async (S, w) => {
        const g = S.g;
        await S.step('cryo_intro', async () => {
          await S.cinematic(async () => {
            await S.say('aria', 'It’s so cold my band is lagging. The archive should be east of the first pod hall.', 'band');
            await S.say('aria', 'The floors are ice. Don’t sprint into a corner unless you like hugging walls.');
          });
          S.hint('Ice is slippery — momentum carries you. Cold vents slow you down.', 6);
        });
        S.when('terminal:archive', async (S2) => {
          await S2.step('cryo_reveal', async () => {
            await S2.cinematic(async () => {
              const aria = w.npc('aria');
              S2.g.glitch(1.5);
              audio.play('glitch', { vol: 0.8 });
              await S2.say('aria', 'Project MOLE. Candidate #07. There’s footage. Five files.', 'typing');
              await S2.say('aria', 'Relay 7… that’s you. With wire cutters. Line 7 press — you. Elise’s office — you, tearing the formula. Pump 3. The kennel.', 'typing');
              await S2.say('aria', 'Noah. It’s you. It’s been you the whole time.', 'despair');
              const c = await S2.choose([
                { text: '“I don’t remember any of it. Aria — I swear I don’t remember.”', kind: 'conscience' },
                { text: '“Delete it. Right now. Before anyone else sees.”', kind: 'mask' },
                { text: '“…Is there anything else in there? Anything that explains it?”', kind: 'conscience' },
              ]);
              if (c === 1) {
                S2.g.state.mask++;
                await S2.say('aria', 'Delete it? You want me to DELETE it?', 'shock');
                await S2.say('aria', '…No. I’m copying it. And I’m going to keep digging.', 'cross');
              } else {
                S2.g.state.conscience++;
                await S2.say('aria', 'There’s a second file. Firmware notes. A carrier wave in your band — below hearing. Commands.', 'typing');
                await S2.say('aria', 'Noah… they’ve been driving you. Like a puppet.', 'despair');
              }
              void aria;
            });
            await S2.evidence('mole_footage');
            await S2.evidence('subliminal_signal');
            S2.journal('Project MOLE. It was me. Every sabotage. I don’t remember a single one. Aria found a signal in my band.');
          });
        });
        S.when('pickup:thermal', async (S2) => {
          S2.bark('aria', 'A thermal coil. Heater housings should take that — they’ll thaw the frozen doors.');
        });
        const upd = () => {
          if (!g.flag('archive_hacked')) S.objective('Find the GloomTech archive (east of the first pod hall) and let Aria hack it.');
          else if (!g.flag('thaw1')) S.objective('Thaw the frozen door in the archive — install a thermal coil in the heater (one is in the first pod hall).');
          else if (!g.flag('thaw2')) S.objective('Find another thermal coil (locker room) and thaw the door to the Warden’s chamber (west end of the Board’s pod hall).');
          else S.objective('Face the Warden and take the Captain’s Key.');
        };
        upd();
        while (!g.flag('boss_warden_dead')) {
          const ev = await S.waitAny(['flag:archive_hacked', 'flag:thaw1', 'flag:thaw2', 'trigger:boss_warden', 'flag:boss_warden_dead']);
          upd();
          if (ev === 'trigger:boss_warden') {
            await S.step('cryo_boss', async () => {
              await S.boss('warden');
            });
          }
        }
        await S.wait(2.5);
        await S.step('cryo_outro', async () => {
          S.d.giveItem('coreKey', 1);
          await S.cinematic(async () => {
            await S.captain('My key! Lovely. Bring it home, Noah. Everyone is waiting. *Everyone.*');
            await S.say('aria', 'I’m sending the footage to the others. I’m sorry. They have to know.', 'despair');
          });
        });
        S.objective('Return to the Polaris (gangway in the Warden’s chamber).');
      },
    },
    beforeTravel: async (d, to) => {
      if (to === 'ballroom' && d.game.flag('trial_ready')) {
        d.completeChapter('trial6');
        return false;
      }
      return true;
    },
  },

  trial6: trialChapter('trial6', 'ch8'),

  // =================================================================== CHAPTER 8
  ch8: {
    async start(S) {
      await card(S, 'ch8');
      S.g.state.flags.open_core = true;
      await S.load('hub', 'hall');
    },
    hubAbsent: ['elise', 'isaac', 'kai', 'luna'],
    levels: {
      hub: async (S, w) => {
        const g = S.g;
        const truth = g.state.flags.final === 'truth';
        await S.step('ch8_purge', async () => {
          audio.startLoop('alarm', 'alarm', 0.5);
          await S.cinematic(async () => {
            const pillar = w.level.spawns.captain.pos;
            captainHolo(S, pillar, 1.6);
            S.shot(pillar.clone().add(V(0, 1.4, 6)), pillar.clone().setY(2.8), { fov: 48 });
            await S.captain('Attention, GhastMarina. This is no longer a broadcast. This is an evacuation.');
            await S.captain('GloomTech has seen what we showed the world. Nine million viewers. Surface feeds. Every screen still lit.');
            await S.captain('They have triggered a *Purge Protocol*. The Core will overload. Their pet — the Apex — has been released to make sure nothing walks away.');
            if (truth) await S.captain('You refused my vote. Fine. Then earn your ending. Get to the Core lift — north deck, at the spire. Shut down the overload, and the lifeboats are yours.');
            else await S.captain('My instrument. My loyal, wonderful instrument. Get to the Core lift. Alone, if you must. You always were, really.');
            removeCaptain(S);
            if (truth) {
              await S.say('hana', 'We’re with you, Noah. All the way.');
              await S.say('aria', 'Your band is jammed. Whatever you do now — it’s you doing it.', 'typing');
            }
          });
          audio.stopLoop('alarm');
        });
        if (truth) for (const id of ['hana', 'aria'] as CastId[]) {
          const n = w.npc(id);
          if (n && g.state.alive[id]) {
            n.follow(true);
            n.arm(id === 'hana' ? 'pistol' : 'arc');
          }
        }
        // the purge has released mutants onto the deck
        await S.step('ch8_deckfight', async () => {
          S.objective('Fight through to the Polaris Core lift (north deck, at the spire).');
          const deck = w.level.spawns.deck.pos;
          const wave = await spawnWave(S, [['runner', 3], ['shambler', 4], ['bloater', 1]], deck, 7);
          await waitClear(S, wave);
        });
        S.objective('Take the Polaris Core lift (north deck, at the spire).');
      },
      core: async (S, w) => {
        const g = S.g;
        const truth = g.state.flags.final === 'truth';
        const lb = buildProp('lifeboat', 3, {});
        const lsp = w.level.spawns.lifeboat;
        lb.obj.position.copy(lsp.pos);
        w.scene.add(lb.obj);
        if (truth) {
          for (const id of ['hana', 'aria'] as CastId[]) {
            if (!g.state.alive[id] || w.npc(id)) continue;
            const n = S.d.spawnNPC(id, w.player.pos.clone().add(V(id === 'hana' ? 1.5 : -1.5, 0, -1)), 0, null);
            n.follow(true);
            n.arm(id === 'hana' ? 'pistol' : 'arc');
          }
        }
        const arena = w.level.spawns.arena.pos;
        await S.step('core_arrive', async () => {
          await S.cinematic(async () => {
            const reactor = arena.clone().add(V(0, 0, -6));
            S.shot(w.player.pos.clone().add(V(-3, 4, 6)), reactor.clone().setY(20), { fov: 60, blend: 0, drift: V(0.4, 0.3, 0) });
            await S.wait(2);
            await S.thought('The Polaris Core. The beam roars up through the ash like the planet is bleeding light.');
            await S.captain('Welcome to the heart of it all. Hold the platform until the overload vents. Then the lifeboat on the east dock is yours.');
          });
        });
        const waves: [EnemyKind, number][][] = [
          [['shambler', 4], ['runner', 3], ['hound', 2]],
          [['phantom', 3], ['thinker', 2], ['spitter', 2], ['welder', 2]],
          [['frostbitten', 2], ['brute', 1], ['bloater', 2], ['diver', 2], ['creeper', 2]],
        ];
        const lines = [
          'Wave one. GloomTech sends its regards — and its rejects.',
          'They’re throwing the lab stock at you now. Keep your light on.',
          'Everything they have left. Every mistake they ever bottled. Hold on, Noah!',
        ];
        for (let i = 0; i < waves.length; i++) {
          await S.step('core_wave' + i, async () => {
            g.music.play('finale', 1);
            S.objective(`Hold the platform — overload venting (${i + 1}/3).`);
            S.bark('captain', lines[i], 5);
            const wave = await spawnWave(S, waves[i], arena, 11);
            await waitClear(S, wave);
            g.save();
          });
        }
        await S.step('core_apex', async () => {
          S.objective('Defeat the Apex.');
          await S.cinematic(async () => {
            await S.captain('The overload is venting. Which means GloomTech has one card left to play. Brace yourself.');
          });
          await S.boss('apex');
        });
        await S.waitFlag('boss_apex_dead');
        await S.wait(3);
        await S.step('core_ending', async () => {
          await ending(S, w, lb.obj, truth);
        });
      },
    },
  },
  end: {
    async start(S) {
      await S.guard(S.g.quitToTitle());
    },
    async resume(S) {
      await S.guard(S.g.quitToTitle());
    },
  },
};

// ------------------------------------------------------------------ water drain effect
function drain(S: Script, w: World) {
  const L = w.level;
  for (let i = 0; i < L.terrain.length; i++) if (L.terrain[i] === T.Water) L.terrain[i] = T.Floor;
  const water = w.built.water;
  audio.play('splash', { vol: 1, pitch: 0.5 });
  audio.play('steam', { vol: 0.8, pitch: 0.4 });
  S.g.ui.hud.banner('HABITAT DRAINING', 'The water level is dropping.');
  if (water) {
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / 6000);
      water.position.y = -0.6 * k;
      if (k < 1) requestAnimationFrame(tick);
      else water.visible = false;
    };
    tick();
  }
}

// ------------------------------------------------------------------ the ending
async function ending(S: Script, w: World, boat: THREE.Object3D, truth: boolean) {
  const g = S.g;
  const st = g.state;
  const dock = w.level.spawns.dock.pos;
  const reactor = w.level.spawns.arena.pos.clone().add(V(0, 0, -6));
  await S.cinematic(async () => {
    const cap = captainHolo(S, reactor.clone().add(V(0, 3, 4)), 4.5, 0);
    cap.yaw = Math.atan2(w.player.pos.x - cap.pos.x, w.player.pos.z - cap.pos.z);
    S.shot(w.player.pos.clone().add(V(-2, 1.2, 5)), reactor.clone().setY(9), { fov: 50, blend: 0, drift: V(0.2, 0.05, 0) });
    g.music.play('ending', 3);
    await S.captain('It’s done. The Apex is dead, the overload is venting, and the world… the world is still watching.');
    await S.captain('You want to know who I am? I was GloomTech’s Head of Security. I watched them pour the serum into the coolant, the soil, the sea.');
    await S.captain('I reported it. They declared me dead. So I took their flotilla, their cameras, and their audience — and I gave the Undernet exactly what it craved.');
    await S.captain('And then I showed it who built the stage.');
    if (truth) {
      await S.say('noah', 'You turned us into a show. You turned ME into a weapon.');
      await S.captain('I did. And you broke the script. You refused to vote. Nine million people watched twelve monsters choose mercy.');
      await S.captain('That was never in my plan, Noah. That is the message.');
    } else {
      await S.say('noah', 'And me? What was I?');
      await S.captain('The proof. That anyone — even a brilliant, grieving boy who studied manipulators — can be made into one. You played your part perfectly.');
      await S.captain('Stage Two will need a new Captain. Think about it.');
    }
    removeCaptain(S);
    // to the lifeboat
    await S.fade(1, 1.2);
    w.player.place(dock.clone(), Math.PI / 2);
    const boarders: CastId[] = truth ? (SURVIVORS.filter((s) => s !== 'noah' && st.alive[s]) as CastId[]) : [];
    boarders.forEach((id, i) => {
      const n = w.npc(id) ?? S.d.spawnNPC(id, dock.clone(), 0, null);
      n.follow(false);
      n.arm(null);
      n.teleport(dock.clone().add(V(-1.5 - (i % 3) * 1.2, 0, -1.5 + Math.floor(i / 3) * 1.4)));
      n.yaw = n.homeYaw = Math.PI / 2;
      n.setPose(i % 2 ? 'cross' : null);
    });
    S.shot(dock.clone().add(V(-7, 3, 7)), boat.position.clone().setY(1.5), { fov: 50, blend: 0, drift: V(0.4, 0.05, 0) });
    await S.fade(0, 1.5);
    if (truth) {
      await S.say('hana', 'Lifeboat’s fueled. Room for everyone who’s left.');
      await S.say('elise', 'I rebuilt the antidote. From memory. It’s not perfect — but it’s a start.', 'think');
      await S.say('aria', 'The footage is everywhere now, Noah. They can’t bury it.', 'typing');
      await S.say('noah', 'Then let’s go somewhere the cameras can’t follow.');
    } else {
      await S.thought('One seat. One lifeboat. One survivor. The viewers will remember me as the last one standing. The Captain will remember me as his.');
    }
    // boarding
    await S.fade(1, 1);
    w.player.root.visible = false;
    for (const id of boarders) {
      const n = w.npc(id);
      if (n) n.root.visible = false;
    }
    await S.fade(0, 1);
    // launch
    S.shot(dock.clone().add(V(4, 6, 16)), boat.position.clone().add(V(14, 0, 0)), { fov: 55, blend: 0 });
    audio.play('machinery', { vol: 0.7 });
    const t0 = performance.now();
    const start = boat.position.clone();
    const ride = () => {
      const k = (performance.now() - t0) / 9000;
      boat.position.set(start.x + k * k * 60, start.y - Math.min(14, k * 18), start.z + Math.sin(k * 3) * 1.5);
      if (k < 1) requestAnimationFrame(ride);
    };
    ride();
    await S.wait(5.2);
    await S.captain('Stage One complete. Ratings: *historic*.');
    await S.wait(1.4);
    // the explosion
    audio.play('explosion', { vol: 1.4, pitch: 0.7 });
    audio.play('explosion', { vol: 1.2, pitch: 0.5 });
    g.fx.explosion(boat.position.clone().setY(boat.position.y + 1), 'fire', 8);
    g.rig.addShake(1.5);
    boat.visible = false;
    await S.wait(0.4);
    g.setFadeInstant(1);
    g.music.play('none', 0.1);
    await S.wait(2.5);
    await S.guard(g.ui.chapterCard(truth ? 'ENDING — THE WITNESS' : 'ENDING — THE INSTRUMENT', 'STAGE 2', truth ? '“If anyone is still watching… remember us.”' : '“Every show needs a host.”'));
  });
  st.chapter = 'end';
  saveGame(st);
  g.music.play('credits', 2);
  g.ui.hud.show(false);
  await S.guard(g.ui.showCredits(truth ? 'witness' : 'instrument'));
  // post-credits sting
  audio.play('chime', { vol: 0.6 });
  await S.guard(g.ui.dlg.say('band', 'GloomOS 9.1 rebooting… Biometric lock confirmed. *Welcome back, Participant #07.*'));
  g.ui.dlg.hide();
  await S.guard(g.quitToTitle());
}

export { CAST };
