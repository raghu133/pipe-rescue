import {
    _decorator, Component, Node, Label, Graphics, Color, UITransform, Vec3,
    Button, Layers,
} from 'cc';
import {
    Cell, COLS, ROWS, MOVE_LIMIT, START_RC,
    buildPuzzle, reachableFrom, isSolved,
} from './PipeLogic';
import { PipeTile } from './PipeTile';

const { ccclass, property } = _decorator;

type GameState = 'play' | 'win' | 'lose';

/**
 * GameController builds the entire Pipe Rescue scene from code and runs the
 * game loop. Attach this to a single root Node under the Canvas; everything
 * else (background, grid, buttons, end card) is created in onLoad. Building
 * in code keeps the .scene file tiny and the layout responsive.
 *
 * Design resolution is 720x1280 (portrait 9:16). The Canvas fit settings in
 * the scene keep it centered and scaled on any device.
 */
@ccclass('GameController')
export class GameController extends Component {

    @property
    moveLimit = MOVE_LIMIT;

    private grid: Cell[][] = [];
    private movesLeft = MOVE_LIMIT;
    private state: GameState = 'play';

    private W = 720;
    private H = 1280;
    private cellSize = 0;
    private gridOrigin = new Vec3();

    private tiles: PipeTile[][] = [];
    private movesLabel!: Label;
    private statusLabel!: Label;

    private gameRoot!: Node;   // gameplay UI
    private endRoot!: Node;    // end card UI
    private endTitle!: Label;
    private endSub!: Label;

    onLoad() {
        const ui = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        ui.setContentSize(this.W, this.H);

        this.buildBackground();
        this.gameRoot = this.makeChild('GameRoot', this.node);
        this.endRoot = this.makeChild('EndRoot', this.node);

        this.buildHeader();
        this.buildGrid();
        this.buildCheckButton();
        this.buildEndCard();

        this.resetGame();
    }

    // ---- helpers --------------------------------------------------------
    private makeChild(name: string, parent: Node): Node {
        const n = new Node(name);
        n.layer = Layers.Enum.UI_2D;
        n.setParent(parent);
        n.addComponent(UITransform);
        return n;
    }

    private addLabel(parent: Node, text: string, size: number, color: Color, x: number, y: number): Label {
        const n = this.makeChild('label', parent);
        n.setPosition(x, y);
        const l = n.addComponent(Label);
        l.string = text;
        l.fontSize = size;
        l.lineHeight = size + 4;
        l.color = color;
        l.horizontalAlign = Label.HorizontalAlign.CENTER;
        l.verticalAlign = Label.VerticalAlign.CENTER;
        return l;
    }

    /** Build a rounded rectangle button with a label. Returns the node. */
    private addButton(parent: Node, label: string, w: number, h: number, x: number, y: number,
                      fill: Color, onClick: () => void): Node {
        const n = this.makeChild('button', parent);
        n.setPosition(x, y);
        const ui = n.getComponent(UITransform)!;
        ui.setContentSize(w, h);
        const g = n.addComponent(Graphics);
        g.fillColor = fill;
        g.roundRect(-w / 2, -h / 2, w, h, 18);
        g.fill();
        this.addLabel(n, label, Math.floor(h * 0.34), Color.WHITE, 0, 0);
        const btn = n.addComponent(Button);
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.95;
        n.on(Node.EventType.TOUCH_END, onClick, this);
        return n;
    }

    // ---- scene construction --------------------------------------------
    private buildBackground() {
        const n = this.makeChild('bg', this.node);
        n.setSiblingIndex(0);
        const ui = n.getComponent(UITransform)!;
        ui.setContentSize(this.W, this.H);
        const g = n.addComponent(Graphics);
        g.fillColor = new Color(15, 45, 85);
        g.rect(-this.W / 2, -this.H / 2, this.W, this.H);
        g.fill();
    }

    private buildHeader() {
        const topY = this.H / 2;
        this.addLabel(this.gameRoot, 'Pipe Rescue', 56, Color.WHITE, 0, topY - 90);
        this.addLabel(this.gameRoot, 'Tap pipe tiles to connect the path.',
            28, new Color(255, 233, 168), 0, topY - 150);

        // moves chip
        const chip = this.makeChild('chip', this.gameRoot);
        chip.setPosition(0, topY - 215);
        chip.getComponent(UITransform)!.setContentSize(300, 70);
        const g = chip.addComponent(Graphics);
        g.fillColor = new Color(29, 78, 137);
        g.roundRect(-150, -35, 300, 70, 16);
        g.fill();
        this.movesLabel = this.addLabel(chip, '', 34, Color.WHITE, 0, 0);
    }

