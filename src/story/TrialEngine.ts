import * as THREE from 'three';
import type { Director } from './Director';
import { Abort } from './Director';
import { TRIALS, TStep, FINAL_TRUTH, FINAL_MASK } from './Trials';
import { EVIDENCE } from './Lore';
import { CAST, CastId, SURVIVORS } from '../chars/Cast';
import { NPC } from '../entities/NPC';
import { audio } from '../core/Audio';
import { PM, part } from '../world/Props';
import { compact } from '../entities/Models';
import type { TalkLine } from './Talk';
import { rand } from '../core/math';

export interface TrialResult {
  outcome: 'done' | 'truth' | 'mask' | 'fail' | 'quit';
}

class TrialFail extends Error {}

const RADIUS = 5.4;

export async function runTrial(d: Director, id: string): Promise<TrialResult> {
  const g = d.game;
  const def = TRIALS[id];
  const runTok = d.runToken;
  const check = () => {
    if (d.runToken !== runTok) throw new Abort();
  };
  g.mode = 'trial';
  g.ui.hud.show(false);
  await g.loadLevel('ballroom', 'center');
  check();
  const w = g.world!;
  w.player.root.visible = false;
  w.player.control = false;
  g.cinematic = true;
  g.setLetterbox(false);
  const C = w.level.spawns.center.pos.clone();
  const st = g.state;
  // auto-compile evidence: everything non-incriminating for this trial is "in your notes"
  const tn = parseInt(id.replace('trial', ''), 10);
  for (const [eid, e] of Object.entries(EVIDENCE)) if (e.trial === tn && !e.self && !st.evidence.includes(eid)) st.evidence.push(eid);
  // seats
  const seats = new Map<CastId, { pos: THREE.Vector3; face: THREE.Vector3 }>();
  const npcs = new Map<CastId, NPC>();
  SURVIVORS.forEach((cid, i) => {
    const a = Math.PI / 2 + (i / SURVIVORS.length) * Math.PI * 2;
    const pos = C.clone().add(new THREE.Vector3(Math.cos(a) * RADIUS, 0, Math.sin(a) * RADIUS));
    const face = C.clone().sub(pos).setY(0).normalize();
    seats.set(cid, { pos, face });
    const podium = buildPodium(CAST[cid].color);
    podium.position.copy(pos).addScaledVector(face, 0.75);
    podium.rotation.y = Math.atan2(-face.x, -face.z);
    w.scene.add(podium);
    w.level.group.add(podium);
    if (st.alive[cid]) {
      const n = new NPC(w, cid);
      n.place(pos, Math.atan2(face.x, face.z));
      n.lookAtPlayer = false;
      n.interactable = false;
      n.lookTarget = C.clone().setY(1.6);
      w.scene.add(n.root);
      w.npcs.push(n);
      npcs.set(cid, n);
    } else {
      const mem = buildMemorial(CAST[cid].color);
      mem.position.copy(pos);
      mem.rotation.y = Math.atan2(face.x, face.z);
      w.level.group.add(mem);
    }
  });
  // captain hologram above the throne
  const capSp = w.level.spawns.captain?.pos ?? C.clone().add(new THREE.Vector3(0, 0, -8));
  const cap = new NPC(w, 'captain');
  cap.place(capSp, 0);
  cap.root.scale.setScalar(1.7);
  cap.lookAtPlayer = false;
  cap.interactable = false;
  w.scene.add(cap.root);
  w.npcs.push(cap);
  // influence
  const maxHP = 5 + (st.skills.silver ?? 0) + (st.difficulty === 'story' ? 2 : st.difficulty === 'nightmare' ? -1 : 0);
  let hp = maxHP;
  const ui = g.ui.trial;
  ui.show(true);
  ui.setHP(hp, maxHP);
  ui.setPhase('DECK TRIAL');
  ui.setSuspicion(st.suspicion);
  g.music.play('trial', 1.5);
  audio.setAmbience('ballroom');

  // ---------------- camera helpers ----------------
  let lastSpeaker = '';
  const camOn = (who: string, style: 'close' | 'dutch' | 'low' = 'close') => {
    if (who === 'captain') {
      g.rig.setCine({ pos: C.clone().add(new THREE.Vector3(rand(-1.5, 1.5), 1.2, -1)), look: capSp.clone().setY(3.4), fov: 50, blend: 0.35 });
      return;
    }
    const s = seats.get(who as CastId);
    if (!s) {
      wide();
      return;
    }
    const side = new THREE.Vector3(-s.face.z, 0, s.face.x).multiplyScalar(rand(-0.9, 0.9));
    const h = CAST[who as CastId]?.look.height ?? 1;
    const pos = s.pos.clone().addScaledVector(s.face, style === 'low' ? 1.6 : 2.3).add(side).setY(style === 'low' ? 0.9 : 1.75 * h);
    const look = s.pos.clone().setY(1.58 * h);
    g.rig.setCine({ pos, look, fov: style === 'dutch' ? 36 : 40, blend: lastSpeaker === who ? 0.3 : 0, drift: s.face.clone().multiplyScalar(-0.08), shakeAmt: style === 'dutch' ? 0.2 : 0 });
    lastSpeaker = who;
  };
  const wide = () => {
    g.rig.setCine({ pos: C.clone().add(new THREE.Vector3(0, 8.5, 9.5)), look: C.clone().setY(1), fov: 55, blend: 0.6, drift: new THREE.Vector3(0.3, 0, 0) });
    lastSpeaker = '';
  };

  const say = async (who: string, text: string, pose?: string) => {
    check();
    const n = npcs.get(who as CastId);
    if (n && pose) n.setPose(pose);
    camOn(who, pose === 'shock' || pose === 'point' ? 'dutch' : 'close');
    if (n) n.talking = 1e9;
    await g.ui.dlg.say(who, text, who === 'captain' ? { style: 'captain' } : {});
    if (n) {
      n.talking = 0.2;
      if (pose === 'shock' || pose === 'point') n.setPose(null);
    }
    check();
  };
  const lines = async (ls: TalkLine[]) => {
    for (const l of ls) await say(l[0], l[1], l[2]);
  };
  const hurt = async (who?: string) => {
    hp--;
    ui.setHP(hp, maxHP);
    st.suspicion = Math.min(100, st.suspicion + 3);
    ui.setSuspicion(st.suspicion);
    audio.play('wrong', { vol: 0.7 });
    g.rig.addShake(0.4);
    const critic = who ?? pickAlive(st, ['fiona', 'kai', 'dexter', 'elise', 'aria', 'hana']);
    await say(critic, pick(['That doesn’t make any sense, Noah.', 'Are you even listening?', 'Wrong. Think it through.', 'That’s a stretch, even for you.', 'No. That contradicts nothing.']));
    if (hp <= 0) throw new TrialFail();
  };

  // debug/test autoplay: answer every question correctly
  const auto = g.autoplay >= 0;
  const runSteps = async (steps: TStep[]): Promise<TrialResult | null> => {
    for (const s of steps) {
      check();
      switch (s.t) {
        case 'phase':
          ui.setPhase(s.text);
          wide();
          await g.wait(0.8);
          break;
        case 'line':
          await say(s.who, s.text, s.pose);
          break;
        case 'lines':
          await lines(s.lines);
          break;
        case 'debate': {
          ui.setPhase('NONSTOP DEBATE');
          g.music.play('debate', 0.6);
          await ui.shout('NONSTOP DEBATE', 'agree');
          let fails = 0;
          const bullets = st.evidence.filter((e) => EVIDENCE[e]?.trial === tn || EVIDENCE[e]?.trial === tn - 1 || e === s.answer.ev);
          if (!bullets.includes(s.answer.ev)) bullets.push(s.answer.ev);
          for (;;) {
            check();
            g.ui.dlg.hide();
            const r = auto
              ? { stmt: s.answer.stmt, ev: s.answer.ev, agree: s.answer.agree }
              : await ui.debate(s.stmts, shuffle(bullets.slice(-8)), s.time ?? 60, (i) => camOn(s.stmts[i].who, i % 2 ? 'dutch' : 'close'));
            check();
            if (r === 'timeout') {
              await hurt();
              await say('noah', s.hint, 'think');
              continue;
            }
            const ok = r.stmt === s.answer.stmt && r.ev === s.answer.ev && !!r.agree === !!s.answer.agree;
            if (ok) {
              await ui.shout(s.answer.agree ? 'I AGREE WITH THAT!' : 'NO, THAT’S WRONG!', s.answer.agree ? 'agree' : 'refute');
              st.suspicion = Math.max(0, st.suspicion - 2);
              ui.setSuspicion(st.suspicion);
              g.tip(25, 'BREAKTHROUGH');
              break;
            }
            await ui.shout('…?', 'wrong');
            fails++;
            await hurt(s.stmts[r.stmt]?.who);
            if (fails >= 2) await say('noah', s.hint, 'think');
          }
          g.music.play('trial', 0.8);
          ui.setPhase('DECK TRIAL');
          await lines(s.success);
          break;
        }
        case 'choice': {
          wide();
          for (;;) {
            await g.ui.dlg.say('noah', s.q, { style: 'thought', title: '(thinking)' });
            if (auto) g.autoChoice = s.correct;
            const i = await g.ui.dlg.choose(s.options.map((o) => ({ text: o })));
            g.autoChoice = 0;
            check();
            if (i === s.correct) break;
            await hurt();
          }
          if (s.success) await lines(s.success);
          break;
        }
        case 'present': {
          for (;;) {
            camOn('noah', 'low');
            await g.ui.dlg.say('noah', s.q, { style: 'thought', title: '(thinking)' });
            g.ui.dlg.hide();
            const ev = auto ? s.correct : await ui.present(s.q, st.evidence.filter((e) => EVIDENCE[e]));
            check();
            if (ev === s.correct) {
              await ui.shout('THIS PROVES IT!', 'refute');
              break;
            }
            await ui.shout('…?', 'wrong');
            await hurt();
          }
          if (s.success) await lines(s.success);
          break;
        }
        case 'rebuttal': {
          ui.setPhase('REBUTTAL');
          await ui.shout('REBUTTAL!', 'refute');
          await say(s.who, s.text, s.pose ?? 'point');
          camOn('noah', 'dutch');
          const avail = s.options.filter((o) => !o.needs || st.evidence.includes(o.needs));
          const i = await g.ui.dlg.choose(avail.map((o) => ({ text: o.text, kind: o.kind })));
          check();
          const o = avail[i];
          st.suspicion = Math.max(0, Math.min(100, st.suspicion + o.susp));
          if (o.kind === 'mask') st.mask++;
          else st.conscience++;
          ui.setSuspicion(st.suspicion);
          audio.play(o.kind === 'mask' ? 'glitch' : 'chime', { vol: 0.4 });
          await lines(o.reply);
          ui.setPhase('DECK TRIAL');
          break;
        }
        case 'recon': {
          ui.setPhase('CLOSING ARGUMENT');
          g.music.play('debate', 0.6);
          await ui.shout('CLOSING ARGUMENT', 'agree');
          const filled: string[] = [];
          for (const p of s.panels) {
            for (;;) {
              const i = auto ? p.correct : await ui.recon(s.title, filled, s.panels.length, p.q, p.options);
              check();
              if (i === p.correct) break;
              await hurt();
            }
            filled.push(p.text);
            audio.play('uiConfirm', { vol: 0.5 });
          }
          if (!auto) await ui.recon(s.title, filled, s.panels.length, '*The truth is laid bare.*', ['This is the truth!']);
          check();
          await ui.shout('CASE CLOSED!', 'refute');
          g.music.play('trial', 0.8);
          break;
        }
        case 'vote': {
          ui.setPhase('VOTING TIME');
          await say('captain', 'Pencils down! It’s VOTING TIME! Choose wisely… or don’t. It’s funnier when you don’t.');
          for (;;) {
            const who = auto ? s.culprit : await ui.vote(st.alive);
            check();
            if (who === s.culprit) break;
            await hurt();
          }
          const votes = tally(st.alive, s.culprit, st.suspicion);
          await ui.tally(votes, s.culprit);
          check();
          break;
        }
        case 'execution': {
          await execute(s.who, s.last);
          break;
        }
        case 'finalChoice': {
          camOn('noah', 'low');
          await g.ui.dlg.say('noah', 'Every eye in the room. Every viewer on the Undernet. Waiting.', { style: 'thought', title: '(thinking)' });
          const c = await g.ui.dlg.choose([
            { text: 'Tell the truth. All of it.', kind: 'conscience' },
            { text: 'Fight back. Discredit the archive — and Aria with it.', kind: 'mask' },
          ]);
          check();
          if (c === 0) {
            st.conscience += 3;
            await runSteps(FINAL_TRUTH);
            wide();
            await say('captain', 'Enough heartfelt nonsense! The show requires a VOTE. Who goes into the dark?!');
            const v = await g.ui.dlg.choose([{ text: '“None of us. We refuse to vote.”', kind: 'conscience' }, { text: '“Vote for me. I’ll go.”', kind: 'conscience' }]);
            check();
            if (v === 1) {
              await say('hana', 'No. Absolutely not.', 'shock');
              await say('elise', 'Out of the question, Noah.', 'think');
            }
            await say('hana', 'We’re not voting. Not anymore.', 'cross');
            await say('kai', 'None of us.', 'hips');
            await say('isaac', 'Your show’s over, Captain.', 'point');
            await say('captain', 'You… WHAT? You can’t — the ratings— the audience—');
            await say('captain', '…Fine. FINE. If you won’t play my game, you’ll play THEIRS. GloomTech has been clawing at my feed for weeks. Let’s let them in.');
            st.flags.ending_truth = true;
            return { outcome: 'truth' };
          }
          st.mask += 3;
          await runSteps(FINAL_MASK);
          if (st.suspicion >= 75) {
            await say('elise', 'No. I’ve watched you lie for six weeks, Noah. I know your tells now.', 'despair');
            await say('captain', 'Ooh, so close. But they’ve seen too much, my little instrument.');
            const votes = tally(st.alive, 'noah', 100);
            await ui.tally(votes, 'noah');
            await execute('noah', 'Lila… I proved it. People are exactly as bad as I thought. Including me.');
            throw new TrialFail();
          }
          await say('aria', 'You’re doing it right now. Turning them. Lila trusted you too, Noah.', 'despair');
          ui.setPhase('VOTING TIME');
          for (;;) {
            const who = await ui.vote(st.alive);
            check();
            if (who === 'aria') break;
            await say('captain', 'Mmm, no. The story needs a villain, Noah. Give them one.');
          }
          await ui.tally(tally(st.alive, 'aria', 0), 'aria');
          await execute('aria', 'You know what the worst part is? You’ll believe your own lie by morning.');
          await say('captain', 'Bravo. BRAVO. My finest instrument.');
          await say('captain', 'But GloomTech has seen enough of my little broadcast. They’re coming to shut us down — all of us. Get to the Core.');
          st.flags.ending_mask = true;
          return { outcome: 'mask' };
        }
      }
    }
    return null;
  };

  const execute = async (who: CastId, last: string) => {
    ui.setPhase('ISOLATION');
    g.music.play('execution', 1);
    await say('captain', who === 'noah' ? 'The traitor, at last! Let’s give our mole a send-off worthy of the ratings!' : `We have a verdict! ${CAST[who].name} has been chosen. It’s time… for ISOLATION!`);
    const n = npcs.get(who);
    if (!n && who !== 'noah') return;
    const actor = n ?? npcs.get('noah')!;
    await say(who, last, 'despair');
    camOn(who, 'low');
    audio.play('tranq', { vol: 0.9 });
    actor.setPose('clutch');
    actor.model.material.emissive.setRGB(0.6, 0, 0.05);
    await g.wait(1.2);
    actor.setPose('slump');
    audio.play('crowd', { vol: 0.5 });
    await g.wait(1.0);
    // the floor opens
    const red = { pos: actor.pos.clone().setY(-0.5), color: new THREE.Color(0xff1a30), intensity: 40, range: 8, flicker: 0.3 };
    w.level.lights.push(red);
    audio.play('stomp', { vol: 1 });
    g.rig.addShake(0.6);
    const t0 = performance.now();
    await new Promise<void>((res) => {
      const tick = () => {
        const k = (performance.now() - t0) / 1600;
        actor.root.position.y = -k * k * 6;
        if (k < 1) requestAnimationFrame(tick);
        else res();
      };
      tick();
    });
    audio.play('bossRoar', { vol: 0.6, pitch: 1.3 });
    audio.play('zombieMoan', { vol: 0.8 });
    await g.fade(1, 0.6);
    g.ui.hud.banner(`${CAST[who].name.toUpperCase()} WAS CAST INTO THE ISOLATION ZONE`, '');
    await g.wait(2.6);
    actor.root.visible = false;
    w.level.lights.splice(w.level.lights.indexOf(red), 1);
    if (who !== 'noah') {
      st.alive[who] = false;
      const s = seats.get(who)!;
      const mem = buildMemorial(CAST[who].color);
      mem.position.copy(s.pos);
      mem.rotation.y = Math.atan2(s.face.x, s.face.z);
      w.level.group.add(mem);
    }
    await g.fade(0, 0.8);
    g.music.play('trial', 1.5);
  };

  try {
    const r = await runSteps(def.steps);
    check();
    if (r) {
      cleanup();
      return r;
    }
    // epilogue
    wide();
    await say('captain', 'Ahh, the satisfying thud of justice. Or was it? Was that the mole? Oh, I’ll never tell.');
    const tipAmt = 120 + hp * 30;
    g.tip(tipAmt, 'TRIAL RATINGS');
    st.insight += 1;
    g.ui.hud.banner('TRIAL COMPLETE', `+1 Insight · ${hp}/${maxHP} Influence remaining · +${tipAmt}¢`);
    await g.wait(1.5);
    cleanup();
    d.message('captain', 'Well played, Noah. Nobody suspects the one who points first. — C.');
    return { outcome: 'done' };
  } catch (e) {
    if (e instanceof TrialFail) {
      cleanup();
      const retry = await trialFailScreen(d);
      if (retry) return { outcome: 'fail' };
      return { outcome: 'quit' };
    }
    cleanup();
    throw e;
  }

  function cleanup() {
    ui.show(false);
    ui.clear();
    g.ui.dlg.hide();
    g.mode = 'play';
    g.cinematic = false;
    g.rig.setCine(null);
  }
}

