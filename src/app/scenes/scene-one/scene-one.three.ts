import * as THREE from 'three';
import gsap from 'gsap';
import { handleResize } from '../../shared/utils/three-utils';

// ── Types & Interfaces ───────────────────────────────────────────────────────

interface PlanetData {
  name:       string;
  size:       number;
  distance:   number;
  color:      number;
  emissive:   number;
  speed:      number;
  tilt:       number;
  hasRings?:  boolean;
  ringColor?: number;
}

export interface PlanetObject {
  mesh:  THREE.Mesh;
  pivot: THREE.Object3D;
  speed: number;
  data:  PlanetData;
  glow:  THREE.Sprite;
  rings?: THREE.Mesh;
}

// ── Constants ────────────────────────────────────────────────────────────────

export const PLANET_NAMES = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter'] as const;
export type PlanetName = typeof PLANET_NAMES[number];

const PLANET_DATA: PlanetData[] = [
  { name: 'Mercury', size: 0.28, distance: 6.0,  color: 0xb5a99a, emissive: 0x3a2f28, speed: 0.041, tilt: 0.03 },
  { name: 'Venus',   size: 0.55, distance: 9.0,  color: 0xe8c97a, emissive: 0x5a3e10, speed: 0.031, tilt: 0.05 },
  { name: 'Earth',   size: 0.58, distance: 12.5, color: 0x4a90e2, emissive: 0x0a2040, speed: 0.021, tilt: 0.41 },
  { name: 'Mars',    size: 0.40, distance: 16.0, color: 0xd4694a, emissive: 0x3a1208, speed: 0.015, tilt: 0.44 },
  { name: 'Jupiter', size: 1.10, distance: 22.0, color: 0xc8a96e, emissive: 0x2a1c0a, speed: 0.008, tilt: 0.05, hasRings: true, ringColor: 0x8a7055 },
];

const CAM_OVERVIEW = { x: 0, y: 15, z: 35, fov: 45 };
const STAR_COUNT = 4000;

// ── Shaders ──────────────────────────────────────────────────────────────────

const SUN_SHADER = {
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
      float noise = sin(vUv.y * 20.0 + time * 2.0) * 0.1;
      vec3 baseColor = vec3(1.0, 0.45, 0.05);
      float rim = pow(1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);
      gl_FragColor = vec4(baseColor + (rim * 0.6) + noise, 1.0);
    }
  `
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function createGlowMaterial(color: number, opacity: number): THREE.SpriteMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
  
  grad.addColorStop(0, `rgba(${r},${g},${b},${opacity})`);
  grad.addColorStop(0.5, `rgba(${r},${g},${b},${opacity * 0.3})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
}

// ── Class ────────────────────────────────────────────────────────────────────

export class SceneOneThree {
  private canvas: HTMLCanvasElement;
  private rafId: number | null = null;
  private clock = new THREE.Timer();

  // Estados
  public orbitEnabled = true;
  private isTransitioning = false;
  private focusedPlanet: PlanetObject | null = null;

  scene!:    THREE.Scene;
  camera!:   THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;

  sun!:       THREE.Mesh;
  sunGlow!:   THREE.Sprite;
  sunCorona!: THREE.Sprite; // <--- AÑADIR ESTA LÍNEA
  planets:    PlanetObject[] = [];
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
    this.buildEnvironment();
    this.buildSun();
    this.buildOrbits();
    this.buildPlanets();
    
