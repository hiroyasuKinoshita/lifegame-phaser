import * as THREE from 'three';
import { World } from './World';
import { PatternSystem, SPACESHIP_LWSS } from '../systems/PatternSystem';
import { CardSystem } from '../systems/CardSystem';
import { GRID_SIZE, CHUNK_SIZE, MAX_AGE } from '../constants';
import { MathUtils } from '../utils/MathUtils';

export class Game {
    private world: World;
    private patternSystem: PatternSystem;
    private cardSystem!: CardSystem;

    // Three.js components
    private renderer!: THREE.WebGLRenderer;
    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private instancedMesh!: THREE.InstancedMesh;
    private dummy = new THREE.Object3D();
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();

    // Sun
    private sunLight!: THREE.DirectionalLight;
    private sunMesh!: THREE.Mesh;
    private sunAngle = 0;

    // Game Loop
    private isRunning = false;
    private lastTime = 0;
    private gameUpdateTimer = 0;
    private cardDealTimer = 0;
    private gameStartTime = 0;
    private animationFrameId: number | null = null;

    // UI
    private infoContainer: HTMLElement | null = null;

    // Camera controls
    private cameraRadius = 1000;
    private cameraAzimuth = 0;
    private cameraElevation = Math.PI / 4;
    private cameraTarget = new THREE.Vector3(0, 0, 0);
    private isDragging = false;
    private lastPointerPosition = new THREE.Vector2();

    constructor() {
        this.world = new World();
        this.patternSystem = new PatternSystem(this.world);

        this.initThreeJS();
        this.cardSystem = new CardSystem(this, this.world, this.patternSystem);

        this.setupInput();
        this.setupUI();

        // Start render loop
        this.animate(0);
    }

    private initThreeJS() {
        // Setup Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.innerHTML = ''; // Clear existing content
            this.renderer.domElement.style.position = 'absolute';
            this.renderer.domElement.style.top = '0';
            this.renderer.domElement.style.left = '0';
            gameContainer.appendChild(this.renderer.domElement);
        }