    private buildGrid() {
        const margin = 60;
        this.cellSize = (this.W - margin * 2) / COLS;
        const gridW = this.cellSize * COLS;
        // top of grid placed below the header
        const gridTopY = this.H / 2 - 320;
        // origin = center of cell (0,0)
        const originX = -gridW / 2 + this.cellSize / 2;
        const originY = gridTopY - this.cellSize / 2;
        this.gridOrigin.set(originX, originY, 0);

        const gridNode = this.makeChild('grid', this.gameRoot);
        this.grid = buildPuzzle();
        this.tiles = [];
        for (let r = 0; r < ROWS; r++) {
            this.tiles[r] = [];
            for (let c = 0; c < COLS; c++) {
                const tileNode = this.makeChild('tile_' + r + '_' + c, gridNode);
                tileNode.setPosition(this.tilePos(r, c));
                const tile = tileNode.addComponent(PipeTile);
                tile.init(r, c, this.cellSize, this.grid[r][c], this.onTileTap.bind(this));
                this.tiles[r][c] = tile;
            }
        }
    }

    private tilePos(r: number, c: number): Vec3 {
        // row increases downward, so subtract from y
        return new Vec3(
            this.gridOrigin.x + c * this.cellSize,
            this.gridOrigin.y - r * this.cellSize,
            0
        );
    }

    private buildCheckButton() {
        const y = this.gridOrigin.y - (ROWS - 1) * this.cellSize - this.cellSize / 2 - 80;
        this.addButton(this.gameRoot, 'Check Path', this.W - 120, 100, 0, y,
            new Color(43, 182, 115), () => this.tryCheckPath());
        this.statusLabel = this.addLabel(this.gameRoot, '', 28,
            new Color(184, 210, 238), 0, y - 75);
    }

    private buildEndCard() {
        const topY = this.H / 2;
        this.endTitle = this.addLabel(this.endRoot, '', 64, new Color(57, 217, 138), 0, topY - 200);
        this.endSub = this.addLabel(this.endRoot, '', 32, new Color(184, 210, 238), 0, topY - 270);
        this.addLabel(this.endRoot, 'Mock Call to Action', 24,
            new Color(184, 210, 238), 0, -290);

        this.addButton(this.endRoot, 'Play Now', 460, 120, 0, -200,
            new Color(52, 120, 246), () => this.onCTA());
        this.addButton(this.endRoot, 'Try Again', 460, 95, 0, -370,
            new Color(43, 182, 115), () => this.resetGame());
        this.endRoot.active = false;
    }

    // ---- game loop ------------------------------------------------------
    private resetGame() {
        this.grid = buildPuzzle();
        this.movesLeft = this.moveLimit;
        this.state = 'play';
        // rebuild tile cells (new objects after buildPuzzle)
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                this.tiles[r][c].cell = this.grid[r][c];
                this.tiles[r][c].node.setRotationFromEuler(0, 0, 0);
            }
        }
        this.gameRoot.active = true;
        this.endRoot.active = false;
        this.refresh();
    }

    private onTileTap(r: number, c: number) {
        if (this.state !== 'play') return;
        const cell = this.grid[r][c];
        if (cell.type === 'empty' || cell.fixed) return;

        cell.rot = (cell.rot + 1) & 3;
        this.movesLeft--;

        if (isSolved(this.grid)) { this.win(); return; }
        if (this.movesLeft <= 0) { this.lose(); return; }
        this.refresh();
    }

    private tryCheckPath() {
        if (this.state !== 'play') return;
        if (isSolved(this.grid)) this.win();
        else this.refresh();
    }

    private win() { this.state = 'win'; this.showEnd(true); }
    private lose() { this.state = 'lose'; this.showEnd(false); }

    private onCTA() {
        // Mock Call to Action — no store link / ad SDK per the brief.
        console.log('[Pipe Rescue] Play Now clicked — (mock CTA)');
    }

    /** Redraw moves, status, and the water-fill highlight on every tile. */
    private refresh() {
        this.movesLabel.string = 'Moves Left: ' + this.movesLeft;
        const filled = reachableFrom(this.grid, START_RC);
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                this.tiles[r][c].redraw(filled.has(r * COLS + c));
            }
        }
        const connected = isSolved(this.grid);
        this.statusLabel.string = connected ? 'Connected — press Check Path!' : 'Status: not connected yet';
        this.statusLabel.color = connected ? new Color(57, 217, 138) : new Color(184, 210, 238);
    }

    private showEnd(win: boolean) {
        this.refresh();
        this.gameRoot.active = false;
        this.endRoot.active = true;
        this.endTitle.string = win ? 'You fixed it!' : 'Out of moves!';
        this.endTitle.color = win ? new Color(57, 217, 138) : new Color(255, 200, 61);
        this.endSub.string = win ? 'Puzzle complete' : 'Give it another try';
        this.endSub.color = win ? new Color(57, 217, 138) : new Color(184, 210, 238);
    }
}
