// services/scene-two-animations.service.ts
import { Injectable } from '@angular/core';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import * as THREE from 'three';

gsap.registerPlugin(ScrollTrigger);

export interface AnimationTargets {
  overlayText: HTMLDivElement;
  title: HTMLHeadingElement;
  subtitle: HTMLParagraphElement;
  quote: HTMLElement;
  scrollIndicator: HTMLDivElement;
  canvasContainer: HTMLDivElement;
  camera: THREE.PerspectiveCamera;
  senateGroup: THREE.Group;
}

@Injectable({ providedIn: 'root' })
export class SceneTwoAnimations {
  private targets!: AnimationTargets;
  private masterTl!: gsap.core.Timeline;
  private scrollTl!: gsap.core.Timeline;

  // ── Init ──────────────────────────────────────────────────────────────────
  init(targets: AnimationTargets): void {
    this.targets = targets;

    // Reset initial states
    gsap.set(targets.overlayText, { opacity: 0 });
    gsap.set(targets.subtitle, { opacity: 0, y: 20 });
    gsap.set(targets.quote, { opacity: 0, x: -30 });
    gsap.set(targets.scrollIndicator, { opacity: 0, y: 10 });

    // Get title lines
    const titleLines = targets.title.querySelectorAll('.title-line');
    gsap.set(titleLines, { opacity: 0, y: 40 });
  }

  // ── Master Intro Sequence ─────────────────────────────────────────────────
  // Phase 1: Camera zooms from high down toward senate floor (Three.js object)
  // Phase 2: Fade-in dramatic with text appearing
  // Phase 3: Scroll-trigger — camera continues gliding as user scrolls
  playIntroSequence(): void {
    const { camera, senateGroup, overlayText, title, subtitle, quote, scrollIndicator } =
      this.targets;

    const titleLines = title.querySelectorAll('.title-line');

    // ── Phase 1: Camera zoom-in (0s → 3.5s) ─────────────────────────────────
    const camProxy = {
      posY: camera.position.y,
      posZ: camera.position.z,
      fov: camera.fov,
    };

    this.masterTl = gsap.timeline();

    // Camera sweeps from high overhead down to dramatic angle
    this.masterTl
      .to(
        camProxy,
        {
          posY: 22,
          posZ: 45,
          fov: 48,
          duration: 3.5,
          ease: 'power3.inOut',
          onUpdate: () => {
            camera.position.y = camProxy.posY;
            camera.position.z = camProxy.posZ;
            camera.fov = camProxy.fov;
            camera.updateProjectionMatrix();
            camera.lookAt(0, 0, 0);
          },
        },
        0
      )

      // Senate group fades in from darkness
      .fromTo(
        senateGroup,
        { visible: true },
        {
          duration: 2.5,
          ease: 'power2.inOut',
          onStart: () => {
            // Fade material opacity of senate children
            senateGroup.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                const mats = Array.isArray(mesh.material)
                  ? mesh.material
                  : [mesh.material];
                mats.forEach((m: THREE.Material) => {
                  m.transparent = true;
                  (m as any).opacity = 0;
                });
              }
            });
          },
          onUpdate: function () {
            const p = this['progress']();
            senateGroup.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                const mats = Array.isArray(mesh.material)
                  ? mesh.material
                  : [mesh.material];
                mats.forEach((m: THREE.Material) => {
                  (m as any).opacity = p;
                });
              }
            });
          },
        },
        0.3
      )

      // ── Phase 2: Text fade-in (3s →) ──────────────────────────────────────

      // Overlay wrapper fades in
      .to(overlayText, { opacity: 1, duration: 0.8, ease: 'power2.out' }, 2.8)

      // Title lines stagger up
      .to(
        titleLines,
        {
          opacity: 1,
          y: 0,
          duration: 1.0,
          ease: 'power3.out',
          stagger: 0.2,
        },
        3.0
      )

      // Subtitle fades in
      .to(
        subtitle,
        { opacity: 1, y: 0, duration: 1.0, ease: 'power2.out' },
        3.7
      )

      // Quote slides in from left
      .to(
        quote,
        { opacity: 1, x: 0, duration: 1.0, ease: 'power2.out' },
        4.4
      )

      // Scroll indicator pulses in
      .to(
        scrollIndicator,
        { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' },
        5.2
      );

    // ── Phase 3: Scroll-trigger camera glide ─────────────────────────────────
    this.masterTl.call(() => this.setupScrollTrigger(), [], 5.0);
  }

  // ── Scroll Trigger: camera glides deeper as user scrolls ─────────────────
  private setupScrollTrigger(): void {
    const { camera, canvasContainer } = this.targets;
    const scroller = canvasContainer.closest('.scroll-container') as HTMLElement | null;

    const camProxy = {
      posY: camera.position.y,
      posZ: camera.position.z,
      lookY: 0,
    };

    this.scrollTl = gsap.timeline({
      scrollTrigger: {
        trigger: canvasContainer,
        scroller: scroller ?? undefined,
        start: 'top top',
        end: 'bottom top',
        scrub: 0.5,
        invalidateOnRefresh: true,
      },
    });

    // Camera descends and pushes forward — feeling of entering the chamber
    this.scrollTl.to(camProxy, {
      posY: 8,
      posZ: 22,
      lookY: -4,
      ease: 'none',
      onUpdate: () => {
        camera.position.y = camProxy.posY;
        camera.position.z = camProxy.posZ;
        camera.updateProjectionMatrix();
        camera.lookAt(0, camProxy.lookY, 0);
      },
    });
  }

  // ── Dispose ───────────────────────────────────────────────────────────────
  dispose(): void {
    this.masterTl?.kill();
    this.scrollTl?.scrollTrigger?.kill();
    this.scrollTl?.kill();
  }
}
