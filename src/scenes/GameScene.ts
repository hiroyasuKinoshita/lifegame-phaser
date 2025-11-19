import * as Phaser from 'phaser';
import { GRID_SIZE, CHUNK_SIZE, MAX_AGE } from '../constants';
import { World } from '../core/World';
import { PatternSystem, SPACESHIP_LWSS } from '../systems/PatternSystem';
import { CardSystem } from '../systems/CardSystem';

export class GameScene extends Phaser.Scene {
    private world: World;
    private patternSystem: PatternSystem;
    private cardSystem!: CardSystem;
    private graphics!: Phaser.GameObjects.Graphics;
    private gameStarted = false;
    private gameUpdateEvent?: Phaser.Time.TimerEvent;
    private cardDealEvent?: Phaser.Time.TimerEvent;
    private gameStartTime = 0;
    private infoContainer: HTMLElement | null = null;
    private starfield?: Phaser.GameObjects.TileSprite;

    constructor() {
        super({ key: 'GameScene' });
        this.world = new World();
        this.patternSystem = new PatternSystem(this.world);
        // CardSystem initialized in create() because it needs the scene instance
    }

    preload() {
        // Generate starfield texture
        const starGraphics = this.make.graphics({ x: 0, y: 0, add: false } as any);
        starGraphics.fillStyle(0xffffff);
        for (let i = 0; i < 500; i++) {
            const x = Math.random() * 1024;
            const y = Math.random() * 1024;
            const r = Math.random() * 1.5;
            starGraphics.fillCircle(x, y, r);
        }
        starGraphics.generateTexture('starfield', 1024, 1024);
        starGraphics.destroy();
    }

    create() {
        this.cardSystem = new CardSystem(this, this.world, this.patternSystem);
        this.graphics = this.add.graphics();

        // Add starfield background
        this.starfield = this.add.tileSprite(0, 0, window.innerWidth, window.innerHeight, 'starfield');
        this.starfield.setOrigin(0, 0);
        this.starfield.setScrollFactor(0);
        this.starfield.setDepth(-1);

        this.setupInput();
        this.setupUI();

        this.scale.on('resize', (gameSize: any) => {
            if (this.starfield) {
                this.starfield.setSize(gameSize.width, gameSize.height);
            }
        });
    }

    private setupInput() {
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

        this.input.on('wheel', (pointer: any, gameObjects: any[], deltaX: number, deltaY: number, deltaZ: number) => {
            const camera = this.cameras.main;
            let newZoom = camera.zoom;
            if (deltaY < 0) newZoom += 0.1;
            else if (deltaY > 0) newZoom -= 0.1;
            newZoom = Phaser.Math.Clamp(newZoom, 0.1, 2.0);
            camera.setZoom(newZoom);
        });
    }

    private setupUI() {
        const startButton = document.getElementById('startButton');
        const resetButton = document.getElementById('resetButton');
        const addSpaceshipButton = document.getElementById('addSpaceshipButton');
        this.infoContainer = document.getElementById('infoContainer');

        if (startButton) {
            startButton.addEventListener('click', () => {
                startButton.style.display = 'none';
                if (resetButton) resetButton.style.display = 'inline-block';
                this.startGame();
            });
        }

        if (resetButton) {
            resetButton.addEventListener('click', () => {
                this.resetGame();
            });
        }

        if (addSpaceshipButton) {
            addSpaceshipButton.addEventListener('click', () => {
                if (!this.gameStarted) return;
                const camera = this.cameras.main;
                const centerRow = Math.floor((camera.scrollY + camera.height / 2) / GRID_SIZE);
                const centerCol = Math.floor((camera.scrollX + camera.width / 2) / GRID_SIZE);
                this.patternSystem.placePattern(SPACESHIP_LWSS, centerRow, centerCol);
            });
        }
    }

