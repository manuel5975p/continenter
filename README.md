# Continenter

Continenter is a turn-based 2D artillery game built with Next.js, React, TypeScript, and Zustand.

You play a single character against 2 bots on destructible terrain. Each turn, you can move, aim, select a weapon, and fire. Last side standing wins.

## Game Overview

- **Mode:** Player vs 2 bots
- **Map:** Procedurally generated destructible terrain
- **Turn timer:** 10 seconds per turn
- **Movement budget:** 130 px per turn
- **Victory:** Eliminate all enemies (or survive after player elimination to lose)

## Features

- Real-time canvas rendering with terrain, projectiles, explosions, and aim previews
- Turn system with alternating player/bot control and per-turn movement limits
- Physics simulation with gravity, friction, knockback, and slope-aware walking
- Destructible terrain from explosive impacts
- Weapon system with unique projectile behavior and ammo tracking per entity
- Adjustable bot simulation speed (1x / 2.5x / 5x)

## Weapons

Each unit starts with a full loadout.

| Weapon | Damage | Blast Radius | Ammo | Notes |
| --- | ---: | ---: | ---: | --- |
| Pistol | 10 | 1 | 6 | Fast, basic ballistic shot |
| Shotgun | 50 total | 5 | 4 | 6-pellet spread, split damage |
| Grenade | 60 | 80 | 3 | Arcing projectile with stronger gravity |
| Bazooka | 80 | 120 | 2 | Heavy explosive impact |
| Flamethrower | 40 total | 60 | 1 | Multi-particle short-lifespan flame burst |
| Sniper Rifle | 50 | 0 | 1 | Very high-speed precision shot with piercing |

## Controls

- **A / Left Arrow:** Move left (during your turn)
- **D / Right Arrow:** Move right (during your turn)
- **Mouse Move:** Aim
- **Mouse Click:** Fire
- **Mouse Wheel:** Increase/decrease shot power
- **W / S:** Cycle weapon
- **HUD Weapon Menu:** Directly select any weapon

## UI

- **Map Canvas:** Terrain, units, projectile rendering, turn overlay, game-over overlay
- **HUD:** Turn info, timer, walk distance, player/enemy health, weapon stats, power, angle, speed selector
- **Action Bar:** Current weapon/ammo + restart button on game over

## Local Development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Type check:

```bash
pnpm -s tsc --noEmit
```

## Build

```bash
pnpm build
```

The project is configured for static export (`next export` output in `out/`) and GitHub Pages hosting.

## GitHub Pages Deployment

A workflow is included at `.github/workflows/deploy-gh-pages.yml`.

### What it does

On push to `main` (or manual trigger), GitHub Actions:

1. Installs dependencies with pnpm
2. Builds the static site
3. Publishes `out/` to the `gh-pages` branch

### Repository settings required

1. In GitHub repo settings, enable **Actions** permissions to write contents (or keep default `GITHUB_TOKEN` write permissions enabled).
2. In **Pages** settings, set source to **Deploy from a branch** and select `gh-pages` / root.

## Project Structure

- `src/features/game/model` — game types and weapon definitions/behaviors
- `src/features/game/engine` — core simulation (turns, movement, combat, terrain damage, bots)
- `src/features/game/store` — Zustand state management and game loop integration
- `src/features/game/ui` — `MapCanvas`, `Hud`, and `ActionBar`
