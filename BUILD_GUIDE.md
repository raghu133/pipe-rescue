# Pipe Rescue — Manual Build Guide (Cocos Creator 3.8.8)

This guide walks you through building **Pipe Rescue** by hand in Cocos Creator
**3.8.8**, step by step: creating the project, the node tree, the scripts, and
the Web/HTML5 export. Follow it top to bottom and you'll end with the same
playable ad that's in `pipe-rescue-cocos/`.

There are **two paths**:

- **Path A — Code-driven (recommended, ~15 min).** One root node + three
  scripts; the scripts build the grid, UI, and end card at runtime. This is how
  the included project works. Fewer manual steps, less to wire up by hand.
- **Path B — Fully manual node tree.** You place every tile, label and button
  in the editor yourself. More clicking, but useful if you want to *see* the
  whole hierarchy and tweak it visually.

Start with **Path A**. Path B is at the end if you want the hand-placed version.

---

## 0. Prerequisites

- Cocos Creator **3.8.8** installed (you have this).
- Basic familiarity with the editor panels: **Hierarchy** (node tree, left),
  **Assets** (files, bottom-left), **Inspector** (properties, right),
  **Scene/Game** view (center), **Console** (bottom).

---

## 1. Create the project

1. Open **Cocos Dashboard → Projects → New** (or **New Project**).
2. Choose the **Empty (2D)** template (or Empty — 2D is fine; this game is 2D UI).
3. Name it `pipe-rescue` and pick a folder. Click **Create & Open**.
4. Wait for the editor to finish importing (first load builds the engine cache).

> The editor auto-creates `assets/`, `settings/`, `package.json`, etc. You'll
> add scripts and a scene into `assets/`.

---

## 2. Set the project to portrait 9:16

1. Menu **Project → Project Settings → Project Data** (or **Layout/Design** tab,
   depending on version).
2. Find **Design Resolution**. Set:
   - **Width:** `720`
   - **Height:** `1280`
   - **Fit Width:** ✅ on  •  **Fit Height:** ☐ off
3. (Optional) **Project → Project Settings → Feature Cropping** — leave defaults.
4. Save settings.

> 720×1280 is portrait 9:16. "Fit Width" keeps the board edge-to-edge on any
> phone while letting the top/bottom breathe.

---

## 3. Create folders and the scene

1. In **Assets**, right-click the `assets` folder → **Create → Folder**. Make
   two folders: `scenes` and `scripts`.
2. Right-click `assets/scenes` → **Create → Scene**. Name it `Main`.
3. Double-click `Main.scene` to open it.

A new scene already contains a **Canvas** node with a **Camera** child. Good —
we build everything under the Canvas.

---

## 4. Add the three scripts

In **Assets → scripts**, right-click → **Create → TypeScript → NewComponent**
three times, naming them exactly:

- `PipeLogic`
- `PipeTile`
- `GameController`

Then open each and paste the code below (replace the generated stub entirely).

> The code is identical to `pipe-rescue-cocos/assets/scripts/*.ts`. You can also
> just copy those files in — but pasting here keeps this guide self-contained.

### 4.1 `PipeLogic.ts` — pure puzzle rules (no engine code)

