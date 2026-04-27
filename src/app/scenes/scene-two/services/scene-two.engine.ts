// src/app/core/services/scene-two.engine.ts
import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Builders live inside the scene-two folder — same as senate-layout.builder.ts
// that you already have at src/app/scenes/scene-two/
import { SenateLayoutBuilder } from '../builders/senate-layout.builder';
import { SenatePodBuilder } from '../builders/senate-pod.builder';
import { SceneLightsBuilder } from '../builders/scene-lights.builder';

@Injectable({ providedIn: 'root' })
export class SceneTwoService {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId!: number;
  private clock = new THREE.Clock();
  private isRunning = false;

  senateGroup!: THREE.Group;
  palpatineGroup!: THREE.Group;
  centralPodium!: THREE.Group;

  // ── Init ──────────────────────────────────────────────────────────────────
  // src/app/core/services/scene-two.service.ts

  async init(container: HTMLDivElement, onProgress: (p: number) => void): Promise<void> {
    this.buildRenderer(container);
    this.buildCamera(container);
    this.buildScene();
    this.buildControls();

    // 1. Encender luces ANTES de la carga pesada
    SceneLightsBuilder.build(this.scene);

    // 2. Construir la geometría básica (el placeholder ya se verá)
    this.senateGroup = SenateLayoutBuilder.build(this.scene);
    this.centralPodium = SenatePodBuilder.buildCentralPodium(this.scene);

    // 3. Arrancar el renderizado INMEDIATAMENTE
    this.animate();

    window.addEventListener('resize', this.onResize.bind(this));

    // 4. Cargar modelos en segundo plano sin bloquear el render
    await this.loadModels(onProgress);
  }

  // ── Renderer ──────────────────────────────────────────────────────────────
  private buildRenderer(container: HTMLDivElement): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.6;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  private buildCamera(container: HTMLDivElement): void {
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 2000);
    // High overhead — GSAP will animate down during intro
    this.camera.position.set(0, 80, 60);
    this.camera.lookAt(0, 0, 0);
  }

  // ── Scene ─────────────────────────────────────────────────────────────────
  private buildScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020307);
    this.scene.fog = new THREE.FogExp2(0x020307, 0.008);
  }

  // ── Controls (cinematic — disabled for GSAP) ──────────────────────────────
  private buildControls(): void {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enabled = false;
  }

  // ── Load GLTF models ──────────────────────────────────────────────────────
  private async loadModels(onProgress: (p: number) => void): Promise<void> {
    const loader = new GLTFLoader();
    // const draco = new DRACOLoader();
    // draco.setDecoderPath('assets/draco/');
    // loader.setDRACOLoader(draco);

    const loadGLTF = (url: string, from: number, to: number) =>
      new Promise<THREE.Group>((resolve, reject) => {
        loader.load(
          url,
          (gltf) => resolve(gltf.scene),
          (xhr) => {
            if (xhr.total > 0) onProgress(from + (xhr.loaded / xhr.total) * (to - from));
          },
          reject
        );
      });

    // ── Palpatine ─────────────────────────────────────────────────────────
    try {
      const palpatineScene = await loadGLTF('assets/models/palpatine.glb', 0, 0.5);
      this.palpatineGroup = new THREE.Group();
      this.palpatineGroup.add(palpatineScene);
      this.palpatineGroup.scale.setScalar(2.5);
      this.palpatineGroup.position.set(0, -8, 28);
      this.palpatineGroup.rotation.y = Math.PI; // Back to camera

      palpatineScene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });

      this.scene.add(this.palpatineGroup);
    } catch {
      console.warn('[SceneTwo] palpatine.glb not found — using placeholder silhouette.');
      this.palpatineGroup = this.buildPalpatinePlaceholder();
      this.scene.add(this.palpatineGroup);
      onProgress(0.5);
    }

    // ── Senate pod model ──────────────────────────────────────────────────
    try {
      const podScene = await loadGLTF('assets/models/senatepod.glb', 0.5, 0.95);
      SenateLayoutBuilder.replaceWithModel(this.senateGroup, podScene);
    } catch {
      console.warn('[SceneTwo] senate_pod.glb not found — keeping procedural geometry.');
      onProgress(0.95);
    }

    onProgress(1);
  }

  // ── Palpatine procedural silhouette ───────────────────────────────────────
  private buildPalpatinePlaceholder(): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.8 });

    // Body (robe)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 3.8, 12), mat);
    body.position.y = 1.9;
    group.add(body);

    // Shoulders
    const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8, 0, Math.PI), mat);
    shoulders.position.y = 3.7;
    shoulders.rotation.x = Math.PI;
    group.add(shoulders);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), mat);
    head.position.y = 4.3;
    group.add(head);

    // Hood
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.9, 12), mat);
    hood.position.set(0, 4.85, -0.1);
    hood.rotation.x = 0.15;
    group.add(hood);

    group.scale.setScalar(2.5);
    group.position.set(0, -8, 28);
    group.rotation.y = Math.PI;
    return group;
  }

  // ── Render loop ───────────────────────────────────────────────────────────
  private animate(): void {
    this.isRunning = true;
    this.animationId = requestAnimationFrame(this.animate.bind(this));
    const delta = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();

    // Subtle idle senate rotation
    if (this.senateGroup) this.senateGroup.rotation.y += delta * 0.015;

    // Subtle cloak sway
    if (this.palpatineGroup) {
      this.palpatineGroup.rotation.z = Math.sin(elapsed * 0.4) * 0.008;
    }

    this.renderer.render(this.scene, this.camera);
  }

  // ── Resize ────────────────────────────────────────────────────────────────
  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ── Public getters (used by AnimationsService) ────────────────────────────
  getCamera(): THREE.PerspectiveCamera { return this.camera; }
  getSenateGroup(): THREE.Group { return this.senateGroup; }

  // ── Pause / Resume (called by IScene hide/show) ───────────────────────────
  pause(): void {
    if (!this.isRunning) return;
    cancelAnimationFrame(this.animationId);
    this.isRunning = false;
  }

  resume(): void {
    if (this.isRunning || !this.renderer) return;
    this.isRunning = true;
    this.animate();
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  dispose(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.onResize.bind(this));

    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => (m as THREE.Material).dispose());
      }
    });

    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}