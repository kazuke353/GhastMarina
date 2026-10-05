export interface LogDef {
  title: string;
  speaker: string;
  where: string;
  text: string;
}

export const LOGS: Record<string, LogDef> = {
  // ---------------- hub ----------------
  hub_log1: {
    title: 'Crew Manifest', speaker: 'GloomTech Logistics', where: 'Polaris Vessel',
    text: `GHASTMARINA FLOTILLA — CREW MANIFEST (REV. 14)

Vessels: 6 + Core.
Crew complement prior to Serum Trial: 1,204.
Crew complement after Serum Trial: [REDACTED].
Passenger complement: 12 (twelve). Non-negotiable. The Captain insists.

Note from Logistics: Please stop ordering party hats. We are aware it is "a show". Budget is budget.`,
  },
  hub_log2: {
    title: 'Undernet Promo Reel', speaker: 'The Captain', where: 'Polaris Vessel',
    text: `[A bassy jingle. Applause from an audience that may not exist.]

CAPTAIN: Tired of watching the world end slowly? Tired of ash, of quiet, of nothing ever happening?

Tune in to GHASTMARINA. Twelve condemned souls. Six haunted vessels. One traitor.

Every Sunday, they vote. Every Sunday, someone falls.

Tip your favorites. Curse your villains. And remember — they can hear you cheer.

[Jingle. A woman's voice, fast:] GloomTech Industries is not affiliated with Ghastmarina. GloomTech Industries is not aware of Ghastmarina. GloomTech Industries loves you.`,
  },
  hub_log3: {
    title: 'Isolation Zone — Maintenance', speaker: 'Technician Paolo', where: 'Polaris Vessel',
    text: `Note to self: the Isolation Zone hatch sticks in the cold. Grease it before Sunday.

Second note: they asked me to make the drop "more cinematic." I said it's a hole. They said make it a cinematic hole.

Third note: I don't go down there to retrieve anything anymore. Nothing down there wants to be retrieved.`,
  },
  // ---------------- city ----------------
  city_log1: {
    title: 'Last Voicemail', speaker: 'Marisol Ortega', where: 'Forgotten City Vessel',
    text: `Hey, baby, it's Mom. The tram's stuck again — something about a "serum event" at the plaza. Everyone's been handed these free GloomTech drinks. Evolution Enhancer, it says on the can. Tastes like pennies.

The man next to me keeps scratching his arm. He says it itches under the skin.

I'll be home late. Don't wait up. I love y— [screaming in the background] — what is he — sir? SIR—

[Static. Then breathing. Not hers.]`,
  },
  city_log2: {
    title: 'Riot Unit Report', speaker: 'Officer D. Reyes', where: 'Forgotten City Vessel',
    text: `Riot Unit 4, incident report. Shields up at the plaza. Crowd non-responsive to commands. Crowd non-responsive to batons. Crowd non-responsive to rubber rounds.

Crowd responsive to noise. Crowd responsive to light.

Recommend: lights off. Recommend: quiet. Recommend: whoever approved the free drinks be thrown off this ship.

Addendum: Kowalski got bit. Kowalski says he's fine. Kowalski is not fine.`,
  },
  city_log3: {
    title: 'Launch Party Script', speaker: 'GloomTech PR', where: 'Forgotten City Vessel',
    text: `EVOLUTION ENHANCER™ — LAUNCH EVENT RUN OF SHOW

19:00 — Confetti.
19:05 — CEO hologram: "Tomorrow's humanity, today!"
19:10 — Free samples to all 800 residents of the City Vessel (test cohort).
19:30 — Observe.
20:00 — Do not, under any circumstances, leave the VIP lounge.
20:15 — If the residents begin to "change", this is expected. Smile for the cameras.
21:00 — Evacuate VIPs by helicopter. Seal the vessel. Bill the Undernet.`,
  },
  // ---------------- industrial ----------------
  ind_log1: {
    title: 'Shift Supervisor Memo', speaker: 'The Foreman', where: 'Industrial Complex Vessel',
    text: `To all Line 7 workers:

The new coolant additive is MANDATORY. Yes it glows. Yes it smells like a dentist's office. Yes Hector's teeth fell out. Hector was already old.

Productivity is up 340%. Sleep is optional now. Pain is optional now. You're welcome.

Anyone caught removing their safety mask will be docked a week's pay and/or their face.

— Management (me)`,
  },
  ind_log2: {
    title: 'Union Grievance #4471', speaker: 'Rosa Kim, Line Steward', where: 'Industrial Complex Vessel',
    text: `GRIEVANCE: Workers are being fused to the machinery.

RESPONSE FROM GLOOMTECH HR: "Workers report increased job security."

GRIEVANCE (APPEAL): Hector is part of the conveyor now. He blinks at us when we walk by.

RESPONSE FROM GLOOMTECH HR: "Please refer to Hector by his new title: Conveyor Associate."`,
  },
  ind_log3: {
    title: 'Additive Batch Notes', speaker: 'Unknown Chemist', where: 'Industrial Complex Vessel',
    text: `Batch 7-G: Serum diluted 1:4000 in coolant. Vaporized by the furnaces. Inhaled by entire shift.

Outcome: strength ×3, compliance ×10, humanity ×0.

The client is pleased. The client is "the Board". I've never met the Board. Nobody has. The Board sends emails at 3:33 AM.

I'm putting in for a transfer to the Lab vessel. At least there the monsters are in cages.`,
  },
  // ---------------- lab ----------------
  lab_log1: {
    title: 'Dr. E. Marlow — Day 1', speaker: 'Dr. Elise Marlow', where: 'Subterranean Lab Vessel',
    text: `Project lead, Evolution Enhancer. They gave me a corner office with a window onto the specimen tanks. I asked for one onto the sea. They said the sea "isn't on brand."

The serum is beautiful. It rewrites cells like poetry. If we can stabilize it, radiation sickness, burns, starvation — all of it — gone.

The Board wants it weaponized by spring. I told them that's not what it's for.

They smiled. I don't like how they smile.`,
  },
  lab_log2: {
    title: 'Dr. E. Marlow — Day 212', speaker: 'Dr. Elise Marlow', where: 'Subterranean Lab Vessel',
    text: `They used my formula on the City Vessel. Eight hundred people. They called it a "launch."

I've been altering the batches. Small things. Instability markers. If the serum degrades, they can't sell it.

Someone noticed. Security has been "reviewing" my access. If I disappear, the antidote notes are in the cold vault — Cryo, Locker 9.

If anyone finds this: it was never supposed to be a weapon. It was supposed to be a cure.`,
  },
  lab_log3: {
    title: 'Subject Zero — Behavioral Notes', speaker: 'Dr. A. Thorne', where: 'Subterranean Lab Vessel',
    text: `Subject 000 continues to exceed projections. Cranial mass +40%. Demonstrates problem-solving, tool use, and what I can only describe as spite.

It has learned to project fear. Staff report hallucinations within six meters of the cell.

It asked me today, through the glass, in perfect English: "When do I get to meet the audience?"

I did not tell it about the Undernet. I'm certain I did not.`,
  },
  // ---------------- aquatic ----------------
  aqua_log1: {
    title: 'Habitat Tour Script', speaker: 'Tour Guide Bot', where: 'Aquatic Habitat Vessel',
    text: `Welcome to the GloomTech Aquatic Habitat, where the ocean comes to you!

To your left: our Coral Reef Restoration Exhibit. Coral has been extinct in the wild since the Cataclysm. Ours is printed!

To your right: our mascot, Finn! Say hi, Finn!

[Long pause.]

Finn is shy today. Please do not tap the glass. Please do not tap the glass. PLEASE DO NOT TAP THE GLASS.`,
  },
  aqua_log2: {
    title: 'Veterinary Log — "Finn"', speaker: 'Dr. Okafor, Marine Vet', where: 'Aquatic Habitat Vessel',
    text: `Finn was a harbor seal. A good boy. Then someone in Marketing decided the mascot should be "more evolved."

Week 1: Finn is larger.
Week 3: Finn has more teeth than any mammal should.
Week 6: Finn has tentacles. Finn is no longer a seal. Finn ate the night shift.
Week 7: Marketing says Finn's merchandise is "flying off the shelves."

I am requesting a transfer. I am requesting a priest.`,
  },
  aqua_log3: {
    title: 'Pump Station Warning', speaker: 'Habitat Automated Systems', where: 'Aquatic Habitat Vessel',
    text: `WARNING: PUMP 3 FLOW REVERSED.
WARNING: HABITAT FLOOD LEVEL 62% AND RISING.
WARNING: ELECTRICAL SYSTEMS EXPOSED TO WATER.

Remote override source: GloomBand #07.

Have a wonderful, aquatic day!`,
  },
  // ---------------- biosphere ----------------
  bio_log1: {
    title: 'Quarterly Yield Report', speaker: 'Agri-Division', where: 'Agricultural Biosphere Vessel',
    text: `Yield is up 900% since the introduction of Cultivar 9 ("Mother Bloom").

Side effects include: crops that move, crops that hum, crops that ate Gary.

We have stopped using the word "harvest." We now say "negotiation."`,
  },
  bio_log2: {
    title: 'Proposal: Cultivar 9', speaker: 'Dr. Ivy Hale', where: 'Agricultural Biosphere Vessel',
    text: `What if the plants fed themselves?

Serum-infused root systems create a closed nutrient loop: the plant releases spores; spores infect a host; host returns to the soil. Enriches the soil. Feeds the plant.

The Board loved it. They asked who the "hosts" would be.

I said compost. They said "sure."

They did not mean compost.`,
  },
  bio_log3: {
    title: "Gardener's Diary", speaker: 'Tomas, Gardener', where: 'Agricultural Biosphere Vessel',
    text: `The little blue mushrooms are back. The workers call them "Gloomies". They glow when you're sad. They glow brighter when you lie.

I told one about my wife. It glowed so bright it hurt my eyes.

Management says Gloomies are a "natural air purifier." Then why do they have cameras in them? Why do they turn to watch you?`,
  },
  // ---------------- cryo ----------------
  cryo_log1: {
    title: 'Cold Storage Inventory', speaker: 'Cryo Systems', where: 'Cryo-Preservation Vessel',
    text: `POD 1–40: Board members (dormant, awaiting "a better world").
POD 41–90: Serum candidates (dormant, awaiting "a worse world").
POD 91: The Captain's wife. DO NOT OPEN.
LOCKER 9: Personal effects — Dr. E. Marlow. Confiscated.

Temperature: -71°C. Integrity: 34%. Something in Pod 63 is knocking.`,
  },
  cryo_log2: {
    title: 'Project MOLE — Candidate #07', speaker: 'GloomTech Behavioral Ops', where: 'Cryo-Preservation Vessel',
    text: `Candidate #07: NOAH. Former psychology prodigy. Thesis: "The Manipulator's Mind." Grief-compromised (see: LILA, deceased).

Method: subliminal carrier wave via GloomBand firmware. Commands delivered below conscious threshold. Subject experiences "blackouts" during execution.

Projected outcome: Subject will sabotage the group while genuinely believing himself innocent. Subject will argue his innocence brilliantly. He studied how.

Ethics review: waived.`,
  },
  cryo_log3: {
    title: 'Letter of Resignation', speaker: 'Head of Security, GloomTech', where: 'Cryo-Preservation Vessel',
    text: `To the Board:

I have seen the City Vessel. I have seen what you put in the coolant, in the soil, in the sea. I have seen you sell it to the Undernet as entertainment.

I resign. Then I am going to take your flotilla, your cameras, and your audience — and I am going to show them what you are.

You will call me a madman. Fine. Call me Captain.`,
  },
  // ---------------- core ----------------
  core_log1: {
    title: 'Polaris Core Specification', speaker: 'GloomTech Engineering', where: 'Polaris Core',
    text: `The Polaris Core is a miniaturized magnetospheric engine, originally designed to repair Earth's magnetic field after the Cataclysm.

Repurposed: power for six vessels; heat dissipation via a vertical beam; and an uplink to GloomTech's last surviving satellite.

Every frame of footage aboard the GhastMarina rides that beam into the sky. Every frame.`,
  },
  core_log2: {
    title: 'Ratings Memo', speaker: 'Undernet Broadcast Ops', where: 'Polaris Core',
    text: `Week 1: 12,000 viewers.
Week 3: 480,000 viewers.
Week 5: 9.1 million viewers.

That's not the Undernet anymore. That's everyone with a screen.

The Board has ordered the broadcast terminated. The Captain has refused. The Board has ordered the flotilla "decommissioned."

I'm not sure what decommissioned means at sea. I'm sure it isn't good.`,
  },
  core_log3: {
    title: 'To Whoever Is Watching', speaker: 'The Captain', where: 'Polaris Core',
    text: `If you are hearing this, the trials worked.

You watched twelve people turn on each other for your entertainment. You tipped. You laughed. You voted in the comments.

Now look at who built the stage. Look at whose logo is on the serum, the soil, the sea. Look at who sold you the end of the world and then sold you a front-row seat.

I am not asking you to forgive me. I am asking you to look.`,
  },
};

