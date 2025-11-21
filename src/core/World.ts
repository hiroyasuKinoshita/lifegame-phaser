import { CHUNK_SIZE, MAX_AGE } from '../constants';
import { Chunk } from '../types';

export class World {
    public chunks: Map<string, Chunk> = new Map();
    public evolvedCells: Set<string> = new Set();
    public barrierCells: Map<string, number> = new Map();
    public generationCount = 0;

    constructor() {
        this.reset();
    }

    public reset() {
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
                    for (let y = 0; y < CHUNK_SIZE; y++) {
                        for (let x = 0; x < CHUNK_SIZE; x++) {
                            chunk[y][x] = Math.round(Math.random());
                        }
                    }
                }
            }
        }
    }

    public getChunkKey(cx: number, cy: number): string {
        return `${cx},${cy}`;
    }

    public getChunk(cx: number, cy: number, createIfMissing = false): Chunk | undefined {
        const key = this.getChunkKey(cx, cy);
        let chunk = this.chunks.get(key);
        if (!chunk && createIfMissing) {
            chunk = new Array(CHUNK_SIZE).fill(0).map(() => new Array(CHUNK_SIZE).fill(0));
            this.chunks.set(key, chunk);
        }
        return chunk;
    }

    public getCell(x: number, y: number): number {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cy = Math.floor(y / CHUNK_SIZE);
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const ly = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

        const chunk = this.chunks.get(this.getChunkKey(cx, cy));
        return chunk ? chunk[ly][lx] : 0;
    }

    public setCell(x: number, y: number, val: number) {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cy = Math.floor(y / CHUNK_SIZE);
        const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const ly = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

        const chunk = this.getChunk(cx, cy, true);
        if (chunk) {
            chunk[ly][lx] = val;
        }
    }

    public update() {
        const nextChunks: Map<string, Chunk> = new Map();
        const chunksToProcess = new Set<string>();

        // Identify chunks that need processing
        for (const [key, chunk] of this.chunks) {
            let hasLife = false;
            for (let r = 0; r < CHUNK_SIZE; r++) {
                for (let c = 0; c < CHUNK_SIZE; c++) {
                    if (chunk[r][c] > 0) {
                        hasLife = true;
                        break;
                    }
                }
                if (hasLife) break;
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

            // Pre-fetch 3x3 neighbor chunks
            const neighborChunks: (Chunk | undefined)[][] = [
                [undefined, undefined, undefined],
                [undefined, undefined, undefined],
                [undefined, undefined, undefined]
            ];

            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    neighborChunks[dy + 1][dx + 1] = this.chunks.get(this.getChunkKey(cx + dx, cy + dy));
                }
            }

            const chunk = new Array(CHUNK_SIZE).fill(0).map(() => new Array(CHUNK_SIZE).fill(0));
            let chunkHasLife = false;

            for (let y = 0; y < CHUNK_SIZE; y++) {
                for (let x = 0; x < CHUNK_SIZE; x++) {
                    // Optimized neighbor counting
                    let neighbors = 0;

                    // Check 8 neighbors
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;

                            const nx = x + dx;
                            const ny = y + dy;

                            let targetChunk: Chunk | undefined;
                            let targetX = nx;
                            let targetY = ny;

                            // Determine which chunk to look at
                            let chunkDx = 0;
                            let chunkDy = 0;

                            if (nx < 0) {
                                chunkDx = -1;
                                targetX = CHUNK_SIZE - 1;
                            } else if (nx >= CHUNK_SIZE) {
                                chunkDx = 1;
                                targetX = 0;
                            }

                            if (ny < 0) {
                                chunkDy = -1;
                                targetY = CHUNK_SIZE - 1;
                            } else if (ny >= CHUNK_SIZE) {
                                chunkDy = 1;
                                targetY = 0;
                            }

                            targetChunk = neighborChunks[chunkDy + 1][chunkDx + 1];

                            if (targetChunk && targetChunk[targetY][targetX] > 0) {
                                neighbors++;
                            }
                        }
                    }

                    // Get current cell age (center chunk is at [1][1])
                    const currentChunk = neighborChunks[1][1];
                    const currentAge = currentChunk ? currentChunk[y][x] : 0;

                    let nextAge = 0;
                    if (currentAge > 0) {
                        if (neighbors < 2 || neighbors > 3) {
                            nextAge = 0;
                        } else {
                            nextAge = Math.min(currentAge + 1, MAX_AGE);
                        }
                    } else {
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
            const cx = Math.floor(c / CHUNK_SIZE);
            const cy = Math.floor(r / CHUNK_SIZE);
            const lx = ((c % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            const ly = ((r % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            const chunkKey = this.getChunkKey(cx, cy);

            let chunk = nextChunks.get(chunkKey);
            if (!chunk) {
                chunk = new Array(CHUNK_SIZE).fill(0).map(() => new Array(CHUNK_SIZE).fill(0));
                nextChunks.set(chunkKey, chunk);
            }
            chunk[ly][lx] = Math.max(chunk[ly][lx], 1);

            turns--;
            if (turns <= 0) {
                this.barrierCells.delete(key);
            } else {
                this.barrierCells.set(key, turns);
            }
        });

        this.chunks = nextChunks;
        this.generationCount++;
    }


}
