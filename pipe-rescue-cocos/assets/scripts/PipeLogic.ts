/**
 * PipeLogic — pure, engine-agnostic puzzle logic for Pipe Rescue.
 *
 * No Cocos imports here on purpose: this is plain data + functions so the
 * rules are easy to read, test, and reuse. The Cocos component
 * (GameController.ts) renders nodes from this state; the standalone HTML5
 * build (../../../build-html5/game.js) uses the identical model.
 *
 * Sides are 0=Up, 1=Right, 2=Down, 3=Left. A tile's open sides are its
 * base openings plus its clockwise rotation (mod 4). Two neighbours
 * connect when both have an opening on the shared edge.
 */

export type PipeType = 'empty' | 'start' | 'goal' | 'straight' | 'elbow';

export interface Cell {
    type: PipeType;
    rot: number;    // 0..3, clockwise quarter-turns
    fixed: boolean; // start / goal / empty cannot be rotated
}

export const COLS = 4;
export const ROWS = 4;
export const MOVE_LIMIT = 12;

export const START_RC: [number, number] = [0, 0];
export const GOAL_RC: [number, number] = [3, 2];

/** Open sides for each type in its base (rot 0) orientation. */
const BASE_OPEN: Record<PipeType, number[]> = {
    start: [2],        // water flows down out of the source
    goal: [0],         // water arrives from above
    straight: [0, 2],  // vertical
    elbow: [1, 2],     // right + down ("L")
    empty: [],
};

/** side index -> [dRow, dCol, oppositeSide] */
const DIRS: [number, number, number][] = [
    [-1, 0, 2], // up
    [0, 1, 3],  // right
    [1, 0, 0],  // down
    [0, -1, 1], // left
];

export function makeCell(type: PipeType, rot = 0, fixed = false): Cell {
    return { type, rot, fixed };
}

/**
 * The single fixed, hand-authored puzzle. A full 4x4 grid (every cell is a
 * pipe tile) matching the assessment wireframe. Verified: it does NOT connect
 * at start and the optimal solution is 7 taps, well within the 12-move limit.
 * Solution path: start(0,0) -> (1,0) -> (2,0) -> (2,1) -> (2,2) -> goal(3,2).
 * Tiles off the path are decoys the player can also rotate.
 */
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

/**
 * Flood fill of every cell reachable from `rc` through connected pipes.
 * Returns a Set of "row*COLS+col" keys. Used for win detection and for
 * the live "water filled" highlight.
 */
export function reachableFrom(grid: Cell[][], rc: [number, number]): Set<number> {
    const key = (r: number, c: number) => r * COLS + c;
    const seen = new Set<number>([key(rc[0], rc[1])]);
    const stack: [number, number][] = [rc];
    while (stack.length) {
        const [r, c] = stack.pop()!;
        for (let s = 0; s < 4; s++) {
            const nr = r + DIRS[s][0];
            const nc = c + DIRS[s][1];
            const opp = DIRS[s][2];
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
