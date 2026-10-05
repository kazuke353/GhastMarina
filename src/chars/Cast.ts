import { Look } from './CharacterBuilder';

export type CastId =
  | 'noah' | 'elise' | 'leo' | 'aria' | 'dexter' | 'fiona' | 'grant' | 'hana' | 'isaac' | 'jade' | 'kai' | 'luna' | 'captain';

export interface CastMember {
  id: CastId;
  name: string;
  title: string;
  color: string; // UI accent
  pitch: number; // dialogue babble base pitch
  timbre: number;
  bio: string;
  traits: string;
  look: Look;
}

export const CAST: Record<CastId, CastMember> = {
  noah: {
    id: 'noah', name: 'Noah', title: 'The Enigma', color: '#ff4d3d', pitch: 132, timbre: 0.2,
    traits: 'Observant · Adaptable · Unpredictable',
    bio: 'A former psychology prodigy who studied the minds of manipulators. Wakes with gaps in his memory — and things in his pockets he never picked up.',
    look: {
      skin: 0xf0c8a8, hair: 0xd8321e, hairStyle: 'messy', top: 0x141418, topStyle: 'jacket', under: 0xf2f2f2,
      bottom: 0x101014, shoes: 0x1a1210, glasses: 0x0a0a0c, extras: ['furCollar', 'choker', 'chains', 'boots', 'buckles'],
      height: 1.0, build: 0.95, eye: 0x3a5a8a, accent: 0xd8dde4, seed: 1,
    },
  },
  elise: {
    id: 'elise', name: 'Dr. Elise', title: 'The Medic', color: '#4fd1c5', pitch: 215, timbre: 0.1,
    traits: 'Compassionate · Decisive · Meticulous',
    bio: 'A brilliant surgeon who treated radiation sickness after the cataclysm. She knows far more about GloomTech serums than a surgeon should.',
    look: {
      skin: 0xe8c0a0, hair: 0x3a2418, hairStyle: 'bun', top: 0xf4f6f8, topStyle: 'labcoat', under: 0x2a8a88,
      bottom: 0x2a8a88, shoes: 0x2a2a30, female: true, glasses: 0x6a6a72, extras: ['stethoscope', 'badge'], height: 0.97, build: 0.9, seed: 2,
    },
  },
  leo: {
    id: 'leo', name: 'Leo', title: 'The Gambler', color: '#e0b040', pitch: 118, timbre: 0.3,
    traits: 'Suave · Risk-taking · Silver-tongued',
    bio: 'Professional poker player turned underground bookmaker. Always counting outs — and always holding something back.',
    look: {
      skin: 0xc89070, hair: 0x18120e, hairStyle: 'slick', top: 0x3a1a1e, topStyle: 'vest', under: 0xf0ece4, accent: 0x5a1420,
      bottom: 0x1c1c22, shoes: 0x2a1a10, hat: 'fedora', hatColor: 0x1c1c20, extras: ['ringGold', 'cardPocket'], height: 1.02, build: 1.0, beard: false, seed: 3,
    },
  },
  aria: {
    id: 'aria', name: 'Aria', title: 'The Hacker', color: '#b06cff', pitch: 238, timbre: 0.6,
    traits: 'Curious · Introverted · Tenacious',
    bio: 'A white-hat prodigy who kept the lights on for whole communities by hacking old-world tech. She reminds Noah of someone he lost.',
    look: {
      skin: 0xf2d0b8, hair: 0x1c1428, hairStyle: 'bob', top: 0x4a2a6a, topStyle: 'hoodie', bottom: 0x22222a, shoes: 0xe8e8ee,
      female: true, hat: 'headphones', accent: 0xb06cff, extras: ['streaks', 'sneakers'], height: 0.93, build: 0.85, seed: 4,
    },
  },
  dexter: {
    id: 'dexter', name: 'Dexter', title: 'The Soldier', color: '#8fb85a', pitch: 98, timbre: 0.4,
    traits: 'Disciplined · Loyal · Assertive',
    bio: 'Multiple tours overseas, then a decade leading rescue missions through the ash. Follows protocol even when protocol bleeds.',
    look: {
      skin: 0x8a5a3a, hair: 0x141210, hairStyle: 'buzz', top: 0x4a5a32, topStyle: 'tactical', bottom: 0x3a4030, shoes: 0x2a2418,
      beard: true, extras: ['dogtags', 'boots', 'kneepads', 'holster'], height: 1.08, build: 1.22, seed: 5,
    },
  },
  fiona: {
    id: 'fiona', name: 'Fiona', title: 'The Strategist', color: '#e8e8f0', pitch: 205, timbre: 0.2,
    traits: 'Analytical · Patient · Introverted',
    bio: 'Former world chess champion. After the collapse she planned rations for ten thousand people. She thinks twelve moves ahead — and so does her opponent.',
    look: {
      skin: 0xf4dccc, hair: 0xe0e0ec, hairStyle: 'ponytail', top: 0x121216, topStyle: 'coat', under: 0xf0f0f4, bottom: 0x121216,
      shoes: 0x0e0e10, female: true, accent: 0xf0f0f0, extras: ['scarfChess', 'boots'], height: 1.0, build: 0.88, seed: 6,
    },
  },
  grant: {
    id: 'grant', name: 'Grant', title: 'The Negotiator', color: '#7fa6d0', pitch: 108, timbre: 0.1,
    traits: 'Empathetic · Persuasive · Calm',
    bio: 'Hostage negotiator, then peace broker between warring survivor factions. He can talk anyone into anything — almost.',
    look: {
      skin: 0xd8a888, hair: 0x8a8a8e, hairStyle: 'short', top: 0x3a4250, topStyle: 'suit', under: 0xe6eaf0, accent: 0x2a4a7a,
      bottom: 0x3a4250, shoes: 0x1a1410, beard: true, height: 1.03, build: 1.08, seed: 7,
    },
  },
  hana: {
    id: 'hana', name: 'Hana', title: 'The Scout', color: '#ff9a3c', pitch: 255, timbre: 0.5,
    traits: 'Agile · Observant · Optimistic',
    bio: 'An Olympic hopeful whose dreams ended with the sky. She became the fastest scout in the wastes — first in, first out.',
    look: {
      skin: 0xf0cca8, hair: 0x0e0c0e, hairStyle: 'ponytail', top: 0xff7a1a, topStyle: 'jacket', under: 0x1c1c22, bottom: 0x1c1c22,
      shoes: 0xff7a1a, female: true, accent: 0xff9a3c, extras: ['sneakers', 'backpack'], height: 0.95, build: 0.84, seed: 8,
    },
  },
  isaac: {
    id: 'isaac', name: 'Isaac', title: 'The Engineer', color: '#3fa7ff', pitch: 128, timbre: 0.3,
    traits: 'Innovative · Pragmatic · Focused',
    bio: 'Aerospace engineer who rebuilt water purifiers from scrap after the fall. If it has wires, Isaac can make it work — or make it explode.',
    look: {
      skin: 0xe0b090, hair: 0x5a3a20, hairStyle: 'messy', top: 0x3a5a7a, topStyle: 'overalls', under: 0xd8d0c0, bottom: 0x3a5a7a,
      shoes: 0x3a2a1a, hat: 'goggles', extras: ['toolbelt', 'boots'], height: 1.0, build: 1.02, seed: 9,
    },
  },
  jade: {
    id: 'jade', name: 'Jade', title: 'The Lockpick', color: '#2fd48a', pitch: 228, timbre: 0.4,
    traits: 'Stealthy · Witty · Resourceful',
    bio: 'Once the most wanted art thief on three continents. No lock has ever kept her out. Some should have.',
    look: {
      skin: 0xe8c4a8, hair: 0x0a0a0c, hairStyle: 'short', top: 0x1e3a2e, topStyle: 'jacket', under: 0x0e1a14, bottom: 0x101814,
      shoes: 0x0a0a0a, female: true, hat: 'beanie', hatColor: 0x16261e, extras: ['pendantJade', 'boots'], height: 0.96, build: 0.84, seed: 10,
    },
  },
  kai: {
    id: 'kai', name: 'Kai', title: 'The Survivalist', color: '#c08a4a', pitch: 102, timbre: 0.5,
    traits: 'Resilient · Pragmatic · Adaptive',
    bio: 'Wilderness guide who taught whole towns to live off poisoned land. Believes in survival of the prepared. Mostly.',
    look: {
      skin: 0xb88060, hair: 0x2a1c12, hairStyle: 'tied', top: 0x6a4a2a, topStyle: 'poncho', bottom: 0x4a4030, shoes: 0x3a2a1a,
      beard: true, accent: 0x8a2a1a, extras: ['boots'], height: 1.05, build: 1.12, seed: 11,
    },
  },
  luna: {
    id: 'luna', name: 'Luna', title: 'The Mystic', color: '#8a9cff', pitch: 196, timbre: 0.0,
    traits: 'Intuitive · Mysterious · Wise',
    bio: 'A folklore professor who catalogued the myths of drowned cities. She says the mushrooms whisper. She may be right.',
    look: {
      skin: 0xeed6c6, hair: 0xd8dcf0, hairStyle: 'long', top: 0x3a3a8a, topStyle: 'shawl', bottom: 0x24245a, shoes: 0x1a1a2a,
      female: true, extras: ['beads'], height: 0.98, build: 0.86, seed: 12,
    },
  },
  captain: {
    id: 'captain', name: 'The Captain', title: 'Master of the GhastMarina', color: '#ff2a4a', pitch: 70, timbre: 1.0,
    traits: 'Faceless · Theatrical · Omnipresent',
    bio: 'A voice in every wristband. A silhouette in every screen. He calls it a game. He calls it a message.',
    look: {
      skin: 0x050508, hair: 0x050508, hairStyle: 'none', top: 0x0c1428, topStyle: 'uniform', under: 0x0a0a10, bottom: 0x0c1428,
      shoes: 0x050505, hat: 'captain', hatColor: 0x0c1428, eye: 0xff2040, eyeGlow: true, band: false, height: 1.12, build: 1.1, seed: 13,
    },
  },
};

export const SURVIVORS: CastId[] = ['noah', 'elise', 'leo', 'aria', 'dexter', 'fiona', 'grant', 'hana', 'isaac', 'jade', 'kai', 'luna'];

export function castName(id: string) {
  return (CAST as any)[id]?.name ?? id;
}