async function trialFailScreen(d: Director): Promise<boolean> {
  const g = d.game;
  g.state.deaths++;
  return new Promise((res) => {
    const o = document.createElement('div');
    o.className = 'overlay';
    o.innerHTML = `<div class="gameover"><h1>VOTED OUT</h1><p>The others turned on you. The Isolation Zone welcomes you home.</p><div class="menu"><button class="btn r">Retry the trial</button><button class="btn danger q">Quit to title</button></div></div>`;
    g.ui.root.appendChild(o);
    g.input.exitLock();
    o.querySelector('.r')!.addEventListener('click', () => {
      o.remove();
      res(true);
    });
    o.querySelector('.q')!.addEventListener('click', () => {
      o.remove();
      res(false);
      void g.quitToTitle();
    });
  });
}

function tally(alive: Record<string, boolean>, culprit: string, suspicion: number) {
  const v: Record<string, number> = {};
  const voters = SURVIVORS.filter((s) => alive[s]);
  for (const s of voters) v[s] = 0;
  for (const s of voters) {
    if (s === culprit) {
      v[pick(voters.filter((x) => x !== s))]++;
      continue;
    }
    if (s !== 'noah' && suspicion > 40 && Math.random() < (suspicion - 40) / 120) v.noah = (v.noah ?? 0) + 1;
    else v[culprit]++;
  }
  return v;
}