        // Setup Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue start
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.0005);

        // Setup Camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
        this.updateCameraPosition();

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Brighter ambient
        this.scene.add(ambientLight);

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        this.scene.add(hemiLight);

        // Sun Light
        this.sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 5000;
        const d = 1000;
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;
        this.scene.add(this.sunLight);

        // Sun Mesh
        const sunGeometry = new THREE.SphereGeometry(50, 32, 32);
        const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        this.sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
        this.scene.add(this.sunMesh);

        const pointLight = new THREE.PointLight(0x00ffff, 1, 1000);
        pointLight.position.set(0, 200, 0);
        this.scene.add(pointLight);

        // InstancedMesh for Cells
        const geometry = new THREE.BoxGeometry(GRID_SIZE * 0.9, GRID_SIZE * 0.9, GRID_SIZE * 0.9);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.1,
            metalness: 0.1
        });

        this.instancedMesh = new THREE.InstancedMesh(geometry, material, 100000);
        this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.instancedMesh.castShadow = true;
        this.instancedMesh.receiveShadow = true;
        this.scene.add(this.instancedMesh);

        // Grid Helper
        const gridHelper = new THREE.GridHelper(2000, 20, 0x333333, 0x111111);
        this.scene.add(gridHelper);

        // Handle window resize
        window.addEventListener('resize', () => {
            this.handleResize(window.innerWidth, window.innerHeight);
        });
    }

    private handleResize(width: number, height: number) {
        if (this.renderer && this.camera) {
            this.renderer.setSize(width, height);
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        }
    }

    private setupInput() {
        const canvas = this.renderer.domElement;

        canvas.addEventListener('pointerdown', (event) => {
            this.isDragging = true;
            this.lastPointerPosition.set(event.clientX, event.clientY);
        });

        window.addEventListener('pointerup', () => {
            this.isDragging = false;
        });

        window.addEventListener('pointermove', (event) => {
            if (this.isDragging) {
                const dx = event.clientX - this.lastPointerPosition.x;
                const dy = event.clientY - this.lastPointerPosition.y;

                // Rotate camera
                this.cameraAzimuth -= dx * 0.005;
                this.cameraElevation += dy * 0.005;

                // Clamp elevation
                this.cameraElevation = MathUtils.clamp(this.cameraElevation, 0.1, Math.PI / 2 - 0.1);

                this.updateCameraPosition();
                this.lastPointerPosition.set(event.clientX, event.clientY);
            }
        });

        canvas.addEventListener('wheel', (event) => {
            this.cameraRadius += event.deltaY * 0.5;
            this.cameraRadius = MathUtils.clamp(this.cameraRadius, 100, 3000);
            this.updateCameraPosition();
        });

        window.addEventListener('keydown', (event) => {
            const panSpeed = 20;
            const forward = new THREE.Vector3();
            this.camera.getWorldDirection(forward);
            forward.y = 0;
            forward.normalize();

            const right = new THREE.Vector3();
            right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW':
                    this.cameraTarget.add(forward.multiplyScalar(panSpeed));
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    this.cameraTarget.add(forward.multiplyScalar(-panSpeed));
                    break;
                case 'ArrowLeft':
                case 'KeyA':
                    this.cameraTarget.add(right.multiplyScalar(-panSpeed));
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    this.cameraTarget.add(right.multiplyScalar(panSpeed));
                    break;
            }
            this.updateCameraPosition();
        });
    }

    private updateCameraPosition() {
        const x = this.cameraTarget.x + this.cameraRadius * Math.sin(this.cameraElevation) * Math.sin(this.cameraAzimuth);
        const y = this.cameraTarget.y + this.cameraRadius * Math.cos(this.cameraElevation);
        const z = this.cameraTarget.z + this.cameraRadius * Math.sin(this.cameraElevation) * Math.cos(this.cameraAzimuth);

        this.camera.position.set(x, y, z);
        this.camera.lookAt(this.cameraTarget);
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
                if (!this.isRunning) return;
                const centerRow = Math.floor(this.cameraTarget.z / GRID_SIZE);
                const centerCol = Math.floor(this.cameraTarget.x / GRID_SIZE);
                this.patternSystem.placePattern(SPACESHIP_LWSS, centerRow, centerCol);
            });
        }
    }

    private startGame() {
        this.world.reset();
        this.cardSystem.initCards();
        this.gameStartTime = Date.now();
        this.isRunning = true;
        this.gameUpdateTimer = 0;
        this.cardDealTimer = 0;

        if (this.infoContainer) this.infoContainer.textContent = 'Time: 0s Gen: 0';
    }

    private resetGame() {
        this.isRunning = false;
        this.world.reset();
        this.cardSystem.reset();

        // Clear instances
        this.instancedMesh.count = 0;
        this.instancedMesh.instanceMatrix.needsUpdate = true;

        const startButton = document.getElementById('startButton');
        const resetButton = document.getElementById('resetButton');
        if (startButton) startButton.style.display = 'inline-block';
        if (resetButton) resetButton.style.display = 'none';
        if (this.infoContainer) this.infoContainer.textContent = '';
        this.cameraTarget.set(0, 0, 0);
        this.updateCameraPosition();
    }

    public getCenterGridPosition(): { row: number, col: number } {
        return {
            row: Math.floor(this.cameraTarget.z / GRID_SIZE),
            col: Math.floor(this.cameraTarget.x / GRID_SIZE)
        };
    }

    public getVisibleGridBounds() {
        const visibleRange = 2000;
        const startX = this.cameraTarget.x - visibleRange;
        const endX = this.cameraTarget.x + visibleRange;
        const startZ = this.cameraTarget.z - visibleRange;
        const endZ = this.cameraTarget.z + visibleRange;

        return {
            startCol: Math.floor(startX / GRID_SIZE),
            endCol: Math.ceil(endX / GRID_SIZE),
            startRow: Math.floor(startZ / GRID_SIZE),
            endRow: Math.ceil(endZ / GRID_SIZE)
        };
    }

    private animate = (time: number) => {
        this.animationFrameId = requestAnimationFrame(this.animate);

        const delta = time - this.lastTime;
        this.lastTime = time;

        // Update Sun Position
        this.sunAngle += delta * 0.0001; // Slow rotation
        const sunRadius = 2000;
        const sunX = Math.cos(this.sunAngle) * sunRadius;
        const sunY = Math.sin(this.sunAngle) * sunRadius;
        const sunZ = Math.sin(this.sunAngle * 0.5) * 500; // Slight wobble in Z

        if (this.sunLight && this.sunMesh) {
            this.sunLight.position.set(sunX, Math.abs(sunY), sunZ); // Keep sun above horizon for light logic if desired, or let it set
            this.sunMesh.position.set(sunX, sunY, sunZ);
            this.sunLight.target.position.copy(this.cameraTarget);
            this.sunLight.target.updateMatrixWorld();

            // Simple Day/Night cycle background
            const intensity = Math.max(0, Math.sin(this.sunAngle));
            const skyColor = new THREE.Color(0x87CEEB).lerp(new THREE.Color(0x050510), 1 - intensity);
            this.scene.background = skyColor;
            this.scene.fog = new THREE.FogExp2(skyColor.getHex(), 0.0005);
            this.sunLight.intensity = intensity * 1.5;
        }

        if (this.isRunning) {
            // Update Game Logic
            this.gameUpdateTimer += delta;
            if (this.gameUpdateTimer >= 100) { // 100ms per generation
                this.world.update();
                this.gameUpdateTimer = 0;
            }

            // Card Dealing
            this.cardDealTimer += delta;
            if (this.cardDealTimer >= 10000) { // 10s per card
                this.cardSystem.addRandomCard();
                this.cardDealTimer = 0;
            }

            // Update UI
            if (this.infoContainer) {
                const elapsed = Math.floor((Date.now() - this.gameStartTime) / 1000);
                this.infoContainer.textContent = `Time: ${elapsed}s Gen: ${this.world.generationCount}`;
            }
        }

        // Render
        this.render();
    }

    private render() {
        // Detect patterns
        const bounds = this.getVisibleGridBounds();
        const detectedPatternCells = this.patternSystem.findPatterns(bounds);

        // Update Instances
        this.updateInstances(detectedPatternCells);

        this.renderer.render(this.scene, this.camera);
    }

    private updateInstances(detectedPatternCells?: Map<string, number>) {
        let count = 0;
        const color = new THREE.Color();
        const bounds = this.getVisibleGridBounds();

        const startCx = Math.floor(bounds.startCol * GRID_SIZE / (CHUNK_SIZE * GRID_SIZE));
        const endCx = Math.floor(bounds.endCol * GRID_SIZE / (CHUNK_SIZE * GRID_SIZE));
        const startCy = Math.floor(bounds.startRow * GRID_SIZE / (CHUNK_SIZE * GRID_SIZE));
        const endCy = Math.floor(bounds.endRow * GRID_SIZE / (CHUNK_SIZE * GRID_SIZE));

        for (let cy = startCy; cy <= endCy; cy++) {
            for (let cx = startCx; cx <= endCx; cx++) {
                const chunk = this.world.chunks.get(this.world.getChunkKey(cx, cy));
                if (!chunk) continue;

                for (let y = 0; y < CHUNK_SIZE; y++) {
                    for (let x = 0; x < CHUNK_SIZE; x++) {
                        const cellAge = chunk[y][x];
                        if (cellAge > 0) {
                            const globalX = (cx * CHUNK_SIZE + x) * GRID_SIZE;
                            const globalZ = (cy * CHUNK_SIZE + y) * GRID_SIZE;

                            this.dummy.position.set(globalX, 0, globalZ);
                            const scale = Math.min(1, cellAge / 3);
                            this.dummy.scale.set(scale, scale * (1 + cellAge * 0.2), scale);
                            this.dummy.updateMatrix();
                            this.instancedMesh.setMatrixAt(count, this.dummy.matrix);

                            const hue = (cellAge / MAX_AGE);
                            color.setHSL(hue, 1.0, 0.5);

                            const cellKey = `${cx * CHUNK_SIZE + x},${cy * CHUNK_SIZE + y}`;
                            if (this.world.barrierCells.has(cellKey)) {
                                color.setHex(0xffff00);
                            } else if (this.world.evolvedCells.has(cellKey)) {
                                color.setHex(0x00ffff);
                            } else if (detectedPatternCells && detectedPatternCells.has(cellKey)) {
                                color.setHex(detectedPatternCells.get(cellKey)!);
                            }

                            this.instancedMesh.setColorAt(count, color);
                            count++;
                            if (count >= this.instancedMesh.count) break;
                        }
                    }
                }
            }
        }

        this.instancedMesh.count = count;
        this.instancedMesh.instanceMatrix.needsUpdate = true;
        if (this.instancedMesh.instanceColor) this.instancedMesh.instanceColor.needsUpdate = true;
    }

    public get width(): number {
        return window.innerWidth;
    }

    public get height(): number {
        return window.innerHeight;
    }
}
