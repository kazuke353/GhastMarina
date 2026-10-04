import type { CastId } from '../chars/Cast';
import type { Stmt } from '../ui/TrialUI';
import type { TalkLine } from './Talk';

export interface RebutOpt {
  text: string;
  kind: 'mask' | 'conscience';
  susp: number;
  needs?: string;
  reply: TalkLine[];
}

export type TStep =
  | { t: 'line'; who: string; text: string; pose?: string }
  | { t: 'lines'; lines: TalkLine[] }
  | { t: 'phase'; text: string }
  | { t: 'debate'; title: string; stmts: Stmt[]; answer: { stmt: number; ev: string; agree?: boolean }; time?: number; success: TalkLine[]; hint: string }
  | { t: 'choice'; q: string; who?: string; options: string[]; correct: number; success?: TalkLine[] }
  | { t: 'present'; q: string; who?: string; correct: string; success?: TalkLine[] }
  | { t: 'rebuttal'; who: string; text: string; pose?: string; options: RebutOpt[] }
  | { t: 'recon'; title: string; panels: { q: string; options: string[]; correct: number; text: string }[] }
  | { t: 'vote'; culprit: CastId }
  | { t: 'execution'; who: CastId; last: string }
  | { t: 'finalChoice' };

export interface TrialDef {
  id: string;
  title: string;
  culprit: CastId | null;
  steps: TStep[];
}

const L = (who: string, text: string, pose?: string): TStep => ({ t: 'line', who, text, pose });