function pick<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}
function pickAlive(st: { alive: Record<string, boolean> }, ids: CastId[]) {
  const a = ids.filter((i) => st.alive[i]);
  return a.length ? pick(a) : 'captain';
}
function shuffle<T>(a: T[]) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function buildPodium(color: string) {
  const P = PM();
  const c = new THREE.Color(color);
  const g = compact(new THREE.Group().add(
    part(new THREE.CylinderGeometry(1, 1, 1, 8), P.wood, 0x3a2418, [0, 0.55, 0], [0.42, 1.1, 0.42]),
    part(new THREE.CylinderGeometry(1, 1, 1, 8), P.paint, 0x5a2030, [0, 1.12, 0], [0.5, 0.06, 0.5]),
    part(new THREE.BoxGeometry(1, 1, 1), P.glowV, c, [0, 0.9, 0.4], [0.45, 0.05, 0.02]),
  ));
  return g;
}
function buildMemorial(color: string) {
  const P = PM();
  const c = new THREE.Color(color);
  return compact(new THREE.Group().add(
    part(new THREE.CylinderGeometry(1, 1, 1, 6), P.metal, 0x2a2a2e, [0, 1.0, 0], [0.04, 2, 0.04]),
    part(new THREE.BoxGeometry(1, 1, 1), P.paint, c.clone().multiplyScalar(0.5), [0, 1.75, 0], [0.7, 0.9, 0.04]),
    part(new THREE.BoxGeometry(1, 1, 1), P.glowV, 0xff2a4a, [0, 1.75, 0.03], [0.95, 0.08, 0.02], [0, 0, 0.9]),
    part(new THREE.BoxGeometry(1, 1, 1), P.glowV, 0xff2a4a, [0, 1.75, 0.03], [0.95, 0.08, 0.02], [0, 0, -0.9]),
  ));
}
