const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'phaser-example',
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

const GRID_SIZE = 10;
const WORLD_WIDTH = 3200; // 仮想世界の幅 (例: 800 * 4)
const WORLD_HEIGHT = 2400; // 仮想世界の高さ (例: 600 * 4)

const ROWS = WORLD_HEIGHT / GRID_SIZE;
const COLS = WORLD_WIDTH / GRID_SIZE;
const MAX_AGE = 10; // セルの最大年齢（色変化の基準）

let grid;
let graphics;
let gameStarted = false;
let gameUpdateEvent; // To store the time event for stopping/resetting

function preload() {}

function create() {
    graphics = this.add.graphics();

    // カメラのワールド境界を設定
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    let isDragging = false;
    let lastPointerPosition = new Phaser.Math.Vector2();

    this.input.on('pointerdown', (pointer) => {
        isDragging = true;
        lastPointerPosition.copy(pointer.position);
    });

    this.input.on('pointerup', () => {
        isDragging = false;
    });

    this.input.on('pointermove', (pointer) => {
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

    startButton.addEventListener('click', () => {
        startButton.style.display = 'none'; // Hide the button
        resetButton.style.display = 'block'; // Show reset button
        startGame.call(this); // Call startGame in the context of the scene
    });

    resetButton.addEventListener('click', () => {
        resetGame.call(this); // Call resetGame in the context of the scene
    });

    resetButton.style.display = 'none'; // Hide reset button initially

    // Mouse wheel zoom
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
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

function startGame() {
    // Initialize the grid with random values (0 for dead, 1 for newly born)
    grid = new Array(ROWS);
    for (let i = 0; i < ROWS; i++) {
        grid[i] = new Array(COLS);
        for (let j = 0; j < COLS; j++) {
            grid[i][j] = Math.round(Math.random());
        }
    }

    // Update the grid every 100ms
    gameUpdateEvent = this.time.addEvent({
        delay: 100,
        callback: updateGrid,
        callbackScope: this,
        loop: true
    });

    gameStarted = true;
}

function resetGame() {
    if (gameUpdateEvent) {
        gameUpdateEvent.remove(); // Stop the game update loop
    }
    gameStarted = false;
    grid = null; // Clear the grid
    graphics.clear(); // Clear drawing

    const startButton = document.getElementById('startButton');
    const resetButton = document.getElementById('resetButton');

    startButton.style.display = 'block'; // Show start button
    resetButton.style.display = 'none'; // Hide reset button

    // Reset camera position
    this.cameras.main.scrollX = 0;
    this.cameras.main.scrollY = 0;
}

function update() {
    if (!gameStarted) {
        return;
    }

    graphics.clear();

    const camera = this.cameras.main;
    const startCol = Math.floor(camera.scrollX / GRID_SIZE);
    const endCol = Math.ceil((camera.scrollX + camera.width) / GRID_SIZE);
    const startRow = Math.floor(camera.scrollY / GRID_SIZE);
    const endRow = Math.ceil((camera.scrollY + camera.height) / GRID_SIZE);

    // Draw the grid
    for (let i = startRow; i < endRow; i++) {
        for (let j = startCol; j < endCol; j++) {
            // Ensure indices are within grid bounds
            if (i >= 0 && i < ROWS && j >= 0 && j < COLS) {
                const cellAge = grid[i][j];
                if (cellAge > 0) { // Cell is alive
                    // Calculate color based on age
                    const greenComponent = Math.max(0, 255 - (cellAge * (255 / MAX_AGE)));
                    const color = (0x00 << 16) | (Math.floor(greenComponent) << 8) | 0x00;
                    graphics.fillStyle(color);
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

    grid = nextGrid;
}

function countNeighbors(grid, row, col) {
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