export const TRIALS: Record<string, TrialDef> = {
  // ===================================================================== TRIAL 1
  trial1: {
    id: 'trial1', title: 'The House Always Wins', culprit: 'leo',
    steps: [
      { t: 'phase', text: 'OPENING STATEMENTS' },
      L('captain', 'Welcome, welcome, to the very first Deck Trial! Twelve podiums, twelve liars, one glorious vote!'),
      L('captain', 'On tonight’s menu: a theft from my lovely medbay — and a cut wire that nearly turned our little Scout into street pizza.'),
      L('captain', 'Find the culprit. Vote. The one you choose takes a long nap in the Isolation Zone. Choose wrong… well. You’ll see. Begin!'),
      L('dexter', 'Let’s be methodical. The medbay first. Elise — you had the only key.', 'hips'),
      L('elise', 'I did. And it vanished from my coat for an hour that night. Whoever opened the door used my card.', 'think'),
      {
        t: 'debate', title: 'Who robbed the medbay?', hint: 'Someone claims nobody passed the cargo hold. Who heard otherwise?',
        stmts: [
          { who: 'dexter', text: 'The thief had to have [medical training] to know what to take.' },
          { who: 'kai', text: 'Whoever did it is planning to survive alone. A {hoarder}.' },
          { who: 'leo', text: 'I was in my quarters all night. [Nobody went near the cargo hold].' },
          { who: 'fiona', text: 'Lifting Elise’s keycard suggests [a pickpocket] among us.' },
        ],
        answer: { stmt: 2, ev: 'jade_testimony' },
        success: [
          ['noah', 'No, that’s wrong! Jade heard leather-soled shoes click past the cargo hold at three in the morning.', 'point'],
          ['jade', 'Italian leather. I’d know that sound in my sleep. Which I wasn’t, by the way.', 'cross'],
          ['leo', '…Lots of people have nice shoes.', 'shrug'],
        ],
      },
      {
        t: 'choice', q: 'Where was the stolen medicine hidden?', options: ['In the cargo hold, behind the crates', 'In the medbay all along', 'Somewhere on the City Vessel'], correct: 0,
        success: [['kai', 'I smelled antiseptic down there. East wall, behind the crates.', 'hips']],
      },
      {
        t: 'present', q: 'And what was found beside the stash?', correct: 'poker_chip',
        success: [
          ['noah', 'A gold poker chip. Monogrammed “L.C.”', 'point'],
          ['grant', 'L.C. … Leo Castellanos.', 'think'],
          ['leo', 'That— okay. OKAY. Fine!', 'shock'],
        ],
      },
      L('leo', 'Yes, I took the meds! Insurance! You think I’m gonna trust eleven killers to share antibiotics when the bodies start dropping?', 'shrug'),
      L('hana', 'You left us with NOTHING!'),
      {
        t: 'rebuttal', who: 'leo', pose: 'point',
        text: 'But stealing medicine isn’t sabotage. You want to know who cut that relay wire? The guy who came back from the city with grease on his hands. *Noah.*',
        options: [
          { text: 'Present the Corrupted Override Log — the band ID could be any of us. Including yours, Leo.', kind: 'mask', susp: -10, needs: 'override_log', reply: [['aria', 'He’s right. The last digit’s corrupted — it could be any band from 01 to 09.', 'typing'], ['leo', 'Oh, come ON.']] },
          { text: '“Grease? I was carrying Isaac’s toolbox.”', kind: 'mask', susp: -4, reply: [['isaac', '…Did you? I mean— maybe? It’s all a blur.'], ['fiona', 'Convenient.', 'cross']] },
          { text: '“I don’t remember where I was when the gate dropped. I blacked out.”', kind: 'conscience', susp: 15, reply: [['elise', 'Blackouts are a known side effect of that sedative. I’ve had two myself.', 'think'], ['dexter', 'That’s not an alibi, Doc. That’s a confession of nothing.', 'hips']] },
          { text: 'Show them the cut wire you found in your own pocket.', kind: 'conscience', susp: 25, needs: 'cut_wire', reply: [['hana', 'You… had the wire?', 'shock'], ['noah', 'I found it after I woke up. I don’t know how it got there.'], ['luna', 'Truth, offered freely. The Gloomies dim. Curious.', 'meditate'], ['fiona', 'Or a very clever bluff. Let’s finish with the thief.', 'cross']] },
        ],
      },
      {
        t: 'debate', title: 'Is Leo the mole?', hint: 'Something in Leo’s stash proves he had the Captain’s access. Agree with whoever mentions it.',
        stmts: [
          { who: 'leo', text: 'Stealing meds doesn’t make me [the Captain’s errand boy]!' },
          { who: 'fiona', text: 'Leo’s stash held more than medicine — {a GloomTech executive keycard}.' },
          { who: 'grant', text: 'We shouldn’t vote on a [feeling]. We need proof.' },
          { who: 'jade', text: 'A card like that opens [half the doors on this ship].' },
        ],
        answer: { stmt: 1, ev: 'gt_keycard', agree: true },
        success: [
          ['noah', 'I agree with you! A GloomTech exec keycard — it opens the medbay and the gangway control room.', 'point'],
          ['leo', 'I WON that card! In a poker game! Off a GloomTech VP who couldn’t bluff to save his life!', 'shock'],
          ['fiona', 'A thief with a liar’s alibi and the Captain’s keys. The board is clear.', 'cross'],
        ],
      },
      {
        t: 'recon', title: 'NIGHT ONE — THE MEDBAY THEFT',
        panels: [
          { q: 'Who lifted Elise’s keycard from her coat?', options: ['Leo', 'Jade', 'Noah'], correct: 0, text: 'During dinner, *Leo* lifted Elise’s keycard from her coat.' },
          { q: 'Where did he go at 3 AM?', options: ['The medbay', 'The gangway', 'The chapel'], correct: 0, text: 'At 3 AM he opened the *medbay* and emptied it.' },
          { q: 'Where did he hide everything?', options: ['The cargo hold', 'His quarters', 'The City Vessel'], correct: 0, text: 'He stashed it all in the *cargo hold* — Jade heard his Italian shoes go by.' },
          { q: 'What did he leave behind?', options: ['His poker chip', 'A cut wire', 'A glove'], correct: 0, text: 'But he dropped his monogrammed *poker chip* beside the stash.' },
        ],
      },
      { t: 'vote', culprit: 'leo' },
      { t: 'execution', who: 'leo', last: 'Heh. The house always wins… just never the house you think.' },
    ],
  },
  // ===================================================================== TRIAL 2
  trial2: {
    id: 'trial2', title: 'Terms of Surrender', culprit: 'grant',
    steps: [
      { t: 'phase', text: 'OPENING STATEMENTS' },
      L('captain', 'Trial number two! Somebody has been chatting with yours truly behind your backs. And somebody tried to make our Engineer a lot less… handy.'),
      L('dexter', 'Every route we planned got ambushed within the hour. That isn’t luck.', 'hips'),
      {
        t: 'debate', title: 'Who is leaking our plans?', hint: 'Someone says the Captain needs no informant. What did you find behind the chapel organ?',
        stmts: [
          { who: 'grant', text: 'The Captain sees through our bands. He [doesn’t need an informant].' },
          { who: 'fiona', text: 'The ambushes came [within the hour] of every plan.' },
          { who: 'jade', text: 'Maybe the mutants are just [smart].' },
          { who: 'kai', text: 'Someone was talking at 2 AM. [Could’ve been anyone].' },
        ],
        answer: { stmt: 0, ev: 'transmitter' },
        success: [
          ['noah', 'No, that’s wrong! There’s a shortwave rig behind the chapel organ — tuned to the Captain’s private channel.', 'point'],
          ['aria', 'That’s not GloomTech hardware. Someone built that by hand.', 'typing'],
        ],
      },
      {
        t: 'present', q: 'Who does the transmitter belong to?', correct: 'tie_clip',
        success: [
          ['noah', 'This was caught in the casing. A silver tie clip: “G.A. — 20 Years of Service, Hostage Response Unit.”', 'point'],
          ['hana', 'G.A.… Grant Alvarez.', 'shock'],
        ],
      },
      L('grant', '…I can explain.', 'despair'),
      {
        t: 'debate', title: 'Grant’s defense', hint: 'Grant claims he negotiated for everyone. His own notes say otherwise.',
        stmts: [
          { who: 'grant', text: 'I was negotiating [our release]. All of us.' },
          { who: 'grant', text: 'I never told him [anything that mattered].' },
          { who: 'elise', text: 'If he bargained for all of us, [that isn’t betrayal].' },
          { who: 'grant', text: 'I would only ever have handed over [the real mole].' },
        ],
        answer: { stmt: 0, ev: 'grant_notes' },
        success: [
          ['noah', 'Your own script says “Anchor: one life for eleven.” One life, Grant. Yours.', 'point'],
          ['grant', '…You were never supposed to find that.', 'despair'],
        ],
      },
      {
        t: 'choice', q: 'What did Grant actually trade the Captain?', options: ['Our routes and plans', 'The identity of the mole', 'The medbay supplies'], correct: 0,
        success: [['fiona', 'Every ambush, gift-wrapped. He bought his ticket with our routes.', 'cross'], ['kai', 'I heard him. “Safe passage. Do we have a deal?”', 'hips']],
      },
      {
        t: 'rebuttal', who: 'isaac', pose: 'point',
        text: 'But who tried to CRUSH me? Grant was in the hub that whole time. And Noah was *right there* when the press fired!',
        options: [
          { text: '“Grant’s rig could relay band commands. He reprogrammed the press remotely.”', kind: 'mask', susp: -10, reply: [['aria', '…Technically, a rig like that could relay a command. Technically.', 'typing'], ['grant', 'That’s absurd!', 'shock']] },
          { text: '“I was ten meters away fighting a welder.”', kind: 'mask', susp: -5, reply: [['dexter', 'And the Captain won’t share the footage. Convenient.', 'hips']] },
          { text: 'Show them the press key you found in your boot after you blacked out.', kind: 'conscience', susp: 20, needs: 'press_card', reply: [['isaac', 'You… WHAT?', 'shock'], ['elise', 'Two blackouts. Two sabotages. Noah — I don’t think this is the sedative.', 'think']] },
          { text: '“I don’t know, Isaac. I really don’t know.”', kind: 'conscience', susp: 10, reply: [['isaac', 'That’s… not comforting, man.', 'despair']] },
        ],
      },
      {
        t: 'recon', title: 'THE CHAPEL TRANSMITTER',
        panels: [
          { q: 'Who built the transmitter?', options: ['Grant', 'Aria', 'Isaac'], correct: 0, text: '*Grant* hid a hand-built shortwave rig behind the chapel organ.' },
          { q: 'When did he call the Captain?', options: ['Around 2 AM', 'At noon', 'During trials'], correct: 0, text: 'Every night *around 2 AM*, he whispered our plans to the Captain.' },
          { q: 'What did he trade away?', options: ['Our routes', 'The mole’s name', 'Medicine'], correct: 0, text: 'He traded *our routes* for a promise of safe passage — for one.' },
          { q: 'What gave him away?', options: ['His tie clip', 'His shoes', 'His band'], correct: 0, text: 'But his *tie clip* snagged in the casing — and Kai heard every word.' },
        ],
      },
      { t: 'vote', culprit: 'grant' },
      { t: 'execution', who: 'grant', last: 'I talked a hundred men off ledges. Never thought I’d be the one standing on it.' },
    ],
  },
  // ===================================================================== TRIAL 3
  trial3: {
    id: 'trial3', title: 'The Gloomheart Heist', culprit: 'jade',
    steps: [
      { t: 'phase', text: 'OPENING STATEMENTS' },
      L('captain', 'Someone broke into my lab vault, stole my prettiest prototype, and let Subject Zero out to play! Rude. Also, delightful.'),
      L('elise', 'Before anyone else says it — I will. I was GloomTech’s serum lead. I tried to sabotage it. That’s how I ended up here.', 'despair'),
      L('dexter', '…You BUILT those things?', 'shock'),
      L('elise', 'I built a cure. They built the monsters out of it.', 'think'),
      {
        t: 'debate', title: 'Who opened Cell 0?', hint: 'One claim says the cell was hacked. What does the containment log say?',
        stmts: [
          { who: 'fiona', text: 'Elise knew the lab. [She opened the cell] to reach her research.' },
          { who: 'dexter', text: 'The cell had to be [hacked]. Aria’s our hacker.' },
          { who: 'jade', text: 'Subject Zero is smart. Maybe it [opened the door itself].' },
          { who: 'aria', text: 'I never touched containment. I [wasn’t even in the lab].' },
        ],
        answer: { stmt: 1, ev: 'cell_record' },
        success: [
          ['noah', 'No, that’s wrong! The containment log says Cell 0 was opened manually. No hack. No keycard. Just skill.', 'point'],
          ['aria', 'Thank you.', 'typing'],
          ['kai', 'Manual. Like picking a lock.', 'hips'],
        ],
      },
      {
        t: 'present', q: 'What was left snapped off inside the lock?', correct: 'lockpick',
        success: [
          ['noah', 'A tension wrench with a jade-green grip.', 'point'],
          ['luna', 'Jade-green. How poetic.', 'meditate'],
          ['jade', 'Lots of things are green! Grass! Envy! Zombies!', 'nervous'],
        ],
      },
      {
        t: 'present', q: 'And what was caught on the vault hinge?', correct: 'broken_chain',
        success: [
          ['noah', 'A snapped silver chain. The kind that holds a pendant.', 'point'],
          ['hana', 'Jade… where’s your necklace?', 'shock'],
          ['jade', 'I… lost it. In the shower.', 'nervous'],
        ],
      },
      {
        t: 'rebuttal', who: 'jade', pose: 'point',
        text: 'FINE. I was in the vault. I took the Gloomheart — one jewel, one ticket out. But I did NOT let that thing out on purpose! And Elise’s formula got torn up the same night. Ask *Noah* where he was!',
        options: [
          { text: '“Elise’s office was unlocked all night. Anyone could have — including you.”', kind: 'mask', susp: -8, reply: [['jade', 'I steal pretty things, not homework!', 'shock']] },
          { text: '“Elise had the strongest motive to destroy her own past.”', kind: 'mask', susp: -6, needs: 'elise_logs', reply: [['elise', 'I would NEVER destroy the cure.', 'shock'], ['fiona', 'Desperate people destroy many things.', 'cross']] },
          { text: 'Admit you found half the formula in your pocket after another blackout.', kind: 'conscience', susp: 25, needs: 'torn_formula', reply: [['elise', 'You WHAT?', 'shock'], ['luna', 'The mask slips.', 'meditate'], ['aria', 'Noah… how many blackouts have you had?', 'typing']] },
          { text: '“I was in the office. I don’t remember what I did there.”', kind: 'conscience', susp: 15, reply: [['dexter', 'I’m putting that on the list, Noah.', 'hips']] },
        ],
      },
      {
        t: 'present', q: 'Where is the Gloomheart now?', correct: 'heart_core',
        success: [
          ['noah', 'Sewn inside the mattress in Room 235. Still glowing.', 'point'],
          ['jade', '…It was going to buy me a whole new life.', 'despair'],
        ],
      },
      {
        t: 'recon', title: 'THE GLOOMHEART HEIST',
        panels: [
          { q: 'Who picked the containment locks?', options: ['Jade', 'Aria', 'Elise'], correct: 0, text: 'At 1 AM, *Jade* picked the containment wing locks.' },
          { q: 'What was she after?', options: ['The Gloomheart', 'The antidote', 'Subject Zero'], correct: 0, text: 'She was after the *Gloomheart* in Vault 0-B.' },
          { q: 'What did she leave behind?', options: ['Her lockpick and chain', 'A keycard', 'A note'], correct: 0, text: 'Her *lockpick* snapped, and her *chain* caught on the hinge.' },
          { q: 'What did her heist unleash?', options: ['Subject Zero', 'The Leviathan', 'A flood'], correct: 0, text: 'And in her hurry, Cell 0 swung open — freeing *Subject Zero*.' },
        ],
      },
      { t: 'vote', culprit: 'jade' },
      { t: 'execution', who: 'jade', last: 'Every lock has a weakness. Turns out mine was a pretty rock.' },
    ],
  },
  // ===================================================================== TRIAL 4
  trial4: {
    id: 'trial4', title: 'Protocol', culprit: 'dexter',
    steps: [
      { t: 'phase', text: 'OPENING STATEMENTS' },
      L('captain', 'Water, water everywhere! And one little Scout who nearly breathed it. Who sealed the door, hmm?'),
      L('hana', 'Someone sealed me inside Bulkhead C while the water was rising.', 'despair'),
      {
        t: 'debate', title: 'Who sealed Bulkhead C?', hint: 'Someone says it sealed itself. What does the seal record say?',
        stmts: [
          { who: 'dexter', text: 'The bulkhead [sealed automatically] when the breach alarm tripped.' },
          { who: 'kai', text: 'I was on the lower deck. [I never touched the controls].' },
          { who: 'isaac', text: 'The bulkheads on that vessel are [manual only].' },
          { who: 'fiona', text: 'Whoever it was, [they had a reason].' },
        ],
        answer: { stmt: 0, ev: 'bulkhead_log' },
        success: [
          ['noah', 'No, that’s wrong! The seal record says Bulkhead C was sealed by Band #05. Not the alarm.', 'point'],
          ['aria', 'Band #05 is… Dexter.', 'typing'],
        ],
      },
      {
        t: 'present', q: 'What proves he was at the controls?', correct: 'dog_tag',
        success: [
          ['noah', 'His dog tag. Found right beside the bulkhead lever.', 'point'],
          ['dexter', '…It snapped off when I hit the lever.', 'despair'],
        ],
      },
      L('dexter', 'I sealed it. One compartment flooding is a tragedy. The whole deck flooding is a massacre.', 'hips'),
      L('hana', 'You said “Sorry, kid.” I HEARD you.', 'despair'),
      {
        t: 'rebuttal', who: 'dexter', pose: 'point',
        text: 'But I didn’t FLOOD that habitat. Someone reversed Pump 3 that morning — from a GloomBand. Ask yourselves whose band. Noah was alone in the pump room.',
        options: [
          { text: '“The override source could have been your band too, Dexter.”', kind: 'mask', susp: -8, reply: [['dexter', 'I can read, Noah. It wasn’t mine.', 'hips'], ['fiona', 'Hmm.', 'cross']] },
          { text: '“You sealed a nineteen-year-old in a drowning room. Don’t change the subject.”', kind: 'mask', susp: -10, reply: [['hana', '…He’s right. You did.', 'despair'], ['dexter', '…I did.', 'despair']] },
          { text: 'Show them your band log: Pump 3 reversed — from your own band.', kind: 'conscience', susp: 25, needs: 'pump_override', reply: [['aria', 'Your band is executing commands without you.', 'typing'], ['elise', 'That’s not a sedative. That’s a program.', 'think']] },
          { text: '“Maybe I did. I don’t know what I do anymore.”', kind: 'conscience', susp: 15, reply: [['luna', 'Honesty, like water, finds the cracks.', 'meditate']] },
        ],
      },
      {
        t: 'debate', title: 'Is following protocol a crime?', hint: 'Someone points out Dexter wrote this rule himself. Agree with them.',
        stmts: [
          { who: 'dexter', text: 'Protocol [saved the lower deck].' },
          { who: 'elise', text: 'He [had no choice].' },
          { who: 'fiona', text: 'He’s done this before. {His protocol card is annotated in his own hand.}' },
          { who: 'kai', text: 'Anyone would have [done the same].' },
        ],
        answer: { stmt: 2, ev: 'protocol_card', agree: true },
        success: [
          ['noah', 'I agree! “Seal regardless of personnel.” He wrote that rule for himself.', 'point'],
          ['dexter', 'I wrote it after the first time. After Kandahar. Somebody has to make the call.', 'despair'],
        ],
      },
      {
        t: 'recon', title: 'BULKHEAD C',
        panels: [
          { q: 'Who reached the Bulkhead C controls?', options: ['Dexter', 'Kai', 'Isaac'], correct: 0, text: 'When the flood alarm sounded, *Dexter* reached the Bulkhead C controls.' },
          { q: 'Who was trapped behind it?', options: ['Hana', 'Kai', 'Luna'], correct: 0, text: '*Hana* was still inside, pounding on the door.' },
          { q: 'What did he do?', options: ['Sealed it anyway', 'Opened it', 'Called for help'], correct: 0, text: 'Following his own protocol, he *sealed it anyway*.' },
          { q: 'What did he leave behind?', options: ['His dog tag', 'His rifle', 'His band'], correct: 0, text: 'His *dog tag* snapped off on the lever.' },
        ],
      },
      { t: 'vote', culprit: 'dexter' },
      { t: 'execution', who: 'dexter', last: 'Protocol says the soldier goes first. …Hana. Sorry, kid.' },
    ],
  },
  // ===================================================================== TRIAL 5
  trial5: {
    id: 'trial5', title: 'Checkmate', culprit: 'fiona',
    steps: [
      { t: 'phase', text: 'OPENING STATEMENTS' },
      L('captain', 'Spores in the water, poison in the garden! Somebody is playing the long game. Shall we see who?'),
      L('isaac', 'The water was dosed at the intake. Precisely. Kai nearly died.', 'despair'),
      {
        t: 'debate', title: 'Who poisoned the water?', hint: 'Someone blames the wind. What did Isaac’s analysis find?',
        stmts: [
          { who: 'fiona', text: 'Mother Bloom’s spores [drift on the wind]. The intake was unlucky.' },
          { who: 'luna', text: 'I walk the greenhouse at night… [but not that night].' },
          { who: 'hana', text: 'Whoever did it [wanted us dead].' },
          { who: 'kai', text: 'If it was an accident, why was the dose [so exact]?' },
        ],
        answer: { stmt: 0, ev: 'water_report' },
        success: [
          ['noah', 'No, that’s wrong! The spores were introduced at the intake and dosed precisely. Wind doesn’t do math.', 'point'],
          ['isaac', 'Exactly what I said!', 'point'],
        ],
      },
      {
        t: 'present', q: 'What was found in the seed vault?', correct: 'spore_vial',
        success: [
          ['noah', 'An emptied vial of Mother Bloom spores. Engraved with a tiny black queen.', 'point'],
          ['aria', 'A chess piece.', 'typing'],
          ['fiona', '…Many people like chess.', 'cross'],
        ],
      },
      {
        t: 'present', q: 'Who saw someone in the greenhouse at midnight?', correct: 'luna_testimony',
        success: [['luna', 'Fiona. Gloves on. Tending flowers nobody asked her to tend.', 'meditate']],
      },
      L('fiona', 'Very well. Yes. I dosed the water. Not to kill. To weaken.', 'cross'),
      L('hana', 'WHY?!', 'shock'),
      L('fiona', 'Because sentiment loses games. I needed the votes to fall where the probabilities said they should.', 'cross'),
      {
        t: 'present', q: 'What proves she was steering the votes?', correct: 'vote_notes',
        success: [
          ['noah', 'Her notebook. Vote probabilities. Names crossed out weeks in advance. Kai and Isaac circled — “weaken before Sunday.”', 'point'],
          ['kai', 'You CIRCLED me?!', 'shock'],
        ],
      },
      {
        t: 'rebuttal', who: 'fiona', pose: 'point',
        text: 'And the next circled name, Noah, is *yours*. Every sabotage happened when you vanished. The kennel was opened with a key on YOUR ring. I was going to win this by removing you.',
        options: [
          { text: '“You poisoned two of us and kept a kill list. You don’t get to accuse anyone.”', kind: 'mask', susp: -12, reply: [['elise', '…He has a point, Fiona. You’ve spent your credibility.', 'think']] },
          { text: '“Isaac had the kennel key first. He was fixing the locks.”', kind: 'mask', susp: -6, reply: [['isaac', 'I— what? No, I— did I?', 'shock']] },
          { text: 'Admit the kennel key was on your ring — and you don’t remember using it.', kind: 'conscience', susp: 25, needs: 'kennel_key', reply: [['hana', 'Noah…', 'despair'], ['aria', 'I’m almost through the encryption. Whatever is in your band, I’ll find it.', 'typing']] },
          { text: '“Maybe you should circle my name. I wouldn’t blame you.”', kind: 'conscience', susp: 15, reply: [['fiona', 'Finally. An honest move.', 'cross']] },
        ],
      },
      {
        t: 'recon', title: 'THE POISONED WELL',
        panels: [
          { q: 'Who took spores from the seed vault?', options: ['Fiona', 'Luna', 'Isaac'], correct: 0, text: '*Fiona* emptied a vial of Mother Bloom spores in the seed vault.' },
          { q: 'Where did she put them?', options: ['The hub water intake', 'The medbay', 'The mess hall'], correct: 0, text: 'At midnight she dosed the *hub water intake*.' },
          { q: 'Why?', options: ['To weaken the voters', 'To kill everyone', 'To escape'], correct: 0, text: 'Not to kill — *to weaken the voters* she had circled.' },
          { q: 'What gave her away?', options: ['Her engraved vial and notebook', 'Her shoes', 'Her band'], correct: 0, text: 'But her *engraved vial and notebook* gave her away.' },
        ],
      },
      { t: 'vote', culprit: 'fiona' },
      { t: 'execution', who: 'fiona', last: 'Checkmate… was never mine to call. Was it, Noah?' },
    ],
  },
  // ===================================================================== FINAL TRIAL
  trial6: {
    id: 'trial6', title: 'The Mole', culprit: null,
    steps: [
      { t: 'phase', text: 'THE FINAL TRIAL' },
      L('captain', 'The final trial! Five fallen. Seven standing. And one mole who has been sitting in plain sight. Shall we finally say it out loud?'),
      L('aria', 'I’ll say it. I cracked the cryo archive. Project MOLE. Candidate #07.', 'typing'),
      {
        t: 'present', q: 'Aria plays the archive. What does it show?', correct: 'mole_footage',
        success: [
          ['hana', 'That’s… that’s you, Noah. At the relay. Cutting the wire.', 'shock'],
          ['isaac', 'And the press panel. That’s you at the press.', 'shock'],
          ['elise', 'And my formula. You tore it in half and fed it to the burner.', 'despair'],
        ],
      },
      L('kai', 'Five blackouts. Five sabotages. Every one of them — you.', 'point'),
      { t: 'finalChoice' },
    ],
  },
};