export interface EvidenceDef {
  name: string;
  desc: string;
  trial: number;
  self?: boolean; // incriminates Noah
}

export const EVIDENCE: Record<string, EvidenceDef> = {
  // Trial 1
  cut_wire: { name: 'Cut Wire', desc: 'A length of insulated grid cable, cleanly snipped. It was in your jacket pocket after the blackout. You don’t remember cutting anything.', trial: 1, self: true },
  override_log: { name: 'Corrupted Override Log', desc: 'Relay terminal: “MANUAL OVERRIDE — BAND #0█”. The last digit is corrupted.', trial: 1 },
  hana_testimony: { name: 'Hana’s Account', desc: 'Right before the gate dropped, Hana glimpsed a figure in a dark jacket by the relay.', trial: 1 },
  medbay_list: { name: 'Medbay Inventory', desc: 'Missing: 12 antibiotics, 6 stims, 4 GloomCalm packs. The lock wasn’t forced — it was opened with Elise’s keycard, which vanished from her coat for an hour.', trial: 1 },
  jade_testimony: { name: 'Jade’s Account', desc: 'At 3 AM Jade heard leather-soled shoes click past the cargo hold. “Italian. Expensive. Nobody else here wears those.”', trial: 1 },
  leo_alibi: { name: 'Leo’s Alibi', desc: 'Leo insists he never left his quarters that night.', trial: 1 },
  poker_chip: { name: 'Gold Poker Chip', desc: 'Monogrammed “L.C.” Found beside the hidden medical stash in the cargo hold.', trial: 1 },
  gt_keycard: { name: 'GloomTech Exec Keycard', desc: 'Found in the stash. Leo says he won it in a card game. It opens the medbay — and the gangway control room.', trial: 1 },
  // Trial 2
  press_card: { name: 'Press Programming Key', desc: 'A Line 7 maintenance key. It was in your boot after the blackout. Your boot.', trial: 2, self: true },
  isaac_testimony: { name: 'Isaac’s Account', desc: 'The press cycle was reprogrammed remotely — from a GloomBand — seconds before it nearly took Isaac’s arm.', trial: 2 },
  transmitter: { name: 'Hidden Transmitter', desc: 'A shortwave rig tuned to the Captain’s private channel, stashed behind the organ in the hub chapel.', trial: 2 },
  tie_clip: { name: 'Silver Tie Clip', desc: 'Engraved “G.A. — 20 Years of Service, Hostage Response Unit.” Caught in the transmitter’s casing.', trial: 2 },
  grant_notes: { name: 'Negotiation Script', desc: '“Opening: acknowledge his power. Anchor: one life for eleven. Concession: I deliver the mole.” In Grant’s handwriting.', trial: 2 },
  kai_testimony: { name: 'Kai’s Account', desc: 'Kai heard Grant whispering at 2 AM: “...and in exchange you guarantee safe passage. Do we have a deal?”', trial: 2 },
  ambush_report: { name: 'Ambush Pattern', desc: 'Every route the group planned was ambushed within the hour. Someone has been reporting their plans to the Captain.', trial: 2 },
  // Trial 3
  torn_formula: { name: 'Torn Formula', desc: 'Half of Elise’s antidote formula, torn and crumpled — in your pocket. The other half is ash.', trial: 3, self: true },
  lockpick: { name: 'Custom Lockpick', desc: 'A tension wrench with a jade-green grip, snapped off inside the containment door lock.', trial: 3 },
  broken_chain: { name: 'Broken Chain', desc: 'A fine silver chain, snapped. Caught on the specimen vault’s hinge. A pendant clasp, but no pendant.', trial: 3 },
  cell_record: { name: 'Containment Record', desc: 'Cell 0 opened manually at 01:12. No hack. No keycard. Just skill.', trial: 3 },
  heart_core: { name: 'The Gloomheart', desc: 'A prototype energy core cut like a gemstone. Missing from the lab vault. Worth a fortune on the Undernet.', trial: 3 },
  elise_logs: { name: 'Dr. Marlow’s Logs', desc: 'Elise was the serum project lead at GloomTech — and secretly sabotaged it.', trial: 3 },
  // Trial 4
  pump_override: { name: 'Pump Override Log', desc: 'Your band’s own log: “PUMP 3 — REVERSE FLOW — EXECUTED.” You never touched a pump.', trial: 4, self: true },
  bulkhead_log: { name: 'Bulkhead Seal Record', desc: 'Bulkhead C sealed by Band #05 at 14:32 — with Hana still inside.', trial: 4 },
  hana_testimony2: { name: 'Hana’s Account', desc: 'Through the bulkhead, someone said: “Sorry, kid. Protocol.”', trial: 4 },
  protocol_card: { name: 'Flood Protocol Card', desc: '“Seal breached compartments regardless of personnel.” Annotated in a soldier’s block capitals.', trial: 4 },
  dog_tag: { name: 'Dog Tag', desc: 'D. HOLLOWAY — O NEG. Found by the bulkhead controls.', trial: 4 },
  // Trial 5
  kennel_key: { name: 'Kennel Release Key', desc: 'The biosphere kennel was opened from inside. Its key was on your keyring.', trial: 5, self: true },
  spore_vial: { name: 'Spore Vial', desc: 'An emptied vial of Mother Bloom spores. Engraved with a tiny black queen.', trial: 5 },
  vote_notes: { name: 'Fiona’s Projections', desc: 'A notebook of vote probabilities. Names crossed out weeks in advance. Kai and Isaac circled: “weaken before Sunday.”', trial: 5 },
  luna_testimony: { name: 'Luna’s Account', desc: 'Luna saw Fiona in the greenhouse at midnight “tending the flowers — with gloves on.”', trial: 5 },
  water_report: { name: 'Water Supply Report', desc: 'Isaac’s analysis: spores were introduced at the hub’s water intake. Precise dosage. Not an accident.', trial: 5 },
  // Trial 6
  mole_footage: { name: 'Project MOLE Footage', desc: 'Cryo archive recordings of every blackout: you cutting wires, reprogramming presses, tearing the formula, reversing pumps.', trial: 6 },
  subliminal_signal: { name: 'Subliminal Carrier', desc: 'Aria found a hidden carrier wave in Band #07’s firmware: commands delivered below conscious perception.', trial: 6 },
  aria_backdoor: { name: 'Aria’s Backdoor', desc: 'Server logs show Aria breached the Captain’s systems weeks ago. With that access, she could fabricate footage.', trial: 6 },
  captain_dossier: { name: 'The Captain’s Dossier', desc: 'Former GloomTech Head of Security. Whistleblower. Declared dead two years ago.', trial: 6 },
};

