declare namespace Phaser {
    const AUTO: any;
    namespace Types {
        namespace Core {
            interface GameConfig { [key: string]: any; }
        }
    }
    namespace Math {
        function Between(min: number, max: number): number;
        function Clamp(value: number, min: number, max: number): number;
        function Shuffle<T>(array: T[]): T[];
        class Vector2 {
            x: number;
            y: number;
            copy(v: Vector2): this;
        }
    }
    namespace Input {
        interface Pointer {
            position: { x: number; y: number };
        }
    }
    namespace GameObjects {
        class Graphics {
            clear(): void;
            fillStyle(color: number): void;
            fillRect(x: number, y: number, w: number, h: number): void;
        }
    }
    namespace Time {
        interface TimerEvent {
            remove(): void;
        }
    }
    class Game {
        constructor(config: any);
    }
}
