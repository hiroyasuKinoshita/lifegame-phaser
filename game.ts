// Phaser is loaded globally from CDN
const config: any = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    scale: { mode: (Phaser as any).Scale?.RESIZE ?? 0 },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);
window.addEventListener('resize', () => {
    (game as any).scale?.resize(window.innerWidth, window.innerHeight);
});

const GRID_SIZE = 10;
const WORLD_WIDTH = 3200; // 仮想世界の幅 (例: 800 * 4)
const WORLD_HEIGHT = 2400; // 仮想世界の高さ (例: 600 * 4)

const ROWS = WORLD_HEIGHT / GRID_SIZE;
const COLS = WORLD_WIDTH / GRID_SIZE;
const MAX_AGE = 10; // セルの最大年齢（色変化の基準）

let grid: number[][];
let graphics: any;
let gameStarted = false;
let gameUpdateEvent: any; // To store the time event for stopping/resetting
let cardDealEvent: any;
let generationCount = 0;
let gameStartTime = 0;
let infoContainer: HTMLElement | null;
const MAX_CARDS = 8;

enum CardType {
    Disaster = 'Disaster',
    Evolution = 'Evolution',
    Split = 'Split',
    Barrier = 'Barrier'
}

interface Card { type: CardType; }

let playerCards: Card[] = [];
let evolvedCells = new Set<string>();
let barrierCells = new Map<string, number>();
let cardsContainer: HTMLElement | null;
let popupContainer: HTMLElement | null;

const CARD_DESCRIPTIONS: Record<CardType, string> = {
    [CardType.Disaster]: 'ランダムなセルを消滅させます。',
    [CardType.Evolution]: 'いくつかのセルが進化し移動できるようになります。',
    [CardType.Split]: 'セルを中心に周囲へ増殖させます。',
    [CardType.Barrier]: '一時的に周囲を守るバリアを張ります。'
};

function preload(this: any) { }

function create(this: any) {
    graphics = this.add.graphics();

    // カメラのワールド境界を設定
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    let isDragging = false;
    let lastPointerPosition = new Phaser.Math.Vector2();

    this.input.on('pointerdown', (pointer: any) => {
        isDragging = true;
        lastPointerPosition.copy(pointer.position);
    });

    this.input.on('pointerup', () => {
        isDragging = false;
    });

    this.input.on('pointermove', (pointer: any) => {
        if (isDragging) {
            const dx = pointer.position.x - lastPointerPosition.x;
            const dy = pointer.position.y - lastPointerPosition.y;

            this.cameras.main.scrollX -= dx;
            this.cameras.main.scrollY -= dy;

            lastPointerPosition.copy(pointer.position);
        }
    });

    const startButton = document.getElementById('startButton');
    const resetButton = document.getElementById('resetButton');
    cardsContainer = document.getElementById('cardsContainer');
    if (cardsContainer) {
        cardsContainer.innerHTML = '';
    }
    infoContainer = document.getElementById('infoContainer');
    if (infoContainer) {
        infoContainer.textContent = '';
    }
    popupContainer = document.getElementById('popup');
    if (popupContainer) {
        popupContainer.style.display = 'none';
    }

    if (startButton) {
        startButton.addEventListener('click', () => {
            startButton.style.display = 'none'; // Hide the button
            if (resetButton) {
                resetButton.style.display = 'block'; // Show reset button
            }
            startGame.call(this); // Call startGame in the context of the scene
        });
    }

    if (resetButton) {
        resetButton.addEventListener('click', () => {
            resetGame.call(this); // Call resetGame in the context of the scene
        });
        resetButton.style.display = 'none'; // Hide reset button initially
    }


    // Mouse wheel zoom
    this.input.on('wheel', (pointer: any, gameObjects: any[], deltaX: number, deltaY: number, deltaZ: number) => {
        const camera = this.cameras.main;
        let newZoom = camera.zoom;

        if (deltaY < 0) { // Scroll up, zoom in
            newZoom += 0.1;
        } else if (deltaY > 0) { // Scroll down, zoom out
            newZoom -= 0.1;
        }

        // Clamp zoom to a reasonable range
        newZoom = Phaser.Math.Clamp(newZoom, 0.1, 2.0); // Min zoom 0.1, Max zoom 2.0
        camera.setZoom(newZoom);
    });
}

