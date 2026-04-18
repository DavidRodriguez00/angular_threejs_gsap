import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface CloneViewport {
  domId:      string;
  modelPath:  string;
  accentHex:  number;
  scene:      THREE.Scene;
  camera:     THREE.PerspectiveCamera;
  modelGroup: THREE.Group;
  loaded:     boolean;
  mixer?:     THREE.AnimationMixer;
}

export class ClonesEngine {
  public readonly renderer:  THREE.WebGLRenderer;
  public readonly viewports: CloneViewport[];
  private readonly loader = new GLTFLoader();
  private readonly clock  = new THREE.Clock();
  private disposed = false;

  constructor(
    canvas: HTMLCanvasElement,
    defs: Pick<CloneViewport, 'domId' | 'modelPath' | 'accentHex'>[]
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha:     true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.toneMapping        = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.6;
    this.renderer.shadowMap.enabled  = true;
    this.renderer.shadowMap.type     = THREE.PCFSoftShadowMap;
    this.renderer.autoClear          = false;

    this.viewports = defs.map(d => this._buildVp(d));
    this.viewports.forEach(vp => this._load(vp));
  }

  private _buildVp(
    def: Pick<CloneViewport, 'domId' | 'modelPath' | 'accentHex'>
  ): CloneViewport {
    const scene  = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(36, window.innerWidth / window.innerHeight, 0.01, 200);
    camera.position.set(0, 1.5, 4.2);
    camera.lookAt(0, 1.1, 0);

    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    const accent = new THREE.Color(def.accentHex);

    scene.add(new THREE.AmbientLight(0x0a0a1a, 4.0));

    const key = new THREE.DirectionalLight(0xffffff, 6.0);
    key.position.set(1.5, 4, 3);
    key.castShadow = true;
    scene.add(key);

    const accentLight = new THREE.PointLight(accent, 8.0, 10);
    accentLight.position.set(-1.5, 2, 2);
    scene.add(accentLight);

    const rim = new THREE.DirectionalLight(0x2244aa, 4.0);
    rim.position.set(-3, 3, -3);
    scene.add(rim);

    const bounce = new THREE.PointLight(accent, 3.0, 5);
    bounce.position.set(0, -0.2, 1.5);
    scene.add(bounce);

    return { ...def, scene, camera, modelGroup, loaded: false };
  }

  private _load(vp: CloneViewport): void {
    this.loader.load(
      vp.modelPath,
      (gltf) => {
        const model = gltf.scene;
        const box    = new THREE.Box3().setFromObject(model);
        const height = box.getSize(new THREE.Vector3()).y || 1;
        const scale  = 2.0 / height;
        const center = box.getCenter(new THREE.Vector3());
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
        model.traverse(c => {
          if (c instanceof THREE.Mesh) {
            c.castShadow = c.receiveShadow = true;
          }
        });
        if (gltf.animations?.length) {
          vp.mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach(clip => vp.mixer!.clipAction(clip).play());
        }
        vp.modelGroup.add(model);
        vp.loaded = true;
      },
      undefined,
      () => { this._fallback(vp); vp.loaded = true; }
    );
  }

  private _fallback(vp: CloneViewport): void {
    const accent = new THREE.Color(vp.accentHex);
    const plate  = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: .95, roughness: .15 });
    const body   = new THREE.MeshStandardMaterial({ color: 0x111118, metalness: .9, roughness: .2 });
    const visor  = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: accent, emissiveIntensity: 3, metalness: 1, roughness: 0 });
    const chest  = new THREE.MeshStandardMaterial({ color: 0x181820, emissive: accent, emissiveIntensity: .4, metalness: .9, roughness: .1 });

    const g = vp.modelGroup;
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x=0,y=0,z=0) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z); m.castShadow=true; g.add(m);
    };
    add(new THREE.SphereGeometry(.26,32,32),               plate,  0,   1.82, 0);
    add(new THREE.BoxGeometry(.30,.08,.1),                  visor,  0,   1.83, .22);
    add(new THREE.CylinderGeometry(.1,.12,.14,16),          body,   0,   1.58, 0);
    add(new THREE.BoxGeometry(.72,.56,.36),                 plate,  0,   1.22, 0);
    add(new THREE.BoxGeometry(.30,.20,.08),                 chest,  0,   1.24, .19);
    add(new THREE.BoxGeometry(.60,.30,.32),                 body,   0,    .88, 0);
    add(new THREE.BoxGeometry(.64,.20,.34),                 plate,  0,    .70, 0);
    add(new THREE.SphereGeometry(.19,16,16),                plate, -.54, 1.38, 0);
    add(new THREE.SphereGeometry(.19,16,16),                plate,  .54, 1.38, 0);
    add(new THREE.CylinderGeometry(.09,.08,.44,16),         body,  -.55, 1.10, 0);
    add(new THREE.CylinderGeometry(.09,.08,.44,16),         body,   .55, 1.10, 0);
    add(new THREE.SphereGeometry(.10,12,12),                plate, -.55,  .86, 0);
    add(new THREE.SphereGeometry(.10,12,12),                plate,  .55,  .86, 0);
    add(new THREE.CylinderGeometry(.08,.07,.40,16),         body,  -.55,  .62, 0);
    add(new THREE.CylinderGeometry(.08,.07,.40,16),         body,   .55,  .62, 0);
    add(new THREE.CylinderGeometry(.13,.11,.48,16),         plate, -.17,  .37, 0);
    add(new THREE.CylinderGeometry(.13,.11,.48,16),         plate,  .17,  .37, 0);
    add(new THREE.SphereGeometry(.12,12,12),                plate, -.17,  .10, .06);
    add(new THREE.SphereGeometry(.12,12,12),                plate,  .17,  .10, .06);
    add(new THREE.CylinderGeometry(.10,.08,.44,16),         body,  -.17, -.15, 0);
    add(new THREE.CylinderGeometry(.10,.08,.44,16),         body,   .17, -.15, 0);
    add(new THREE.BoxGeometry(.20,.14,.30),                 plate, -.17, -.40, .04);
    add(new THREE.BoxGeometry(.20,.14,.30),                 plate,  .17, -.40, .04);
  }

  update(): void {
    if (this.disposed) return;
    const d = this.clock.getDelta();
    this.viewports.forEach(vp => {
      vp.modelGroup.rotation.y += d * 0.25;
      vp.mixer?.update(d);
    });
  }

  /**
   * Renderiza solo el viewport que coincide con domId del slide activo.
   * Si domId es null, renderiza todos.
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

      const cr   = canvas.getBoundingClientRect();
      const er   = el.getBoundingClientRect();
      const x    = er.left - cr.left;
      const y    = er.top  - cr.top;
      const w    = er.width;
      const h    = er.height;
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

  setExposure(v: number): void {
    this.renderer.toneMappingExposure = THREE.MathUtils.clamp(v, 0, 4);
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
      vp.scene.traverse(o => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
        }
      });
      vp.mixer?.stopAllAction();
    });
    this.renderer.dispose();
  }
}