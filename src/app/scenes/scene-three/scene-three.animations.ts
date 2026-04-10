import gsap from 'gsap';
import * as THREE from 'three';
import { SceneThreeThree } from './scene-three.three';

/**
 * GSAP-driven entrance and idle animations for Scene One.
 * Enhanced with cinematic fly-by, material transitions and deep memory safety.
 */
export class SceneThreeAnimations {
  private entranceTl: gsap.core.Timeline;
  private idleTl:     gsap.core.Timeline;
  private isIntroFinished: boolean = false;

  constructor(private three: SceneThreeThree) {
    // Timelines con defaults optimizados para visualización espacial
    this.entranceTl = gsap.timeline({ 
      paused: true,
      defaults: { duration: 1.5, ease: 'expo.out' } 
    });

    this.idleTl = gsap.timeline({ 
      paused: true, 
      repeat: -1, 
      yoyo: true,
      defaults: { ease: 'sine.inOut', duration: 3 }
    });
  }

  init(): void {
    // Validamos que los objetos de Three.js estén listos
    if (!this.three.sun || !this.three.planets.length) {
      console.warn('SceneThreeAnimations: Three.js objects not initialized.');
      return;
    }
    
    this.buildEntrance();
    this.buildIdle();
  }

  // ── Entrance: The Big Bang Sequence ────────────────────────────────────────

  private buildEntrance(): void {
    const { camera, sun, sunGlow, sunCorona, planets, orbitLines } = this.three;

    // Estado inicial: Todo oculto o en posiciones de "arranque"
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);
    
    sun.scale.setScalar(0);
    if (sunGlow) sunGlow.material.opacity = 0;
    if (sunCorona) sunCorona.material.opacity = 0;

    const planetMeshes = planets.map(p => p.mesh.scale);
    const orbitMaterials = orbitLines.map(l => l.material as THREE.LineBasicMaterial);

    // Animación de entrada por pasos
    this.entranceTl
      // 1. Nacimiento del Sol (Elastic Ease para impacto físico)
      .to(sun.scale, { 
        x: 1, y: 1, z: 1, 
        duration: 2, 
        ease: 'elastic.out(1, 0.8)' 
      })

      // 2. Encendido de la corona (Stagger de opacidad)
      .to([sunGlow.material, sunCorona.material], {
        opacity: (i) => i === 0 ? 0.8 : 0.3,
        stagger: 0.3,
        duration: 1
      }, '-=1.2')

      // 3. Cinematic Camera Pullback & Tilt
      // Pasamos de una vista cercana a la configuración CAM_OVERVIEW
      .to(camera.position, {
        x: 0, y: 15, z: 35, // Valores alineados con CAM_OVERVIEW del SceneThreeThree
        duration: 4,
        ease: 'power4.inOut',
        onUpdate: () => camera.lookAt(0, 0, 0),
        onStart: () => {
          // Habilitamos la lógica de rotación interna del SceneThreeThree a mitad del vuelo
          gsap.delayedCall(2, () => { this.three.orbitEnabled = true; });
        },
        onComplete: () => {
          this.isIntroFinished = true;
        }
      }, '-=1')

      // 4. Despliegue de Órbitas (Fade in elegante)
      .to(orbitMaterials, {
        opacity: 0.25,
        stagger: { each: 0.1, from: 'start' },
        duration: 2
      }, '-=3')

      // 5. Instanciación de Planetas (Efecto de "pop" con retroceso)
      .to(planetMeshes, {
        x: 1, y: 1, z: 1,
        stagger: 0.2,
        ease: 'back.out(2)',
        duration: 1.2
      }, '-=2.5');
  }

  // ── Idle: The Cosmic Breath ────────────────────────────────────────────────

  private buildIdle(): void {
    const { sun, sunGlow, planets } = this.three;

    // Pulsación del núcleo solar (Respiración del sistema)
    this.idleTl
      .to(sun.scale, { 
        x: 1.03, y: 1.03, z: 1.03, 
        duration: 4 
      }, 0)
      .to(sunGlow.scale, { 
        x: 17, y: 17, z: 17, // Ligeramente mayor que el default para efecto "glow"
        duration: 4 
      }, 0);

    // Efecto de flotación (Micro-variaciones en el eje Y)
    // Usamos el pivot para no interferir con la posición relativa de la órbita
    planets.forEach((p, index) => {
      this.idleTl.to(p.mesh.position, {
        y: `+=${0.15 + (index * 0.05)}`,
        duration: 3 + index,
        ease: 'sine.inOut'
      }, 0);
    });

    // Variación de intensidad lumínica (Emissive flicker)
    planets.forEach((p) => {
      const mat = p.mesh.material as THREE.MeshStandardMaterial;
      this.idleTl.to(mat, {
        emissiveIntensity: 0.6,
        duration: 2 + Math.random() * 2
      }, 0);
    });
  }

  // ── Public Control API ─────────────────────────────────────────────────────

  /**
   * Ejecuta la secuencia. Inteligente: decide si hacer intro o solo idle.
   */
  play(): void {
    if (!this.isIntroFinished) {
      this.entranceTl.play();
    }
    // El idle empieza siempre, pero sus efectos son sutiles
    this.idleTl.play();
  }

  pause(): void {
    this.entranceTl.pause();
    this.idleTl.pause();
  }

  /**
   * Reinicia la experiencia desde el Big Bang.
   */
  restart(): void {
    this.isIntroFinished = false;
    this.entranceTl.restart();
    this.idleTl.restart();
  }

  /**
   * Limpieza profunda de GSAP. 
   * Previene que tweens sigan ejecutándose sobre objetos destruidos en Three.js.
   */
  destroy(): void {
    this.entranceTl.kill();
    this.idleTl.kill();
    
    // Matamos cualquier tween residual en los objetos principales
    const objectsToClean = [
      this.three.camera.position,
      this.three.sun.scale,
      this.three.sunGlow.scale,
      ...this.three.planets.map(p => p.mesh.scale),
      ...this.three.planets.map(p => p.mesh.position)
    ];
    
    gsap.killTweensOf(objectsToClean);
  }
}