function startGame(this: any) {
    // Initialize the grid with random values (0 for dead, 1 for newly born)
    grid = new Array(ROWS);
    for (let i = 0; i < ROWS; i++) {
        grid[i] = new Array(COLS);
        for (let j = 0; j < COLS; j++) {
            grid[i][j] = Math.round(Math.random());
        }
    }

    evolvedCells.clear();
    barrierCells.clear();
    playerCards = generateCards(3);
    displayCards();
    generationCount = 0;
    gameStartTime = Date.now();
    if (infoContainer) {
        infoContainer.textContent = 'Time: 0s Gen: 0';
    }
    if (cardDealEvent) {
        cardDealEvent.remove();
    }
    cardDealEvent = this.time.addEvent({
        delay: 10000,
        callback: () => {
            addRandomCard();
        },
        callbackScope: this,
        loop: true
    });

    // Update the grid every 100ms
    gameUpdateEvent = this.time.addEvent({
        delay: 100,
        callback: updateGrid,
        callbackScope: this,
        loop: true
    });

    gameStarted = true;
}

function resetGame(this: any) {
    if (gameUpdateEvent) {
        gameUpdateEvent.remove(); // Stop the game update loop
    }
    if (cardDealEvent) {
        cardDealEvent.remove();
    }
    gameStarted = false;
    grid = []; // Clear the grid
    graphics.clear(); // Clear drawing

    const startButton = document.getElementById('startButton');
    const resetButton = document.getElementById('resetButton');

    if (startButton) {
        startButton.style.display = 'block'; // Show start button
    }
    if (resetButton) {
        resetButton.style.display = 'none'; // Hide reset button
    }

    playerCards = [];
    evolvedCells.clear();
    barrierCells.clear();
    if (cardsContainer) {
        cardsContainer.innerHTML = '';
    }
    if (infoContainer) {
        infoContainer.textContent = '';
    }


    // Reset camera position
    this.cameras.main.scrollX = 0;
    this.cameras.main.scrollY = 0;
}

function update(this: any) {
    if (!gameStarted) {
        return;
    }

    graphics.clear();

    const camera = this.cameras.main;
    const startCol = Math.floor(camera.scrollX / GRID_SIZE);
    const endCol = Math.ceil((camera.scrollX + camera.width) / GRID_SIZE);
    const startRow = Math.floor(camera.scrollY / GRID_SIZE);
    const endRow = Math.ceil((camera.scrollY + camera.height) / GRID_SIZE);

    const detectedPatternCells = findPatterns(grid);

    // Draw the grid
    for (let i = startRow; i < endRow; i++) {
        for (let j = startCol; j < endCol; j++) {
            // Ensure indices are within grid bounds
            if (i >= 0 && i < ROWS && j >= 0 && j < COLS) {
                const cellAge = grid[i][j];
                if (cellAge > 0) { // Cell is alive
                    let color;
                    const cellKey = `${i},${j}`;

                    if (barrierCells.has(cellKey)) {
                        color = 0xffff00; // yellow for barrier
                    } else if (evolvedCells.has(cellKey)) {
                        color = 0x00ffff; // cyan for evolved
                    } else if (detectedPatternCells.has(cellKey)) {
                        color = detectedPatternCells.get(cellKey);
                    } else {
                        const greenComponent = Math.max(0, 255 - (cellAge * (255 / MAX_AGE)));
                        color = (0x00 << 16) | (Math.floor(greenComponent) << 8) | 0x00;
                    }
                    graphics.fillStyle(color as number);
                    graphics.fillRect(j * GRID_SIZE, i * GRID_SIZE, GRID_SIZE, GRID_SIZE);
                }
            }
        }
    }
}

