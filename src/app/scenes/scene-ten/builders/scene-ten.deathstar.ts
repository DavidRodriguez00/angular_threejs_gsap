import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';

// ─────────────────────────────────────────────────────────────────────────────
//  TIPOS PÚBLICOS
// ─────────────────────────────────────────────────────────────────────────────

export interface DeathstarConfig {
  /** Color emisivo del reactor central (hex). Por defecto: 0xFFE81F */
  color: number;
  /** Intensidad emisiva base del casco. Por defecto: 0.0 (sin glow en el casco) */
  glowBase: number;
  /** Amplitud máxima del pulso sobre glowBase. Por defecto: 0.04 */
  pulseAmplitude: number;
  /** Velocidad angular del pulso (rad/s). Por defecto: 0.6 */
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
  /** Intensidad máxima de la luz durante el pulso. Por defecto: 2.5 */
  lightPeakIntensity: number;
  /** Intensidad mínima de la luz en reposo. Por defecto: 1.2 */
  lightBaseIntensity: number;
}

type LoadState = 'idle' | 'loading' | 'ready' | 'disposed';

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Readonly<DeathstarConfig> = {
  color:              0xFFE81F,
  // El casco NO emite luz — toda la emisión quedará solo en el reactor
  glowBase:           0.0,
  pulseAmplitude:     0.04,   // pulso casi imperceptible en el casco
  pulseSpeed:         0.6,
  floatAmplitude:     0.35,
  floatSpeed:         1.0,
  mouseDamping:       0.05,
  mouseStrengthX:     0.20,
  mouseStrengthY:     0.20,
  autoRotateSpeed:    0.0008,
  lightPeakIntensity: 2.5,
  lightBaseIntensity: 1.2,
};

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
//  UTILIDADES PURAS
// ─────────────────────────────────────────────────────────────────────────────

function forEachMesh(root: THREE.Object3D, cb: (mesh: THREE.Mesh) => void): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) cb(child);
  });
}

function disposeMesh(mesh: THREE.Mesh): void {
  mesh.geometry.dispose();
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of materials) mat.dispose();
}

function centerPivot(object: THREE.Object3D): void {
  const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
  object.position.sub(center);
}

