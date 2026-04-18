// import * as THREE from 'three';
// import { LavaEngine } from './scene-three.engine';

// // ─────────────────────────────────────────────────────────────────────────────
// //  TYPES
// // ─────────────────────────────────────────────────────────────────────────────

// export interface LavaScrollConfig {
//   /** Z de cámara en progress=0. Default: 5.5 */
//   camZStart: number;
//   /** Z de cámara en progress=1. Default: 9.0 */
//   camZEnd: number;
//   /** FOV base. Default: 50 */
//   fovBase: number;
//   /** Delta de FOV al llegar a progress=1. Default: 18 */
//   fovDelta: number;
//   /** Ángulo de inclinación máximo del planeta (rad). Default: 0.4 */
//   tiltMax: number;
// }

// const DEFAULT_CONFIG: LavaScrollConfig = {
//   camZStart: 5.5,
//   camZEnd:   9.0,
//   fovBase:   50,
//   fovDelta:  18,
//   tiltMax:   0.4,
// };

// const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// const clamp01 = (p: number): number => {
//   if (!isFinite(p)) return 0;
//   return Math.max(0, Math.min(1, p));
// };

// // ─────────────────────────────────────────────────────────────────────────────
// //  LavaScrollHandler
// // ─────────────────────────────────────────────────────────────────────────────

// /**
//  * Coreografía de la Escena 3 basada en progreso de scroll.
//  * Al hacer scroll el planeta se aleja, se inclina y la cámara retrocede.
//  */
// export class LavaScrollHandler {
//   private cfg: LavaScrollConfig;

//   constructor(
//     private engine: LavaEngine,
//     config: Partial<LavaScrollConfig> = {}
//   ) {
//     this.cfg = { ...DEFAULT_CONFIG, ...config };
//   }

//   updateByProgress(progress: number): void {
//     const p = clamp01(progress);
//     this.updateCamera(p);
//     this.updatePlanetTilt(p);
//   }

//   private updateCamera(p: number): void {
//     this.engine.camera.position.z = lerp(this.cfg.camZStart, this.cfg.camZEnd, p);
//     this.engine.camera.fov        = this.cfg.fovBase + p * this.cfg.fovDelta;
//     this.engine.camera.updateProjectionMatrix();
//   }

//   private updatePlanetTilt(p: number): void {
//     // El planeta se inclina ligeramente mientras nos alejamos (sensación de órbita)
//     const scene = this.engine.scene;
//     const planet = scene.children.find(c =>
//       c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.SphereGeometry
//     );
//     if (planet) {
//       planet.rotation.x = lerp(0, this.cfg.tiltMax, p);
//     }
//   }
// }