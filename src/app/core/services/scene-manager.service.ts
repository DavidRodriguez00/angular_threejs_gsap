import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, distinctUntilChanged, map, shareReplay } from 'rxjs';

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface IScene {
  show(): void;
  hide(): void;
}

export interface SceneTransition {
  from: number | null;
  to: number;
}

export interface SceneManagerState {
  activeIndex: number | null;
  previousIndex: number | null;
  count: number;
  isTransitioning: boolean;
}

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * Manages scene registration, activation, and transitions.
 * Supports lazy registration and safe re-initialization.
 */
@Injectable({
  providedIn: 'root',
})
export class SceneManagerService implements OnDestroy {

  // ── Internal state ─────────────────────────────────────────────────────────

  private scenes: IScene[] = [];

  private readonly _state$ = new BehaviorSubject<SceneManagerState>({
    activeIndex:   null,
    previousIndex: null,
    count:         0,
    isTransitioning: false,
  });

  // ── Public observables ─────────────────────────────────────────────────────

  /** Full state snapshot stream */
  readonly state$: Observable<SceneManagerState> =
    this._state$.asObservable().pipe(shareReplay(1));

  /** Currently active scene index (null before first activation) */
  readonly activeIndex$: Observable<number | null> = this._state$.pipe(
    map(s => s.activeIndex),
    distinctUntilChanged(),
    shareReplay(1),
  );

  /** Fires on every scene change with from/to pair — useful for animations */
  readonly transition$: Observable<SceneTransition> = this._state$.pipe(
    map(s => ({ from: s.previousIndex, to: s.activeIndex! })),
    distinctUntilChanged((a, b) => a.to === b.to && a.from === b.from),
    shareReplay(1),
  );

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Register (or replace) the full scene list and activate the first scene.
   * Safe to call multiple times — cleans up previous state first.
   */
  registerScenes(scenes: IScene[]): void {
    this.resetAll();
    this.scenes = [...scenes];
    this.patchState({ count: scenes.length });

    if (scenes.length > 0) {
      this.activateScene(0);
    }
  }

  /**
   * Add a single scene dynamically after initial registration.
   */
  addScene(scene: IScene): void {
    this.scenes.push(scene);
    this.patchState({ count: this.scenes.length });
  }

  /**
   * Transition to a scene by index.
   * No-op if the index is already active or out of bounds.
   */
  activateScene(index: number): void {
    const { activeIndex } = this._state$.value;

    if (!this.isValidIndex(index) || index === activeIndex) return;

    this.patchState({ isTransitioning: true });

    // Hide previous
    if (activeIndex !== null && this.isValidIndex(activeIndex)) {
      this.scenes[activeIndex].hide();
    }

    // Show next
    this.scenes[index].show();

    this.patchState({
      previousIndex:   activeIndex,
      activeIndex:     index,
      isTransitioning: false,
    });
  }

  /**
   * Advance to the next scene (wraps around).
   */
  next(): void {
    const { activeIndex, count } = this._state$.value;
    if (count === 0) return;
    const next = activeIndex === null ? 0 : (activeIndex + 1) % count;
    this.activateScene(next);
  }

  /**
   * Go to the previous scene (wraps around).
   */
  prev(): void {
    const { activeIndex, count } = this._state$.value;
    if (count === 0) return;
    const prev = activeIndex === null ? 0 : (activeIndex - 1 + count) % count;
    this.activateScene(prev);
  }

  /**
   * Show a scene without hiding the current one.
   * Useful for overlays or secondary scenes.
   */
  showScene(index: number): void {
    if (!this.isValidIndex(index)) return;
    this.scenes[index].show();
  }

  /**
   * Hide a scene without altering active state.
   */
  hideScene(index: number): void {
    if (!this.isValidIndex(index)) return;
    this.scenes[index].hide();
  }

  /** Synchronous snapshot of the current state */
  getState(): SceneManagerState {
    return this._state$.value;
  }

  get sceneCount(): number {
    return this.scenes.length;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnDestroy(): void {
    this.resetAll();
    this._state$.complete();
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private resetAll(): void {
    this.scenes.forEach((_, i) => this.hideScene(i));
    this.scenes = [];
    this.patchState({
      activeIndex:     null,
      previousIndex:   null,
      count:           0,
      isTransitioning: false,
    });
  }

  private patchState(partial: Partial<SceneManagerState>): void {
    this._state$.next({ ...this._state$.value, ...partial });
  }

  private isValidIndex(index: number): boolean {
    return Number.isInteger(index) && index >= 0 && index < this.scenes.length;
  }
}