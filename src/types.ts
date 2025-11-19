export type Chunk = number[][];

export enum CardType {
    Disaster = 'Disaster',
    Evolution = 'Evolution',
    Split = 'Split',
    Barrier = 'Barrier',
    GliderGun = 'GliderGun'
}

export interface Card {
    type: CardType;
}
