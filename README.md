# GhastMarina: Voyage of the Betrayed

A third-person survival-horror mystery for the browser, built with Three.js and TypeScript.

Twelve death-row inmates wake up in a shipping container aboard the GhastMarina, a flotilla of six derelict vessels chained around a beam of light on a frozen sea. A voice that calls itself the Captain gives them one rule: one of you is my mole. Every Sunday the survivors meet in the Ballroom for a Deck Trial and vote someone into the dark.

You play Noah, Participant #07. You're clever and guarded, and you keep losing time.

## Features

- **A full story campaign.** The prologue and eight chapters cover the Polaris hub and six themed vessels: the Forgotten City, the Industrial Complex, the Subterranean Lab, the Aquatic Habitat, the Agricultural Biosphere and Cryo-Preservation. The finale takes place at the Polaris Core.
- **Six Deck Trials** in the style of a class trial:
  - Nonstop Debates where you shoot weak points with evidence ("Truth Bullets")
  - Evidence presentation and rebuttal showdowns
  - Closing-argument reconstructions
  - Votes, with consequences
- **Two endings**, decided by the choices you make between your mask and your conscience.
- **Combat and stealth:**
  - a lead pipe, fire axe, pistol, shotgun and arc thrower
  - silent takedowns, flares, a flashlight that reveals phantoms
  - headshots, staggers and dodge-rolls
- **Twenty mutant types** that patrol, hunt, burrow, disguise themselves and swarm. **Seven multi-phase bosses**: Gridlock, the Foreman, Subject Zero, the Leviathan, Mother Bloom, the Warden and the Apex.
- **Hazards on every vessel:** hydraulic presses, steam vents, conveyors, laser curtains, electrified water, spore pods and frozen floors.
- **Your GloomBand:** inventory, evidence, a voyage log, a map, private messages and skills. It also hosts the GloomOS breach hacking minigame.
- **Sanity:** blackouts, whispers, hallucinated mutants and Gloomy the mushroom.
- **The Undernet audience:** a live viewer count and tips that pay for upgrades at the GloomMart and workbench.
- **Everything is generated in code.** Characters, animation, levels, textures, sound effects, voices and the adaptive music score need no external assets.
- **A custom render pipeline:** HDR, bloom, ink outlines, colour grading, film grain and sanity-driven distortion.

## Controls

| Action | Keyboard / Mouse |
| --- | --- |
| Move / Sprint / Sneak | `W A S D` / `Shift` / `Ctrl` or `C` |
| Look / Aim / Attack | Mouse / Right mouse / Left mouse |
| Interact, talk, takedown | `E` |
| Dodge roll | `Space` |
| Reload | `R` |
| Weapons (melee, pistol, shotgun, arc) / quick swap | `1`–`4` / `Q` |
| Flashlight | `F` |
| Throw flare | `G` |
| Heal | `H` |
| GloomBand / Map | `Tab` or `I` / `M` |
| Pause | `Esc` or `P` |

Gamepads with the standard layout are supported too.

In a Nonstop Debate, press `1`–`9` or use the mouse wheel to pick a Truth Bullet. Then click a yellow weak point to refute it, or a green one to agree.

## Running it

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # static build in dist/
npm run build:single   # one self-contained HTML file in dist-single/
npm run typecheck
```

Pushing to `main` builds the game and deploys it to GitHub Pages through `.github/workflows/deploy.yml`. To turn that on, open the repository settings, go to **Pages**, and set the source to **GitHub Actions**.

Use a recent desktop browser with WebGL 2. The game saves to `localStorage` automatically and at Gloomy Shrines. After you've reached a chapter, you can replay it from Chapter Select on the title screen.

### Debug and test hooks

If you open the game with `?debug`, it exposes `window.__GM.dbg`. That object has helpers to teleport, set flags, kill enemies and use interactables. Add `&chapter=<id>` to jump straight into a chapter (for example `ch3` or `trial2`). Add `&auto=0.2` to auto-advance dialogue and auto-solve trials. `scripts/drive.mjs` runs scripted headless play-throughs with Playwright.

## Project layout

```
src/
  core/      input, procedural audio, adaptive music, settings, math
  gfx/       renderer and post-processing, procedural textures, materials, particles, sky/sea/beam
  chars/     procedural character builder, animator, cast definitions
  world/     level system, themes, props, level builder and the ASCII maps for every vessel
  entities/  player, enemies, bosses, NPCs, doors, hazards, projectiles, interactables
  game/      game loop, world, camera rig, FX, items, save state
  story/     director, chapter scripts, dialogue, lore and evidence, Deck Trial engine
  ui/        HUD, dialogue, GloomBand, hacking, trial UI, menus
```

The original design documents (`Idea.txt`, `Characters.md`, `Story.md`, `chapters.md`, `Transcript.md`) are kept at the repository root.
