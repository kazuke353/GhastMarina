import type { CastId } from '../chars/Cast';
import type { ItemId } from '../world/LevelDef';

export type TalkLine = [string, string, string?];
export interface TalkEntry {
  lines: TalkLine[];
  give?: [ItemId, number][];
  evidence?: string;
  flag?: string;
  repeat?: boolean;
}

type Phase = Partial<Record<CastId, TalkEntry>>;

export const HUB_TALK: Record<string, Phase> = {
  // ------------------------------------------------------------ CHAPTER 1
  ch1: {
    elise: {
      lines: [
        ['elise', 'Pupils even, color returning. You’ll live. For now.', 'think'],
        ['noah', 'You do that to everyone you meet?'],
        ['elise', 'Only the ones who wake up first. You came out of that sedative fast, Noah. Faster than anyone.'],
        ['elise', 'Take this. If you get hurt out there, don’t be a hero about it.'],
      ],
      give: [['bandage', 2]],
    },
    leo: {
      lines: [
        ['leo', 'Leo Castellanos. Professional optimist.', 'cross'],
        ['leo', 'Here’s how I see it: twelve players, one cheat, a dealer who lies for fun. Classic table.'],
        ['noah', 'And who’s the cheat?'],
        ['leo', 'Kid, at a table like this? Assume it’s everyone. Saves time.'],
      ],
    },
    aria: {
      lines: [
        ['aria', 'Don’t mind me. I’m arguing with a wristband.', 'typing'],
        ['aria', 'GloomOS is locked down tight, but it’s chatty. It pings a server every eight seconds. Something is listening.'],
        ['noah', 'Can you get in?'],
        ['aria', 'Eventually. Everything has a back door. People included.'],
        ['aria', '…Sorry. You just — you look like someone I used to know. Never mind.'],
      ],
    },
    dexter: {
      lines: [
        ['dexter', 'Name’s Dexter. Two tours, one rescue corps, zero patience for panic.', 'hips'],
        ['dexter', 'We need a perimeter, a watch rotation, and rules. Rule one: nobody wanders off alone.'],
        ['noah', 'And rule two?'],
        ['dexter', 'If someone breaks rule one, we find out why.'],
      ],
    },
    fiona: {
      lines: [
        ['fiona', 'Fiona. I used to play chess for a living. Now I play people.', 'cross'],
        ['fiona', 'The Captain has given us a deduction game with incomplete information and a ticking clock. I find it… elegant.'],
        ['noah', 'You sound like you’re enjoying this.'],
        ['fiona', 'I’m enjoying understanding it. Enjoyment comes when I win.'],
      ],
    },
    grant: {
      lines: [
        ['grant', 'Grant Alvarez. I used to talk men down from rooftops.', 'think'],
        ['grant', 'Everyone on this ship has a breaking point. My job is to find it before it finds us.'],
        ['grant', 'If you ever need to talk — about anything — my door’s open. Literally. They removed the locks.'],
      ],
    },
    hana: {
      lines: [
        ['hana', 'Hana! Scout, sprinter, professional “first one through the door.”'],
        ['hana', 'I already ran the whole deck twice. Six gangways — all sealed. And something is MOANING on the other side of every one.'],
        ['noah', 'Comforting.'],
        ['hana', 'Hey, at least we know where the monsters are. That’s basically a map!'],
      ],
    },
    isaac: {
      lines: [
        ['isaac', 'Don’t touch that bench. I mean it. Okay, you can touch it a little.', 'typing'],
        ['isaac', 'Isaac. Engineer. I’m setting up a workbench — bring me scrap and I can make whatever you’re holding hit harder.'],
        ['isaac', 'This whole ship runs off that core. Whoever built it was a genius. A monstrous, terrifying genius.'],
      ],
      give: [['scrap', 4]],
    },
    jade: {
      lines: [
        ['jade', 'Psst. You look like a man who notices things.', 'cross'],
        ['jade', 'Jade. I acquire. Paintings, jewels, the occasional nation’s gold reserve.'],
        ['jade', 'This boat’s full of locked doors. Locked doors are just doors that haven’t met me yet.'],
      ],
    },
    kai: {
      lines: [
        ['kai', 'Kai. Wilderness guide. Ex-wilderness, now that the wilderness is radioactive.', 'hips'],
        ['kai', 'Rule of thumb: water, warmth, weapons, in that order. We’ve got two out of three.'],
        ['kai', 'Here. Flares. Monsters hate fire. Everything hates fire.'],
      ],
      give: [['flare', 2]],
    },
    luna: {
      lines: [
        ['luna', 'Shh. The mushrooms are speaking.', 'meditate'],
        ['noah', 'The glowing ones?'],
        ['luna', 'Gloomies. They glow brighter near lies. Tonight they glow very bright indeed.'],
        ['luna', 'Gather them, Noah. Sit with them at the shrines. They will keep your mind from fraying.'],
      ],
    },
  },
  // ------------------------------------------------------------ CHAPTER 2
  ch2pre: {
    elise: {
      lines: [
        ['elise', 'Someone emptied my medbay last night. Every antibiotic. Every stim.', 'think'],
        ['elise', 'And the lock wasn’t forced. It was opened with my keycard — which I found back in my coat this morning.'],
        ['noah', 'So someone borrowed it.'],
        ['elise', 'Someone with light fingers. Be careful in the city. I can’t patch what I don’t have.'],
      ],
    },
    hana: {
      lines: [
        ['hana', 'City vessel! Real buildings! Okay, ruined buildings. Still!'],
        ['hana', 'I’ll be right behind you. Or in front. Probably in front.'],
      ],
    },
    leo: {
      lines: [
        ['leo', 'Medbay robbery on night one. Whoever did that has style.', 'cross'],
        ['noah', 'Where were you last night, Leo?'],
        ['leo', 'Counting ceiling tiles. Four hundred and twelve. One’s loose — I’d avoid Room 241.'],
      ],
    },
    dexter: {
      lines: [
        ['dexter', 'You’re taking the scout into the city? Keep her alive.', 'hips'],
        ['dexter', 'And Noah — the sound you make when you sleep. You were muttering numbers. Over and over.'],
      ],
    },
    fiona: {
      lines: [
        ['fiona', 'The Captain gave us a theft on the very first night. Interesting opening.', 'cross'],
        ['fiona', 'Either the mole is clumsy, or someone else has a secret. I suspect both.'],
      ],
    },
    jade: {
      lines: [
        ['jade', 'Don’t look at me. If I’d stolen those meds, nobody would have noticed they were gone.', 'cross'],
      ],
    },
  },
  ch2post: {
    elise: {
      lines: [
        ['elise', 'You’re back. Hana told me about the gate. That was meant to kill her.', 'think'],
        ['elise', 'Here — my inventory of what was taken. Precise to the vial. Maybe it helps you before Sunday.'],
      ],
      evidence: 'medbay_list',
    },
    jade: {
      lines: [
        ['jade', 'You want something juicy for the trial? Fine. Free sample.', 'cross'],
        ['jade', 'Three AM. I couldn’t sleep — occupational hazard. I heard shoes click past the cargo hold. Leather soles. Italian.'],
        ['jade', 'Nobody else on this boat wears Italian leather, Noah. Nobody but our resident card sharp.'],
      ],
      evidence: 'jade_testimony',
    },
    leo: {
      lines: [
        ['leo', 'Why is everyone looking at my shoes?', 'cross'],
        ['noah', 'Where were you the night the medbay was robbed?'],
        ['leo', 'In my quarters. All night. Never left. Hand on heart.'],
        ['leo', '…Why are you writing that down?'],
      ],
      evidence: 'leo_alibi',
    },
    hana: {
      lines: [
        ['hana', 'I keep replaying it. The gate dropping. The sparks.'],
        ['hana', 'Right before it fell, I saw someone by the relay. Dark jacket. Just a shape.'],
        ['noah', '…A dark jacket.'],
        ['hana', 'Half this boat wears dark jackets, Noah. Don’t look at me like that.'],
      ],
      evidence: 'hana_testimony',
    },
    kai: {
      lines: [
        ['kai', 'Smelled something in the cargo hold. Antiseptic. Someone stashed medicine down there.', 'hips'],
        ['kai', 'Behind the crates, east wall. I didn’t touch it. Figured the trial would want it untouched.'],
      ],
    },
    grant: {
      lines: [
        ['grant', 'The trial is coming. Whatever happens, remember: people lie when they’re scared, not just when they’re guilty.', 'think'],
      ],
    },
    aria: {
      lines: [
        ['aria', 'I pulled some band telemetry. The relay override came from a band ending in zero-something.', 'typing'],
        ['aria', 'Bands #01 through #09 all start with zero. That’s… nine of us. Not helpful. Sorry.'],
      ],
    },
    isaac: {
      lines: [
        ['isaac', 'That relay backup was cut clean. Wire cutters. Not a zombie — zombies chew.', 'typing'],
        ['isaac', 'Bring me scrap, I’ll keep your gun purring.'],
      ],
    },
  },
  // ------------------------------------------------------------ CHAPTER 3
  ch3pre: {
    isaac: {
      lines: [
        ['isaac', 'The Industrial vessel! Furnaces, presses, heavy machinery — my people!', 'typing'],
        ['isaac', 'I’m coming with you. If anything there still runs, I want to know how.'],
      ],
    },
    grant: {
      lines: [
        ['grant', 'Leo… I keep thinking about the look on his face.', 'despair'],
        ['grant', 'We voted a man into a pit, Noah. We cheered. The Captain was right about us.'],
        ['noah', 'Do you think he was the mole?'],
        ['grant', 'I think he was a thief. Whether he was a mole… I think the Captain enjoys us not knowing.'],
      ],
    },
    fiona: {
      lines: [
        ['fiona', 'Eleven pieces left. The board simplifies.', 'cross'],
        ['fiona', 'Leo was a pawn. The mole is a knight — it moves in ways you don’t expect.'],
      ],
    },
    elise: {
      lines: [['elise', 'I recovered most of the medicine from Leo’s stash. Take some. Please come back.', 'think']],
      give: [['medkit', 1]],
    },
    kai: {
      lines: [
        ['kai', 'Couldn’t sleep. Heard voices in the corridor around two in the morning.', 'hips'],
        ['kai', 'Probably nothing. On this boat, “probably nothing” is usually something.'],
      ],
    },
    dexter: {
      lines: [['dexter', 'Every time we plan a route, the route is crawling with those things an hour later. Coincidence is a luxury.', 'hips']],
    },
  },
  ch3post: {
    kai: {
      lines: [
        ['kai', 'Those voices I heard at two AM? I went and listened properly.', 'hips'],
        ['kai', 'Grant. In the chapel. Whispering into something: “…and in exchange you guarantee safe passage. Do we have a deal?”'],
        ['kai', 'I don’t know who he was talking to. But nobody on this boat has anyone to call. Except the Captain.'],
      ],
      evidence: 'kai_testimony',
    },
    isaac: {
      lines: [
        ['isaac', 'That press. It was LOCKED OUT. I checked it myself.', 'despair'],
        ['isaac', 'Someone reprogrammed the cycle from a GloomBand. Seconds before I reached in. I nearly lost the arm.'],
        ['isaac', 'You were there, Noah. Did you see anyone?'],
        ['noah', '…No. I didn’t see anyone.'],
      ],
      evidence: 'isaac_testimony',
    },
    fiona: {
      lines: [
        ['fiona', 'I mapped every ambush since we woke up. Every route we discussed was compromised within the hour.', 'cross'],
        ['fiona', 'Someone is reporting our plans to the Captain. Here — my analysis.'],
      ],
      evidence: 'ambush_report',
    },
    grant: {
      lines: [
        ['grant', 'You’ve got that look. The investigator’s squint.', 'think'],
        ['grant', 'Whatever you find, Noah — consider the reasons, not just the act. People do terrible things for good reasons.'],
      ],
    },
    luna: {
      lines: [
        ['luna', 'The chapel organ has been humming at night. Organs don’t hum. Transmitters do.', 'meditate'],
      ],
    },
    hana: {
      lines: [['hana', 'Isaac almost lost his ARM? What is happening to this ship… to us?']],
    },
  },
  // ------------------------------------------------------------ CHAPTER 4
  ch4pre: {
    elise: {
      lines: [
        ['elise', 'The Lab vessel. Of course it’s the lab.', 'despair'],
        ['noah', 'You know it.'],
        ['elise', 'I know labs like it. Let me come with you. There are things there that only I will recognize.'],
      ],
    },
    jade: {
      lines: [
        ['jade', 'Labs have vaults. Vaults have shiny things. Just saying.', 'cross'],
        ['jade', 'Relax. I’m reformed. Mostly. Recently.'],
      ],
    },
    aria: {
      lines: [
        ['aria', 'Grant had a radio. Grant was trading us for a ticket out.', 'typing'],
        ['aria', 'And it still doesn’t feel like he was the mole. The signal I keep seeing — it’s still on the network. Still talking.'],
      ],
    },
    kai: { lines: [['kai', 'Took the liberty of loading your pockets. Shells. Don’t waste them.', 'hips']], give: [['shells', 6]] },
  },
  ch4post: {
    elise: {
      lines: [
        ['elise', 'You read my logs. Don’t pretend you didn’t.', 'despair'],
        ['elise', 'Yes. I was Dr. Elise Marlow. I built the serum. I tried to break it. They framed me for murder instead.'],
        ['elise', 'My antidote notes were in that office. Someone tore them apart. Someone burned the rest.'],
        ['noah', '…'],
        ['elise', 'I’ll tell the others myself. Better from me than from a trial.'],
      ],
      evidence: 'elise_logs',
    },
    jade: {
      lines: [
        ['jade', 'Vault? What vault? I was asleep. Like a baby. A very innocent baby.', 'nervous'],
        ['jade', '…Stop looking at my neck. I lost my necklace in the shower.'],
      ],
    },
    hana: {
      lines: [['hana', 'Jade came back last night soaking wet and grinning. Said she went for a “walk.” At one in the morning.']],
    },
    fiona: {
      lines: [['fiona', 'The containment cell was opened by hand. No hack. Only one of us has hands that good.', 'cross']],
    },
    dexter: {
      lines: [['dexter', 'Subject Zero got out because someone wanted something in that vault. Greed gets people killed.', 'hips']],
    },
  },
  // ------------------------------------------------------------ CHAPTER 5
  ch5pre: {
    dexter: {
      lines: [
        ['dexter', 'Aquatic vessel’s flooding. I’m on point. You’re with me.', 'hips'],
        ['dexter', 'Hana and Kai will sweep the lower decks from the other side. We meet at the pumps.'],
      ],
    },
    hana: {
      lines: [['hana', 'Water! I’m a terrible swimmer. Good thing it’s only knee deep. It IS only knee deep… right?']],
    },
    aria: {
      lines: [
        ['aria', 'I almost cracked the band firmware last night. There’s a second channel under the first. Encrypted. Really encrypted.', 'typing'],
        ['aria', 'Whatever it’s carrying, it’s only going to one band.'],
        ['noah', 'Whose?'],
        ['aria', 'I don’t know yet.'],
      ],
    },
    elise: { lines: [['elise', 'I’m rebuilding the antidote from memory. Slowly. Here, for the road.', 'think']], give: [['pills', 2]] },
  },
  ch5post: {
    dexter: {
      lines: [
        ['dexter', 'Yeah. I sealed Bulkhead C.', 'hips'],
        ['dexter', 'The breach would have flooded the whole lower deck. Protocol says you seal the compartment. You don’t open it for anyone.'],
        ['noah', 'Hana was inside.'],
        ['dexter', 'I know who was inside. I’ll carry that. But I’d do it again.'],
      ],
      evidence: 'bulkhead_log',
    },
    hana: {
      lines: [
        ['hana', 'I heard him, you know. Through the door. “Sorry, kid. Protocol.”'],
        ['hana', 'The water was at my chin when it started draining. If you hadn’t—'],
        ['hana', 'Thank you, Noah.'],
      ],
      evidence: 'hana_testimony2',
    },
    kai: {
      lines: [['kai', 'Pump 3 was reversed on purpose. Somebody wanted that habitat drowned.', 'hips']],
    },
    luna: {
      lines: [['luna', 'The water remembers who touched it. So do the Gloomies. So, perhaps, do you.', 'meditate']],
    },
  },
  // ------------------------------------------------------------ CHAPTER 6
  ch6pre: {
    luna: {
      lines: [
        ['luna', 'The biosphere calls to me. I will walk with you.', 'meditate'],
        ['luna', 'Bring flares. The garden fears fire the way we fear the truth.'],
      ],
      give: [['flare', 2]],
    },
    isaac: {
      lines: [['isaac', 'Feel awful. Kai’s worse. Something in the water…', 'despair']],
    },
    kai: {
      lines: [['kai', 'Can’t… stand up. Haven’t been this sick since the ash winter.', 'despair']],
    },
    fiona: {
      lines: [
        ['fiona', 'Poisoned water two days before a trial. The weak get weaker. The vote gets… simpler.', 'cross'],
        ['noah', 'You sound like you’re admiring it.'],
        ['fiona', 'I admire the move. Not the player.'],
      ],
    },
    elise: { lines: [['elise', 'It’s spores. Mutagenic. I can treat it, but whoever did this knew exactly how much to use.', 'think']] },
  },
  ch6post: {
    isaac: {
      lines: [
        ['isaac', 'I ran the water. Spores were introduced at the intake on the south deck. Dosed precisely.', 'typing'],
        ['isaac', 'This wasn’t an accident or a monster. Somebody did math.'],
      ],
      evidence: 'water_report',
    },
    luna: {
      lines: [
        ['luna', 'I must tell you what I saw. It weighs on me.', 'meditate'],
        ['luna', 'Two nights ago, at midnight, Fiona was in the greenhouse. Tending the flowers. With gloves on.'],
        ['luna', 'Nobody tends flowers at midnight, Noah.'],
      ],
      evidence: 'luna_testimony',
    },
    fiona: {
      lines: [['fiona', 'You’ve been in my room. You moved my chess set a quarter inch.', 'cross']],
    },
    aria: {
      lines: [['aria', 'I’m close to cracking the second channel. Closer than I want to be.', 'typing']],
    },
  },
  // ------------------------------------------------------------ CHAPTER 7
  ch7pre: {
    aria: {
      lines: [
        ['aria', 'The cryo vessel has GloomTech’s archive servers. If the second channel has a source, it’s there.', 'typing'],
        ['aria', 'I’m coming. I need to see it with my own eyes.'],
      ],
    },
    elise: {
      lines: [
        ['elise', 'Locker 9 in the cold vault. My old notes. If they survived, maybe the antidote does too.', 'think'],
      ],
      give: [['medkit', 1]],
    },
    hana: { lines: [['hana', 'Five of us gone. Five. I stopped counting the zombies. I can’t stop counting us.']] },
    kai: { lines: [['kai', 'Whatever’s waiting at the end of this, we face it awake. Here. Last of my good stuff.', 'hips']], give: [['pipebomb', 1]] },
    luna: { lines: [['luna', 'The cards show only one face now. It is wearing glasses.', 'meditate']] },
    isaac: { lines: [['isaac', 'I gave your weapons everything I had. Come back and let me fix them again.', 'typing']], give: [['scrap', 6]] },
  },
  ch8: {
    hana: { lines: [['hana', 'Whatever you did — whatever they made you do — we finish this together.']] },
    elise: { lines: [['elise', 'The signal is jammed. Your mind is your own again, Noah. Use it.', 'think']] },
    isaac: { lines: [['isaac', 'The core is going critical. If we’re doing something heroic, now is good.', 'typing']] },
  },
};