/** Truth-path continuation for the final trial */
export const FINAL_TRUTH: TStep[] = [
  L('noah', 'It’s me. Every time. I don’t remember any of it — but it’s me.', 'despair'),
  {
    t: 'debate', title: 'Is Noah responsible?', hint: 'Someone hears what the band is doing. Agree with them — Aria found proof.',
    stmts: [
      { who: 'kai', text: 'He did it. [He’s guilty]. Vote him.' },
      { who: 'elise', text: 'Blackouts like his [aren’t natural].' },
      { who: 'hana', text: 'He pulled me out of that water. [He saved me].' },
      { who: 'luna', text: 'The band on his wrist {hums a song we cannot hear}.' },
    ],
    answer: { stmt: 3, ev: 'subliminal_signal', agree: true },
    success: [
      ['noah', 'Luna’s right. Aria found a carrier wave hidden in my band’s firmware. Commands — below anything I can hear.', 'point'],
      ['aria', 'The Captain has been driving him like a car.', 'typing'],
      ['elise', 'Then the mole was never Noah. The mole is the band.', 'think'],
    ],
  },
  L('aria', 'I can jam it. Right now. Hold still.', 'typing'),
  L('noah', '…It’s quiet. For the first time since the container, it’s quiet.', 'despair'),
];

export const FINAL_MASK: TStep[] = [
  L('noah', 'Footage can be faked. So let’s ask the obvious question: who controls the footage?', 'point'),
  {
    t: 'present', q: 'Who could have fabricated the archive?', correct: 'aria_backdoor',
    success: [
      ['noah', 'Aria. She breached the Captain’s servers weeks ago. She has had access to everything.', 'point'],
      ['aria', 'I was trying to FIND the signal!', 'shock'],
    ],
  },
  {
    t: 'debate', title: 'Is the footage real?', hint: 'Isaac doubts anyone had the hardware for a fake. Who had the Captain’s own servers?',
    stmts: [
      { who: 'aria', text: 'The footage is [authentic]. I didn’t touch it.' },
      { who: 'hana', text: 'Aria would never [lie to us].' },
      { who: 'isaac', text: 'A fake like that needs [serious hardware].' },
      { who: 'kai', text: 'Why would Aria [frame Noah]?' },
    ],
    answer: { stmt: 2, ev: 'aria_backdoor' },
    success: [
      ['noah', 'The Captain’s servers ARE serious hardware, Isaac. And she’s been living inside them.', 'point'],
      ['kai', '…He’s got a point.', 'think'],
    ],
  },
];
