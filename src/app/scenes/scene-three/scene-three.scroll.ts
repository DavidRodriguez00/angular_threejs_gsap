import * as THREE from 'three';

// ─────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────

export interface ScrollConfig {
  /** Posición Z de la cámara en progress=0. Default: 120 */
  camZStart: number;
  /** Posición Z de la cámara en progress=1. Default: 450 */
  camZEnd: number;
  /** FOV base de la cámara. Default: 50 */
  fovBase: number;
  /** Incremento de FOV al llegar a progress=1. Default: 20 */
  fovDelta: number;
  /** Posición Y del logo en progress=0. Default: 5 */
  logoYStart: number;
  /** Posición Y del logo en progress=1. Default: -25 */
  logoYEnd: number;
  /** Escala del logo en progress=0. Default: 1.0 */
  logoScaleStart: number;
  /** Escala del logo en progress=1. Default: 0.4 */
  logoScaleEnd: number;
  /** Ángulo de rotación Y total a lo largo del scroll (rad). Default: Math.PI * 2 */
  logoRotationY: number;
  /** Ángulo máximo de pitch (rotación X) al final del scroll. Default: 0.3 */
  logoMaxPitchX: number;
}

const DEFAULT_CONFIG: ScrollConfig = {
  camZStart:      120,
  camZEnd:        450,
  fovBase:        50,
  fovDelta:       20,
  logoYStart:     5,
  logoYEnd:      -25,
  logoScaleStart: 1.0,
  logoScaleEnd:   0.4,
  logoRotationY:  Math.PI * 2,
  logoMaxPitchX:  0.3,
};

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

/** Interpolación lineal. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp de un valor al rango [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Sanitiza un progress potencialmente NaN o fuera de rango. */
function sanitizeProgress(p: number): number {
  return Number.isFinite(p) ? clamp(p, 0, 1) : 0;
}

// ─────────────────────────────────────────────
//  CLASS
// ─────────────────────────────────────────────

/**
 * SpaceScrollHandler
 *
 * Orquesta la coreografía entre cámara y logo 3D en función
 * del progreso de scroll normalizado (0–1).
 *
 * Uso:
 *   const handler = new SpaceScrollHandler(camera, logo, config?)
 *   handler.updateByProgress(scrollProgress)   ← en el scroll listener
 */
export class SpaceScrollHandler {

  private readonly cfg: ScrollConfig;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly logo: THREE.Group,
    config: Partial<ScrollConfig> = {},
  ) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
    // Sincroniza la escena al estado inicial sin esperar al primer evento de scroll
    this.updateByProgress(0);
  }

  // ─────────────────────────────────────────────
  //  API PÚBLICA
  // ─────────────────────────────────────────────

  /**
   * Aplica el estado de la escena correspondiente a `progress`.
   * @param progress  Valor normalizado [0, 1]; NaN e Infinity se tratan como 0.
   */
  updateByProgress(progress: number): void {
    const p = sanitizeProgress(progress);

    this.updateCamera(p);
    this.updateLogo(p);
  }

  // ─────────────────────────────────────────────
  //  SUBMÓDULOS DE COREOGRAFÍA
  // ─────────────────────────────────────────────

  /** Mueve la cámara en Z y ajusta el FOV cinemático. */
  private updateCamera(p: number): void {
    this.camera.position.z = lerp(this.cfg.camZStart, this.cfg.camZEnd, p);
    this.camera.fov         = this.cfg.fovBase + p * this.cfg.fovDelta;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Controla posición, escala y rotación del logo.
   *
   * La guarda `scale.x === 0` del original se elimina: si el logo
   * llega con escala 0 (intro pendiente), el scroll no debe
   * forzar una escala no iniciada. La responsabilidad de la escala
   * inicial recae en SpaceLogoManager.intro().
   */
  private updateLogo(p: number): void {
    // Posición vertical (agenda flow)
    this.logo.position.y = lerp(this.cfg.logoYStart, this.cfg.logoYEnd, p);

    // Escala adaptativa
    this.logo.scale.setScalar(
      lerp(this.cfg.logoScaleStart, this.cfg.logoScaleEnd, p)
    );

    // Rotación Y evolutiva
    this.logo.rotation.y = p * this.cfg.logoRotationY;

    // Pitch dinámico (efecto de profundidad)
    this.logo.rotation.x = p * this.cfg.logoMaxPitchX;
  }
}