    private startGame() {
        this.world.reset();
        this.cardSystem.initCards();
        this.gameStartTime = Date.now();

        if (this.infoContainer) this.infoContainer.textContent = 'Time: 0s Gen: 0';

        if (this.cardDealEvent) this.cardDealEvent.remove();
        this.cardDealEvent = this.time.addEvent({
            delay: 10000,
            callback: () => this.cardSystem.addRandomCard(),
            loop: true
        });

        if (this.gameUpdateEvent) this.gameUpdateEvent.remove();
        this.gameUpdateEvent = this.time.addEvent({
            delay: 100,
            callback: () => this.world.update(),
            loop: true
        });

        this.gameStarted = true;
    }

    private resetGame() {
        if (this.gameUpdateEvent) this.gameUpdateEvent.remove();
        if (this.cardDealEvent) this.cardDealEvent.remove();

        this.gameStarted = false;
        this.world.reset();
        this.cardSystem.reset();
        this.graphics.clear();

        const startButton = document.getElementById('startButton');
        const resetButton = document.getElementById('resetButton');
        if (startButton) startButton.style.display = 'inline-block';
        if (resetButton) resetButton.style.display = 'none';
        if (this.infoContainer) this.infoContainer.textContent = '';

        this.cameras.main.scrollX = 0;
        this.cameras.main.scrollY = 0;
    }

    update() {
        if (!this.gameStarted) return;

        this.graphics.clear();

        const camera = this.cameras.main;
        if (this.starfield) {
            this.starfield.tilePositionX = camera.scrollX * 0.1;
            this.starfield.tilePositionY = camera.scrollY * 0.1;
        }

        const worldView = camera.worldView;
        const startCx = Math.floor(worldView.x / (CHUNK_SIZE * GRID_SIZE));
        const endCx = Math.floor((worldView.x + worldView.width) / (CHUNK_SIZE * GRID_SIZE));
        const startCy = Math.floor(worldView.y / (CHUNK_SIZE * GRID_SIZE));
        const endCy = Math.floor((worldView.y + worldView.height) / (CHUNK_SIZE * GRID_SIZE));

        const detectedPatternCells = this.patternSystem.findPatterns(camera);

        for (let cy = startCy; cy <= endCy; cy++) {
            for (let cx = startCx; cx <= endCx; cx++) {
                const chunk = this.world.chunks.get(this.world.getChunkKey(cx, cy));
                if (!chunk) continue;

                for (let y = 0; y < CHUNK_SIZE; y++) {
                    for (let x = 0; x < CHUNK_SIZE; x++) {
                        const cellAge = chunk[y][x];
                        if (cellAge > 0) {
                            const globalX = (cx * CHUNK_SIZE + x) * GRID_SIZE;
                            const globalY = (cy * CHUNK_SIZE + y) * GRID_SIZE;

                            if (globalX + GRID_SIZE < worldView.x || globalX > worldView.right ||
                                globalY + GRID_SIZE < worldView.y || globalY > worldView.bottom) {
                                continue;
                            }

                            let color;
                            const cellKey = `${cx * CHUNK_SIZE + x},${cy * CHUNK_SIZE + y}`;

                            if (this.world.barrierCells.has(cellKey)) {
                                color = 0xffff00;
                            } else if (this.world.evolvedCells.has(cellKey)) {
                                color = 0x00ffff;
                            } else if (detectedPatternCells.has(cellKey)) {
                                color = detectedPatternCells.get(cellKey);
                            } else {
                                const hue = (cellAge / MAX_AGE);
                                const rgbColor = Phaser.Display.Color.HSVToRGB(hue, 1, 1) as any;
                                color = Phaser.Display.Color.GetColor(rgbColor.r, rgbColor.g, rgbColor.b);
                            }
                            this.graphics.fillStyle(color as number);
                            this.graphics.fillRect(globalX, globalY, GRID_SIZE, GRID_SIZE);
                        }
                    }
                }
            }
        }

        if (this.infoContainer) {
            const elapsed = Math.floor((Date.now() - this.gameStartTime) / 1000);
            this.infoContainer.textContent = `Time: ${elapsed}s Gen: ${this.world.generationCount}`;
        }
    }
}
