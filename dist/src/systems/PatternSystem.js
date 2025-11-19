"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatternSystem = exports.GLIDER_GUN = exports.SPACESHIP_LWSS = exports.PATTERNS = void 0;
const constants_1 = require("../constants");
exports.PATTERNS = {
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
exports.SPACESHIP_LWSS = [
    [0, 1], [0, 3],
    [1, 0],
    [2, 0], [2, 3],
    [3, 0], [3, 1], [3, 2]
];
exports.GLIDER_GUN = [
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
class PatternSystem {
    constructor(world) {
        this.world = world;
    }
    checkPattern(startRow, startCol, patternShape) {
        for (const [dr, dc] of patternShape) {
            const r = startRow + dr;
            const c = startCol + dc;
            if (this.world.getCell(c * constants_1.GRID_SIZE, r * constants_1.GRID_SIZE) === 0) {
                return false;
            }
        }
        return true;
    }
    findPatterns(camera) {
        const detectedPatternCells = new Map();
        const startCol = Math.floor(camera.scrollX / constants_1.GRID_SIZE);
        const endCol = Math.ceil((camera.scrollX + camera.width) / constants_1.GRID_SIZE);
        const startRow = Math.floor(camera.scrollY / constants_1.GRID_SIZE);
        const endRow = Math.ceil((camera.scrollY + camera.height) / constants_1.GRID_SIZE);
        for (let r = startRow; r < endRow; r++) {
            for (let c = startCol; c < endCol; c++) {
                if (this.world.getCell(c * constants_1.GRID_SIZE, r * constants_1.GRID_SIZE) > 0) {
                    for (const patternName in exports.PATTERNS) {
                        const pattern = exports.PATTERNS[patternName];
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
    placePattern(pattern, startRow, startCol) {
        for (const [dr, dc] of pattern) {
            const r = startRow + dr;
            const c = startCol + dc;
            this.world.setCell(c * constants_1.GRID_SIZE, r * constants_1.GRID_SIZE, 1);
        }
    }
}
exports.PatternSystem = PatternSystem;