function updateGrid() {
    // Update the grid based on the rules of Life Game
    const nextGrid = new Array(ROWS);
    for (let i = 0; i < ROWS; i++) {
        nextGrid[i] = new Array(COLS);
        for (let j = 0; j < COLS; j++) {
            const neighbors = countNeighbors(grid, i, j);
            const cell = grid[i][j]; // Current age of the cell

            if (cell > 0) { // If cell is alive
                if (neighbors < 2 || neighbors > 3) {
                    nextGrid[i][j] = 0; // Dies
                } else {
                    nextGrid[i][j] = Math.min(cell + 1, MAX_AGE); // Survives, age increases (capped at MAX_AGE)
                }
            } else { // If cell is dead
                if (neighbors === 3) {
                    nextGrid[i][j] = 1; // Born
                } else {
                    nextGrid[i][j] = 0; // Remains dead
                }
            }
        }
    }
    // Apply barrier protection and countdown
    barrierCells.forEach((turns, key) => {
        const [r, c] = key.split(',').map(Number);
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
            nextGrid[r][c] = Math.max(nextGrid[r][c], 1);
        }
        turns--;
        if (turns <= 0) {
            barrierCells.delete(key);
        } else {
            barrierCells.set(key, turns);
        }
    });

    // Handle evolved cell movement
    const newEvolved = new Set<string>();
    const moves: { from: { r: number, c: number }, to: { r: number, c: number }, age: number }[] = [];
    const occupiedTargets = new Set<string>();

    evolvedCells.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        if (Number.isNaN(r) || Number.isNaN(c) || r < 0 || r >= ROWS || c < 0 || c >= COLS) {
            return; // Skip invalid keys
        }
        if (nextGrid[r][c] <= 0) {
            return; // Cell died, no longer evolved
        }

        const dirs = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1], [0, 1],
            [1, -1], [1, 0], [1, 1]
        ];
        Phaser.Utils.Array.Shuffle(dirs);

        let moved = false;
        for (const [dr, dc] of dirs) {
            const nr = r + dr;
            const nc = c + dc;
            const targetKey = `${nr},${nc}`;

            // Check if the target spot is valid, empty in the nextGrid, and not already claimed by another moving cell
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && nextGrid[nr][nc] === 0 && !occupiedTargets.has(targetKey)) {
                moves.push({ from: { r, c }, to: { r: nr, c: nc }, age: nextGrid[r][c] });
                occupiedTargets.add(targetKey); // Mark target as occupied for this turn
                moved = true;
                break; // Cell has found its move for this turn
            }
        }

        if (!moved) {
            // If the cell couldn't move, it stays in its current position
            newEvolved.add(key);
        }
    });

    // Now, execute all the planned moves
    moves.forEach(move => {
        nextGrid[move.to.r][move.to.c] = move.age;
        nextGrid[move.from.r][move.from.c] = 0;
        newEvolved.add(`${move.to.r},${move.to.c}`); // Add the new position to the evolved set for the next generation
    });

    evolvedCells = newEvolved;

    grid = nextGrid;
    generationCount++;
    if (infoContainer) {
        const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
        infoContainer.textContent = `Time: ${elapsed}s Gen: ${generationCount}`;
    }
}

// --- Pattern Recognition Functions ---

const PATTERNS: { [key: string]: { shape: number[][]; color: number } } = {
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

/**
 * Checks if a given pattern exists at a specific (row, col) in the grid.
 * @param {Array<Array<number>>} currentGrid The current game grid.
 * @param {number} startRow The starting row for pattern check.
 * @param {number} startCol The starting column for pattern check.
 * @param {Array<Array<number>>} patternShape The shape of the pattern (relative coordinates).
 * @returns {boolean} True if the pattern exists, false otherwise.
 */
function checkPattern(currentGrid: number[][], startRow: number, startCol: number, patternShape: number[][]) {
    for (const [dr, dc] of patternShape) {
        const r = startRow + dr;
        const c = startCol + dc;

        // Check bounds and if the cell is alive
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS || currentGrid[r][c] === 0) {
            return false;
        }
    }
    return true;
}

/**
 * Finds all occurrences of defined patterns in the grid.
 * @param {Array<Array<number>>} currentGrid The current game grid.
 * @returns {Map<string, number>} A map where keys are "row,col" strings and values are pattern colors.
 */
