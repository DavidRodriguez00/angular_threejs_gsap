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
import { IScene }       from '../../core/services/scene-manager.service';

// ─────────────────────────────────────────────────────────────────────────────
//  Datos
// ─────────────────────────────────────────────────────────────────────────────

interface VpDef {
  domId:        string;
  modelPath:    string;
  accentHex:    number;
  cssAccent:    string;
  cssAccentRgb: string;
  phase:        string;
  era:          string;
  name:         string;
  year:         string;
  specs:        string[];
}

const VP_DEFS: VpDef[] = [
  {
    domId:        'clone-vp-0',
    modelPath:    '/assets/models/clone1.glb',
    accentHex:    0xddd8cc,
    cssAccent:    'rgb(221,216,204)',
    cssAccentRgb: '221 216 204',
    phase:        'PHASE I · CLASSIFIED',
    era:          'CLONE WARS ERA',
    name:         'Phase I Clone Trooper',
    year:         '22 BBY — Battle of Geonosis',
    specs: [
      'Mandalorian-derived armour design',
      'DC-15A Blaster Rifle',
      'ARC-170 Starfighter compatible',
      'Full environmental seal',
    ],
  },
  {
    domId:        'clone-vp-1',
    modelPath:    '/assets/models/clone2.glb',
    accentHex:    0x00aaff,
    cssAccent:    'rgb(0,170,255)',
    cssAccentRgb: '0 170 255',
    phase:        'PHASE II · CLASSIFIED',
    era:          'CLONE WARS ERA',
    name:         'Phase II Clone Trooper',
    year:         '20 BBY — Siege of Mandalore',
    specs: [
      'Enhanced joint mobility system',
      'Modular attachment interface',
      'Improved HUD & comms array',
      'Corps colour identification',
    ],
  },
  {
    domId:        'clone-vp-2',
    modelPath:    '/assets/models/trooper1.glb',
    accentHex:    0xff4422,
    cssAccent:    'rgb(255,68,34)',
    cssAccentRgb: '255 68 34',
    phase:        'IMPERIAL · CLASSIFIED',
    era:          'GALACTIC EMPIRE',
    name:         'Imperial Stormtrooper',
    year:         '19 BBY — 4 ABY',
    specs: [
      'Mass-production standardized design',
      'E-11 BlasTech Blaster Rifle',
      'Non-clone volunteer recruitment',
      'Galaxy-wide Imperial deployment',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Componente
// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector:        'app-scene-three',
  templateUrl:     './scene-three.html',
  styleUrls:       ['./scene-three.css'],
  standalone:      true,
  imports:         [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneThreeComponent implements AfterViewInit, OnDestroy, IScene {

  // ── IScene ───────────────────────────────────────────────────────────────

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
        if (this.frame) { cancelAnimationFrame(this.frame); this.frame = null; }
      });
    });
  }

  updateByProgress(_p: number): void { /* sin parallax global */ }

  // ── Template ─────────────────────────────────────────────────────────────

  readonly viewportDefs = VP_DEFS;
  activeIndex  = 0;
  loadedStates: boolean[] = VP_DEFS.map(() => false);

  next(): void { if (this.activeIndex < VP_DEFS.length - 1) this._slideTo(this.activeIndex + 1); }
  prev(): void { if (this.activeIndex > 0)                  this._slideTo(this.activeIndex - 1); }
  goTo(i: number): void { this._slideTo(i); }

  // ── Refs ─────────────────────────────────────────────────────────────────

  readonly canvasRef     = viewChild.required<ElementRef<HTMLCanvasElement>>('clonesCanvas');
  readonly slidesTrack   = viewChild.required<ElementRef<HTMLElement>>('slidesTrack');

  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone       = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostRef    = inject(ElementRef);
  private readonly cdr        = inject(ChangeDetectorRef);

  // ── Engine / Loop ────────────────────────────────────────────────────────

  private engine!: ClonesEngine;
  private frame: number | null = null;
  private mouse       = new THREE.Vector2();
  private targetMouse = new THREE.Vector2();
  private resizeObserver!: ResizeObserver;

  private _hasPlayedIntro = false;
  private _transitioning  = false;
  private _slideSnapping  = false;
  private _disposed       = false;
  private _trackScrollSettleTimer: ReturnType<typeof setTimeout> | null = null;
  private _loadedPollId: ReturnType<typeof setInterval> | null = null;
  private _slidesTrackEl: HTMLElement | null = null;

  // ── Lifecycle ────────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.zone.runOutsideAngular(() => {
      this._init();
      this._listen();
      this.destroyRef.onDestroy(() => this._dispose());
    });
  }

  ngOnDestroy(): void { this._dispose(); }

  // ── Init ─────────────────────────────────────────────────────────────────

  private _init(): void {
    const canvas = this.canvasRef().nativeElement;
    this.engine = new ClonesEngine(
      canvas,
      VP_DEFS.map(d => ({ domId: d.domId, modelPath: d.modelPath, accentHex: d.accentHex }))
    );
    this._pollLoaded();
  }

  private _pollLoaded(): void {
    this._loadedPollId = setInterval(() => {
      let changed = false;
      this.engine.viewports.forEach((vp, i) => {
        if (!this.loadedStates[i] && vp.loaded) { this.loadedStates[i] = true; changed = true; }
      });
      if (changed) this.zone.run(() => this.cdr.markForCheck());
      if (this.loadedStates.every(Boolean) && this._loadedPollId) {
        clearInterval(this._loadedPollId);
        this._loadedPollId = null;
      }
    }, 250);
  }

  // ── Listeners ────────────────────────────────────────────────────────────

  private _listen(): void {
    this._slidesTrackEl = this.slidesTrack().nativeElement;

    // Resize
    this.resizeObserver = new ResizeObserver(() => {
      this.engine.onResize();
      this._syncTrackToIndex();
    });
    this.resizeObserver.observe(this.hostRef.nativeElement);

    // Mouse parallax
    window.addEventListener('mousemove', this._onMouse);

    // Rueda del ratón → navega entre slides (sin bloquear los bordes)
    this.hostRef.nativeElement.addEventListener('wheel', this._onWheel, { passive: false });

    // Scroll-snap nativo (drag/touch)
    this._slidesTrackEl.addEventListener('scroll', this._onTrackScroll, { passive: true });

    // Teclado
    window.addEventListener('keydown', this._onKey);

    this._syncTrackToIndex();
  }

  private _onMouse = (e: MouseEvent): void => {
    this.targetMouse.x =  (e.clientX / window.innerWidth  - .5) * 2;
    this.targetMouse.y = -(e.clientY / window.innerHeight - .5) * 1.2;
  };

  private _onWheel = (e: WheelEvent): void => {
    if (this._slideSnapping) return;
    if (e.deltaY > 30 && this.activeIndex < VP_DEFS.length - 1) {
      e.preventDefault();
      this.zone.run(() => this.next());
      return;
    }
    if (e.deltaY < -30 && this.activeIndex > 0) {
      e.preventDefault();
      this.zone.run(() => this.prev());
    }
  };

  private _onKey = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowRight') this.zone.run(() => this.next());
    if (e.key === 'ArrowLeft')  this.zone.run(() => this.prev());
  };

  private _onTrackScroll = (): void => {
    if (this._slideSnapping || !this._slidesTrackEl) return;

    if (this._trackScrollSettleTimer) clearTimeout(this._trackScrollSettleTimer);

    this._trackScrollSettleTimer = setTimeout(() => {
      this._trackScrollSettleTimer = null;
      if (!this._slidesTrackEl) return;
      const width = this._slidesTrackEl.clientWidth || window.innerWidth;
      if (!width) return;
      const index = this._clampIndex(Math.round(this._slidesTrackEl.scrollLeft / width));
      if (index !== this.activeIndex) {
        this._animateModelOut(this.activeIndex);
        this._pulseExposure();
      }
      this._commitSlideChange(index);
    }, 110);
  };

  // ── Render loop ───────────────────────────────────────────────────────────

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
    this.mouse.x += (this.targetMouse.x - this.mouse.x) * .05;
    this.mouse.y += (this.targetMouse.y - this.mouse.y) * .05;
  }

  private _parallax(): void {
    // Solo mueve la cámara del slide activo
    const vp  = this.engine.viewports[this.activeIndex];
    if (!vp) return;
    const cam = vp.camera;
    const tx  = this.mouse.x * .3;
    const ty  = this.mouse.y * .18 + 1.5;
    cam.position.x += (tx - cam.position.x) * .04;
    cam.position.y += (ty - cam.position.y) * .04;
    cam.lookAt(0, 1.1, 0);
  }

  // ── Slide snap con GSAP ───────────────────────────────────────────────────

  private _slideTo(index: number): void {
    if (index === this.activeIndex || this._slideSnapping) return;
    const track = this._slidesTrackEl;
    if (!track) return;
    this._slideSnapping = true;
    const width = track.clientWidth || window.innerWidth;
    const targetX = width * index;

    this._animateModelOut(this.activeIndex);
    this._pulseExposure();

    gsap.killTweensOf(track);
    gsap.to(track, {
      scrollLeft: targetX,
      duration: .75,
      ease: 'power3.inOut',
      onComplete: () => {
        this._slideSnapping = false;
        this._commitSlideChange(index);
      },
    });
  }

  private _commitSlideChange(index: number): void {
    const nextIndex = this._clampIndex(index);
    if (nextIndex === this.activeIndex) return;
    this.activeIndex = nextIndex;
    this._animateModelIn(nextIndex);
    this.zone.run(() => this.cdr.markForCheck());
  }

  private _animateModelOut(index: number): void {
    const vp = this.engine.viewports[index];
    if (!vp) return;
    gsap.killTweensOf(vp.modelGroup.position);
    gsap.killTweensOf(vp.modelGroup.scale);
    gsap.to(vp.modelGroup.position, { z: -1.5, duration: .4, ease: 'power2.in' });
    gsap.to(vp.modelGroup.scale,    { x: .85, y: .85, z: .85, duration: .35, ease: 'power2.in' });
  }

  private _animateModelIn(index: number): void {
    const vp = this.engine.viewports[index];
    if (!vp) return;
    gsap.killTweensOf(vp.modelGroup.position);
    gsap.killTweensOf(vp.modelGroup.scale);
    vp.modelGroup.position.z = -1.5;
    vp.modelGroup.scale.set(.85, .85, .85);
    gsap.to(vp.modelGroup.position, { z: 0, duration: .6, ease: 'power3.out' });
    gsap.to(vp.modelGroup.scale,    { x: 1, y: 1, z: 1, duration: .6, ease: 'back.out(1.4)' });
  }

  private _pulseExposure(): void {
    gsap.killTweensOf(this.engine.renderer);
    gsap.to(this.engine.renderer, {
      toneMappingExposure: 2.2,
      duration: .3,
      ease: 'power2.out',
    });
    gsap.to(this.engine.renderer, {
      toneMappingExposure: 1.6,
      duration: .6,
      ease: 'power2.in',
      delay: .3,
    });
  }

  private _syncTrackToIndex(): void {
    if (!this._slidesTrackEl) return;
    const width = this._slidesTrackEl.clientWidth || window.innerWidth;
    this._slidesTrackEl.scrollLeft = width * this.activeIndex;
  }

  private _clampIndex(index: number): number {
    return Math.max(0, Math.min(VP_DEFS.length - 1, index));
  }

  // ── Transiciones IScene ───────────────────────────────────────────────────

  private _playIntro(): void {
    const el = this.hostRef.nativeElement;
    gsap.killTweensOf(el);
    this.engine.setExposure(0);

    gsap.to(el, { opacity: 1, duration: .5, ease: 'power2.out' });

    const p = { v: 0 };
    gsap.to(p, {
      v: 1.6, duration: 2.0, ease: 'power2.inOut',
      onUpdate: () => this.engine.setExposure(p.v),
    });

    // Modelo entra desde lejos
    const vp = this.engine.viewports[0];
    if (vp) {
      vp.modelGroup.position.z = -4;
      vp.modelGroup.scale.set(.6, .6, .6);
      gsap.to(vp.modelGroup.position, { z: 0, duration: 1.8, ease: 'expo.out', delay: .3 });
      gsap.to(vp.modelGroup.scale, { x: 1, y: 1, z: 1, duration: 1.6, ease: 'back.out(1.2)', delay: .4 });
    }
  }

  private _playEnter(): void {
    if (this._transitioning) return;
    this._transitioning = true;

    const el = this.hostRef.nativeElement;
    const tl = gsap.timeline({ onComplete: () => { this._transitioning = false; } });

    tl.to(el, { opacity: 1, duration: .45, ease: 'power2.out' }, 0);

    const p = { v: this.engine.renderer.toneMappingExposure };
    tl.to(p, {
      v: 1.6, duration: .9, ease: 'power2.out',
      onUpdate: () => this.engine.setExposure(p.v),
    }, 0);
  }

  private _playExit(onComplete?: () => void): void {
    if (this._transitioning) { onComplete?.(); return; }
    this._transitioning = true;

    const el = this.hostRef.nativeElement;
    const tl = gsap.timeline({
      onComplete: () => { this._transitioning = false; onComplete?.(); },
    });

    const p = { v: this.engine.renderer.toneMappingExposure };
    tl.to(p, {
      v: 0, duration: .5, ease: 'power2.in',
      onUpdate: () => this.engine.setExposure(p.v),
    }, 0);
    tl.to(el, { opacity: 0, duration: .6, ease: 'power2.in' }, .05);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  private _dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    if (this._loadedPollId) clearInterval(this._loadedPollId);
    if (this._trackScrollSettleTimer) clearTimeout(this._trackScrollSettleTimer);
    if (this._slidesTrackEl) {
      this._slidesTrackEl.removeEventListener('scroll', this._onTrackScroll);
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
    window.removeEventListener('keydown',   this._onKey);
    this.hostRef.nativeElement.removeEventListener('wheel',      this._onWheel);
    this.resizeObserver?.disconnect();
    this.engine?.dispose();
  }
}
