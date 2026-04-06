import gsap from 'gsap';
import * as THREE from 'three';
import { SceneTwoThree } from './scene-two.three';

/**
 * GSAP animations for Scene Two — Imperial Command.
 * Entrance: Imperial march-style — cold, authoritative, mechanical.
 * Idle: The slow rotation of total domination.
 */
export class SceneTwoAnimations {
  private entranceTl: gsap.core.Timeline;
  private idleTl:     gsap.core.Timeline;
  private isIntroFinished = false;

  constructor(private three: SceneTwoThree) {
    this.entranceTl = gsap.timeline({
      paused: true,
      defaults: { duration: 1.8, ease: 'power3.out' }
    });

    this.idleTl = gsap.timeline({
      paused: true,
      repeat: -1,
      yoyo: true,
      defaults: { ease: 'sine.inOut', duration: 5 }
    });
  }

  init(): void {
    if (!this.three.star || !this.three.planets.length) {
      console.warn('SceneTwoAnimations: Three.js objects not initialized.');
      return;
    }
    this.buildEntrance();
    this.buildIdle();
  }

  // ── Entrance: Imperial Reveal ─────────────────────────────────────────────

  private buildEntrance(): void {
    const { camera, star, starGlow, starCorona, planets, orbitLines, deathStar } = this.three;

    // Initial state
    camera.position.set(0, 8, 14);
    camera.lookAt(0, 0, 0);

    star.scale.setScalar(0);
    if (starGlow)   (starGlow.material as THREE.SpriteMaterial).opacity   = 0;
    if (starCorona) (starCorona.material as THREE.SpriteMaterial).opacity = 0;

    deathStar.scale.setScalar(0);

    const orbitMats  = orbitLines.map(l => l.material as THREE.LineBasicMaterial);
    const planetScales = planets.map(p => p.mesh.scale);

    this.entranceTl
      // 1. Imperial star ignition — abrupt, powerful
      .to(star.scale, {
        x: 1, y: 1, z: 1,
        duration: 0.8,
        ease: 'back.out(3)'
      })

      // 2. Corona flare
      .to([(starGlow.material as THREE.SpriteMaterial), (starCorona.material as THREE.SpriteMaterial)], {
        opacity: (i: number) => i === 0 ? 0.85 : 0.3,
        stagger: 0.2,
        duration: 0.9
      }, '-=0.4')

      // 3. Camera pull back — long, cinematic, Imperial
      .to(camera.position, {
        x: 0, y: 18, z: 42,
        duration: 5,
        ease: 'power4.inOut',
        onUpdate: () => camera.lookAt(0, 0, 0),
        onStart: () => {
          gsap.delayedCall(3, () => { this.three.orbitEnabled = true; });
        },
        onComplete: () => { this.isIntroFinished = true; }
      }, '-=0.6')

      // 4. Orbit lines materialise
      .to(orbitMats, {
        opacity: 0.35,
        stagger: { each: 0.12, from: 'start' },
        duration: 1.8
      }, '-=4')

      // 5. Planets emerge — snap in, no bounce, Imperial precision
      .to(planetScales, {
        x: 1, y: 1, z: 1,
        stagger: 0.18,
        ease: 'power2.out',
        duration: 1
      }, '-=3.5')

      // 6. Death Star looms in last
      .to(deathStar.scale, {
        x: 1, y: 1, z: 1,
        duration: 1.5,
        ease: 'expo.out'
      }, '-=1.2');
  }

  // ── Idle: Imperial Dominion ───────────────────────────────────────────────

  private buildIdle(): void {
    const { star, starGlow, planets } = this.three;

    // Slow star pulse — power, not life
    this.idleTl
      .to(star.scale, {
        x: 1.02, y: 1.02, z: 1.02,
        duration: 6
      }, 0)
      .to((starGlow.material as THREE.SpriteMaterial), {
        opacity: 0.95,
        duration: 5
      }, 0);

    // Planets — minimal idle, efficient
    planets.forEach((p, i) => {
      const mat = p.mesh.material as THREE.MeshStandardMaterial;
      this.idleTl.to(mat, {
        emissiveIntensity: 0.55,
        duration: 3 + i * 0.4
      }, 0);
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  play(): void {
    if (!this.isIntroFinished) this.entranceTl.play();
    this.idleTl.play();
  }

  pause(): void {
    this.entranceTl.pause();
    this.idleTl.pause();
  }

  restart(): void {
    this.isIntroFinished = false;
    this.entranceTl.restart();
    this.idleTl.restart();
  }

  destroy(): void {
    this.entranceTl.kill();
    this.idleTl.kill();

    const targets = [
      this.three.camera.position,
      this.three.star.scale,
      this.three.starGlow,
      this.three.deathStar.scale,
      ...this.three.planets.map(p => p.mesh.scale),
      ...this.three.planets.map(p => p.mesh.material as THREE.MeshStandardMaterial)
    ];

    gsap.killTweensOf(targets);
  }
}