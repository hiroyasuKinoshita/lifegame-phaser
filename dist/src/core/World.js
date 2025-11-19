"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.World = void 0;
const constants_1 = require("../constants");
class World {
    constructor() {
        this.chunks = new Map();
        this.evolvedCells = new Set();
        this.barrierCells = new Map();
        this.generationCount = 0;
        this.reset();
    }
    reset() {
        this.chunks.clear();
        this.evolvedCells.clear();
        this.barrierCells.clear();
        this.generationCount = 0;
        // Initialize center chunks
        const startChunkRange = 2;
        for (let cy = -startChunkRange; cy <= startChunkRange; cy++) {
            for (let cx = -startChunkRange; cx <= startChunkRange; cx++) {
                const chunk = this.getChunk(cx, cy, true);
                if (chunk) {
                    for (let y = 0; y < constants_1.CHUNK_SIZE; y++) {
                        for (let x = 0; x < constants_1.CHUNK_SIZE; x++) {
                            chunk[y][x] = Math.round(Math.random());
                        }
                    }
                }
            }
        }
    }
    getChunkKey(cx, cy) {
        return `${cx},${cy}`;
    }
    getChunk(cx, cy, createIfMissing = false) {
        const key = this.getChunkKey(cx, cy);
        let chunk = this.chunks.get(key);
        if (!chunk && createIfMissing) {
            chunk = new Array(constants_1.CHUNK_SIZE).fill(0).map(() => new Array(constants_1.CHUNK_SIZE).fill(0));
            this.chunks.set(key, chunk);
        }
        return chunk;
    }
    getCell(x, y) {
        const cx = Math.floor(x / constants_1.CHUNK_SIZE);
        const cy = Math.floor(y / constants_1.CHUNK_SIZE);
        const lx = ((x % constants_1.CHUNK_SIZE) + constants_1.CHUNK_SIZE) % constants_1.CHUNK_SIZE;
        const ly = ((y % constants_1.CHUNK_SIZE) + constants_1.CHUNK_SIZE) % constants_1.CHUNK_SIZE;
        const chunk = this.chunks.get(this.getChunkKey(cx, cy));
        return chunk ? chunk[ly][lx] : 0;
    }
    setCell(x, y, val) {
        const cx = Math.floor(x / constants_1.CHUNK_SIZE);
        const cy = Math.floor(y / constants_1.CHUNK_SIZE);
        const lx = ((x % constants_1.CHUNK_SIZE) + constants_1.CHUNK_SIZE) % constants_1.CHUNK_SIZE;
        const ly = ((y % constants_1.CHUNK_SIZE) + constants_1.CHUNK_SIZE) % constants_1.CHUNK_SIZE;
        const chunk = this.getChunk(cx, cy, true);
        if (chunk) {
            chunk[ly][lx] = val;
        }
    }
    update() {
        const nextChunks = new Map();
        const chunksToProcess = new Set();
        // Identify chunks that need processing
        for (const [key, chunk] of this.chunks) {
            let hasLife = false;
            for (let r = 0; r < constants_1.CHUNK_SIZE; r++) {
                for (let c = 0; c < constants_1.CHUNK_SIZE; c++) {
                    if (chunk[r][c] > 0) {
                        hasLife = true;
                        break;
                    }
                }
                if (hasLife)
                    break;
            }
            if (hasLife) {
                const [cx, cy] = key.split(',').map(Number);
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        chunksToProcess.add(this.getChunkKey(cx + dx, cy + dy));
                    }
                }
            }
        }
        // Process chunks
        for (const key of chunksToProcess) {
            const [cx, cy] = key.split(',').map(Number);
            const chunk = new Array(constants_1.CHUNK_SIZE).fill(0).map(() => new Array(constants_1.CHUNK_SIZE).fill(0));
            let chunkHasLife = false;
            for (let y = 0; y < constants_1.CHUNK_SIZE; y++) {
                for (let x = 0; x < constants_1.CHUNK_SIZE; x++) {
                    const globalX = cx * constants_1.CHUNK_SIZE + x;
                    const globalY = cy * constants_1.CHUNK_SIZE + y;
                    const neighbors = this.countNeighbors(globalX, globalY);
                    const currentAge = this.getCell(globalX, globalY);
                    let nextAge = 0;
                    if (currentAge > 0) {
                        if (neighbors < 2 || neighbors > 3) {
                            nextAge = 0;
                        }
                        else {
                            nextAge = Math.min(currentAge + 1, constants_1.MAX_AGE);
                        }
                    }
                    else {
                        if (neighbors === 3) {
                            nextAge = 1;
                        }
                    }
                    if (nextAge > 0) {
                        chunk[y][x] = nextAge;
                        chunkHasLife = true;
                    }
                }
            }
            if (chunkHasLife) {
                nextChunks.set(key, chunk);
            }
        }
        // Apply barrier protection
        this.barrierCells.forEach((turns, key) => {
            const [r, c] = key.split(',').map(Number);
            const cx = Math.floor(c / constants_1.CHUNK_SIZE);
            const cy = Math.floor(r / constants_1.CHUNK_SIZE);
            const lx = ((c % constants_1.CHUNK_SIZE) + constants_1.CHUNK_SIZE) % constants_1.CHUNK_SIZE;
            const ly = ((r % constants_1.CHUNK_SIZE) + constants_1.CHUNK_SIZE) % constants_1.CHUNK_SIZE;
            const chunkKey = this.getChunkKey(cx, cy);
            let chunk = nextChunks.get(chunkKey);
            if (!chunk) {
                chunk = new Array(constants_1.CHUNK_SIZE).fill(0).map(() => new Array(constants_1.CHUNK_SIZE).fill(0));
                nextChunks.set(chunkKey, chunk);
            }
            chunk[ly][lx] = Math.max(chunk[ly][lx], 1);
            turns--;
            if (turns <= 0) {
                this.barrierCells.delete(key);
            }
            else {
                this.barrierCells.set(key, turns);
            }
        });
        this.chunks = nextChunks;
        this.generationCount++;
    }
    countNeighbors(x, y) {
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0)
                    continue;
                if (this.getCell(x + dx, y + dy) > 0) {
                    count++;
                }
            }
        }
        return count;
    }
}
exports.World = World;