export const GLOOMY_QUOTES = [
  'Hello friend! I am definitely not a camera.',
  'You glow when you lie, you know. Just a little.',
  'Breathe in. Breathe out. GloomTech™ filtered that for you!',
  'Twelve little passengers… I counted. I always count.',
  'Spores are just hugs that travel.',
  'The Captain says I am a good boy. I am a mushroom.',
  'Shhh. The walls are listening. I am the walls.',
  'Smile! Somebody out there is tipping.',
  'I liked Lila. Who’s Lila? Forget I said that.',
  'Don’t trust anyone. Except me. Especially me.',
  'You have dirt under your nails. Funny. You washed them.',
  'Glow brighter, little friend. The dark is hungry.',
  'Fun fact: mushrooms are closer to animals than plants. Think about that.',
  'I saw what you did. It’s okay. I won’t tell. Probably.',
  'Every Sunday someone falls. Isn’t that exciting?',
];

export interface NetPost {
  id: string;
  chapter: number;
  kind: 'ad' | 'podcast' | 'banner';
  title: string;
  body: string;
  comments: [string, string, boolean?][]; // user, text, deleted?
  removed?: boolean;
}

export const GLOOMNET: NetPost[] = [
  {
    id: 'ad1', chapter: 1, kind: 'ad', title: 'GLOOMTECH: POWERING TOMORROW',
    body: 'Soft piano. A child laughs in a geothermal greenhouse. “After the Cataclysm, GloomTech brought the warmth back. Every light you see, every breath you filter — that’s us. That’s family.”',
    comments: [['geo_dad_44', 'my heating bill went down 2% this year thank u gloomtech'], ['sunfacts', 'the sun is still up there right?? right??'], ['user_99210', 'they put something in the wat— [comment removed for violating community guidelines]', true]],
  },
  {
    id: 'pod1', chapter: 1, kind: 'podcast', title: 'UNDERNET UNFILTERED — Ep. 212', removed: true,
    body: '“—so the Ghastmarina thing, right? Twelve death-row inmates, a zombie boat, and every single vessel has GloomTech hardware on it. And GloomTech says they’ve never heard of it? Buddy, your logo is on the wristbands. Your logo is on the MUSHROOMS—”',
    comments: [['vex', 'LMAO the mushrooms'], ['gloomtech_official', 'GloomTech Industries is not aware of Ghastmarina. Have a bright day!']],
  },
  {
    id: 'ad2', chapter: 2, kind: 'banner', title: 'EVOLUTION ENHANCER™ — BE MORE',
    body: 'A stick figure drinks a glowing can and bulks into a hero. Click to learn more! [You click. The hero deflates like a balloon and the can rolls away. “Results not typical.”]',
    comments: [['gymbro_eternal', 'ordered 6 cans. still waiting. my arm itches'], ['nurse_k', 'please stop drinking this'], ['user_31337', 'my brother drank it at the city launch and— [comment removed]', true]],
  },
  {
    id: 'pod2', chapter: 3, kind: 'podcast', title: 'UNDERNET UNFILTERED — Ep. 215', removed: true,
    body: '“Contestant seven, the redhead with the glasses — anyone else notice he goes quiet for a few minutes every night and the feed cuts to an ad? Every. Night. I’m just saying, the Captain’s editing is VERY convenient—”',
    comments: [['noahstan', 'leave my boy alone he is just tired'], ['detective_dee', 'feed cut at 02:14 and 03:40 i have timestamps'], ['mod_bot', 'This thread has been locked.']],
  },
  {
    id: 'ad3', chapter: 4, kind: 'ad', title: 'GLOOMCALM™ — FEEL LESS, LIVE MORE',
    body: '“Anxious about the end of the world? Haunted by choices you can’t remember making? Ask your GloomTech physician about GloomCalm™. Side effects may include calm.”',
    comments: [['sleepy_sal', 'i took one and forgot my name its great'], ['dr_who_asks', 'whose name did i forget']],
  },
  {
    id: 'pod3', chapter: 5, kind: 'podcast', title: 'UNDERNET UNFILTERED — Ep. 219', removed: true,
    body: '“Ratings for Ghastmarina just passed the Undernet’s total subscriber count. Do the math. This is leaking to the surface feeds. Regular people are watching. And they are asking who built the boat—”',
    comments: [['surface_sam', 'hi from the surface we can see you'], ['gloomtech_official', 'Surface feeds are not real. Please return to your geothermal habitat.']],
  },
  {
    id: 'ad4', chapter: 6, kind: 'banner', title: 'GEOTHERMAL UTOPIA — NOW HIRING',
    body: '“Join the GloomTech family! Openings in Agriculture, Aquatics, and Behavioral Operations. Benefits include: purpose, warmth, and being remembered.” [Apply] [Apply] [Apply]',
    comments: [['jobseeker_9', 'applied. got a wristband in the mail. it hums'], ['ex_employee', 'behavioral ops is NOT what you thi— [comment removed]', true]],
  },
  {
    id: 'pod4', chapter: 7, kind: 'podcast', title: 'UNDERNET UNFILTERED — FINAL EPISODE?', removed: true,
    body: '“They’re pulling the plug. GloomTech just sent a ‘decommission’ order for the flotilla. If you’re watching Ghastmarina right now, record everything. Everything. Because tomorrow they’ll say it never happened—”',
    comments: [['everyone', 'recording'], ['everyone_else', 'recording'], ['lila_was_here', 'noah if you can see this i forgive you']],
  },
];