```ts
/**
 * PipeLogic — pure, engine-agnostic puzzle logic for Pipe Rescue.
 * Sides: 0=Up, 1=Right, 2=Down, 3=Left. A tile's open sides are its base
 * openings plus its clockwise rotation (mod 4). Two neighbours connect when
 * both have an opening on the shared edge.
 */
export type PipeType = 'empty' | 'start' | 'goal' | 'straight' | 'elbow';

export interface Cell { type: PipeType; rot: number; fixed: boolean; }

export const COLS = 4;
export const ROWS = 4;
export const MOVE_LIMIT = 12;
export const START_RC: [number, number] = [0, 0];
export const GOAL_RC: [number, number] = [3, 2];

const BASE_OPEN: Record<PipeType, number[]> = {
    start: [2], goal: [0], straight: [0, 2], elbow: [1, 2], empty: [],
};
const DIRS: [number, number, number][] = [
    [-1, 0, 2], [0, 1, 3], [1, 0, 0], [0, -1, 1],
];

export function makeCell(type: PipeType, rot = 0, fixed = false): Cell {
    return { type, rot, fixed };
}

/** Full 4x4 fixed puzzle. Starts disconnected; optimal solution is 7 taps. */
export function buildPuzzle(): Cell[][] {
    return [
        [makeCell('start', 0, true), makeCell('elbow', 0), makeCell('straight', 1), makeCell('elbow', 0)],
        [makeCell('straight', 1), makeCell('elbow', 2), makeCell('straight', 1), makeCell('straight', 0)],
        [makeCell('elbow', 0), makeCell('straight', 0), makeCell('elbow', 3), makeCell('elbow', 2)],
        [makeCell('straight', 1), makeCell('elbow', 1), makeCell('goal', 0, true), makeCell('straight', 0)],
    ];
}

export function openSides(cell: Cell): number[] {
    return BASE_OPEN[cell.type].map(s => (s + cell.rot) & 3);
}
export function hasOpening(cell: Cell | undefined, side: number): boolean {
    if (!cell || cell.type === 'empty') return false;
    return openSides(cell).indexOf(side) !== -1;
}

/** Flood fill from rc through connected pipes -> Set of row*COLS+col keys. */
export function reachableFrom(grid: Cell[][], rc: [number, number]): Set<number> {
    const key = (r: number, c: number) => r * COLS + c;
    const seen = new Set<number>([key(rc[0], rc[1])]);
    const stack: [number, number][] = [rc];
    while (stack.length) {
        const [r, c] = stack.pop()!;
        for (let s = 0; s < 4; s++) {
            const nr = r + DIRS[s][0], nc = c + DIRS[s][1], opp = DIRS[s][2];
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
            if (grid[nr][nc].type === 'empty') continue;
            if (hasOpening(grid[r][c], s) && hasOpening(grid[nr][nc], opp) && !seen.has(key(nr, nc))) {
                seen.add(key(nr, nc));
                stack.push([nr, nc]);
            }
        }
    }
    return seen;
}
export function isSolved(grid: Cell[][]): boolean {
    return reachableFrom(grid, START_RC).has(GOAL_RC[0] * COLS + GOAL_RC[1]);
}
```

### 4.2 `PipeTile.ts` — one tile (draws pipe + handles tap)

```ts
import { _decorator, Component, Node, Graphics, Color, UITransform, Label, tween, Vec3 } from 'cc';
import { Cell, openSides } from './PipeLogic';
const { ccclass } = _decorator;

const COL_TILE = new Color(47, 111, 179);
const COL_TILE_EDGE = new Color(27, 74, 125);
const COL_PIPE_DRY = new Color(188, 214, 240);
const COL_PIPE_WET = new Color(57, 217, 138);
const COL_START = new Color(57, 217, 138);
const COL_GOAL = new Color(255, 200, 61);

@ccclass('PipeTile')
export class PipeTile extends Component {
    public row = 0; public col = 0; public size = 100;
    public cell!: Cell;
    private gfx!: Graphics;
    private onTap?: (r: number, c: number) => void;

    init(row: number, col: number, size: number, cell: Cell, onTap: (r: number, c: number) => void) {
        this.row = row; this.col = col; this.size = size; this.cell = cell; this.onTap = onTap;
        const ui = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        ui.setContentSize(size, size);
        this.gfx = this.node.getComponent(Graphics) || this.node.addComponent(Graphics);
        this.node.on(Node.EventType.TOUCH_END, this.handleTap, this);

        if (cell.type === 'start' || cell.type === 'goal') {
            const labelNode = new Node('marker');
            labelNode.setParent(this.node);
            const label = labelNode.addComponent(Label);
            label.string = cell.type === 'start' ? 'START' : 'GOAL';
            label.fontSize = Math.floor(size * 0.16);
            label.color = new Color(11, 31, 58);
        }
        this.redraw(false);
    }

    private handleTap() {
        if (this.cell.type === 'empty' || this.cell.fixed) return;
        tween(this.node)
            .by(0.08, { eulerAngles: new Vec3(0, 0, -90) })
            .call(() => { this.node.setRotationFromEuler(0, 0, 0); this.redraw(false); })
            .start();
        this.onTap && this.onTap(this.row, this.col);
    }

    redraw(filled: boolean) {
        const g = this.gfx; g.clear();
        if (this.cell.type === 'empty') return;
        const h = this.size / 2, pad = 6;
        g.fillColor = COL_TILE;
        g.roundRect(-h + pad, -h + pad, this.size - pad * 2, this.size - pad * 2, 12);
        g.fill();
        g.lineWidth = 3; g.strokeColor = COL_TILE_EDGE; g.stroke();

        const pipeColor = filled ? COL_PIPE_WET : COL_PIPE_DRY;
        const reach = h - pad, lw = this.size * 0.28;
        g.lineWidth = lw; g.strokeColor = pipeColor;
        for (const side of openSides(this.cell)) {
            g.moveTo(0, 0);
            if (side === 0) g.lineTo(0, reach);
            else if (side === 1) g.lineTo(reach, 0);
            else if (side === 2) g.lineTo(0, -reach);
            else g.lineTo(-reach, 0);
            g.stroke();
        }
        g.fillColor = pipeColor; g.circle(0, 0, lw * 0.5); g.fill();

        if (this.cell.type === 'start' || this.cell.type === 'goal') {
            g.fillColor = this.cell.type === 'start' ? COL_START : COL_GOAL;
            g.circle(0, 0, lw * 0.95); g.fill();
        }
    }
}
```

