import { GRID_SIZE } from '../constants';
import { World } from '../core/World';

export const PATTERNS: { [key: string]: { shape: number[][]; color: number } } = {
    block: {
        shape: [[0, 0], [0, 1], [1, 0], [1, 1]],
        color: 0xFF0000 // Red
    },
    blinker_h: {
        shape: [[0, 0], [0, 1], [0, 2]],
        color: 0x0000FF // Blue
    },
    blinker_v: {
        shape: [[0, 0], [1, 0], [2, 0]],
        color: 0x0000FF // Blue
    }
};

export const SPACESHIP_LWSS = [
    [0, 1], [0, 3],
    [1, 0],
    [2, 0], [2, 3],
    [3, 0], [3, 1], [3, 2]
];

export const GLIDER_GUN = [
    [5, 1], [5, 2], [6, 1], [6, 2],
    [5, 11], [6, 11], [7, 11],
    [4, 12], [8, 12],
    [3, 13], [9, 13],
    [3, 14], [9, 14],
    [6, 15],
    [4, 16], [8, 16],
    [5, 17], [6, 17], [7, 17],
    [6, 18],
    [3, 21], [4, 21], [5, 21],
    [3, 22], [4, 22], [5, 22],
    [2, 23], [6, 23],
    [1, 25], [2, 25], [6, 25], [7, 25],
    [3, 35], [4, 35], [3, 36], [4, 36]
];

export class PatternSystem {
    private world: World;

    constructor(world: World) {
        this.world = world;
    }

    public checkPattern(startRow: number, startCol: number, patternShape: number[][]): boolean {
        for (const [dr, dc] of patternShape) {
            const r = startRow + dr;
            const c = startCol + dc;
            if (this.world.getCell(c * GRID_SIZE, r * GRID_SIZE) === 0) {
                return false;
            }
        }
        return true;
    }

    public findPatterns(bounds: { startCol: number, endCol: number, startRow: number, endRow: number }): Map<string, number> {
        const detectedPatternCells = new Map<string, number>();

        const { startCol, endCol, startRow, endRow } = bounds;

        for (let r = startRow; r < endRow; r++) {
            for (let c = startCol; c < endCol; c++) {
                if (this.world.getCell(c * GRID_SIZE, r * GRID_SIZE) > 0) {
                    for (const patternName in PATTERNS) {
                        const pattern = PATTERNS[patternName];
                        if (this.checkPattern(r, c, pattern.shape)) {
                            for (const [dr, dc] of pattern.shape) {
                                detectedPatternCells.set(`${r + dr},${c + dc}`, pattern.color);
                            }
                        }
                    }
                }
            }
        }
        return detectedPatternCells;
    }

    public placePattern(pattern: number[][], startRow: number, startCol: number) {
        for (const [dr, dc] of pattern) {
            const r = startRow + dr;
            const c = startCol + dc;
            this.world.setCell(c * GRID_SIZE, r * GRID_SIZE, 1);
        }
    }
}
