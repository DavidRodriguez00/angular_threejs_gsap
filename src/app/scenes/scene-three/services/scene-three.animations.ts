import gsap from 'gsap';
import { ClonesEngine } from './scene-three.engine';

export class SlideTransitions {
  constructor(
    private readonly engine:    ClonesEngine,
    private readonly trackEl:   () => HTMLElement | null,
    private readonly hostEl:    HTMLElement,
  ) {}

  // ── Scene-level show/hide ────────────────────────────────────────────────

  intro(activeIndex: number, onUiIn: (i: number) => void): void {
    gsap.killTweensOf(this.hostEl);
    this.engine.setExposure(0);
    gsap.to(this.hostEl, { opacity: 1, duration: 0.5, ease: 'power2.out' });
    const p = { v: 0 };
    gsap.to(p, { v: 1.6, duration: 2, ease: 'power2.inOut', onUpdate: () => this.engine.setExposure(p.v) });

    const vp = this.engine.viewports[activeIndex];
    if (vp) {
      vp.modelGroup.position.z = -4;
      vp.modelGroup.scale.set(0.62, 0.62, 0.62);
      gsap.to(vp.modelGroup.position, { z: 0, duration: 1.8,  ease: 'expo.out',      delay: 0.25 });
      gsap.to(vp.modelGroup.scale,    { x: 1, y: 1, z: 1, duration: 1.65, ease: 'back.out(1.2)', delay: 0.33 });
    }
    onUiIn(activeIndex);
  }

  enter(activeIndex: number, onUiIn: (i: number) => void, onDone: () => void): void {
    const tl = gsap.timeline({ onComplete: onDone });
    tl.to(this.hostEl, { opacity: 1, duration: 0.45, ease: 'power2.out' }, 0);
    const p = { v: this.engine.renderer.toneMappingExposure };
    tl.to(p, { v: 1.6, duration: 0.9, ease: 'power2.out', onUpdate: () => this.engine.setExposure(p.v) }, 0);
    onUiIn(activeIndex);
  }

  exit(onDone: () => void): void {
    const tl = gsap.timeline({ onComplete: onDone });
    const p = { v: this.engine.renderer.toneMappingExposure };
    tl.to(p,           { v: 0, duration: 0.5, ease: 'power2.in', onUpdate: () => this.engine.setExposure(p.v) }, 0);
    tl.to(this.hostEl, { opacity: 0, duration: 0.6, ease: 'power2.in' }, 0.05);
  }

  // ── Slide navigation ─────────────────────────────────────────────────────

  slideTo(next: number, onStart: () => void, onDone: () => void): void {
    const track = this.trackEl();
    if (!track) return;
    gsap.killTweensOf(track);
    gsap.to(track, {
      xPercent: -100 * next,
      duration:  0.82,
      ease:      'power4.inOut',
      overwrite: 'auto',
      onStart:   onStart,
      onComplete: onDone,
    });
  }

  syncTrack(index: number): void {
    const track = this.trackEl();
    if (!track) return;
    gsap.killTweensOf(track);
    gsap.set(track, { xPercent: -100 * index });
  }

  pulseExposure(): void {
    gsap.killTweensOf(this.engine.renderer);
    gsap.to(this.engine.renderer, { toneMappingExposure: 2.1, duration: 0.25, ease: 'power2.out' });
    gsap.to(this.engine.renderer, { toneMappingExposure: 1.6, duration: 0.62, delay: 0.22, ease: 'power2.in' });
  }

  // ── UI (DOM) ─────────────────────────────────────────────────────────────

  uiOut(slide: HTMLElement): void {
    const els = slide.querySelectorAll<HTMLElement>('.reveal');
    if (!els.length) return;
    gsap.killTweensOf(els);
    gsap.to(els, { opacity: 0, y: -14, duration: 0.2, stagger: 0.02, ease: 'power1.in', overwrite: 'auto' });
  }

  uiIn(slide: HTMLElement, immediate = false): void {
    const els = slide.querySelectorAll<HTMLElement>('.reveal');
    if (!els.length) return;
    gsap.killTweensOf(els);
    if (immediate) { gsap.set(els, { opacity: 1, y: 0 }); return; }
    gsap.fromTo(els, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.58, stagger: 0.055, ease: 'power3.out', overwrite: 'auto' });
  }

  // ── 3-D model ────────────────────────────────────────────────────────────

  modelOut(index: number): void {
    const vp = this.engine.viewports[index];
    if (!vp) return;
    gsap.killTweensOf(vp.modelGroup.position);
    gsap.killTweensOf(vp.modelGroup.scale);
    gsap.to(vp.modelGroup.position, { z: -1.5, duration: 0.4,  ease: 'power2.in' });
    gsap.to(vp.modelGroup.scale,    { x: 0.84, y: 0.84, z: 0.84, duration: 0.36, ease: 'power2.in' });
  }

  modelIn(index: number): void {
    const vp = this.engine.viewports[index];
    if (!vp) return;
    vp.modelGroup.position.z = -1.6;
    vp.modelGroup.scale.set(0.84, 0.84, 0.84);
    gsap.killTweensOf(vp.modelGroup.position);
    gsap.killTweensOf(vp.modelGroup.scale);
    gsap.to(vp.modelGroup.position, { z: 0, duration: 0.62, ease: 'power3.out'     });
    gsap.to(vp.modelGroup.scale,    { x: 1, y: 1, z: 1, duration: 0.62, ease: 'back.out(1.3)' });
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  killAll(): void {
    gsap.killTweensOf(this.hostEl);
    gsap.killTweensOf(this.engine.renderer);
    const track = this.trackEl();
    if (track) gsap.killTweensOf(track);
    this.engine.viewports.forEach(vp => {
      gsap.killTweensOf(vp.modelGroup.position);
      gsap.killTweensOf(vp.modelGroup.scale);
    });
  }
}