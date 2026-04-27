# scene-two — Galactic Senate

Escena Three.js + GSAP para Angular 17+ (Standalone Components).

## Estructura de archivos

```
scene-two/
├── scene-two.ts                ← Componente Angular
├── scene-two.html              ← Template con overlay de texto
├── scene-two.css               ← Estilos (Cinzel + EB Garamond)
│
├── services/
│   ├── scene-two.service.ts              ← Three.js: renderer, cámara, modelos
│   └── scene-two-animations.ts           ← GSAP: zoom-in + fade-in + scroll
│
└── builders/
    ├── senate-layout.builder.ts          ← Rings concéntricos de pods
    ├── senate-pod.builder.ts             ← Podio central del Canciller
    └── scene-lights.builder.ts           ← Iluminación cinemática
```

## Dependencias

```bash
npm install three @types/three gsap
```

## Assets requeridos

Coloca tus modelos en `src/assets/models/`:

```
src/assets/models/
├── palpatine.glb        ← Tu modelo de Palpatine
└── senate_pod.glb       ← Tu modelo de asiento/nave del senado
```

El componente tiene fallback procedural si los modelos no se encuentran.

Para Draco compressed models:

```bash
# Copia los decoders de three.js
cp -r node_modules/three/examples/jsm/libs/draco/ src/assets/draco/
```

## Integración en rutas

```typescript
// app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'scene-two',
    loadComponent: () =>
      import('./scene-two').then((m) => m.SceneTwoComponent),
  },
];
```

## Animación — 3 fases

| Fase | Duración | Qué hace |
|------|----------|----------|
| **1. Camera zoom-in** | 0s → 3.5s | Cámara cae desde lo alto hacia el senado |
| **2. Text fade-in** | 2.8s → 5.5s | Título, subtítulo y cita aparecen en stagger |
| **3. Scroll trigger** | scroll | Cámara sigue descendiendo mientras el usuario scrollea |

## Comportamiento con modelos

- **Con modelos reales**: Los pods procedurales se reemplazan por instancias del `.glb`
- **Sin modelos**: El builder procedural crea la geometría completa, incluido Palpatine como silueta

## Customización rápida

| Qué cambiar | Archivo | Variable |
|-------------|---------|----------|
| Número de anillos del senado | `senate-layout.builder.ts` | `RING_COUNT` |
| Posición inicial de cámara | `scene-two.service.ts` | `camera.position` en `buildCamera()` |
| Timing de animaciones | `scene-two-animations.service.ts` | segundos en `masterTl` |
| Texto de la escena | `scene-two.component.html` | Directamente en el template |
| Colores cinemáticos | `scene-lights.builder.ts` | Colores de cada `THREE.Light` |
