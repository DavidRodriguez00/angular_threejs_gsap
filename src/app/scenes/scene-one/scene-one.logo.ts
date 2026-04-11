import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';

// ─────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────

export interface LogoConfig {
  /** Color principal del brillo emisivo (hex). Default: #00f2ff */
  color: number;
  /** Intensidad base del emisivo en reposo. Default: 0.15 */
  glowBase: number;
  /** Amplitud del pulso energético. Default: 0.6 */
  pulseAmplitude: number;
  /** Amplitud del floating (unidades world). Default: 0.35 */
  floatAmplitude: number;
  /** Velocidad del float (multiplicador). Default: 1.0 */
  floatSpeed: number;
  /** Suavizado del parallax de ratón (0–1). Default: 0.05 */
  mouseDamping: number;
  /** Fuerza del parallax horizontal. Default: 0.25 */
  mouseStrengthX: number;
  /** Fuerza del parallax vertical. Default: 0.20 */
  mouseStrengthY: number;
}

const DEFAULT_CONFIG: LogoConfig = {
  color: 0xFFE81F,
  glowBase: 0.05,
  pulseAmplitude: 0.6,
  floatAmplitude: 0.35,
  floatSpeed: 1.0,
  mouseDamping: 0.05,
  mouseStrengthX: 0.20,
  mouseStrengthY: 0.20,
};

type LoadState = 'idle' | 'loading' | 'ready' | 'disposed';

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

/** Itera sólo sobre los Mesh de un Object3D, sin boxing extra. */
function forEachMesh(
  root: THREE.Object3D,
  cb: (mesh: THREE.Mesh) => void
): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) cb(child);
  });
}

/** Libera geometría + materiales de un Mesh. */
function disposeMesh(mesh: THREE.Mesh): void {
  mesh.geometry.dispose();
  const mats = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];
  mats.forEach((m) => m.dispose());
}

// ─────────────────────────────────────────────
//  CLASS
// ─────────────────────────────────────────────

/**
 * SpaceLogoManager
 *
 * Gestiona la carga, materiales biokinéticos, animación cinemática de entrada
 * y el loop de actualización (float + parallax + pulso) de un logo 3D GLTF.
 *
 * Ciclo de vida:
 *   new SpaceLogoManager(scene, config?)
 *   → await .load(path)
 *   → .intro(onComplete?)
 *   → .update(elapsedSeconds, mouse)   ← en el render loop
 *   → .dispose()
 */
export class SpaceLogoManager {

  // ── Nodo raíz expuesto (posicionable desde fuera) ──────────────────
  public readonly container: THREE.Group = new THREE.Group();

  // ── Estado interno ─────────────────────────────────────────────────
  private state: LoadState = 'idle';
  private model: THREE.Group | null = null;
  private basePositionY: number = 0; // Posición Y base controlada por scroll

  // ── Infraestructura Three.js ───────────────────────────────────────
  private readonly loader = new GLTFLoader();
  private readonly light: THREE.PointLight;

  // ── Configuración inmutable post-construcción ──────────────────────
  private readonly cfg: LogoConfig;

  // ─────────────────────────────────────────────
  //  CONSTRUCTOR
  // ─────────────────────────────────────────────

