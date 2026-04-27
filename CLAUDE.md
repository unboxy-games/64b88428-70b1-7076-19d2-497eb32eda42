# Snake

**Genre:** Classic arcade  
**Core mechanic:** Control a growing snake — eat red food dots to grow longer and score points. Die by hitting a wall or yourself.

## Features implemented
- 36×20 grid, cell size 32px, centered on canvas
- Snake movement with arrow keys / WASD
- Direction queue (up to 2 queued inputs for responsive control)
- Food spawns at random empty cell with a Back.easeOut pop-in animation + scale pulse idle
- Particle burst on food pickup, floating score popup text
- Score: 10 pts base + 5 × speed level per food
- Speed levels 0–5: 150ms → 65ms per step; speed up every 5 foods eaten
- High score persisted to `unboxy.saves` (key: `highScore`)
- Camera red flash + snake alpha flash on death

## Visual style
- Dark forest-green gradient background with checkerboard grid cells
- Glowing green border around play area (3 layered strokes)
- Snake head: bright lime #2ecc71 rounded rect with direction-aware eyes (dark socket + white pupil)
- Snake body: colour gradient from #27ae60 (neck) → #0e5c25 (tail), shrinking padding and radius toward tail
- Food: red glow ring + main circle + highlight + shine + green stem; scale pulses 1→1.12 when idle
- Score popup: gold text floats upward on eat; particle burst (red/orange dots)
- Death: red camera flash, snake alpha flash

## Game states
- `title` — SNAKE title with pulsing scale, blinking "PRESS ANY KEY" prompt
- `playing` — main game loop driven by delta accumulator
- `dead` — GAME OVER overlay fades in, shows score + best, blinking restart prompt; 800ms lock before any-key restarts

## Key files
- `src/scenes/GameScene.ts` — all game logic, snake, food, overlays, saves
- `src/scenes/UIScene.ts` — persistent HUD: score (left), best (right), speed-level dot indicator + label (centre top)
- `src/main.ts` — exports `unboxyReady` (Unboxy.init promise) for use in GameScene

## Changes this session
- Built entire game from scratch (new project)
