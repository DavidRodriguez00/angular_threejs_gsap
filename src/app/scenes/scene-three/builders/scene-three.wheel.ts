const TRIGGER = 84;
const RESET_MS = 180;
const COOLDOWN_MS = 620;

export class WheelHandler {
    private accumulator = 0;
    private resetTimer: ReturnType<typeof setTimeout> | null = null;
    private cooldownUntil = 0;

    constructor(
        private readonly onNext: () => void,
        private readonly onPrev: () => void,
    ) { }

    handle(e: WheelEvent, canNext: boolean, canPrev: boolean): void {
        const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        if (!delta) return;

        const goingNext = delta > 0;
        const canMove = goingNext ? canNext : canPrev;

        if (!canMove) { this.reset(); return; }

        e.preventDefault();
        e.stopPropagation();

        const now = performance.now();
        if (now < this.cooldownUntil) return;

        this.accumulator += delta;
        this._armReset();

        if (Math.abs(this.accumulator) < TRIGGER) return;

        this.reset();
        this.cooldownUntil = now + COOLDOWN_MS;
        goingNext ? this.onNext() : this.onPrev();
    }

    reset(): void {
        this.accumulator = 0;
        if (this.resetTimer !== null) { clearTimeout(this.resetTimer); this.resetTimer = null; }
    }

    private _armReset(): void {
        if (this.resetTimer !== null) clearTimeout(this.resetTimer);
        this.resetTimer = setTimeout(() => { this.resetTimer = null; this.accumulator = 0; }, RESET_MS);
    }
}