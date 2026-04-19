import {
  Component,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  inject,
  PLATFORM_ID,
  viewChild,
  NgZone,
  DestroyRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import * as THREE from 'three';
import gsap from 'gsap';

import { ClonesEngine } from './scene-three.engine';
import { IScene } from '../../core/services/scene-manager.service';

interface VpDef {
  domId: string;
  modelPath: string;
  accentHex: number;
  cssAccent: string;
  cssAccentRgb: string;
  phase: string;
  era: string;
  name: string;
  year: string;
  specs: string[];
}

const VP_DEFS: VpDef[] = [
  {
    domId: 'clone-vp-0',
    modelPath: '/assets/models/clone1.glb',
    accentHex: 0xddd8cc,
    cssAccent: 'rgb(221,216,204)',
    cssAccentRgb: '221 216 204',
    phase: 'PHASE I · CLASSIFIED',
    era: 'CLONE WARS ERA',
    name: 'Phase I Clone Trooper',
    year: '22 BBY — Battle of Geonosis',
    specs: [
      'Mandalorian-derived armour design',
      'DC-15A Blaster Rifle',
      'ARC-170 Starfighter compatible',
      'Full environmental seal',
    ],
  },
  {
    domId: 'clone-vp-1',
    modelPath: '/assets/models/clone2.glb',
    accentHex: 0x00aaff,
    cssAccent: 'rgb(0,170,255)',
    cssAccentRgb: '0 170 255',
    phase: 'PHASE II · CLASSIFIED',
    era: 'CLONE WARS ERA',
    name: 'Phase II Clone Trooper',
    year: '20 BBY — Siege of Mandalore',
    specs: [
      'Enhanced joint mobility system',
      'Modular attachment interface',
      'Improved HUD & comms array',
      'Corps colour identification',
    ],
  },
  {
    domId: 'clone-vp-2',
    modelPath: '/assets/models/trooper1.glb',
    accentHex: 0xff4422,
    cssAccent: 'rgb(255,68,34)',
    cssAccentRgb: '255 68 34',
    phase: 'IMPERIAL · CLASSIFIED',
    era: 'GALACTIC EMPIRE',
    name: 'Imperial Stormtrooper',
    year: '19 BBY — 4 ABY',
    specs: [
      'Mass-production standardized design',
      'E-11 BlasTech Blaster Rifle',
      'Non-clone volunteer recruitment',
      'Galaxy-wide Imperial deployment',
    ],
  },
];

const WHEEL_TRIGGER = 84;
const WHEEL_RESET_MS = 180;
const WHEEL_COOLDOWN_MS = 620;

@Component({
  selector: 'app-scene-three',
  templateUrl: './scene-three.html',
  styleUrls: ['./scene-three.css'],
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneThreeComponent implements AfterViewInit, OnDestroy, IScene {
  readonly viewportDefs = VP_DEFS;

  activeIndex = 0;
  loadedStates: boolean[] = VP_DEFS.map(() => false);

  readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('clonesCanvas');
  readonly slidesTrack = viewChild.required<ElementRef<HTMLElement>>('slidesTrack');

  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);

  private engine!: ClonesEngine;
  private frame: number | null = null;
  private mouse = new THREE.Vector2();
  private targetMouse = new THREE.Vector2();
  private resizeObserver!: ResizeObserver;

  private _hasPlayedIntro = false;
  private _transitioning = false;
  private _slideSnapping = false;
  private _disposed = false;

  private _loadedPollId: ReturnType<typeof setInterval> | null = null;
  private _slidesTrackEl: HTMLElement | null = null;

  private _wheelAccumulator = 0;
  private _wheelResetTimer: ReturnType<typeof setTimeout> | null = null;
  private _wheelCooldownUntil = 0;

  show(): void {
    this.zone.runOutsideAngular(() => {
      this._syncTrackToIndex();
      if (!this.frame) this._startLoop();

      if (!this._hasPlayedIntro) {
        this._hasPlayedIntro = true;
        this._playIntro();
      } else {
        this._playEnter();
      }
    });
  }

  hide(): void {
    this.zone.runOutsideAngular(() => {
      this._playExit(() => {
        if (this.frame) {
          cancelAnimationFrame(this.frame);
          this.frame = null;
        }
      });
    });
  }

  updateByProgress(_p: number): void {
    // Esta escena maneja navegación interna por slides.
  }

  next(): void {
    if (this.activeIndex < VP_DEFS.length - 1) this._slideTo(this.activeIndex + 1);
  }

  prev(): void {
    if (this.activeIndex > 0) this._slideTo(this.activeIndex - 1);
  }

  goTo(i: number): void {
    this._slideTo(i);
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.zone.runOutsideAngular(() => {
      this._init();
      this._listen();
      this.destroyRef.onDestroy(() => this._dispose());
    });
  }

  ngOnDestroy(): void {
    this._dispose();
  }

  private _init(): void {
    const canvas = this.canvasRef().nativeElement;

    this.engine = new ClonesEngine(
      canvas,
      VP_DEFS.map(d => ({ domId: d.domId, modelPath: d.modelPath, accentHex: d.accentHex })),
    );

    this._pollLoaded();
    this._applyActiveAccent(this.activeIndex);
  }

  private _pollLoaded(): void {
    this._loadedPollId = setInterval(() => {
      let changed = false;

      this.engine.viewports.forEach((vp, i) => {
        if (!this.loadedStates[i] && vp.loaded) {
          this.loadedStates[i] = true;
          changed = true;
        }
      });

      if (changed) this.zone.run(() => this.cdr.markForCheck());

      if (this.loadedStates.every(Boolean) && this._loadedPollId) {
        clearInterval(this._loadedPollId);
        this._loadedPollId = null;
      }
    }, 250);
  }

  private _listen(): void {
    this._slidesTrackEl = this.slidesTrack().nativeElement;

    this.resizeObserver = new ResizeObserver(() => {
      this.engine.onResize();
      this._syncTrackToIndex();
    });

    this.resizeObserver.observe(this.hostRef.nativeElement);

    window.addEventListener('mousemove', this._onMouse);
    window.addEventListener('keydown', this._onKey);
    this.hostRef.nativeElement.addEventListener('wheel', this._onWheel, {
      passive: false,
    });

    this._syncTrackToIndex();
    this._animateUiIn(this.activeIndex, true);
  }

  private _onMouse = (e: MouseEvent): void => {
    this.targetMouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
    this.targetMouse.y = -(e.clientY / window.innerHeight - 0.5) * 1.2;
  };

  private _onWheel = (e: WheelEvent): void => {
    if (this.frame === null) return;

    const dominantDelta =
      Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;

    if (!dominantDelta) return;

    const direction = dominantDelta > 0 ? 1 : -1;
    const canMove = direction > 0
      ? this.activeIndex < VP_DEFS.length - 1
      : this.activeIndex > 0;

    if (this._slideSnapping) {
      if (canMove) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    if (!canMove) {
      this._resetWheelAccumulator();
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const now = performance.now();
    if (now < this._wheelCooldownUntil) return;

    this._wheelAccumulator += dominantDelta;
    this._armWheelReset();

    if (Math.abs(this._wheelAccumulator) < WHEEL_TRIGGER) return;

    const goNext = this._wheelAccumulator > 0;
    this._resetWheelAccumulator();
    this._wheelCooldownUntil = now + WHEEL_COOLDOWN_MS;

    this.zone.run(() => {
      if (goNext) this.next();
      else this.prev();
    });
  };

  private _onKey = (e: KeyboardEvent): void => {
    if (this.frame === null || this._slideSnapping) return;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.zone.run(() => this.next());
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.zone.run(() => this.prev());
    }
  };

  private _armWheelReset(): void {
    if (this._wheelResetTimer) clearTimeout(this._wheelResetTimer);

    this._wheelResetTimer = setTimeout(() => {
      this._wheelResetTimer = null;
      this._wheelAccumulator = 0;
    }, WHEEL_RESET_MS);
  }

  private _resetWheelAccumulator(): void {
    this._wheelAccumulator = 0;

    if (this._wheelResetTimer) {
      clearTimeout(this._wheelResetTimer);
      this._wheelResetTimer = null;
    }
  }

  private _startLoop(): void {
    const tick = (): void => {
      this.frame = requestAnimationFrame(tick);
      this._smoothMouse();
      this._parallax();
      this.engine.update();
      this.engine.renderSlide(VP_DEFS[this.activeIndex].domId);
    };

    tick();
  }

  private _smoothMouse(): void {
    this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.05;
    this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.05;
  }

  private _parallax(): void {
    const vp = this.engine.viewports[this.activeIndex];
    if (!vp) return;

    const cam = vp.camera;
    const tx = this.mouse.x * 0.32;
    const ty = this.mouse.y * 0.2 + 1.5;

    cam.position.x += (tx - cam.position.x) * 0.04;
    cam.position.y += (ty - cam.position.y) * 0.04;
    cam.lookAt(0, 1.1, 0);
  }

  private _slideTo(index: number): void {
    const nextIndex = this._clampIndex(index);

    if (nextIndex === this.activeIndex || this._slideSnapping) return;

    const track = this._slidesTrackEl;
    if (!track) return;

    this._slideSnapping = true;
    this._animateUiOut(this.activeIndex);
    this._animateModelOut(this.activeIndex);
    this._pulseExposure();

    gsap.killTweensOf(track);
    gsap.to(track, {
      xPercent: -100 * nextIndex,
      duration: 0.82,
      ease: 'power4.inOut',
      overwrite: 'auto',
      onStart: () => this._applyActiveAccent(nextIndex),
      onComplete: () => {
        this._slideSnapping = false;
        this._commitSlideChange(nextIndex);
      },
    });
  }

  private _commitSlideChange(index: number): void {
    const nextIndex = this._clampIndex(index);

    if (nextIndex === this.activeIndex) {
      this._animateUiIn(nextIndex);
      return;
    }

    this.activeIndex = nextIndex;
    this._animateModelIn(nextIndex);
    this._animateUiIn(nextIndex);

    this.zone.run(() => this.cdr.markForCheck());
  }

  private _animateUiOut(index: number): void {
    const slide = this._getSlide(index);
    if (!slide) return;

    const reveal = slide.querySelectorAll<HTMLElement>('.reveal');
    if (!reveal.length) return;

    gsap.killTweensOf(reveal);
    gsap.to(reveal, {
      opacity: 0,
      y: -14,
      duration: 0.2,
      stagger: 0.02,
      ease: 'power1.in',
      overwrite: 'auto',
    });
  }

  private _animateUiIn(index: number, immediate = false): void {
    const slide = this._getSlide(index);
    if (!slide) return;

    const reveal = slide.querySelectorAll<HTMLElement>('.reveal');
    if (!reveal.length) return;

    gsap.killTweensOf(reveal);

    if (immediate) {
      gsap.set(reveal, { opacity: 1, y: 0 });
      return;
    }

    gsap.fromTo(
      reveal,
      { opacity: 0, y: 22 },
      {
        opacity: 1,
        y: 0,
        duration: 0.58,
        stagger: 0.055,
        ease: 'power3.out',
        overwrite: 'auto',
      },
    );
  }

  private _getSlide(index: number): HTMLElement | null {
    if (!this._slidesTrackEl) return null;
    return this._slidesTrackEl.children.item(index) as HTMLElement | null;
  }

  private _animateModelOut(index: number): void {
    const vp = this.engine.viewports[index];
    if (!vp) return;

    gsap.killTweensOf(vp.modelGroup.position);
    gsap.killTweensOf(vp.modelGroup.scale);

    gsap.to(vp.modelGroup.position, {
      z: -1.5,
      duration: 0.4,
      ease: 'power2.in',
    });

    gsap.to(vp.modelGroup.scale, {
      x: 0.84,
      y: 0.84,
      z: 0.84,
      duration: 0.36,
      ease: 'power2.in',
    });
  }

  private _animateModelIn(index: number): void {
    const vp = this.engine.viewports[index];
    if (!vp) return;

    gsap.killTweensOf(vp.modelGroup.position);
    gsap.killTweensOf(vp.modelGroup.scale);

    vp.modelGroup.position.z = -1.6;
    vp.modelGroup.scale.set(0.84, 0.84, 0.84);

    gsap.to(vp.modelGroup.position, {
      z: 0,
      duration: 0.62,
      ease: 'power3.out',
    });

    gsap.to(vp.modelGroup.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 0.62,
      ease: 'back.out(1.3)',
    });
  }

  private _pulseExposure(): void {
    gsap.killTweensOf(this.engine.renderer);

    gsap.to(this.engine.renderer, {
      toneMappingExposure: 2.1,
      duration: 0.25,
      ease: 'power2.out',
    });

    gsap.to(this.engine.renderer, {
      toneMappingExposure: 1.6,
      duration: 0.62,
      delay: 0.22,
      ease: 'power2.in',
    });
  }

  private _syncTrackToIndex(): void {
    if (!this._slidesTrackEl) return;

    gsap.killTweensOf(this._slidesTrackEl);
    gsap.set(this._slidesTrackEl, { xPercent: -100 * this.activeIndex });

    this._applyActiveAccent(this.activeIndex);
  }

  private _applyActiveAccent(index: number): void {
    const vp = VP_DEFS[this._clampIndex(index)];
    this.hostRef.nativeElement.style.setProperty('--active-accent-rgb', vp.cssAccentRgb);
  }

  private _clampIndex(index: number): number {
    return Math.max(0, Math.min(VP_DEFS.length - 1, index));
  }

  private _playIntro(): void {
    const el = this.hostRef.nativeElement;

    gsap.killTweensOf(el);
    this.engine.setExposure(0);

    gsap.to(el, {
      opacity: 1,
      duration: 0.5,
      ease: 'power2.out',
    });

    const p = { v: 0 };
    gsap.to(p, {
      v: 1.6,
      duration: 2,
      ease: 'power2.inOut',
      onUpdate: () => this.engine.setExposure(p.v),
    });

    const vp = this.engine.viewports[this.activeIndex];
    if (vp) {
      vp.modelGroup.position.z = -4;
      vp.modelGroup.scale.set(0.62, 0.62, 0.62);

      gsap.to(vp.modelGroup.position, {
        z: 0,
        duration: 1.8,
        ease: 'expo.out',
        delay: 0.25,
      });

      gsap.to(vp.modelGroup.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 1.65,
        ease: 'back.out(1.2)',
        delay: 0.33,
      });
    }

    this._animateUiIn(this.activeIndex);
  }

  private _playEnter(): void {
    if (this._transitioning) return;
    this._transitioning = true;

    const el = this.hostRef.nativeElement;
    const tl = gsap.timeline({
      onComplete: () => {
        this._transitioning = false;
      },
    });

    tl.to(
      el,
      {
        opacity: 1,
        duration: 0.45,
        ease: 'power2.out',
      },
      0,
    );

    const p = { v: this.engine.renderer.toneMappingExposure };
    tl.to(
      p,
      {
        v: 1.6,
        duration: 0.9,
        ease: 'power2.out',
        onUpdate: () => this.engine.setExposure(p.v),
      },
      0,
    );

    this._animateUiIn(this.activeIndex);
  }

  private _playExit(onComplete?: () => void): void {
    if (this._transitioning) {
      onComplete?.();
      return;
    }

    this._transitioning = true;
    this._resetWheelAccumulator();

    const el = this.hostRef.nativeElement;
    const tl = gsap.timeline({
      onComplete: () => {
        this._transitioning = false;
        onComplete?.();
      },
    });

    const p = { v: this.engine.renderer.toneMappingExposure };
    tl.to(
      p,
      {
        v: 0,
        duration: 0.5,
        ease: 'power2.in',
        onUpdate: () => this.engine.setExposure(p.v),
      },
      0,
    );

    tl.to(
      el,
      {
        opacity: 0,
        duration: 0.6,
        ease: 'power2.in',
      },
      0.05,
    );
  }

  private _dispose(): void {
    if (this._disposed) return;
    this._disposed = true;

    if (this.frame) cancelAnimationFrame(this.frame);
    if (this._loadedPollId) clearInterval(this._loadedPollId);

    this._resetWheelAccumulator();

    if (this._slidesTrackEl) {
      gsap.killTweensOf(this._slidesTrackEl);
    }

    gsap.killTweensOf(this.hostRef.nativeElement);

    if (this.engine) {
      gsap.killTweensOf(this.engine.renderer);

      this.engine.viewports.forEach(vp => {
        gsap.killTweensOf(vp.modelGroup.position);
        gsap.killTweensOf(vp.modelGroup.scale);
      });
    }

    window.removeEventListener('mousemove', this._onMouse);
    window.removeEventListener('keydown', this._onKey);
    this.hostRef.nativeElement.removeEventListener('wheel', this._onWheel);

    this.resizeObserver?.disconnect();
    this.engine?.dispose();
  }
}
