import * as THREE from 'three';
import gsap from 'gsap';
import { handleResize } from '../../shared/utils/three-utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface StarWarsPlanetData {
  name:        string;
  size:        number;
  distance:    number;
  color:       number;
  emissive:    number;
  speed:       number;
  tilt:        number;
  cloudColor?: number;
  hasRings?:   boolean;
  ringColor?:  number;
  isRebelBase?: boolean;
}

export interface SWPlanetObject {
  mesh:   THREE.Mesh;
  pivot:  THREE.Object3D;
  speed:  number;
  data:   StarWarsPlanetData;
  glow:   THREE.Sprite;
  clouds?: THREE.Mesh;
  rings?: THREE.Mesh;
}

// ── Constants ────────────────────────────────────────────────────────────────

export const SW_PLANET_NAMES = ['Coruscant', 'Tatooine', 'Hoth', 'Endor', 'Mustafar', 'Alderaan'] as const;
export type SWPlanetName = typeof SW_PLANET_NAMES[number];

const SW_PLANET_DATA: StarWarsPlanetData[] = [
  { name: 'Coruscant', size: 0.7,  distance: 7.0,  color: 0xd4a84b, emissive: 0x3a2000, speed: 0.038, tilt: 0.05 },
  { name: 'Tatooine',  size: 0.55, distance: 10.5, color: 0xd4904a, emissive: 0x3a1800, speed: 0.026, tilt: 0.08, cloudColor: 0xc4803a },
  { name: 'Hoth',      size: 0.50, distance: 14.0, color: 0xdce8f0, emissive: 0x102030, speed: 0.019, tilt: 0.45, cloudColor: 0xeef4f8 },
  { name: 'Endor',     size: 0.45, distance: 18.0, color: 0x2a6a30, emissive: 0x051008, speed: 0.014, tilt: 0.3,  cloudColor: 0x4a8a50, isRebelBase: true },
  { name: 'Mustafar',  size: 0.40, distance: 22.0, color: 0x8a1a00, emissive: 0x440800, speed: 0.010, tilt: 0.1 },
  { name: 'Alderaan',  size: 0.60, distance: 27.0, color: 0x5a8ab0, emissive: 0x102040, speed: 0.007, tilt: 0.25, cloudColor: 0x7aaaca, hasRings: true, ringColor: 0x3a6a90 },
];

const CAM_OVERVIEW = { x: 0, y: 18, z: 42, fov: 42 };
const STAR_COUNT   = 6000;

// ── Shaders ──────────────────────────────────────────────────────────────────

/** Imperial star shader — cold blue-white with angular corona lines */
const IMPERIAL_STAR_SHADER = {
  vertex: `
    varying vec2 vUv;
    varying vec3 vNormal;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragment: `
    uniform float time;
    varying vec2 vUv;
    varying vec3 vNormal;
    void main() {
      float flare = abs(sin(vUv.y * 12.0 + time * 1.5)) * 0.08;
      vec3 base   = vec3(1.0, 0.92, 0.78);
      vec3 hot    = vec3(1.0, 0.6, 0.1);
      float rim   = pow(1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 2.5);
      gl_FragColor = vec4(mix(base, hot, rim) + flare, 1.0);
    }
  `
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeGlow(color: number, opacity: number): THREE.SpriteMaterial {
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = 128;
  const ctx = cvs.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  const r = (color >> 16) & 0xff, gv = (color >> 8) & 0xff, b = color & 0xff;
  g.addColorStop(0,   `rgba(${r},${gv},${b},${opacity})`);
  g.addColorStop(0.4, `rgba(${r},${gv},${b},${opacity * 0.4})`);
  g.addColorStop(1,   `rgba(${r},${gv},${b},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cvs),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
}

// ── Class ────────────────────────────────────────────────────────────────────

export class SceneTwoThree {
  private canvas:          HTMLCanvasElement;
  private rafId:           number | null = null;
  private clock =          new THREE.Timer();

