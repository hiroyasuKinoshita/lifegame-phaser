import { Card, CardType } from '../types';
import { MAX_CARDS, CHUNK_SIZE, GRID_SIZE } from '../constants';
import { World } from '../core/World';
import { PatternSystem, GLIDER_GUN } from './PatternSystem';
import { Game } from '../core/Game';
import { MathUtils } from '../utils/MathUtils';

const CARD_DESCRIPTIONS: Record<CardType, string> = {
    [CardType.Disaster]: 'ランダムなセルを消滅させます。',
    [CardType.Evolution]: 'いくつかのセルが進化し移動できるようになります。',
    [CardType.Split]: 'セルを中心に周囲へ増殖させます。',
    [CardType.Barrier]: '一時的に周囲を守るバリアを張ります。',
    [CardType.GliderGun]: 'グライダーを無限に射出する銃を設置します。'
};

export class CardSystem {
    private world: World;
    private patternSystem: PatternSystem;
    private game: Game;
    private playerCards: Card[] = [];
    private cardsContainer: HTMLElement | null;
    private popupContainer: HTMLElement | null;

    constructor(game: Game, world: World, patternSystem: PatternSystem) {
        this.game = game;
        this.world = world;
        this.patternSystem = patternSystem;
        this.cardsContainer = document.getElementById('cardsContainer');
        this.popupContainer = document.getElementById('popup');
    }

    public reset() {
        this.playerCards = [];
        if (this.cardsContainer) {
            this.cardsContainer.innerHTML = '';
        }
        if (this.popupContainer) {
            this.popupContainer.style.display = 'none';
        }
    }

    public generateCards(num: number): Card[] {
        const types = Object.keys(CardType).map(k => (CardType as any)[k]) as CardType[];
        const cards: Card[] = [];
        for (let i = 0; i < num; i++) {
            const type = types[MathUtils.between(0, types.length - 1)];
            cards.push({ type });
        }
        return cards;
    }

    public addRandomCard() {
        const [card] = this.generateCards(1);
        this.playerCards.push(card);
        while (this.playerCards.length > MAX_CARDS) {
            this.playerCards.shift();
        }
        this.displayCards();
    }

    public initCards() {
        this.playerCards = this.generateCards(3);
        this.displayCards();
    }

    private displayCards() {
        if (!this.cardsContainer) return;
        this.cardsContainer.innerHTML = '';
        this.playerCards.forEach((card, index) => {
            const btn = document.createElement('button');
            btn.textContent = card.type;
            btn.className = 'card-button';
            btn.addEventListener('click', () => {
                this.showCardPopup(index);
            });
            this.cardsContainer!.appendChild(btn);
        });
    }

    private showCardPopup(index: number) {
        if (!this.popupContainer) return;
        const card = this.playerCards[index];
        if (!card) return;

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
        this.popupContainer.style.display = 'flex';
    }

    private useCard(index: number) {
        const card = this.playerCards[index];
        if (!card) return;

        this.playCardEffect(card.type);

        switch (card.type) {
            case CardType.Disaster:
                this.applyDisaster();
                break;
            case CardType.Evolution:
                this.applyEvolution();
                break;
            case CardType.Split:
                this.applySplit();
                break;
            case CardType.Barrier:
                this.applyBarrier();
                break;
            case CardType.GliderGun:
                this.applyGliderGun();
                break;
        }
        this.playerCards.splice(index, 1);
        this.displayCards();
    }

    private playCardEffect(cardType: CardType) {
        // Simple DOM-based flash effect
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100%';
        flash.style.height = '100%';
        flash.style.pointerEvents = 'none';
        flash.style.zIndex = '1000';
        flash.style.transition = 'opacity 0.5s ease-out';
        flash.style.opacity = '0.5';

        const color = this.getEffectColor(cardType);
        flash.style.backgroundColor = '#' + ('000000' + color.toString(16)).slice(-6);

        document.body.appendChild(flash);

        // Fade out and remove
        requestAnimationFrame(() => {
            flash.style.opacity = '0';
        });

        setTimeout(() => {
            document.body.removeChild(flash);
        }, 500);
    }

    private getEffectColor(cardType: CardType): number {
        switch (cardType) {
            case CardType.Disaster: return 0xff0000;
            case CardType.Evolution: return 0x00ffff;
            case CardType.Split: return 0x00ff00;
            case CardType.Barrier: return 0xffff00;
            case CardType.GliderGun: return 0xff00ff;
            default: return 0xffffff;
        }
    }

    private applyDisaster() {
        const cellsToKill = 100;
        const activeKeys = Array.from(this.world.chunks.keys());
        if (activeKeys.length === 0) return;

        for (let i = 0; i < cellsToKill; i++) {
            const key = activeKeys[MathUtils.between(0, activeKeys.length - 1)];
            const [cx, cy] = key.split(',').map(Number);
            const r = cy * CHUNK_SIZE + MathUtils.between(0, CHUNK_SIZE - 1);
            const c = cx * CHUNK_SIZE + MathUtils.between(0, CHUNK_SIZE - 1);

            this.world.setCell(c * GRID_SIZE, r * GRID_SIZE, 0);
            this.world.evolvedCells.delete(`${r},${c}`);
            this.world.barrierCells.delete(`${r},${c}`);
        }
    }

    private applyEvolution() {
        let added = 0;
        let attempts = 0;
        const activeKeys = Array.from(this.world.chunks.keys());
        if (activeKeys.length === 0) return;

        while (added < 5 && attempts < 100) {
            const key = activeKeys[MathUtils.between(0, activeKeys.length - 1)];
            const [cx, cy] = key.split(',').map(Number);
            const r = cy * CHUNK_SIZE + MathUtils.between(0, CHUNK_SIZE - 1);
            const c = cx * CHUNK_SIZE + MathUtils.between(0, CHUNK_SIZE - 1);

            if (this.world.getCell(c * GRID_SIZE, r * GRID_SIZE) > 0) {
                this.world.evolvedCells.add(`${r},${c}`);
                added++;
            }
            attempts++;
        }
    }

    private applySplit() {
        let done = 0;
        let attempts = 0;
        const activeKeys = Array.from(this.world.chunks.keys());
        if (activeKeys.length === 0) return;

        while (done < 5 && attempts < 100) {
            const key = activeKeys[MathUtils.between(0, activeKeys.length - 1)];
            const [cx, cy] = key.split(',').map(Number);
            const r = cy * CHUNK_SIZE + MathUtils.between(0, CHUNK_SIZE - 1);
            const c = cx * CHUNK_SIZE + MathUtils.between(0, CHUNK_SIZE - 1);

            if (this.world.getCell(c * GRID_SIZE, r * GRID_SIZE) > 0) {
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const nr = r + dr;
                        const nc = c + dc;
                        this.world.setCell(nc * GRID_SIZE, nr * GRID_SIZE, 1);
                    }
                }
                done++;
            }
            attempts++;
        }
    }

    private applyBarrier() {
        const { row, col } = this.game.getCenterGridPosition();
        for (let i = -2; i <= 2; i++) {
            for (let j = -2; j <= 2; j++) {
                const key = `${row + i},${col + j}`;
                this.world.barrierCells.set(key, 20);
            }
        }
    }

    private applyGliderGun() {
        const { row, col } = this.game.getCenterGridPosition();
        this.patternSystem.placePattern(GLIDER_GUN, row, col);
    }
}

