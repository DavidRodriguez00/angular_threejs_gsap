import {
  Component, ElementRef, AfterViewInit, OnDestroy,
  inject, PLATFORM_ID, viewChild, NgZone, DestroyRef,
  ChangeDetectionStrategy, signal, computed,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

import { VP_DEFS } from './builders/scene-three.data';
import { ClonesEngine } from './services/scene-three.engine';
import { SlideTransitions } from './services/scene-three.animations';
import { WheelHandler } from './builders/scene-three.wheel';
import { IScene } from '../../core/services/scene-manager.service';

@Component({
  selector: 'app-scene-three',
  templateUrl: './scene-three.html',
  styleUrls: ['./scene-three.css'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneThreeComponent implements AfterViewInit, OnDestroy, IScene {

  // ── Template ───────────────────────────────────────────────────────────────

  readonly defs = VP_DEFS;
  readonly activeIndex = signal(0);
  readonly loaded = signal<boolean[]>(VP_DEFS.map(() => false));
  readonly activeName = computed(() => VP_DEFS[this.activeIndex()]?.name ?? '');

  readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('clonesCanvas');
  readonly trackRef = viewChild.required<ElementRef<HTMLElement>>('slidesTrack');

  // ── DI ─────────────────────────────────────────────────────────────────────

  private readonly zone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostEl = inject(ElementRef<HTMLElement>);

  // ── State ──────────────────────────────────────────────────────────────────

  private engine!: ClonesEngine;
  private transitions!: SlideTransitions;
  private wheel!: WheelHandler;
  private resizeObs!: ResizeObserver;

  private frame: number | null = null;
  private pollId: ReturnType<typeof setInterval> | null = null;
  private trackEl: HTMLElement | null = null;

  private snapping = false;
  private transitioning = false;
  private introPlayed = false;
  private disposed = false;

  private mouse = { x: 0, y: 0 };
  private mTarget = { x: 0, y: 0 };

  // ── IScene ─────────────────────────────────────────────────────────────────

  show(): void {
    this.zone.runOutsideAngular(() => {
      this.transitions.syncTrack(this.activeIndex());
      this._applyAccent(this.activeIndex());
      if (!this.frame) this._startLoop();

      if (!this.introPlayed) {
        this.introPlayed = true;
        this.transitions.intro(this.activeIndex(), i => this._uiIn(i));
      } else {
        if (this.transitioning) return;
        this.transitioning = true;
        this.transitions.enter(
          this.activeIndex(),
          i => this._uiIn(i),
          () => { this.transitioning = false; },
        );
      }
    });
  }

  hide(): void {
    this.zone.runOutsideAngular(() => {
      if (this.transitioning) return;
      this.transitioning = true;
      this.wheel.reset();
      this.transitions.exit(() => {
        this.transitioning = false;
        if (this.frame !== null) { cancelAnimationFrame(this.frame); this.frame = null; }
      });
    });
  }

  updateByProgress(_p: number): void { }

  // ── Navigation ─────────────────────────────────────────────────────────────

  next(): void { this._slideTo(this.activeIndex() + 1); }
  prev(): void { this._slideTo(this.activeIndex() - 1); }
  goTo(i: number): void { this._slideTo(i); }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.zone.runOutsideAngular(() => {
      this._init();
      this.destroyRef.onDestroy(() => this._dispose());
    });
  }

  ngOnDestroy(): void { this._dispose(); }

  // ── Init ───────────────────────────────────────────────────────────────────

  private _init(): void {
    this.trackEl = this.trackRef().nativeElement;

    this.engine = new ClonesEngine(
      this.canvasRef().nativeElement,
      VP_DEFS.map(({ domId, modelPath, accentHex }) => ({ domId, modelPath, accentHex })),
    );

    this.transitions = new SlideTransitions(
      this.engine,
      () => this.trackEl,
      this.hostEl.nativeElement,
    );

    this.wheel = new WheelHandler(
      () => this.zone.run(() => this.next()),
      () => this.zone.run(() => this.prev()),
    );

    this._pollLoaded();
    this._bindEvents();
    this._applyAccent(this.activeIndex());
    this._uiIn(this.activeIndex(), true);
  }

  private _pollLoaded(): void {
    this.pollId = setInterval(() => {
      const next = [...this.loaded()];
      let changed = false;
      this.engine.viewports.forEach((vp, i) => {
        if (!next[i] && vp.loaded) { next[i] = true; changed = true; }
      });
      if (changed) this.zone.run(() => this.loaded.set(next));
      if (next.every(Boolean)) { clearInterval(this.pollId!); this.pollId = null; }
    }, 250);
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  private _bindEvents(): void {
    this.resizeObs = new ResizeObserver(() => {
      this.engine.onResize();
      this.transitions.syncTrack(this.activeIndex());
    });
    this.resizeObs.observe(this.hostEl.nativeElement);

    window.addEventListener('mousemove', this._onMouse);
    window.addEventListener('keydown', this._onKey);
    this.hostEl.nativeElement.addEventListener('wheel', this._onWheel, { passive: false });
  }

  private readonly _onMouse = (e: MouseEvent): void => {
    this.mTarget.x = (e.clientX / window.innerWidth - 0.5) * 2;
    this.mTarget.y = -(e.clientY / window.innerHeight - 0.5) * 1.2;
  };

  private readonly _onWheel = (e: WheelEvent): void => {
    if (this.frame === null) return;
    if (this.snapping) { e.preventDefault(); e.stopPropagation(); return; }
    const idx = this.activeIndex();
    this.wheel.handle(e, idx < VP_DEFS.length - 1, idx > 0);
  };

  private readonly _onKey = (e: KeyboardEvent): void => {
    if (this.frame === null || this.snapping) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); this.zone.run(() => this.next()); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); this.zone.run(() => this.prev()); }
  };

  // ── Render loop ────────────────────────────────────────────────────────────

  private _startLoop(): void {
    const tick = (): void => {
      this.frame = requestAnimationFrame(tick);
      this.mouse.x += (this.mTarget.x - this.mouse.x) * 0.05;
      this.mouse.y += (this.mTarget.y - this.mouse.y) * 0.05;
      this._parallax();
      this.engine.update();
      this.engine.renderSlide(VP_DEFS[this.activeIndex()].domId);
    };
    tick();
  }

  private _parallax(): void {
    const vp = this.engine.viewports[this.activeIndex()];
    if (!vp) return;
    const { camera: cam } = vp;
    cam.position.x += (this.mouse.x * 0.32 - cam.position.x) * 0.04;
    cam.position.y += (this.mouse.y * 0.20 + 1.5 - cam.position.y) * 0.04;
    cam.lookAt(0, 1.1, 0);
  }

  // ── Slide logic ────────────────────────────────────────────────────────────

  private _slideTo(index: number): void {
    const next = this._clamp(index);
    const curr = this.activeIndex();
    if (next === curr || this.snapping) return;

    this.snapping = true;
    const currSlide = this._getSlide(curr);
    if (currSlide) this.transitions.uiOut(currSlide);
    this.transitions.modelOut(curr);
    this.transitions.pulseExposure();

    this.transitions.slideTo(
      next,
      () => this._applyAccent(next),
      () => {
        this.snapping = false;
        this.zone.run(() => this.activeIndex.set(next));
        this.transitions.modelIn(next);
        const nextSlide = this._getSlide(next);
        if (nextSlide) this.transitions.uiIn(nextSlide);
      },
    );
  }

  private _uiIn(index: number, immediate = false): void {
    const slide = this._getSlide(index);
    if (slide) this.transitions.uiIn(slide, immediate);
  }

  private _getSlide(i: number): HTMLElement | null {
    return (this.trackEl?.children.item(i) as HTMLElement) ?? null;
  }

  private _applyAccent(index: number): void {
    const { cssAccentRgb } = VP_DEFS[this._clamp(index)];
    this.hostEl.nativeElement.style.setProperty('--active-accent-rgb', cssAccentRgb);
  }

  private _clamp(i: number): number {
    return Math.max(0, Math.min(VP_DEFS.length - 1, i));
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  private _dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.frame !== null) cancelAnimationFrame(this.frame);
    if (this.pollId !== null) clearInterval(this.pollId);

    this.wheel?.reset();
    this.transitions?.killAll();
    this.engine?.dispose();
    this.resizeObs?.disconnect();

    window.removeEventListener('mousemove', this._onMouse);
    window.removeEventListener('keydown', this._onKey);
    this.hostEl.nativeElement.removeEventListener('wheel', this._onWheel);
  }
}