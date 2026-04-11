import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';

// ─────────────────────────────────────────────────────────────────────────────
//  TIPOS PÚBLICOS
// ─────────────────────────────────────────────────────────────────────────────

/** Paleta de opciones del manager. Todos los campos son opcionales en el constructor. */
export interface DeathstarConfig {
  /** Color emisivo principal (hex). Por defecto: 0xFFE81F */
  color: number;
  /** Intensidad emisiva en reposo. Por defecto: 0.05 */
  glowBase: number;
  /** Amplitud máxima del pulso sobre glowBase. Por defecto: 0.6 */
  pulseAmplitude: number;
  /** Velocidad angular del pulso (rad/s). Por defecto: 1.2 */
  pulseSpeed: number;
  /** Amplitud del movimiento flotante (unidades world). Por defecto: 0.35 */
  floatAmplitude: number;
  /** Multiplicador de velocidad del float. Por defecto: 1.0 */
  floatSpeed: number;
  /** Factor de suavizado del parallax de ratón (0–1). Por defecto: 0.05 */
  mouseDamping: number;
  /** Sensibilidad horizontal del parallax. Por defecto: 0.20 */
  mouseStrengthX: number;
  /** Sensibilidad vertical del parallax. Por defecto: 0.20 */
  mouseStrengthY: number;
  /** Rotación automática lenta en Y (rad/s). Por defecto: 0.0008 */
  autoRotateSpeed: number;
  /** Intensidad máxima de la luz durante el pulso. Por defecto: 4.0 */
  lightPeakIntensity: number;
  /** Intensidad mínima de la luz en reposo. Por defecto: 0.3 */
  lightBaseIntensity: number;
}

// Estado interno de carga — ciclo estrictamente progresivo.
type LoadState = 'idle' | 'loading' | 'ready' | 'disposed';

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Readonly<DeathstarConfig> = {
  color:              0xFFE81F,
  glowBase:           0,
  pulseAmplitude:     0.6,
  pulseSpeed:         1.2,
  floatAmplitude:     0.35,
  floatSpeed:         1.0,
  mouseDamping:       0.05,
  mouseStrengthX:     0.20,
  mouseStrengthY:     0.20,
  autoRotateSpeed:    0.0008,
  lightPeakIntensity: 4.0,
  lightBaseIntensity: 0.3,
};

// Parámetros de la intro cinemática agrupados para facilitar ajustes.
const INTRO = {
  delay:          0.4,
  scaleDuration:  2.6,
  scaleEase:      'expo.inOut',
  travelZ:        -7000,
  travelDuration: 4.0,
  travelEase:     'power3.out',
  lightIntensity: 2.2,
  lightDuration:  5.0,
  lightDelay:     0.8,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
//  UTILIDADES PURAS (sin dependencia de la clase)
// ─────────────────────────────────────────────────────────────────────────────

/** Itera sobre todos los Mesh descendientes de un Object3D. */
function forEachMesh(root: THREE.Object3D, cb: (mesh: THREE.Mesh) => void): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) cb(child);
  });
}

/** Libera la geometría y todos los materiales de un Mesh de GPU. */
function disposeMesh(mesh: THREE.Mesh): void {
  mesh.geometry.dispose();
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of materials) mat.dispose();
}

/** Centra el pivote de un Object3D según su bounding box local. */
function centerPivot(object: THREE.Object3D): void {
  const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
  object.position.sub(center);
}

// ─────────────────────────────────────────────────────────────────────────────
//  CLASE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SpaceDeathstarManager
 *
 * Encapsula la carga, los materiales, la animación cinemática de entrada
 * y el bucle de actualización (parallax + pulso energético + float + rotación)
 * de un modelo 3D GLTF tipo "Estrella de la Muerte".
 *
 * ### Ciclo de vida
 * ```
 * const mgr = new SpaceDeathstarManager(scene, config?);
 * await mgr.load('/models/deathstar.glb');
 * mgr.intro(onComplete?);
 * // En cada frame:
 * mgr.update(clock.getElapsedTime(), mouseVec2);
 * // Al destruir:
 * mgr.dispose();
 * ```
 */
export class SpaceDeathstarManager {

  // ── Nodo público ─────────────────────────────────────────────────────────────
  /** Grupo raíz del manager. Posiciónalo libremente desde el exterior. */
  public readonly container: THREE.Group = new THREE.Group();

