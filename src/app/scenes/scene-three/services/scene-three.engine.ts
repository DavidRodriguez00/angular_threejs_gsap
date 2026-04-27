import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface ViewportDef {
  domId:     string;
  modelPath: string;
  accentHex: number;
}

export interface CloneViewport extends ViewportDef {
  scene:      THREE.Scene;
  camera:     THREE.PerspectiveCamera;
  modelGroup: THREE.Group;
  loaded:     boolean;
  mixer?:     THREE.AnimationMixer;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class ClonesEngine {
  public  readonly renderer:  THREE.WebGLRenderer;
  public  readonly viewports: CloneViewport[];
  private readonly loader   = new GLTFLoader();
  private readonly clock    = new THREE.Clock();
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, defs: ViewportDef[]) {
    this.renderer = this._buildRenderer(canvas);
    this.viewports = defs.map(d => this._buildViewport(d));
    this.viewports.forEach(vp => this._loadModel(vp));
  }

  // ── Private builders ────────────────────────────────────────────────────────

  private _buildRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
    const r = new THREE.WebGLRenderer({
      canvas,
      antialias:       true,
      alpha:           true,
      powerPreference: 'high-performance',
    });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.setSize(window.innerWidth, window.innerHeight, false);
    r.toneMapping         = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.6;
    r.shadowMap.enabled   = true;
    r.shadowMap.type      = THREE.PCFSoftShadowMap;
    r.autoClear           = false;
    return r;
  }

  private _buildViewport(def: ViewportDef): CloneViewport {
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 200);
    camera.position.set(0, 1.5, 4.2);
    camera.lookAt(0, 1.1, 0);

    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    // Lighting
    const accent = new THREE.Color(def.accentHex);

    scene.add(new THREE.AmbientLight(0x0a0a1a, 4.0));

    const key = new THREE.DirectionalLight(0xffffff, 6.0);
    key.position.set(1.5, 4, 3);
    key.castShadow = true;
    scene.add(key);

    const accentPt = new THREE.PointLight(accent, 8.0, 10);
    accentPt.position.set(-1.5, 2, 2);
    scene.add(accentPt);

    const rim = new THREE.DirectionalLight(0x2244aa, 4.0);
    rim.position.set(-3, 3, -3);
    scene.add(rim);

    const bounce = new THREE.PointLight(accent, 3.0, 5);
    bounce.position.set(0, -0.2, 1.5);
    scene.add(bounce);

    return { ...def, scene, camera, modelGroup, loaded: false };
  }

  private _loadModel(vp: CloneViewport): void {
    this.loader.load(
      vp.modelPath,
      (gltf) => {
        const model  = gltf.scene;
        const box    = new THREE.Box3().setFromObject(model);
        const size   = box.getSize(new THREE.Vector3());
        const scale  = 2.0 / (size.y || 1);
        const center = box.getCenter(new THREE.Vector3());

        model.scale.setScalar(scale);
        model.position.set(
          -center.x * scale,
          -box.min.y * scale,
          -center.z * scale,
        );
        model.traverse(c => {
          if (c instanceof THREE.Mesh) c.castShadow = c.receiveShadow = true;
        });

        if (gltf.animations?.length) {
          vp.mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach(clip => vp.mixer!.clipAction(clip).play());
        }

        vp.modelGroup.add(model);
        vp.loaded = true;
      },
      undefined,
      () => { this._buildFallback(vp); vp.loaded = true; },
    );
  }

  /** Low-poly humanoid stand-in when model file is unavailable. */
  private _buildFallback(vp: CloneViewport): void {
    const accent = new THREE.Color(vp.accentHex);
    const mats = {
      plate: new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: .95, roughness: .15 }),
      body:  new THREE.MeshStandardMaterial({ color: 0x111118, metalness: .9,  roughness: .2  }),
      visor: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: accent, emissiveIntensity: 3, metalness: 1, roughness: 0 }),
      chest: new THREE.MeshStandardMaterial({ color: 0x181820, emissive: accent, emissiveIntensity: .4, metalness: .9, roughness: .1 }),
    };

    const g = vp.modelGroup;
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      g.add(m);
    };

    // Head / visor
    add(new THREE.SphereGeometry(.26, 32, 32),            mats.plate,  0,    1.82,  0);
    add(new THREE.BoxGeometry(.30, .08, .1),               mats.visor,  0,    1.83,  .22);
    // Neck
    add(new THREE.CylinderGeometry(.1, .12, .14, 16),     mats.body,   0,    1.58,  0);
    // Torso
    add(new THREE.BoxGeometry(.72, .56, .36),              mats.plate,  0,    1.22,  0);
    add(new THREE.BoxGeometry(.30, .20, .08),              mats.chest,  0,    1.24,  .19);
    add(new THREE.BoxGeometry(.60, .30, .32),              mats.body,   0,     .88,  0);
    add(new THREE.BoxGeometry(.64, .20, .34),              mats.plate,  0,     .70,  0);
    // Shoulders
    add(new THREE.SphereGeometry(.19, 16, 16),             mats.plate, -.54,  1.38,  0);
    add(new THREE.SphereGeometry(.19, 16, 16),             mats.plate,  .54,  1.38,  0);
    // Upper arms
    add(new THREE.CylinderGeometry(.09, .08, .44, 16),    mats.body,  -.55,  1.10,  0);
    add(new THREE.CylinderGeometry(.09, .08, .44, 16),    mats.body,   .55,  1.10,  0);
    // Elbows
    add(new THREE.SphereGeometry(.10, 12, 12),             mats.plate, -.55,   .86,  0);
    add(new THREE.SphereGeometry(.10, 12, 12),             mats.plate,  .55,   .86,  0);
    // Forearms
    add(new THREE.CylinderGeometry(.08, .07, .40, 16),    mats.body,  -.55,   .62,  0);
    add(new THREE.CylinderGeometry(.08, .07, .40, 16),    mats.body,   .55,   .62,  0);
    // Thighs
    add(new THREE.CylinderGeometry(.13, .11, .48, 16),    mats.plate, -.17,   .37,  0);
    add(new THREE.CylinderGeometry(.13, .11, .48, 16),    mats.plate,  .17,   .37,  0);
    // Knees
    add(new THREE.SphereGeometry(.12, 12, 12),             mats.plate, -.17,   .10,  .06);
    add(new THREE.SphereGeometry(.12, 12, 12),             mats.plate,  .17,   .10,  .06);
    // Shins
    add(new THREE.CylinderGeometry(.10, .08, .44, 16),    mats.body,  -.17,  -.15,  0);
    add(new THREE.CylinderGeometry(.10, .08, .44, 16),    mats.body,   .17,  -.15,  0);
    // Boots
    add(new THREE.BoxGeometry(.20, .14, .30),              mats.plate, -.17,  -.40,  .04);
    add(new THREE.BoxGeometry(.20, .14, .30),              mats.plate,  .17,  -.40,  .04);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /** Advances animations and model auto-rotation. Call once per frame. */
  update(): void {
    if (this.disposed) return;
    const delta = this.clock.getDelta();
    this.viewports.forEach(vp => {
      vp.modelGroup.rotation.y += delta * 0.25;
      vp.mixer?.update(delta);
    });
  }

  /**
   * Renders only the viewport matching `activeDomId` into its DOM element.
   * Pass `null` to render all viewports (useful for screenshots / thumbnails).
   */
  renderSlide(activeDomId: string | null): void {
    if (this.disposed) return;

    const r      = this.renderer;
    const canvas = r.domElement;
    const cw     = canvas.clientWidth;
    const ch     = canvas.clientHeight;

    r.clear();

    const targets = activeDomId
      ? this.viewports.filter(vp => vp.domId === activeDomId)
      : this.viewports;

    targets.forEach(vp => {
      const el = document.getElementById(vp.domId);
      if (!el) return;

      const cr = canvas.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      const x  = er.left - cr.left;
      const y  = er.top  - cr.top;
      const w  = er.width;
      const h  = er.height;
      if (w <= 0 || h <= 0) return;

      const glY = ch - y - h;
      r.setScissorTest(true);
      r.setScissor(x, glY, w, h);
      r.setViewport(x, glY, w, h);
      r.clearDepth();

      vp.camera.aspect = w / h;
      vp.camera.updateProjectionMatrix();
      r.render(vp.scene, vp.camera);
    });

    r.setScissorTest(false);
  }

  setExposure(value: number): void {
    this.renderer.toneMappingExposure = THREE.MathUtils.clamp(value, 0, 4);
  }

  onResize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.viewports.forEach(vp => {
      vp.camera.aspect = window.innerWidth / window.innerHeight;
      vp.camera.updateProjectionMatrix();
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.viewports.forEach(vp => {
      vp.mixer?.stopAllAction();
      vp.scene.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return;
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => m.dispose());
      });
    });

    this.renderer.dispose();
  }
}