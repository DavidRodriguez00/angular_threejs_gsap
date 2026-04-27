// builders/scene-lights.builder.ts
import * as THREE from 'three';

/**
 * SceneLightsBuilder
 * Creates cinematic lighting for the Galactic Senate scene:
 * - Deep blue ambient void
 * - Warm gold key light from above (the chancellor's spotlight)
 * - Cool blue fill from below/sides
 * - Rim light on Palpatine silhouette
 * - Scattered tiny blue point lights on senate pods
 */
export class SceneLightsBuilder {

  static build(scene: THREE.Scene): void {

    // ── Ambient — deep void blue ──────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0x080c1a, 0.8);
    scene.add(ambient);

    // ── Hemisphere — sky/ground bounce ───────────────────────────────────
    const hemi = new THREE.HemisphereLight(
      0x1a2040, // sky — cool blue
      0x0a0c14, // ground — near black
      0.6
    );
    scene.add(hemi);

    // ── Key light — gold from above center (Chancellor's spotlight) ───────
    const keyLight = new THREE.SpotLight(0xf0d070, 4);
    keyLight.position.set(0, 60, 0);
    keyLight.target.position.set(0, 15, 0); // Aim at speaker's pod
    keyLight.angle = 0.25;
    keyLight.penumbra = 0.5;
    keyLight.decay = 1.5;
    keyLight.distance = 120;
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 5;
    keyLight.shadow.camera.far = 130;
    scene.add(keyLight);
    scene.add(keyLight.target);

    // ── Fill light — cold blue from front low ────────────────────────────
    const fillLight = new THREE.DirectionalLight(0x1a3a6a, 0.5);
    fillLight.position.set(0, 5, 60);
    scene.add(fillLight);

    // ── Rim / backlight on Palpatine — strong from behind ────────────────
    // Positioned behind the speaker's pod to silhouette Palpatine
    const rimLight = new THREE.SpotLight(0xc9a84c, 3);
    rimLight.position.set(0, 25, -20);
    rimLight.target.position.set(0, -2, 25);
    rimLight.angle = 0.3;
    rimLight.penumbra = 0.6;
    rimLight.decay = 1.8;
    rimLight.distance = 80;
    scene.add(rimLight);
    scene.add(rimLight.target);

    // ── Side dramatic fill — deep purple from left ────────────────────────
    const sideLight = new THREE.PointLight(0x220044, 2, 100);
    sideLight.position.set(-50, 20, 10);
    scene.add(sideLight);

    // ── Senate floor ambient glow ─────────────────────────────────────────
    const floorGlow = new THREE.PointLight(0x1a2a4a, 1.5, 60);
    floorGlow.position.set(0, -2, 0);
    scene.add(floorGlow);

    // ── Scattered pod accent lights ───────────────────────────────────────
    const podLightPositions = [
      { x: 30, y: 12, z: 30, color: 0x2244aa },
      { x: -35, y: 18, z: 20, color: 0x1133bb },
      { x: 15, y: 25, z: -40, color: 0x334499 },
      { x: -20, y: 30, z: -35, color: 0x2255cc },
      { x: 50, y: 22, z: -15, color: 0x112288 },
      { x: -45, y: 15, z: 10, color: 0x1a3366 },
    ];

    podLightPositions.forEach(({ x, y, z, color }) => {
      const light = new THREE.PointLight(color, 0.8, 35);
      light.position.set(x, y, z);
      scene.add(light);
    });
  }
}
