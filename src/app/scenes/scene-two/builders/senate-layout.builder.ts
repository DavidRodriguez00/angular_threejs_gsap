// builders/senate-layout.builder.ts
import * as THREE from 'three';

type PodTransform = {
  position: THREE.Vector3;
  rotation: THREE.Euler;
};

export class SenateLayoutBuilder {

  // ── Configuración central ──────────────────────────────────────────────────
  private static readonly CONFIG = {
    RING_COUNT: 18,
    BASE_RADIUS: 14,
    RADIUS_STEP: 7,

    HEIGHT_STEP: 3.2,
    HEIGHT_CURVE: 0.09,

    POD_BASE_COUNT: 6,
    POD_GROWTH: 3.8,

    TILT_BASE: 6,
    TILT_GROWTH: 1.2,

    FLOOR_RADIUS: 180,
    WALL_HEIGHT: 120,
  };

  // ── Geometrías reutilizadas (MUY IMPORTANTE) ───────────────────────────────
  private static geometries = {
    platform: new THREE.CylinderGeometry(2.2, 2.0, 0.35, 16),
    rim: new THREE.TorusGeometry(2.1, 0.1, 6, 24),
    dome: new THREE.SphereGeometry(0.55, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    stem: new THREE.CylinderGeometry(0.15, 0.15, 2.5, 8),
  };

  // ── Build principal ───────────────────────────────────────────────────────
  static build(scene: THREE.Scene): THREE.Group {
    const group = new THREE.Group();

    const transforms: PodTransform[] = [];

    // ── Generar layout (solo datos) ─────────────────────────────────────────
    for (let ring = 0; ring < this.CONFIG.RING_COUNT; ring++) {

      const radius = this.CONFIG.BASE_RADIUS + ring * this.CONFIG.RADIUS_STEP;
      const height =
        ring * this.CONFIG.HEIGHT_STEP +
        ring * ring * this.CONFIG.HEIGHT_CURVE;

      const podsInRing = Math.round(
        this.CONFIG.POD_BASE_COUNT + ring * this.CONFIG.POD_GROWTH
      );

      const tiltAngle = THREE.MathUtils.degToRad(
        this.CONFIG.TILT_BASE + ring * this.CONFIG.TILT_GROWTH
      );

      for (let i = 0; i < podsInRing; i++) {
        const angle = (i / podsInRing) * Math.PI * 2;

        const position = new THREE.Vector3(
          Math.cos(angle) * radius,
          height,
          Math.sin(angle) * radius
        );

        const rotation = new THREE.Euler(
          tiltAngle,
          angle + Math.PI,
          0
        );

        transforms.push({ position, rotation });
      }
    }

    // ── Crear pods optimizados ──────────────────────────────────────────────
    const pods = this.buildInstancedPods(transforms);
    group.add(pods);

    // ── Entorno ─────────────────────────────────────────────────────────────
    group.add(this.createFloor());
    group.add(this.createWall());

    scene.add(group);
    return group;
  }

  // ── Instanced pods (CLAVE DE RENDIMIENTO) ─────────────────────────────────
  private static buildInstancedPods(transforms: PodTransform[]): THREE.Group {
    const group = new THREE.Group();

    const material = new THREE.MeshStandardMaterial({
      color: 0x2a2c38,
      roughness: 0.6,
      metalness: 0.4,
    });

    const mesh = new THREE.InstancedMesh(
      this.geometries.platform,
      material,
      transforms.length
    );

    const dummy = new THREE.Object3D();

    transforms.forEach((t, i) => {
      dummy.position.copy(t.position);
      dummy.rotation.copy(t.rotation);
      dummy.updateMatrix();

      mesh.setMatrixAt(i, dummy.matrix);
    });

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    group.add(mesh);

    // 👉 EXTRA: puedes añadir aquí más instanced meshes (rim, dome, etc.)
    // si quieres máximo rendimiento

    return group;
  }

  // ── Floor ────────────────────────────────────────────────────────────────
  private static createFloor(): THREE.Mesh {
    const geo = new THREE.CircleGeometry(
      this.CONFIG.FLOOR_RADIUS,
      64
    );

    const mat = new THREE.MeshStandardMaterial({
      color: 0x1a1c24,
      roughness: 0.9,
      metalness: 0.1,
    });

    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    floor.receiveShadow = true;

    return floor;
  }

  // ── Wall ─────────────────────────────────────────────────────────────────
  private static createWall(): THREE.Mesh {
    const geo = new THREE.CylinderGeometry(
      this.CONFIG.FLOOR_RADIUS,
      this.CONFIG.FLOOR_RADIUS,
      this.CONFIG.WALL_HEIGHT,
      64,
      1,
      true
    );

    const mat = new THREE.MeshStandardMaterial({
      color: 0x141620,
      roughness: 1,
      side: THREE.BackSide,
    });

    const wall = new THREE.Mesh(geo, mat);
    wall.position.y = this.CONFIG.WALL_HEIGHT / 4;

    return wall;
  }

  // ── Reemplazo con modelo real (mejorado) ─────────────────────────────────
  static replaceWithModel(
    senateGroup: THREE.Group,
    podModel: THREE.Group
  ): void {
    const transforms: PodTransform[] = [];

    senateGroup.children.forEach((child) => {
      if (child instanceof THREE.InstancedMesh) {
        const dummy = new THREE.Object3D();

        for (let i = 0; i < child.count; i++) {
          child.getMatrixAt(i, dummy.matrix);
          dummy.matrix.decompose(
            dummy.position,
            dummy.quaternion,
            dummy.scale
          );

          transforms.push({
            position: dummy.position.clone(),
            rotation: new THREE.Euler().setFromQuaternion(dummy.quaternion),
          });
        }

        senateGroup.remove(child);
      }
    });

    // Normalizar escala
    const box = new THREE.Box3().setFromObject(podModel);
    const size = box.getSize(new THREE.Vector3());
    const scale = 2.2 / Math.max(size.x, size.y, size.z);

    transforms.forEach(({ position, rotation }) => {
      const clone = podModel.clone();

      clone.scale.setScalar(scale);
      clone.position.copy(position);
      clone.rotation.copy(rotation);

      clone.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });

      senateGroup.add(clone);
    });
  }
}