export const GENERIC_TALK: Partial<Record<CastId, [string][]>> = {
  elise: [['Drink water. Eat something. Sleep. Doctor’s orders.'], ['Your hands are shaking. Sit with a Gloomy for a while.']],
  leo: [['Never bet against the house. Unless you own the house.'], ['Smile, kid. The cameras like a winner.']],
  aria: [['Busy. Hacking. Fighting a mushroom-themed firewall.'], ['Did you know GloomOS has 400 ad trackers? Per wristband.']],
  dexter: [['Check your corners. Check your ammo. Check your friends.'], ['At ease. For now.']],
  fiona: [['Every conversation is a move, Noah. What’s yours?'], ['I’m thinking. Don’t interrupt the pieces.']],
  grant: [['How are you holding up? Honestly.'], ['Breathe. In for four. Out for four.']],
  hana: [['I ran the deck again. Still haunted. Still big.'], ['Race you to the mess hall! …Next time.']],
  isaac: [['Workbench is open if you’ve got scrap.'], ['Don’t lick the core window. Long story.']],
  jade: [['I’m not stealing anything. Right now.'], ['Every lock on this ship is a love letter to me.']],
  kai: [['Water, warmth, weapons. Got all three? Good.'], ['Fire’s your friend out there. Make lots of friends.']],
  luna: [['The Gloomies are murmuring your name.'], ['Some truths glow. Some burn.']],
};
