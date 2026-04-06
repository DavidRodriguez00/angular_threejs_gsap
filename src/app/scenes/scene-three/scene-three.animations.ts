import * as THREE from 'three';

const CONFIG = {
    // Movimiento de cámara: parallax suave al mouse
    CAMERA_PARALLAX_X: 3.5,
    CAMERA_PARALLAX_Y: 2.0,
    CAMERA_LERP:       0.035,   // más lento = más orgánico

    // Respiración de cámara: micro-deriva periódica
    BREATHE_AMP_X:  0.6,
    BREATHE_AMP_Y:  0.4,
    BREATHE_FREQ_X: 0.18,
    BREATHE_FREQ_Y: 0.11,

    // Logo
    FLOAT_AMP:      0.25,
    FLOAT_FREQ:     0.38,
};

/**
 * Controla:
 * 1. Parallax de cámara al mouse + respiración periódica
 * 2. Rotación muy suave de la capa galaxy (GalaxyManager)
 * 3. Flotación orgánica del logo
 *
 * NOTA: el engine.update() ya mueve las capas de estrellas/cúmulos.
 * Esta función solo gestiona cámara y objetos de primer plano.
 */
export const animateSpace = (
    camera:      THREE.PerspectiveCamera,
    stars:       THREE.Points,
    logoGroup:   THREE.Group,
    time:        number,
    mouse:       THREE.Vector2 | { x: number; y: number } = { x: 0, y: 0 }
): void => {

    // ── 1. Capa de galaxia auxiliar (GalaxyManager) ───────────────────────
    // Rotación diferencial propia — muy lenta, eje Y + balanceo Z mínimo
    if (stars) {
        stars.rotation.y = time * 0.004;
        stars.rotation.z = Math.sin(time * 0.07) * 0.012;
    }

    // ── 2. Logo: flotación orgánica ────────────────────────────────────────
    if (logoGroup) {
        // Combinación de dos sinusoides para evitar periodicidad obvia
        logoGroup.position.y = 5
            + Math.sin(time * CONFIG.FLOAT_FREQ) * CONFIG.FLOAT_AMP
            + Math.cos(time * CONFIG.FLOAT_FREQ * 0.61) * CONFIG.FLOAT_AMP * 0.4;

        // Inclinación muy sutil con el tiempo
        logoGroup.rotation.z = Math.sin(time * 0.3) * 0.018;
    }

    // ── 3. Cámara: parallax mouse + respiración ───────────────────────────
    // Target X/Y: suma del parallax del mouse + onda de respiración periódica
    const breathX = Math.sin(time * CONFIG.BREATHE_FREQ_X) * CONFIG.BREATHE_AMP_X;
    const breathY = Math.cos(time * CONFIG.BREATHE_FREQ_Y) * CONFIG.BREATHE_AMP_Y;

    const targetX = mouse.x * CONFIG.CAMERA_PARALLAX_X + breathX;
    const targetY = mouse.y * CONFIG.CAMERA_PARALLAX_Y + breathY;

    // Lerp: movimiento fluido no robótico
    camera.position.x += (targetX - camera.position.x) * CONFIG.CAMERA_LERP;
    camera.position.y += (targetY - camera.position.y) * CONFIG.CAMERA_LERP;

    // Foco: siempre al centro de la escena
    camera.lookAt(0, 0, 0);
};