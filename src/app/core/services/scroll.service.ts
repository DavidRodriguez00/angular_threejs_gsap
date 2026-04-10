import {
  Injectable,
  DestroyRef,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  BehaviorSubject,
  Observable,
  fromEvent,
  Subject,
  distinctUntilChanged,
  debounceTime,
  map,
  shareReplay,
  filter,
  tap,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import gsap from 'gsap';
import { APP_CONFIG } from '../constants';

export interface ScrollState {
  position: number;
  section: number;
  isSnapping: boolean;
  direction: 'up' | 'down' | null;
  progress: number; // 0–1 within current section
}

/**
 * Manages scroll behavior, snapping, and scroll state.
 * SSR-safe (guards all DOM access behind isPlatformBrowser).
 */
@Injectable({
  providedIn: 'root',
})
export class ScrollService {
  // ── DI ──────────────────────────────────────────────────────────────
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  // ── Internal state ───────────────────────────────────────────────────
  private readonly _state$ = new BehaviorSubject<ScrollState>({
    position: 0,
    section: 0,
    isSnapping: false,
    direction: null,
    progress: 0,
  });

  private readonly _sectionChange$ = new Subject<number>();

  // ── Public observables ───────────────────────────────────────────────
  /** Full scroll state snapshot */
  readonly state$: Observable<ScrollState> =
    this._state$.asObservable().pipe(shareReplay(1));

  /** Fires only when the active section index changes */
  readonly sectionChange$: Observable<number> =
    this._sectionChange$.asObservable().pipe(
      distinctUntilChanged(),
      shareReplay(1),
    );

  /** Convenience: scroll position in pixels */
  readonly scrollPosition$: Observable<number> = this._state$.pipe(
    map(s => s.position),
    distinctUntilChanged(),
  );

  /** Convenience: current section index */
  readonly currentSection$: Observable<number> = this._state$.pipe(
    map(s => s.section),
    distinctUntilChanged(),
  );

  /** Convenience: whether a snap animation is in progress */
  readonly isSnapping$: Observable<boolean> = this._state$.pipe(
    map(s => s.isSnapping),
    distinctUntilChanged(),
  );

  // ── Private fields ───────────────────────────────────────────────────
  private scrollElement: HTMLElement | null = null;
  private snapTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private activeGsapTween: gsap.core.Tween | null = null;
  private blockScrollEventsUntil = 0; // timestamp until which to block scroll events
  private wheelEventHandler: ((e: WheelEvent) => void) | null = null;
  // ────────────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────────────

  /**
   * Attach the service to a scrollable element.
   * Safe to call multiple times; re-registers only when the element changes.
   */
  initializeScroll(element: HTMLElement): void {
    if (!this.isBrowser || this.scrollElement === element) return;
    this.scrollElement = element;
    this.setupScrollListener();
  }

  /** Snapshot of the current section index (synchronous). */
  getCurrentSection(): number {
    return this._state$.value.section;
  }

  /** Snapshot of the full state (synchronous). */
  getState(): ScrollState {
    return this._state$.value;
  }

  /**
   * Imperatively set the active section without triggering a scroll animation.
   * Useful when the section changes via means other than scrolling (e.g. routing).
   */
  setCurrentSection(index: number): void {
    this.patchState({ section: index });
    this._sectionChange$.next(index);
  }

  /**
   * Animate-scroll to a section.
   * Kills any in-flight animation before starting a new one.
   */
  snapToSection(sectionIndex: number, sectionHeight: number): void {
    if (!this.scrollElement) return;

    this.killActiveSnap();
    this.patchState({ isSnapping: true });
    
    // Block scroll events for the full duration of the snap animation
    // Add 100ms buffer for debounce and event processing
    const snapDuration = 1; // duration in seconds
    this.blockScrollEventsUntil = performance.now() + (snapDuration * 1000) + 200;
    
    // Attach wheel event handler to prevent interruption during snap
    this.attachWheelBlocker();

    this.activeGsapTween = gsap.to(this.scrollElement, {
      scrollTop: sectionIndex * sectionHeight,
      duration: snapDuration,
      ease: 'power2.out',
      overwrite: 'auto',
      onComplete: () => {
        this.patchState({ isSnapping: false });
        this.activeGsapTween = null;
        this.blockScrollEventsUntil = 0;
        this.detachWheelBlocker();
      },
      onInterrupt: () => {
        // If animation is interrupted (user scrolls), also reset block
        this.blockScrollEventsUntil = 0;
        this.detachWheelBlocker();
      }
    });
  }

  /**
   * Attach wheel event blocker during snap animations.
   * This prevents user scroll wheel from interfering with the animation.
   */
  private attachWheelBlocker(): void {
    if (!this.isBrowser || !this.scrollElement) return;
    
    if (!this.wheelEventHandler) {
      this.wheelEventHandler = (e: WheelEvent) => {
        // Only block if still snapping
        if (this._state$.value.isSnapping) {
          e.preventDefault();
        }
      };
    }

    this.scrollElement.addEventListener('wheel', this.wheelEventHandler, {
      passive: false // Must be non-passive to allow preventDefault
    });
  }

  /**
   * Remove wheel event blocker after snap animation completes.
   */
  private detachWheelBlocker(): void {
    if (!this.isBrowser || !this.scrollElement || !this.wheelEventHandler) return;

    this.scrollElement.removeEventListener('wheel', this.wheelEventHandler);
  }

  // ────────────────────────────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────────────────────────────

  private setupScrollListener(): void {
    const el = this.scrollElement!;

    fromEvent(el, 'scroll', { passive: true })
      .pipe(
        filter(() => {
          // Block scroll processing during GSAP animation
          const now = performance.now();
          return now >= this.blockScrollEventsUntil;
        }),
        tap(() => this.onScrollRaw(el)),
        // Removed debounce - snap happens immediately in onScrollRaw()
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /**
   * Called on every raw scroll event (before debounce) to keep state reactive.
   */
  private onScrollRaw(el: HTMLElement): void {
    const previous = this._state$.value;
    const position = el.scrollTop;
    const height = el.clientHeight || 1;
    const section = Math.round(position / height);
    const progress = (position % height) / height;
    const direction =
      position > previous.position ? 'down' :
        position < previous.position ? 'up' : previous.direction;

    this.patchState({ position, section, direction, progress });

    // If section changed, snap immediately to the new section
    if (section !== previous.section && !this._state$.value.isSnapping) {
      this.clearSnapTimeout();
      this.snapToSection(section, height);
      this._sectionChange$.next(section);
    }
  }

  private scheduleSnap(sectionHeight: number): void {
    this.clearSnapTimeout();

    this.snapTimeoutId = setTimeout(() => {
      if (!this.scrollElement || this._state$.value.isSnapping) return;
      const index = Math.round(this.scrollElement.scrollTop / sectionHeight);
      this.snapToSection(index, sectionHeight);
    }, APP_CONFIG.SCROLL_SNAP_DELAY);
  }

  private clearSnapTimeout(): void {
    if (this.snapTimeoutId !== null) {
      clearTimeout(this.snapTimeoutId);
      this.snapTimeoutId = null;
    }
  }

  private killActiveSnap(): void {
    if (this.activeGsapTween) {
      this.activeGsapTween.kill();
      this.activeGsapTween = null;
    }
  }

  /** Immutable-style partial update. */
  private patchState(partial: Partial<ScrollState>): void {
    this._state$.next({ ...this._state$.value, ...partial });
  }

  ngOnDestroy(): void {
    this.clearSnapTimeout();
    this.killActiveSnap();
    this.detachWheelBlocker();
    this.scrollElement = null;
  }
}