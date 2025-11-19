"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardSystem = void 0;
const types_1 = require("../types");
const constants_1 = require("../constants");
const PatternSystem_1 = require("./PatternSystem");
const CARD_DESCRIPTIONS = {
    [types_1.CardType.Disaster]: 'ランダムなセルを消滅させます。',
    [types_1.CardType.Evolution]: 'いくつかのセルが進化し移動できるようになります。',
    [types_1.CardType.Split]: 'セルを中心に周囲へ増殖させます。',
    [types_1.CardType.Barrier]: '一時的に周囲を守るバリアを張ります。',
    [types_1.CardType.GliderGun]: 'グライダーを無限に射出する銃を設置します。'
};
class CardSystem {
    constructor(scene, world, patternSystem) {
        this.playerCards = [];
        this.scene = scene;
        this.world = world;
        this.patternSystem = patternSystem;
        this.cardsContainer = document.getElementById('cardsContainer');
        this.popupContainer = document.getElementById('popup');
    }
    reset() {
        this.playerCards = [];
        if (this.cardsContainer) {
            this.cardsContainer.innerHTML = '';
        }
        if (this.popupContainer) {
            this.popupContainer.style.display = 'none';
        }
    }
    generateCards(num) {
        const types = Object.keys(types_1.CardType).map(k => types_1.CardType[k]);
        const cards = [];
        for (let i = 0; i < num; i++) {
            const type = types[Phaser.Math.Between(0, types.length - 1)];
            cards.push({ type });
        }
        return cards;
    }
    addRandomCard() {
        const [card] = this.generateCards(1);
        this.playerCards.push(card);
        while (this.playerCards.length > constants_1.MAX_CARDS) {
            this.playerCards.shift();
        }
        this.displayCards();
    }
    initCards() {
        this.playerCards = this.generateCards(3);
        this.displayCards();
    }
    displayCards() {
        if (!this.cardsContainer)
            return;
        this.cardsContainer.innerHTML = '';
        this.playerCards.forEach((card, index) => {
            const btn = document.createElement('button');
            btn.textContent = card.type;
            btn.className = 'card-button';
            btn.addEventListener('click', () => {
                this.showCardPopup(index);
            });
            this.cardsContainer.appendChild(btn);
        });
    }
    showCardPopup(index) {
        if (!this.popupContainer)
            return;
        const card = this.playerCards[index];
        if (!card)
            return;
        this.popupContainer.innerHTML = '';
        const popupContent = document.createElement('div');
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
            if (this.popupContainer) {
                this.popupContainer.style.display = 'none';
                this.popupContainer.innerHTML = '';
            }
        };
        closeButton.addEventListener('click', close);
        useButton.addEventListener('click', () => {
            this.useCard(index);
            close();
        });
        this.popupContainer.appendChild(popupContent);
        this.popupContainer.style.display = 'flex'; // Changed to flex for centering
    }
    useCard(index) {
        const card = this.playerCards[index];
        if (!card)
            return;
        this.playCardEffect(card.type);
        switch (card.type) {
            case types_1.CardType.Disaster:
                this.applyDisaster();
                break;
            case types_1.CardType.Evolution:
                this.applyEvolution();
                break;
            case types_1.CardType.Split:
                this.applySplit();
                break;
            case types_1.CardType.Barrier:
                this.applyBarrier();
                break;
            case types_1.CardType.GliderGun:
                this.applyGliderGun();
                break;
        }
        this.playerCards.splice(index, 1);
        this.displayCards();
    }
    playCardEffect(cardType) {
        const camera = this.scene.cameras.main;
        const centerX = camera.scrollX + camera.width / 2;
        const centerY = camera.scrollY + camera.height / 2;
        const color = this.getEffectColor(cardType);
        const particleGraphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
        particleGraphics.fillStyle(0xffffff);
        particleGraphics.fillRect(0, 0, 8, 8);
        particleGraphics.generateTexture('particle', 8, 8);
        particleGraphics.destroy();
        const emitter = this.scene.add.particles(centerX, centerY, 'particle', {
            speed: { min: 100, max: 500 },
            angle: { min: 0, max: 360 },
            scale: { start: 1, end: 0 },
            blendMode: 'ADD',
            lifespan: 1000,
            tint: color,
            quantity: 50,
            active: true
        });
        this.scene.time.delayedCall(200, () => {
            emitter.stop();
            this.scene.time.delayedCall(1000, () => {
                emitter.destroy();
            });
        });
    }
    getEffectColor(cardType) {
        switch (cardType) {
            case types_1.CardType.Disaster: return 0xff0000;
            case types_1.CardType.Evolution: return 0x00ffff;
            case types_1.CardType.Split: return 0x00ff00;
            case types_1.CardType.Barrier: return 0xffff00;
            case types_1.CardType.GliderGun: return 0xff00ff;
            default: return 0xffffff;
        }
    }
    applyDisaster() {
        const cellsToKill = 100;
        const activeKeys = Array.from(this.world.chunks.keys());
        if (activeKeys.length === 0)
            return;
        for (let i = 0; i < cellsToKill; i++) {
            const key = activeKeys[Phaser.Math.Between(0, activeKeys.length - 1)];
            const [cx, cy] = key.split(',').map(Number);
            const r = cy * constants_1.CHUNK_SIZE + Phaser.Math.Between(0, constants_1.CHUNK_SIZE - 1);
            const c = cx * constants_1.CHUNK_SIZE + Phaser.Math.Between(0, constants_1.CHUNK_SIZE - 1);
            this.world.setCell(c * constants_1.GRID_SIZE, r * constants_1.GRID_SIZE, 0);
            this.world.evolvedCells.delete(`${r},${c}`);
            this.world.barrierCells.delete(`${r},${c}`);
        }
    }
    applyEvolution() {
        let added = 0;
        let attempts = 0;
        const activeKeys = Array.from(this.world.chunks.keys());
        if (activeKeys.length === 0)
            return;
        while (added < 5 && attempts < 100) {
            const key = activeKeys[Phaser.Math.Between(0, activeKeys.length - 1)];
            const [cx, cy] = key.split(',').map(Number);
            const r = cy * constants_1.CHUNK_SIZE + Phaser.Math.Between(0, constants_1.CHUNK_SIZE - 1);
            const c = cx * constants_1.CHUNK_SIZE + Phaser.Math.Between(0, constants_1.CHUNK_SIZE - 1);
            if (this.world.getCell(c * constants_1.GRID_SIZE, r * constants_1.GRID_SIZE) > 0) {
                this.world.evolvedCells.add(`${r},${c}`);
                added++;
            }
            attempts++;
        }
    }
    applySplit() {
        let done = 0;
        let attempts = 0;
        const activeKeys = Array.from(this.world.chunks.keys());
        if (activeKeys.length === 0)
            return;
        while (done < 5 && attempts < 100) {
            const key = activeKeys[Phaser.Math.Between(0, activeKeys.length - 1)];
            const [cx, cy] = key.split(',').map(Number);
            const r = cy * constants_1.CHUNK_SIZE + Phaser.Math.Between(0, constants_1.CHUNK_SIZE - 1);
            const c = cx * constants_1.CHUNK_SIZE + Phaser.Math.Between(0, constants_1.CHUNK_SIZE - 1);
            if (this.world.getCell(c * constants_1.GRID_SIZE, r * constants_1.GRID_SIZE) > 0) {
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const nr = r + dr;
                        const nc = c + dc;
                        this.world.setCell(nc * constants_1.GRID_SIZE, nr * constants_1.GRID_SIZE, 1);
                    }
                }
                done++;
            }
            attempts++;
        }
    }
    applyBarrier() {
        const camera = this.scene.cameras.main;
        const r = Math.floor((camera.scrollY + camera.height / 2) / constants_1.GRID_SIZE);
        const c = Math.floor((camera.scrollX + camera.width / 2) / constants_1.GRID_SIZE);
        for (let i = -2; i <= 2; i++) {
            for (let j = -2; j <= 2; j++) {
                const key = `${r + i},${c + j}`;
                this.world.barrierCells.set(key, 20);
            }
        }
    }
    applyGliderGun() {
        const camera = this.scene.cameras.main;
        const centerRow = Math.floor((camera.scrollY + camera.height / 2) / constants_1.GRID_SIZE);
        const centerCol = Math.floor((camera.scrollX + camera.width / 2) / constants_1.GRID_SIZE);
        this.patternSystem.placePattern(PatternSystem_1.GLIDER_GUN, centerRow, centerCol);
    }
}
exports.CardSystem = CardSystem;
