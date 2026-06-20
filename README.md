# Pipe Rescue — Playable Ad

A small portrait (9:16) HTML5 playable ad built for the Bombay Play AI Intern
assessment. The player taps tiles on a 4×4 grid to rotate them 90° and connect
the **Water Source / Start** to the **Goal / End** before running out of moves,
then reaches a **Call to Action** end card. Layout follows the assessment
wireframe (full grid, instruction pill, solved-path preview on the win card).

---

## What's in this folder

```
Game/
├── PipeRescue.html              ← ★ DOUBLE-CLICK THIS to play (self-contained)
├── build-html5/                 ← split web build (serve over localhost)
│   ├── index.html
│   └── game.js
├── pipe-rescue-cocos/           ← Cocos Creator 3.8 project source
│   ├── assets/
│   │   ├── scenes/Main.scene
│   │   └── scripts/
│   │       ├── PipeLogic.ts     ← pure, engine-agnostic puzzle rules
│   │       ├── PipeTile.ts      ← one tile: draws pipe + handles taps
│   │       └── GameController.ts← builds the scene + runs the game loop
│   ├── settings/                ← project + build settings (portrait 9:16)
│   ├── package.json
│   └── tsconfig.json
├── BUILD_GUIDE.md
└── README.md
```

---

## How to run

### Option A — Just double-click `PipeRescue.html`  ✅ easiest

`PipeRescue.html` is a single self-contained file (HTML + CSS + JavaScript all
inlined). **Double-click it and it opens and plays in any browser** — no local
server, no build step, no setup. For the portrait 9:16 phone look, narrow the
window or use the browser dev-tools device toolbar.

### Option B — Serve the split build on localhost

The `build-html5/` folder also contains the standard split web build
(`index.html` + `game.js`). Because browsers block one local file from loading
another over `file://`, serve it over a tiny local HTTP server:

```bash
cd build-html5
python -m http.server 8000
# then open http://localhost:8000 in a browser
```

Or with Node: `npx serve build-html5` (or `npx http-server build-html5`).

> Both versions are plain Canvas + JavaScript — **no engine runtime required** —
> and share identical game logic with the Cocos TypeScript components.

### Option B — Open / re-export the Cocos Creator project

1. Install **Cocos Creator 3.8.x** (3.8.0 or newer).
2. In Cocos Dashboard → **Add project** → select the `pipe-rescue-cocos`
   folder → **Open**. The editor regenerates `library/`, `temp/`, and the `cc`
   type declarations on first import (this is why editing the `.ts` files
   outside the editor shows `Cannot find module 'cc'` — that resolves on open).
3. In the **Assets** panel open `assets/scenes/Main.scene`. Press **Play** (▶)
   to run in the editor preview.
4. To export the web build: **Project → Build** → choose platform
   **Web Mobile** → **Build**. The output appears under
   `pipe-rescue-cocos/build/web-mobile/`; serve that folder the same way as
   Option A.

Design resolution is preset to **720 × 1280 (portrait, fit-width)**.

---

## How to play

1. The board is a full **4×4 grid** of pipe tiles. **Tap any blue pipe tile**
   to rotate it 90° clockwise.
2. The green **START** marker (top-left) is the water source; the gold **GOAL**
   marker is the destination. Those two tiles are fixed and don't rotate; every
   other tile rotates (tiles off the route are decoys).
3. As soon as a connected path of pipes links START to GOAL, the filled pipes
   light up **green**. You can also press **Check Path** to confirm.
4. You have **12 moves**. Solve it and you get the **"You fixed it! / Puzzle
   complete"** end card with a **Solved Path Preview** and a **Play Now**
   call-to-action. Run out of moves and you get a **Try Again**.

The fixed puzzle's optimal solution is **7 taps**, comfortably inside the
12-move budget.

---

## How it works (design notes)

**Pipe model.** Sides are indexed `0=Up, 1=Right, 2=Down, 3=Left`. Each pipe
type declares the sides it opens on in its base orientation; rotating clockwise
by `rot` quarter-turns adds `rot` to every open side (mod 4). Two neighbouring
tiles are **connected** when both have an opening on the shared edge.

| Type     | Base openings | Notes                         |
|----------|---------------|-------------------------------|
| start    | Down          | water source (fixed)          |
| goal     | Up            | destination (fixed)           |
| straight | Up + Down     | rotates between vertical/horiz |
| elbow    | Right + Down  | an "L" corner                 |

**Solved-state detection.** A flood fill (`reachableFrom`) walks from the
source through connected pipes; the puzzle is solved when the goal cell is in
the reachable set. The same flood fill drives the live green "water filled"
highlight, so progress is visible before you press Check Path.

**Architecture.** All rules live in one small pure module
(`PipeLogic.ts` / the top of `PipeRescue.html`'s inlined script) with no
rendering or engine code, so
the logic is easy to read, test, and reuse. `PipeTile` handles drawing one
tile and its tap; `GameController` builds the whole scene from code (background,
grid, header, buttons, end card) and runs the state machine
(`play → win / lose`). Building the UI in code keeps the `.scene` file tiny and
the layout responsive.

---



**Cocos Creator version:** 3.8.8 (project targets 3.8.8; tested on 3.8.5–3.8.8)  •  **Target:** Web / HTML5, portrait 9:16