function findPatterns(currentGrid: number[][]) {
    const detectedPatternCells = new Map<string, number>();

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            // Only check if the current cell is alive
            if (currentGrid[r][c] > 0) {
                for (const patternName in PATTERNS) {
                    const pattern = PATTERNS[patternName];
                    if (checkPattern(currentGrid, r, c, pattern.shape)) {
                        // If pattern found, mark all its cells with the pattern's color
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

function countNeighbors(grid: number[][], row: number, col: number) {
    let count = 0;
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) {
                continue;
            }

            const newRow = row + i;
            const newCol = col + j;

            if (newRow >= 0 && newCol >= 0 && newRow < ROWS && newCol < COLS) {
                // Only count living neighbors (age > 0)
                if (grid[newRow][newCol] > 0) {
                    count++;
                }
            }
        }
    }
    return count;
}

function generateCards(num: number): Card[] {
    const types = Object.keys(CardType).map(k => (CardType as any)[k]) as CardType[];
    const cards: Card[] = [];
    for (let i = 0; i < num; i++) {
        const type = types[Phaser.Math.Between(0, types.length - 1)];
        cards.push({ type });
    }
    return cards;
}

function displayCards() {
    if (!cardsContainer) return;
    cardsContainer.innerHTML = '';
    playerCards.forEach((card, index) => {
        const btn = document.createElement('button');
        btn.textContent = card.type;
        btn.style.marginRight = '4px';
        btn.addEventListener('click', () => {
            showCardPopup(index);
        });
        cardsContainer!.appendChild(btn);
    });
}

function showCardPopup(index: number) {
    if (!popupContainer) return;
    const card = playerCards[index];
    if (!card) return;

    // Clear previous popup content and listeners
    popupContainer.innerHTML = '';

    const popupContent = document.createElement('div');
    popupContent.style.cssText = "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#333;padding:20px;border-radius:5px;";

    const description = document.createElement('p');
    description.textContent = CARD_DESCRIPTIONS[card.type];
    popupContent.appendChild(description);

    const useButton = document.createElement('button');
    useButton.textContent = 'Use';
    popupContent.appendChild(useButton);

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    popupContent.appendChild(closeButton);

    const close = () => {
        if (popupContainer) {
            popupContainer.style.display = 'none';
            popupContainer.innerHTML = '';
        }
    };

    closeButton.addEventListener('click', close);
    useButton.addEventListener('click', () => {
        useCard(index);
        close();
    });

    popupContainer.appendChild(popupContent);
    popupContainer.style.display = 'block';
}

function useCard(index: number) {
    const card = playerCards[index];
    if (!card) return;
    switch (card.type) {
        case CardType.Disaster:
            applyDisaster();
            break;
        case CardType.Evolution:
            applyEvolution();
            break;
        case CardType.Split:
            applySplit();
            break;
        case CardType.Barrier:
            applyBarrier();
            break;
    }
    playerCards.splice(index, 1);
    displayCards();
}

function applyDisaster() {
    const cellsToKill = 100;
    for (let i = 0; i < cellsToKill; i++) {
        const r = Phaser.Math.Between(0, ROWS - 1);
        const c = Phaser.Math.Between(0, COLS - 1);
        grid[r][c] = 0;
        evolvedCells.delete(`${r},${c}`);
        barrierCells.delete(`${r},${c}`);
    }
}

function applyEvolution() {
    let added = 0;
    let attempts = 0;
    while (added < 5 && attempts < 100) {
        const r = Phaser.Math.Between(0, ROWS - 1);
        const c = Phaser.Math.Between(0, COLS - 1);
        if (grid[r][c] > 0) {
            evolvedCells.add(`${r},${c}`);
            added++;
        }
        attempts++;
    }
}

function applySplit() {
    let done = 0;
    let attempts = 0;
    while (done < 5 && attempts < 100) {
        const r = Phaser.Math.Between(0, ROWS - 1);
        const c = Phaser.Math.Between(0, COLS - 1);
        if (grid[r][c] > 0) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                        grid[nr][nc] = 1;
                    }
                }
            }
            done++;
        }
        attempts++;
    }
}

function applyBarrier() {
    const r = Phaser.Math.Between(0, ROWS - 6);
    const c = Phaser.Math.Between(0, COLS - 6);
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
            const key = `${r + i},${c + j}`;
            barrierCells.set(key, 20);
        }
    }
}

function addRandomCard() {
    const [card] = generateCards(1);
    playerCards.push(card);
    while (playerCards.length > MAX_CARDS) {
        playerCards.shift();
    }
    displayCards();
}