  public orbitEnabled =    true;
  private isTransitioning = false;
  private focusedPlanet:   SWPlanetObject | null = null;

  scene!:    THREE.Scene;
  camera!:   THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;

  /** The Imperial star at the center */
  star!:      THREE.Mesh;
  starGlow!:  THREE.Sprite;
  starCorona!: THREE.Sprite;

  /** Death Star — large imposing structure */
  deathStar!:      THREE.Mesh;
  deathStarOrbit!: THREE.Object3D;

  planets:    SWPlanetObject[] = [];
  stars!:     THREE.Points;
  orbitLines: THREE.LineLoop[] = [];

  private focusTl: gsap.core.Timeline | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  init(): void {
    this.buildScene();
    this.buildCamera();
    this.buildRenderer();
    this.buildLighting();
    this.buildStarField();
    this.buildImperialStar();
    this.buildDeathStar();
    this.buildOrbits();
    this.buildPlanets();

    handleResize(this.camera, this.renderer, this.canvas);
    this.introSequence();
    this.animate();
  }

  // ── Focus API ─────────────────────────────────────────────────────────────

  focusPlanet(name: SWPlanetName): void {
    const planet = this.planets.find(p => p.data.name === name);
    if (!planet || this.isTransitioning) return;
    this.cleanupFocus();
    this.isTransitioning = true;
    this.focusedPlanet   = planet;

    const tp = new THREE.Vector3();
    planet.mesh.getWorldPosition(tp);

    this.focusTl = gsap.timeline({
      onComplete: () => { this.isTransitioning = false; }
    });

    this.focusTl.to(this.camera.position, {
      duration: 2.8,
      x: tp.x + planet.data.size * 5,
      y: tp.y + planet.data.size * 2.5,
      z: tp.z + planet.data.size * 6,
      ease: 'expo.inOut',
      onUpdate: () => {
        const cp = new THREE.Vector3();
        planet.mesh.getWorldPosition(cp);
        this.camera.lookAt(cp);
      }
    });
  }

  focusStar(): void {
    if (this.isTransitioning) return;
    this.cleanupFocus();
    this.isTransitioning = true;
    this.focusedPlanet   = null;

    this.focusTl = gsap.timeline({
      onComplete: () => { this.isTransitioning = false; }
    });

    this.focusTl.to(this.camera.position, {
      x: CAM_OVERVIEW.x, y: CAM_OVERVIEW.y, z: CAM_OVERVIEW.z,
      duration: 2.2, ease: 'power3.inOut',
      onUpdate: () => this.camera.lookAt(0, 0, 0)
    });
  }

  private cleanupFocus(): void {
    this.focusTl?.kill();
  }

  // ── Scene Building ────────────────────────────────────────────────────────

