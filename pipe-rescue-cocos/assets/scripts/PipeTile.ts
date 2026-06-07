import { _decorator, Component, Node, Graphics, Color, UITransform, Label, tween, Vec3 } from 'cc';
import { Cell, openSides } from './PipeLogic';

const { ccclass } = _decorator;

const COL_TILE = new Color(47, 111, 179);
const COL_TILE_EDGE = new Color(27, 74, 125);
const COL_PIPE_DRY = new Color(188, 214, 240);
const COL_PIPE_WET = new Color(57, 217, 138);
const COL_START = new Color(57, 217, 138);
const COL_GOAL = new Color(255, 200, 61);

/**
 * Renders one pipe tile with Graphics and forwards taps to a callback.
 * The tile is redrawn whenever rotation or "filled" state changes.
 */
@ccclass('PipeTile')
export class PipeTile extends Component {
    public row = 0;
    public col = 0;
    public size = 100;
    public cell!: Cell;
    private gfx!: Graphics;
    private onTap?: (r: number, c: number) => void;

    init(row: number, col: number, size: number, cell: Cell, onTap: (r: number, c: number) => void) {
        this.row = row;
        this.col = col;
        this.size = size;
        this.cell = cell;
        this.onTap = onTap;

        const ui = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        ui.setContentSize(size, size);

        this.gfx = this.node.getComponent(Graphics) || this.node.addComponent(Graphics);
        this.node.on(Node.EventType.TOUCH_END, this.handleTap, this);

        // Label marker for start/goal
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
        // quick rotate feedback
        tween(this.node)
            .by(0.08, { eulerAngles: new Vec3(0, 0, -90) })
            .call(() => { this.node.setRotationFromEuler(0, 0, 0); this.redraw(false); })
            .start();
        this.onTap && this.onTap(this.row, this.col);
    }

    /** Draw the tile body + pipe arms. `filled` tints the pipe green. */
    redraw(filled: boolean) {
        const g = this.gfx;
        g.clear();
        if (this.cell.type === 'empty') return;

        const h = this.size / 2;
        const pad = 6;
        // tile body
        g.fillColor = COL_TILE;
        g.roundRect(-h + pad, -h + pad, this.size - pad * 2, this.size - pad * 2, 12);
        g.fill();
        g.lineWidth = 3;
        g.strokeColor = COL_TILE_EDGE;
        g.stroke();

        // arms
        const pipeColor = filled ? COL_PIPE_WET : COL_PIPE_DRY;
        const reach = h - pad;
        const lw = this.size * 0.28;
        g.lineWidth = lw;
        g.strokeColor = pipeColor;
        for (const side of openSides(this.cell)) {
            g.moveTo(0, 0);
            if (side === 0) g.lineTo(0, reach);        // up  (+y)
            else if (side === 1) g.lineTo(reach, 0);   // right
            else if (side === 2) g.lineTo(0, -reach);  // down (-y)
            else g.lineTo(-reach, 0);                  // left
            g.stroke();
        }
        // hub
        g.fillColor = pipeColor;
        g.circle(0, 0, lw * 0.5);
        g.fill();

        // start/goal disc
        if (this.cell.type === 'start' || this.cell.type === 'goal') {
            g.fillColor = this.cell.type === 'start' ? COL_START : COL_GOAL;
            g.circle(0, 0, lw * 0.95);
            g.fill();
        }
    }
}
