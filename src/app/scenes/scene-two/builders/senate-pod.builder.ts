// builders/senate-pod.builder.ts
import * as THREE from 'three';

/**
 * SenatePodBuilder
 * Builds the central Chancellor's podium — the elevated platform
 * at the heart of the Galactic Senate chamber, with the vertical
 * column and speaker's lectern.
 */
export class SenatePodBuilder {

  static buildCentralPodium(scene: THREE.Scene): THREE.Group {
    const group = new THREE.Group();

    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x1c1e28,
      roughness: 0.5,
      metalness: 0.7,
    });

    const goldAccent = new THREE.MeshStandardMaterial({
      color: 0xc9a84c,
      roughness: 0.3,
      metalness: 0.9,
      emissive: 0x3a2a00,
      emissiveIntensity: 0.3,
    });

    // ── Main platform disc ──────────────────────────────────────────────────
    const platformGeo = new THREE.CylinderGeometry(8, 8.5, 1, 32);
    const platform = new THREE.Mesh(platformGeo, darkMetal);
    platform.castShadow = true;
    platform.receiveShadow = true;
    group.add(platform);

    // ── Platform rim ────────────────────────────────────────────────────────
    const rimGeo = new THREE.TorusGeometry(8.25, 0.2, 8, 48);
    const rim = new THREE.Mesh(rimGeo, goldAccent);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.5;
    group.add(rim);

    // ── Inner circular walkway ───────────────────────────────────────────────
    const walkGeo = new THREE.RingGeometry(4, 7.8, 48);
    const walkMat = new THREE.MeshStandardMaterial({
      color: 0x242634,
      roughness: 0.7,
      metalness: 0.3,
    });
    const walk = new THREE.Mesh(walkGeo, walkMat);
    walk.rotation.x = -Math.PI / 2;
    walk.position.y = 0.52;
    group.add(walk);

    // ── Central vertical column ──────────────────────────────────────────────
    const colGeo = new THREE.CylinderGeometry(0.4, 0.5, 14, 16);
    const column = new THREE.Mesh(colGeo, darkMetal);
    column.position.y = 7.5;
    column.castShadow = true;
    group.add(column);

    // Column gold accent stripes
    for (let i = 0; i < 5; i++) {
      const stripeGeo = new THREE.TorusGeometry(0.45, 0.06, 6, 20);
      const stripe = new THREE.Mesh(stripeGeo, goldAccent);
      stripe.rotation.x = Math.PI / 2;
      stripe.position.y = 2 + i * 2.5;
      group.add(stripe);
    }

    // ── Speaker's pod (top of column) ────────────────────────────────────────
    const speakerPlatGeo = new THREE.CylinderGeometry(2.5, 2.8, 0.5, 24);
    const speakerPlat = new THREE.Mesh(speakerPlatGeo, darkMetal);
    speakerPlat.position.y = 14.8;
    speakerPlat.castShadow = true;
    group.add(speakerPlat);

    const speakerRimGeo = new THREE.TorusGeometry(2.65, 0.12, 6, 28);
    const speakerRim = new THREE.Mesh(speakerRimGeo, goldAccent);
    speakerRim.rotation.x = Math.PI / 2;
    speakerRim.position.y = 15.1;
    group.add(speakerRim);

    // ── Lectern / console ────────────────────────────────────────────────────
    const lecternGeo = new THREE.BoxGeometry(1.4, 0.8, 0.6);
    const lectern = new THREE.Mesh(lecternGeo, darkMetal);
    lectern.position.set(0, 15.6, -1.0);
    group.add(lectern);

    // Console screen glow
    const screenGeo = new THREE.PlaneGeometry(0.9, 0.4);
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x2244aa,
      emissive: 0x112266,
      emissiveIntensity: 2,
    });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 15.65, -0.69);
    group.add(screen);

    // ── Point light on speaker's pod ─────────────────────────────────────────
    const podLight = new THREE.PointLight(0xc9a84c, 2, 20);
    podLight.position.y = 16;
    group.add(podLight);

    // ── Base support rings ────────────────────────────────────────────────────
    [3, 6].forEach((r) => {
      const baseGeo = new THREE.CylinderGeometry(r, r + 0.3, 0.3, 32);
      const base = new THREE.Mesh(baseGeo, darkMetal);
      base.position.y = -0.3;
      group.add(base);
    });

    group.position.set(0, 0, 0);
    scene.add(group);
    return group;
  }
}