### 4.3 `GameController.ts` — builds the scene + runs the loop

> This file is long. Copy it verbatim from
> `pipe-rescue-cocos/assets/scripts/GameController.ts`. It:
> - builds the background, header, moves chip, instruction text,
> - lays out the 4×4 grid of `PipeTile`s,
> - adds the **Check Path** button and status line,
> - builds the **end card** (You fixed it! / Play Now / Try Again),
> - runs the `play → win / lose` state machine and the live water-fill highlight.

Key reference points (so you know what it expects):

| Thing | Where |
|-------|-------|
| Design size | `720 × 1280`, set in code via `UITransform` |
| Grid | 4×4, built from `buildPuzzle()` in `PipeLogic` |
| Move limit | `@property moveLimit = 12` (editable in Inspector) |
| Win check | `isSolved(grid)` after each tap, plus Check Path button |

---

## 5. Wire the one node (Path A)

1. In the **Hierarchy**, right-click the **Canvas** node → **Create → Empty
   Node**. Rename it `Game`.
2. Select `Game`. In the **Inspector**, set its **UITransform** Content Size to
   `720 × 1280` (or leave it — the script sets it on load).
3. In the Inspector click **Add Component → Custom Script → GameController**.
4. (Optional) On the `GameController` component, set **Move Limit** = `12`.

That's the entire node tree for Path A:

```
Canvas
├── Camera
└── Game           ← GameController.ts attached (builds everything else at runtime)
```

5. Press **▶ Play** (top toolbar). The game opens in a browser preview. You
   should see the title, moves chip, instruction pill, the 4×4 grid, the Check
   Path button, and the status line. Tap tiles to rotate and solve it.

> If you see nothing: open the **Console**. The usual cause is a typo in a
> script name (the class name in `@ccclass('GameController')` must match) or the
> component not added to the `Game` node.

---

## 6. How to actually solve the puzzle (for your own testing)

Tiles are addressed as (row, col), row 0 = top.

| Tap this tile | How many 90° taps | Becomes |
|---------------|-------------------|---------|
| (1, 0)        | 1                 | vertical |
| (2, 0)        | 3                 | elbow up+right |
| (2, 1)        | 1                 | horizontal |
| (2, 2)        | 2                 | elbow left+down |

That traces **START → down → down → right → right → down → GOAL** (7 taps, under
the 12-move limit). Or just tap tiles and watch the **green** water-fill grow
from START toward GOAL.

---

## 7. Export the Web / HTML5 build

1. Menu **Project → Build** (opens the Build panel).
2. **Platform:** choose **Web Mobile**.
3. Settings to confirm:
   - **Main Bundle / Start Scene:** `Main`
   - **Design Resolution:** `720 × 1280`, Fit Width on
   - **Orientation:** Portrait
4. Click **Build**. Wait for "Build success" in the console.
5. Output folder: `build/web-mobile/`. Click the **Play/Preview** button in the
   Build panel to run it, or serve the folder:

```bash
cd build/web-mobile
python -m http.server 8000
# open http://localhost:8000
```

