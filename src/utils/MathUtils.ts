export class MathUtils {
    static clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    static between(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}