export const CHAPTERS: { id: string; num: string; title: string; sub: string }[] = [
  { id: 'prologue', num: 'PROLOGUE', title: 'A World in Shadows', sub: 'Something heavy falls. Then silence.' },
  { id: 'ch1', num: 'CHAPTER I', title: 'Awakening in Chains', sub: 'Twelve strangers. One container. No memory.' },
  { id: 'ch2', num: 'CHAPTER II', title: 'The Forgotten City', sub: 'Skyscrapers like tombstones. Streets that moan.' },
  { id: 'trial1', num: 'DECK TRIAL I', title: 'The House Always Wins', sub: 'A theft. A sabotage. A vote.' },
  { id: 'ch3', num: 'CHAPTER III', title: 'The Grinding Dark', sub: 'The furnaces breathe. The workers never stopped.' },
  { id: 'trial2', num: 'DECK TRIAL II', title: 'Terms of Surrender', sub: 'Someone has been talking to the Captain.' },
  { id: 'ch4', num: 'CHAPTER IV', title: 'Echoes of the Past', sub: 'Every cage was built by someone.' },
  { id: 'trial3', num: 'DECK TRIAL III', title: 'The Gloomheart Heist', sub: 'A vault opened. A monster freed.' },
  { id: 'ch5', num: 'CHAPTER V', title: 'Undertow', sub: 'The water is rising. So is the body count.' },
  { id: 'trial4', num: 'DECK TRIAL IV', title: 'Protocol', sub: 'Orders are orders. Until they aren’t.' },
  { id: 'ch6', num: 'CHAPTER VI', title: 'Overgrowth', sub: 'The garden is hungry.' },
  { id: 'trial5', num: 'DECK TRIAL V', title: 'Checkmate', sub: 'Twelve moves ahead. One move too many.' },
  { id: 'ch7', num: 'CHAPTER VII', title: 'The Frozen Truth', sub: 'In the cold room, nothing stays buried.' },
  { id: 'trial6', num: 'FINAL TRIAL', title: 'The Mole', sub: 'Every blackout. Every lie. Every vote.' },
  { id: 'ch8', num: 'CHAPTER VIII', title: 'Polaris', sub: 'The beam is a beacon. The beacon is a lie.' },
];