Done — that's the complete playable ad.

---

## Path B — Fully manual node tree (optional)

If you'd rather place every element by hand instead of generating it from code,
build this hierarchy under the Canvas. You'd then write a thinner controller
that only reads/updates these existing nodes (instead of creating them).

```
Canvas  (720×1280, portrait)
├── Camera
├── Background            (Sprite, full-screen dark blue)  → cc.Sprite or Graphics rect
├── Header
│   ├── Title             (Label "Pipe Rescue")
│   ├── MovesChip         (Sprite/Graphics rounded rect)
│   │   └── MovesLabel    (Label "Moves Left: 12")
│   ├── InstructionPill   (Sprite, rounded)
│   │   └── InstrLabel    (Label "💡 Tap pipe tiles to connect the path.")
│   └── SourceGoalLabel   (Label "Water Source / Start → Goal / End")
├── Grid                  (empty node, anchored center; holds 16 tiles)
│   ├── Tile_0_0 … Tile_3_3   (16 nodes, each: UITransform 130×130 + Graphics + PipeTile)
│   │     • START marker on Tile_0_0, GOAL marker on Tile_3_2
├── CheckButton           (Button + Label "Check Path")
├── StatusLabel           (Label "Status: Not connected yet")
└── EndCard               (initially inactive)
    ├── EndTitle          (Label "You fixed it!")
    ├── EndSub            (Label "Puzzle complete")
    ├── PreviewLabel      (Label "Solved Path Preview")
    ├── PreviewPanel      (Sprite/Graphics rounded rect)
    │   └── Mini tiles    (optional smaller copy of the solved grid)
    ├── PlayNowButton     (Button + Label "Play Now")  → logs a mock CTA
    └── TryAgainButton    (Button + Label "Try Again")
```

### Placing the 4×4 grid by hand

1. Create an empty node `Grid` under Canvas. Position it centered, a bit below
   the header (e.g. local Y around `+40`).
2. Cell size = `(720 − 2×70) / 4 = 145`. For a tidy fit use **130** with small
   gaps. For tile (r, c):
   - `x = (c − 1.5) × cellSize`
   - `y = (1.5 − r) × cellSize`  (row 0 at the top, so higher Y)
3. For each of the 16 tiles:
   - Create an empty node `Tile_r_c` under `Grid`.
   - **Add Component → UITransform**, set Content Size to `130 × 130`.
   - **Add Component → Graphics** (the pipe is vector-drawn).
   - **Add Component → PipeTile** (your script).
4. Set the **START** marker on `Tile_0_0` and **GOAL** on `Tile_3_2` (the
   `PipeTile.init` already adds these labels when the cell type is start/goal,
   so if you keep using `init`, this is automatic).

### Buttons

For each button (Check Path, Play Now, Try Again):
1. Create a node, add **UITransform** (e.g. `580 × 110`).
2. Add a **Sprite** (or **Graphics** rounded rect) for the background fill.
3. Add a child **Label** for the text.
4. Add a **Button** component. In its **Click Events**, add one entry, drag your
   controller node in, and pick the handler method
   (`onCheckPath` / `onPlayNow` / `onTryAgain`).

> **Reality check:** Path B is a lot of manual placement (16 tiles + ~12 UI
> nodes + wiring every button event). The included project deliberately uses
> **Path A** so it's robust and the scene file stays tiny. Use Path B only if a
> visually-authored hierarchy is specifically required.

---

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| `Cannot find module 'cc'` in VS Code | Normal when editing outside the editor. Opening the project in Cocos generates the `cc` types; the errors clear. |
| Blank screen on Play | Check the **Console**; usually the script class name doesn't match `@ccclass('…')`, or `GameController` isn't added to the `Game` node. |
| "Missing editor" in Dashboard | Project's `package.json → creator.version` must match an installed editor (here `3.8.8`). |
| Tiles don't rotate | The tile is `fixed` (START/GOAL) — those don't rotate by design. |
| Pipes look offset | In Cocos UI, +Y is up. `side 0 (Up) → +y`, `side 2 (Down) → −y`; the provided code already handles this. |

---

**Editor:** Cocos Creator 3.8.8  •  **Target:** Web Mobile (HTML5), portrait 9:16