    handleResize(this.camera, this.renderer, this.canvas);
    this.introSequence();
    this.animate();
  }

  // ── Camera & Focus Logic ───────────────────────────────────────────────────

  focusPlanet(name: PlanetName): void {
    const planet = this.planets.find(p => p.data.name === name);
    if (!planet || this.isTransitioning) return;

    this.cleanupFocus();
    this.isTransitioning = true;
    this.focusedPlanet = planet;

    const targetPos = new THREE.Vector3();
    planet.mesh.getWorldPosition(targetPos);

    this.focusTl = gsap.timeline({
      onComplete: () => { this.isTransitioning = false; }
    });

    // Zoom cinematográfico
    this.focusTl.to(this.camera.position, {
      duration: 2.5,
      x: targetPos.x + planet.data.size * 4,
      y: targetPos.y + planet.data.size * 2,
      z: targetPos.z + planet.data.size * 5,
      ease: 'expo.inOut',
      onUpdate: () => {
        const currentTarget = new THREE.Vector3();
        planet.mesh.getWorldPosition(currentTarget);
        this.camera.lookAt(currentTarget);
      }
    });
  }

  focusSun(): void {
    if (this.isTransitioning) return;
    this.cleanupFocus();
    this.isTransitioning = true;
    this.focusedPlanet = null;

    this.focusTl = gsap.timeline({
      onComplete: () => { this.isTransitioning = false; }
    });

    this.focusTl.to(this.camera.position, {
      x: CAM_OVERVIEW.x,
      y: CAM_OVERVIEW.y,
      z: CAM_OVERVIEW.z,
      duration: 2,
      ease: 'power3.inOut',
      onUpdate: () => this.camera.lookAt(0, 0, 0)
    });
  }

  private cleanupFocus(): void {
    if (this.focusTl) this.focusTl.kill();
  }

  // ── Core Building ──────────────────────────────────────────────────────────

  private buildScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020308);
  }

  private buildCamera(): void {
    this.camera = new THREE.PerspectiveCamera(
      CAM_OVERVIEW.fov, 
      this.canvas.clientWidth / this.canvas.clientHeight, 
      0.1, 2000
    );
    this.camera.position.set(0, 40, 80); // Posición inicial de entrada
  }

  private buildRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: this.canvas, 
      antialias: true, 
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
  }

  private buildLighting(): void {
    const sunLight = new THREE.PointLight(0xffffff, 10, 150, 1.1);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    this.scene.add(sunLight);

    this.scene.add(new THREE.AmbientLight(0x222244, 0.4));
  }

  private buildEnvironment(): void {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT * 3; i++) {
      pos[i] = (THREE.MathUtils.randFloatSpread(1000));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 1.2, color: 0xffffff, transparent: true, opacity: 0.7
    }));
    this.scene.add(this.stars);
  }

  private buildSun(): void {
    const sunGeo = new THREE.SphereGeometry(3, 64, 64);
    const sunMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: SUN_SHADER.vertex,
      fragmentShader: SUN_SHADER.fragment
    });
    this.sun = new THREE.Mesh(sunGeo, sunMat);
    this.scene.add(this.sun);

    this.sunGlow = new THREE.Sprite(createGlowMaterial(0xff7700, 0.8));
    this.sunGlow.scale.setScalar(15);
    this.scene.add(this.sunGlow);

    this.sunCorona = new THREE.Sprite(createGlowMaterial(0xff4400, 0.2));
    this.sunCorona.scale.setScalar(18);
    this.scene.add(this.sunCorona);
  }

  private buildOrbits(): void {
    PLANET_DATA.forEach(data => {
      const curve = new THREE.EllipseCurve(0, 0, data.distance, data.distance);
      const points = curve.getPoints(128).map(p => new THREE.Vector3(p.x, 0, p.y));
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const orbit = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ 
        color: 0x334466, transparent: true, opacity: 0.3 
      }));
      this.scene.add(orbit);
      this.orbitLines.push(orbit);
    });
  }

  private buildPlanets(): void {
    PLANET_DATA.forEach(data => {
      const pivot = new THREE.Object3D();
      pivot.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(pivot);

      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(data.size, 32, 32),
        new THREE.MeshStandardMaterial({
          color: data.color,
          emissive: data.emissive,
          emissiveIntensity: 0.3,
          roughness: 0.6,
          metalness: 0.1
        })
      );
      mesh.position.x = data.distance;
      mesh.rotation.z = data.tilt;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pivot.add(mesh);

      // Anillos para planetas gigantes
      let rings;
      if (data.hasRings) {
        const rGeo = new THREE.RingGeometry(data.size * 1.4, data.size * 2.2, 64);
        const rMat = new THREE.MeshStandardMaterial({ 
          color: data.ringColor, side: THREE.DoubleSide, transparent: true, opacity: 0.5 
        });
        rings = new THREE.Mesh(rGeo, rMat);
        rings.rotation.x = Math.PI / 2.2;
        mesh.add(rings);
      }

      const glow = new THREE.Sprite(createGlowMaterial(data.color, 0.3));
      glow.scale.setScalar(data.size * 4);
      mesh.add(glow);

      this.planets.push({ mesh, pivot, speed: data.speed, data, glow, rings });
    });
  }

  // ── Main Loop ──────────────────────────────────────────────────────────────

  private introSequence(): void {
    gsap.to(this.camera.position, {
      x: CAM_OVERVIEW.x,
      y: CAM_OVERVIEW.y,
      z: CAM_OVERVIEW.z,
      duration: 4,
      ease: 'expo.out'
    });
  }

  animate = (): void => {
    this.rafId = requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsed();

    // Plasma Sun update
    if (this.sun.material instanceof THREE.ShaderMaterial) {
      this.sun.material.uniforms['time'].value = elapsedTime;
    }

    // Movimiento planetario
    this.planets.forEach(p => {
      p.pivot.rotation.y += p.speed * 0.5;
      p.mesh.rotation.y += delta * 0.4;
    });

    this.stars.rotation.y += delta * 0.02;

    // Follow Logic
    if (this.focusedPlanet && !this.isTransitioning) {
      const worldPos = new THREE.Vector3();
      this.focusedPlanet.mesh.getWorldPosition(worldPos);
      
      const offset = new THREE.Vector3(0, this.focusedPlanet.data.size * 2, this.focusedPlanet.data.size * 5);
      this.camera.position.lerp(worldPos.clone().add(offset), 0.05);
      this.camera.lookAt(worldPos);
    } else if (this.orbitEnabled && !this.isTransitioning) {
      // Idle rotation
      const x = Math.sin(elapsedTime * 0.05) * CAM_OVERVIEW.z;
      const z = Math.cos(elapsedTime * 0.05) * CAM_OVERVIEW.z;
      this.camera.position.lerp(new THREE.Vector3(x, CAM_OVERVIEW.y, z), 0.01);
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