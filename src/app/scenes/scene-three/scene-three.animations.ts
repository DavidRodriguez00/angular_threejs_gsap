import * as THREE from 'three';

const CONFIG = {
  PARALLAX_X:  1.2,
  PARALLAX_Y:  0.8,
  LERP:        0.03,
  BREATHE_AMP: 0.06,
  BREATHE_FREQ: 0.22,
};

/**
 * Parallax de cámara con ratón y micro-respiración.
 * Espejo funcional de animateSpace() de scene-one, adaptado al planeta de lava.
 */
export function animateLava(
  camera:  THREE.PerspectiveCamera,
  time:    number,
  mouse:   { x: number; y: number } = { x: 0, y: 0 }
): void {
  const breathX = Math.sin(time * CONFIG.BREATHE_FREQ) * CONFIG.BREATHE_AMP;
  const breathY = Math.cos(time * CONFIG.BREATHE_FREQ * 0.7) * CONFIG.BREATHE_AMP;

  const targetX = mouse.x * CONFIG.PARALLAX_X + breathX;
  const targetY = mouse.y * CONFIG.PARALLAX_Y + breathY;

  camera.position.x += (targetX - camera.position.x) * CONFIG.LERP;
  camera.position.y += (targetY - camera.position.y) * CONFIG.LERP;

  // Mantener la mirada ligeramente hacia el centro del planeta
  camera.lookAt(0, 0.2, 0);
}