// ─────────────────────────────────────────────────────────────────────────────
//  CLASE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export class SpaceDeathstarManager {

  public readonly container: THREE.Group = new THREE.Group();

  private state: LoadState = 'idle';
  private model: THREE.Group | null = null;

  private readonly loader = new GLTFLoader();

  // ── Sistema de iluminación realista ─────────────────────────────────────────
  /**
   * Luz principal lateral: simula una estrella distante a ~45° derecha-arriba.
   * Da forma y volumen al hemisferio iluminado.
   */
  private readonly keyLight: THREE.DirectionalLight;

  /**
   * Fill muy tenue desde la izquierda: evita que el lado oscuro sea negro puro
   * (luz ambiental difusa del espacio).
   */
  private readonly fillLight: THREE.DirectionalLight;

  /**
   * Rim light azulada fría desde detrás-izquierda: separa el borde del fondo
   * negro y da la sensación de que hay espacio profundo detrás.
   */
  private readonly rimLight: THREE.DirectionalLight;

  /**
   * Punto de luz amarillo-cálido para el reactor: foco pequeño y concentrado
   * en el área del superlaser. Pulsa sutilmente.
   */
  private readonly reactorLight: THREE.PointLight;

  private readonly cfg: Readonly<DeathstarConfig>;
  private basePositionY = 0;

  constructor(
    private readonly scene: THREE.Scene,
    config: Partial<DeathstarConfig> = {},
  ) {
    this.cfg = Object.freeze({ ...DEFAULT_CONFIG, ...config });

    // ── Key light: sol lateral derecho-arriba ────────────────────────────────
    // Color ligeramente cálido (no blanco puro) — más fotorrealista
    this.keyLight = new THREE.DirectionalLight(0xfff5e0, 3.5);
    this.keyLight.position.set(100, 120, 180);
    this.keyLight.target.position.set(0, 0, 0);
    this.container.add(this.keyLight);
    this.container.add(this.keyLight.target);

    // ── Fill light: relleno muy tenue desde la izquierda ────────────────────
    // Simula la luz difusa del universo / albedo de planetas lejanos
    this.fillLight = new THREE.DirectionalLight(0xc8d8ff, 0.1);
    this.fillLight.position.set(-100, 120, -200);
    this.fillLight.target.position.set(0, 0, 0);
    this.container.add(this.fillLight);

    // ── Rim light: borde azul frío desde detrás ──────────────────────────────
    this.rimLight = new THREE.DirectionalLight(0x4488ff, 10);
    this.rimLight.position.set(100, 120, 120);
    // this.rimLight.target.position.set(0, 0, 0);
    this.container.add(this.rimLight);

    // ── Reactor: punto de luz pequeño y cálido ───────────────────────────────
    this.reactorLight = new THREE.PointLight(this.cfg.color, this.cfg.lightBaseIntensity, 60, 2);
    // Posición aproximada del superlaser en la parte superior de la esfera
    this.reactorLight.position.set(0, 20, 150);
    this.container.add(this.reactorLight);

    this.scene.add(this.container);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  GETTERS
  // ─────────────────────────────────────────────────────────────────────────────

  get isReady():    boolean { return this.state === 'ready'; }
  get isLoading():  boolean { return this.state === 'loading'; }
  get isDisposed(): boolean { return this.state === 'disposed'; }

  // ─────────────────────────────────────────────────────────────────────────────
  //  CARGA
  // ─────────────────────────────────────────────────────────────────────────────

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
      forEachMesh(this.model, (mesh) => mesh.geometry.computeVertexNormals());

      this.applyRealisticMaterial();
      this.container.add(this.model);

      this.state = 'ready';
    } catch (error) {
      this.state = 'idle';
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  MATERIAL REALISTA
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Material ultra-realista para el casco de la Estrella de la Muerte.
   *
   * Principios:
   * - Color base gris acero medio (0x5a5a5a) — visible en zonas iluminadas
   * - Alta rugosidad (0.82): metal industrial envejecido, sin reflejos brillantes
   * - Metalness moderado (0.55): metálico pero no espejo
   * - Sin emisión en el casco — la luz viene exclusivamente de las luces de escena
   * - Envío de sombras activado para auto-sombreado entre paneles
   */
  applyRealisticMaterial(): void {
    if (!this.model) return;

    forEachMesh(this.model, (mesh) => {
      // Recicla el material existente si ya es MeshStandardMaterial,
      // si no, crea uno nuevo para no multiplicar objetos GPU.
      let mat = mesh.material as THREE.MeshStandardMaterial;
      if (!(mat instanceof THREE.MeshStandardMaterial)) {
        mat = new THREE.MeshStandardMaterial();
        mesh.material = mat;
      }

      // ── Albedo: gris acero industrial ─────────────────────────────────────
      mat.color.setHex(0x5a5a5a);

      // ── PBR: metal rugoso, sin especular agresivo ──────────────────────────
      mat.roughness  = 0.82;   // muy mate — metal envejecido, paneles erosionados
      mat.metalness  = 0.55;   // reflectividad moderada, no espejo

      // ── Sin emisión en el casco ────────────────────────────────────────────
      // Solo el reactor emitirá; el casco recibe luz de las directionals.
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0.0;

      // ── Sombras y depth writing ────────────────────────────────────────────
      mesh.castShadow    = true;
      mesh.receiveShadow = true;

      mat.needsUpdate = true;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  INTRO CINEMÁTICA
  // ─────────────────────────────────────────────────────────────────────────────

  intro(onComplete?: () => void): gsap.core.Timeline {
    if (!this.isReady) {
      console.warn('SpaceDeathstarManager.intro(): el modelo no está cargado.');
      return gsap.timeline();
    }

    const tl = gsap.timeline({ delay: INTRO.delay, onComplete });

    tl.to(this.container.scale, {
      x: 1, y: 1, z: 1,
      duration: INTRO.scaleDuration,
      ease:     INTRO.scaleEase,
    });

    tl.from(this.container.position, {
      z:        INTRO.travelZ,
      duration: INTRO.travelDuration,
      ease:     INTRO.travelEase,
    }, '<');

    tl.to(this.reactorLight, {
      intensity: INTRO.lightIntensity,
      duration:  INTRO.lightDuration,
    }, INTRO.lightDelay);

    return tl;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  BUCLE DE ACTUALIZACIÓN
  // ─────────────────────────────────────────────────────────────────────────────

  update(t: number, mouse: THREE.Vector2): void {
    if (!this.isReady) return;

    this.updateFloat(t);
    this.updateMouseParallax(mouse);
    this.updateAutoRotate();
    this.updatePulse(t);
  }

  setBasePositionY(y: number): void {
    this.basePositionY = y;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  LIMPIEZA
  // ─────────────────────────────────────────────────────────────────────────────

  dispose(): void {
    if (this.state === 'disposed') return;
    this.state = 'disposed';

    gsap.killTweensOf(this.container.scale);
    gsap.killTweensOf(this.container.position);
    gsap.killTweensOf(this.reactorLight);

    if (this.model) {
      forEachMesh(this.model, disposeMesh);
      this.model = null;
    }

    this.keyLight.dispose();
    this.fillLight.dispose();
    this.rimLight.dispose();
    this.reactorLight.dispose();
    this.scene.remove(this.container);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  //  MÉTODOS PRIVADOS
  // ─────────────────────────────────────────────────────────────────────────────

  private updateFloat(t: number): void {
    const { floatAmplitude, floatSpeed } = this.cfg;
    this.container.position.y = this.basePositionY + Math.sin(t * floatSpeed * 0.5) * floatAmplitude;
  }

  private updateAutoRotate(): void {
    this.container.rotation.y += this.cfg.autoRotateSpeed;
  }

  private updateMouseParallax(mouse: THREE.Vector2): void {
    const { mouseDamping: k, mouseStrengthX: sx, mouseStrengthY: sy } = this.cfg;
    const targetRotY =  mouse.x * sx;
    const targetRotX = -mouse.y * sy;
    this.container.rotation.y += (targetRotY - this.container.rotation.y) * k;
    this.container.rotation.x += (targetRotX - this.container.rotation.x) * k;
  }

  /**
   * Pulso del reactor: SOLO modula la reactorLight (punto cálido sobre el superlaser).
   * El casco NO emite — esto garantiza que la estructura siempre se vea sólida.
   *
   * Efecto secundario sutil: la key light varía ±3% de intensidad para simular
   * el destello energético reflejado en la superficie.
   */
  private updatePulse(t: number): void {
    const { pulseSpeed, lightBaseIntensity, lightPeakIntensity } = this.cfg;

    const wave = (Math.sin(t * pulseSpeed) + 1) * 0.5;

    // Reactor: pulsa entre base y peak
    this.reactorLight.intensity = lightBaseIntensity + wave * (lightPeakIntensity - lightBaseIntensity);

    // Key light: oscilación mínima (+/- 3%) — simula "latido" energético
    this.keyLight.intensity = 3.5 + wave * 0.12;
  }

  private assertNotDisposed(method: string): void {
    if (this.state === 'disposed') {
      throw new Error(`SpaceDeathstarManager.${method}(): el manager fue eliminado.`);
    }
  }
}