  constructor(
    private readonly scene: THREE.Scene,
    config: Partial<LogoConfig> = {}
  ) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };

    // Luz puntual que complementa el emisivo
    this.light = new THREE.PointLight(this.cfg.color, 0.3, 10);
    this.light.position.set(0, 0, 100);

    this.container.add(this.light);
    this.scene.add(this.container);
  }

  // ─────────────────────────────────────────────
  //  GETTERS PÚBLICOS (read-only)
  // ─────────────────────────────────────────────

  get isReady(): boolean { return this.state === 'ready'; }
  get isLoading(): boolean { return this.state === 'loading'; }

  // ─────────────────────────────────────────────
  //  LOAD
  // ─────────────────────────────────────────────

  /**
     * Carga el GLTF, centra su pivote y prepara materiales. 
     * Lanza si ya hay una carga en curso o si el manager fue dispuesto.
     */
  async load(path: string): Promise<void> {
    if (this.state === 'loading') throw new Error('SpaceLogoManager: load already in progress.');
    if (this.state === 'disposed') throw new Error('SpaceLogoManager: cannot load after dispose.');

    this.state = 'loading';

    const gltf = await this.loader.loadAsync(path);
    this.model = gltf.scene;

    // ─────────────────────────────────────────────
    //  CORRECCIÓN DE PIVOTE (Centrado geométrico)
    // ─────────────────────────────────────────────
    const box = new THREE.Box3().setFromObject(this.model);
    const center = box.getCenter(new THREE.Vector3());

    // Desplazamos la malla en la dirección opuesta a su centro
    this.model.position.x -= center.x;
    this.model.position.y -= center.y;
    this.model.position.z -= center.z;
    // ─────────────────────────────────────────────

    this.applyBiokineticMaterial();
    this.container.add(this.model);

    // Escala cero para la intro cinemática
    this.container.scale.setScalar(1);

    this.state = 'ready';
  }

  // ─────────────────────────────────────────────
  //  MATERIAL BIOKINÉTICO
  // ─────────────────────────────────────────────

  /**
   * Reemplaza todos los materiales del modelo con MeshStandardMaterial
   * configurado para el efecto de brillo biokinético.
   *
   * Puede llamarse de nuevo si se actualiza `cfg.color` dinámicamente.
   */
  applyBiokineticMaterial(): void {
    if (!this.model) return;

    const mat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: this.cfg.color,
      emissiveIntensity: this.cfg.glowBase,
      roughness: 1,
      metalness: 2,
    });

    forEachMesh(this.model, (mesh) => {
      // Descarta material previo para evitar leaks
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      } else if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      }

      mesh.material = mat.clone(); // clone → cada mesh puede mutar su intensidad
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });

    mat.dispose(); // el original ya no se usa, sólo los clones
  }

  // ─────────────────────────────────────────────
  //  INTRO CINEMÁTICA
  // ─────────────────────────────────────────────

  /**
   * Secuencia de entrada: aparición orgánica + viaje desde el vacío + encendido.
   * Requiere que `load()` haya completado.
   */
  intro(onComplete?: () => void): any {
    if (!this.isReady) {
      console.warn('SpaceLogoManager.intro(): model not ready.');
      return gsap.timeline();
    }

    const tl = gsap.timeline({ delay: 0.4, onComplete });

    // 1. Aparición volumétrica
    tl.to(this.container.scale, {
      x: 2.2, y: 2.2, z: 2.2,
      duration: 2.6,
      ease: 'expo.inOut',
    });

    // 2. Viaje desde profundidad (simultáneo al scale)
    tl.from(this.container.position, {
      z: -7000,
      duration: 4,
      ease: 'power3.out',
    }, '<');

    // 3. Encendido de la luz (con un leve retardo)
    tl.to(this.light, {
      intensity: 2.2,
      duration: 5,
    }, 0.8);

    return tl;
  }

  // ─────────────────────────────────────────────
  //  UPDATE LOOP
  // ─────────────────────────────────────────────

  /**
   * Llama en cada frame del render loop.
   *
   * @param t     - Tiempo transcurrido en segundos (THREE.Clock.getElapsedTime)
   * @param mouse - Posición normalizada del ratón en [-1, 1]
   */
  update(t: number, mouse: THREE.Vector2): void {
    if (!this.isReady) return;

    this.updateMouseParallax(mouse);
    this.updatePulse(t);
  }

  // ─────────────────────────────────────────────
  //  SETTER PARA POSICIÓN BASE (usado por scroll handler)
  // ─────────────────────────────────────────────

  /**
   * Establece la posición Y base que el scroll handler controla.
   * Los offsets de float se aplican sobre esta base.
   */
  setBasePositionY(y: number): void {
    this.basePositionY = y;
  }

  // ─────────────────────────────────────────────
  //  SUBMÓDULOS DE ANIMACIÓN
  // ─────────────────────────────────────────────

  /** Rotación parallax suavizada con el ratón. */
  private updateMouseParallax(mouse: THREE.Vector2): void {
    const { mouseDamping: k, mouseStrengthX: sx, mouseStrengthY: sy } = this.cfg;
    const targetY = mouse.x * sx;
    const targetX = -mouse.y * sy;

    this.container.rotation.y += (targetY - this.container.rotation.y) * k;
    this.container.rotation.x += (targetX - this.container.rotation.x) * k;
  }

  /** Pulso energético: modula la luz y la intensidad emisiva de los materiales. */
  private updatePulse(t: number): void {
    const pulse = 0.194 + Math.sin(t * 1.7) * this.cfg.pulseAmplitude;

    this.light.intensity = pulse * 0.3;

    if (!this.model) return;

    forEachMesh(this.model, (mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = pulse;
    });
  }

  // ─────────────────────────────────────────────
  //  DISPOSE
  // ─────────────────────────────────────────────

  /** Limpia todos los recursos de GPU y elimina el container de la escena. */
  dispose(): void {
    if (this.state === 'disposed') return;
    this.state = 'disposed';

    gsap.killTweensOf(this.container.scale);
    gsap.killTweensOf(this.container.position);
    gsap.killTweensOf(this.light);

    if (this.model) {
      forEachMesh(this.model, disposeMesh);
    }

    this.light.dispose();
    this.scene.remove(this.container);
  }
}