  private buildScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.FogExp2(0x000000, 0.008);
  }

  private buildCamera(): void {
    this.camera = new THREE.PerspectiveCamera(
      CAM_OVERVIEW.fov,
      this.canvas.clientWidth / this.canvas.clientHeight,
      0.1, 3000
    );
    this.camera.position.set(0, 50, 100);
  }

  private buildRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.renderer.toneMapping  = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFShadowMap;
  }

  private buildLighting(): void {
    // Warm Imperial star light
    const mainLight = new THREE.PointLight(0xffd090, 12, 200, 1.2);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(2048, 2048);
    this.scene.add(mainLight);

    // Cold ambient — deep space
    this.scene.add(new THREE.AmbientLight(0x111122, 0.3));

    // Subtle rim — hint of nebula
    const rimLight = new THREE.DirectionalLight(0x2233aa, 0.4);
    rimLight.position.set(-40, 20, -30);
    this.scene.add(rimLight);
  }

  private buildStarField(): void {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(STAR_COUNT * 3);
    const col = new Float32Array(STAR_COUNT * 3);

    for (let i = 0; i < STAR_COUNT; i++) {
      const i3 = i * 3;
      pos[i3]     = THREE.MathUtils.randFloatSpread(1200);
      pos[i3 + 1] = THREE.MathUtils.randFloatSpread(1200);
      pos[i3 + 2] = THREE.MathUtils.randFloatSpread(1200);

      // Mix of blue-white and warm stars
      const warmth = Math.random();
      col[i3]     = 0.8 + warmth * 0.2;
      col[i3 + 1] = 0.85 + warmth * 0.1;
      col[i3 + 2] = 0.9 + (1 - warmth) * 0.1;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));

    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 1.4, vertexColors: true, transparent: true, opacity: 0.85
    }));
    this.scene.add(this.stars);
  }

  private buildImperialStar(): void {
    const geo = new THREE.SphereGeometry(3.2, 64, 64);
    const mat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader:   IMPERIAL_STAR_SHADER.vertex,
      fragmentShader: IMPERIAL_STAR_SHADER.fragment
    });
    this.star = new THREE.Mesh(geo, mat);
    this.scene.add(this.star);

    this.starGlow = new THREE.Sprite(makeGlow(0xffe890, 0.85));
    this.starGlow.scale.setScalar(18);
    this.scene.add(this.starGlow);

    this.starCorona = new THREE.Sprite(makeGlow(0xffcc60, 0.25));
    this.starCorona.scale.setScalar(26);
    this.scene.add(this.starCorona);
  }

  private buildDeathStar(): void {
    // Pivot for orbital path
    this.deathStarOrbit = new THREE.Object3D();
    this.deathStarOrbit.rotation.y = Math.PI * 0.7;
    this.scene.add(this.deathStarOrbit);

    // Main sphere
    const geo = new THREE.SphereGeometry(2.2, 48, 48);
    const mat = new THREE.MeshStandardMaterial({
      color:     0x888890,
      emissive:  0x111114,
      roughness: 0.8,
      metalness: 0.3,
    });
    this.deathStar = new THREE.Mesh(geo, mat);
    this.deathStar.position.x = 35;
    this.deathStar.castShadow = true;
    this.deathStarOrbit.add(this.deathStar);

    // Superlaser dish indentation hint (flat circle)
    const dishGeo = new THREE.CircleGeometry(0.7, 32);
    const dishMat = new THREE.MeshStandardMaterial({
      color:    0x110000,
      emissive: 0xcc1111,
      emissiveIntensity: 0.8,
      side: THREE.DoubleSide
    });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.set(0, 1.5, 2.1);
    dish.rotation.x = Math.PI * 0.1;
    this.deathStar.add(dish);

    // Equatorial trench ring
    const trenchGeo = new THREE.TorusGeometry(2.22, 0.04, 8, 64);
    const trenchMat = new THREE.MeshStandardMaterial({ color: 0x555560, roughness: 1 });
    const trench = new THREE.Mesh(trenchGeo, trenchMat);
    trench.rotation.x = Math.PI / 2;
    this.deathStar.add(trench);

    // Orbit line
    const curve  = new THREE.EllipseCurve(0, 0, 35, 35);
    const points = curve.getPoints(128).map(p => new THREE.Vector3(p.x, 0, p.y));
    const orbitGeo = new THREE.BufferGeometry().setFromPoints(points);
    const orbitMat = new THREE.LineBasicMaterial({ color: 0x440808, transparent: true, opacity: 0.4 });
    this.scene.add(new THREE.LineLoop(orbitGeo, orbitMat));
  }

  private buildOrbits(): void {
    SW_PLANET_DATA.forEach(data => {
      const curve  = new THREE.EllipseCurve(0, 0, data.distance, data.distance);
      const points = curve.getPoints(128).map(p => new THREE.Vector3(p.x, 0, p.y));
      const geo    = new THREE.BufferGeometry().setFromPoints(points);
      const orbit  = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({
        color: 0x1a0808, transparent: true, opacity: 0.35
      }));
      this.scene.add(orbit);
      this.orbitLines.push(orbit);
    });
  }

  private buildPlanets(): void {
    SW_PLANET_DATA.forEach(data => {
      const pivot = new THREE.Object3D();
      pivot.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(pivot);

      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(data.size, 40, 40),
        new THREE.MeshStandardMaterial({
          color:            data.color,
          emissive:         data.emissive,
          emissiveIntensity: 0.4,
          roughness:        0.65,
          metalness:        0.05
        })
      );
      mesh.position.x  = data.distance;
      mesh.rotation.z  = data.tilt;
      mesh.castShadow  = true;
      mesh.receiveShadow = true;
      pivot.add(mesh);

      // Cloud layer
      let clouds: THREE.Mesh | undefined;
      if (data.cloudColor) {
        clouds = new THREE.Mesh(
          new THREE.SphereGeometry(data.size * 1.02, 32, 32),
          new THREE.MeshStandardMaterial({
            color: data.cloudColor, transparent: true, opacity: 0.3,
            depthWrite: false, roughness: 1
          })
        );
        mesh.add(clouds);
      }

      // Rings
      let rings: THREE.Mesh | undefined;
      if (data.hasRings) {
        const rGeo = new THREE.RingGeometry(data.size * 1.5, data.size * 2.4, 64);
        rings = new THREE.Mesh(rGeo, new THREE.MeshStandardMaterial({
          color: data.ringColor, side: THREE.DoubleSide, transparent: true, opacity: 0.4
        }));
        rings.rotation.x = Math.PI / 2.3;
        mesh.add(rings);
      }

      const glow = new THREE.Sprite(makeGlow(data.color, data.isRebelBase ? 0.5 : 0.3));
      glow.scale.setScalar(data.size * 4.5);
      mesh.add(glow);

      this.planets.push({ mesh, pivot, speed: data.speed, data, glow, clouds, rings });
    });
  }

  // ── Loop ─────────────────────────────────────────────────────────────────

  private introSequence(): void {
    gsap.to(this.camera.position, {
      x: CAM_OVERVIEW.x, y: CAM_OVERVIEW.y, z: CAM_OVERVIEW.z,
      duration: 5, ease: 'expo.out'
    });
  }

  animate = (): void => {
    this.rafId = requestAnimationFrame(this.animate);
    const delta   = this.clock.getDelta();
    const elapsed = this.clock.getElapsed();

    if (this.star.material instanceof THREE.ShaderMaterial) {
      this.star.material.uniforms['time'].value = elapsed;
    }

    // Planet orbits
    this.planets.forEach(p => {
      p.pivot.rotation.y += p.speed * 0.45;
      p.mesh.rotation.y  += delta * 0.3;
      if (p.clouds) p.clouds.rotation.y += delta * 0.08;
    });

    // Death Star slow orbit
    this.deathStarOrbit.rotation.y += delta * 0.004;
    this.deathStar.rotation.y      -= delta * 0.06;

    // Star field drift
    this.stars.rotation.y += delta * 0.008;

    // Camera follow / idle
    if (this.focusedPlanet && !this.isTransitioning) {
      const wp = new THREE.Vector3();
      this.focusedPlanet.mesh.getWorldPosition(wp);
      const off = new THREE.Vector3(0, this.focusedPlanet.data.size * 2.5, this.focusedPlanet.data.size * 6);
      this.camera.position.lerp(wp.clone().add(off), 0.04);
      this.camera.lookAt(wp);
    } else if (this.orbitEnabled && !this.isTransitioning) {
      const cx = Math.sin(elapsed * 0.04) * CAM_OVERVIEW.z;
      const cz = Math.cos(elapsed * 0.04) * CAM_OVERVIEW.z;
      this.camera.position.lerp(new THREE.Vector3(cx, CAM_OVERVIEW.y, cz), 0.008);
      this.camera.lookAt(0, 0, 0);
    }

    this.renderer.render(this.scene, this.camera);
  };

  destroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.focusTl?.kill();
    this.renderer.dispose();
    this.scene.traverse((obj: any) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose());
        else obj.material.dispose();
      }
    });
  }
}