  // ── Estado ───────────────────────────────────────────────────────────────────
  private state: LoadState = 'idle';
  private model: THREE.Group | null = null;

  // ── Infraestructura Three.js ─────────────────────────────────────────────────
  private readonly loader = new GLTFLoader();
  private readonly light: THREE.PointLight;

  // ── Luz de relleno fría (borde trasero) ──────────────────────────────────────
  private readonly rimLight: THREE.PointLight;

  // ── Configuración (congelada tras construcción) ──────────────────────────────
  private readonly cfg: Readonly<DeathstarConfig>;

  // ── Posición Y base controlada por scroll ────────────────────────────────────
  private basePositionY = 0;

  // ─────────────────────────────────────────────────────────────────────────────
  //  CONSTRUCTOR
  // ─────────────────────────────────────────────────────────────────────────────

  constructor(
    private readonly scene: THREE.Scene,
    config: Partial<DeathstarConfig> = {},
  ) {
    this.cfg = Object.freeze({ ...DEFAULT_CONFIG, ...config });

    // Luz ambiente mínima: evita sombras completamente negras.
    this.container.add(new THREE.AmbientLight(0xffffff, 150));

    // Luz puntual principal: simula el brillo energético del modelo.
    this.light = new THREE.PointLight(this.cfg.color, this.cfg.lightBaseIntensity);
    this.light.position.set(150, 80, 200);
    this.container.add(this.light);

    // Luz de borde fría desde el lado opuesto: da volumen y separación del fondo.
    this.rimLight = new THREE.PointLight(0x2244ff, 0.5);
    this.rimLight.position.set(-200, -80, -250);
    this.container.add(this.rimLight);

    this.scene.add(this.container);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  GETTERS PÚBLICOS (solo lectura)
  // ─────────────────────────────────────────────────────────────────────────────

  get isReady():    boolean { return this.state === 'ready'; }
  get isLoading():  boolean { return this.state === 'loading'; }
  get isDisposed(): boolean { return this.state === 'disposed'; }

  // ─────────────────────────────────────────────────────────────────────────────
  //  CARGA
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Carga el modelo GLTF en la ruta indicada, centra su pivote y aplica
   * el material biocinético. Rechaza la promesa si ya hay una carga en curso
   * o si el manager ha sido eliminado.
   */
  async load(path: string): Promise<void> {
    this.assertNotDisposed('load');
    if (this.state === 'loading') {
      throw new Error('SpaceDeathstarManager: hay una carga en curso.');
    }

    this.state = 'loading';

    try {
      const gltf = await this.loader.loadAsync(path);
      this.model = gltf.scene;

      centerPivot(this.model);

      // Recalcula normales para garantizar iluminación correcta en todos los modelos.
      forEachMesh(this.model, (mesh) => mesh.geometry.computeVertexNormals());

      this.applyBiokineticMaterial();
      this.container.add(this.model);

      this.state = 'ready';
    } catch (error) {
      // Devuelve al estado idle para permitir reintentos.
      this.state = 'idle';
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  MATERIAL BIOCINÉTICO
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Aplica (o reaplica) el material MeshStandardMaterial a todos los meshes
   * del modelo. Llámalo de nuevo si cambias `cfg.color` en tiempo de ejecución.
   */
  applyBiokineticMaterial(): void {
    if (!this.model) return;

    forEachMesh(this.model, (mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(0x151515);
      mat.roughness = 0.4;
      mat.metalness = 0.7;
      mat.emissive.setHex(this.cfg.color);
      mat.emissiveIntensity = this.cfg.glowBase;
      mat.needsUpdate = true;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  INTRO CINEMÁTICA
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Lanza la secuencia de entrada GSAP: aparición volumétrica + viaje desde
   * profundidad + encendido gradual de la luz.
   *
   * Devuelve el timeline para que el exterior pueda encadenarlo o cancelarlo.
   * Si el modelo no está listo, devuelve un timeline vacío y emite una advertencia.
   */
  intro(onComplete?: () => void): gsap.core.Timeline {
    if (!this.isReady) {
      console.warn('SpaceDeathstarManager.intro(): el modelo no está cargado.');
      return gsap.timeline();
    }

    const tl = gsap.timeline({ delay: INTRO.delay, onComplete });

    // 1. Aparición volumétrica.
    tl.to(this.container.scale, {
      x: 1, y: 1, z: 1,
      duration: INTRO.scaleDuration,
      ease:     INTRO.scaleEase,
    });

    // 2. Viaje desde el vacío (simultáneo al scale).
    tl.from(this.container.position, {
      z:        INTRO.travelZ,
      duration: INTRO.travelDuration,
      ease:     INTRO.travelEase,
    }, '<');

    // 3. Encendido de la luz con retardo suave.
    tl.to(this.light, {
      intensity: INTRO.lightIntensity,
      duration:  INTRO.lightDuration,
    }, INTRO.lightDelay);

    return tl;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  BUCLE DE ACTUALIZACIÓN
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Llama en cada frame dentro del render loop.
   *
   * @param t     Tiempo transcurrido en segundos (`THREE.Clock.getElapsedTime()`).
   * @param mouse Posición normalizada del cursor en el rango [-1, 1].
   */
  update(t: number, mouse: THREE.Vector2): void {
    if (!this.isReady) return;

    this.updateFloat(t);
    this.updateMouseParallax(mouse);
    this.updateAutoRotate();
    this.updatePulse(t);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  SCROLL HANDLER
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Establece la posición Y base controlada por el scroll.
   * El float se acumula sobre este valor.
   */
  setBasePositionY(y: number): void {
    this.basePositionY = y;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  LIMPIEZA
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Libera todos los recursos de GPU, cancela las tweens activas
   * y elimina el container de la escena. Idempotente.
   */
  dispose(): void {
    if (this.state === 'disposed') return;
    this.state = 'disposed';

    gsap.killTweensOf(this.container.scale);
    gsap.killTweensOf(this.container.position);
    gsap.killTweensOf(this.light);

    if (this.model) {
      forEachMesh(this.model, disposeMesh);
      this.model = null;
    }

    this.light.dispose();
    this.rimLight.dispose();
    this.scene.remove(this.container);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  MÉTODOS PRIVADOS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Movimiento flotante sinusoidal en Y.
   * Se suma a `basePositionY` para no interferir con el control por scroll.
   */
  private updateFloat(t: number): void {
    const { floatAmplitude, floatSpeed } = this.cfg;
    this.container.position.y = this.basePositionY + Math.sin(t * floatSpeed * 0.5) * floatAmplitude;
  }

  /** Rotación lenta automática en Y, independiente del parallax de ratón. */
  private updateAutoRotate(): void {
    this.container.rotation.y += this.cfg.autoRotateSpeed;
  }

  /** Aplica la rotación parallax suavizada hacia la posición del ratón. */
  private updateMouseParallax(mouse: THREE.Vector2): void {
    const { mouseDamping: k, mouseStrengthX: sx, mouseStrengthY: sy } = this.cfg;

    const targetRotY =  mouse.x * sx;
    const targetRotX = -mouse.y * sy;

    this.container.rotation.y += (targetRotY - this.container.rotation.y) * k;
    this.container.rotation.x += (targetRotX - this.container.rotation.x) * k;
  }

  /**
   * Modula la intensidad emisiva de los materiales y la intensidad de la luz
   * con una onda sinusoidal para simular el pulso energético del reactor.
   *
   * emissiveIntensity ∈ [glowBase, glowBase + pulseAmplitude]
   * light.intensity   ∈ [lightBaseIntensity, lightPeakIntensity]
   */
  private updatePulse(t: number): void {
    if (!this.model) return;

    const { glowBase, pulseAmplitude, pulseSpeed, lightBaseIntensity, lightPeakIntensity } = this.cfg;

    // Onda sinusoidal normalizada en [0, 1].
    const wave = (Math.sin(t * pulseSpeed) + 1) * 0.5;

    // Emisivo de los materiales.
    const emissive = glowBase + wave * pulseAmplitude;
    forEachMesh(this.model, (mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat.emissive) {
        mat.emissiveIntensity = emissive;
      }
    });

    // Intensidad de la luz puntual principal.
    this.light.intensity = lightBaseIntensity + wave * (lightPeakIntensity - lightBaseIntensity);

    // La luz de borde pulsa de forma contraria para mayor dramatismo.
    this.rimLight.intensity = 0.3 + (1 - wave) * 0.4;
  }

  /** Lanza si el manager ya fue eliminado. Centraliza el mensaje de error. */
  private assertNotDisposed(method: string): void {
    if (this.state === 'disposed') {
      throw new Error(`SpaceDeathstarManager.${method}(): el manager fue eliminado.`);
    }
  }
}