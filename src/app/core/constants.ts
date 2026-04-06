/**
 * Application-wide constants for configuration and magic numbers
 */
export const APP_CONFIG = {
  // Scroll & Animation
  SCROLL_SNAP_DURATION: 0.6,
  SCROLL_SNAP_DELAY: 150,
  SCENE_FADE_DURATION: 0.5,
  SCENE_INIT_DELAY: 50,
  
  // Canvas & Rendering
  CAMERA_FOV: 75,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 1000,
  INITIAL_CAMERA_Z: 5,
  
  // Responsive
  MOBILE_BREAKPOINT: 768,
  TABLET_BREAKPOINT: 1024,
  
  // Performance
  DEBOUNCE_DURATION: 150,
  RESIZE_OBSERVER_ENABLED: true,
} as const;

export const SCENE_CONFIG = {
  ONE: {
    name: 'Scene One',
    description: 'Interactive cube, sphere & torus animation',
    colors: {
      cube: 0x00ff00,
      sphere: 0xff0000,
      torus: 0xff00ff,
    },
  },
  TWO: {
    name: 'Scene Two',
    description: 'Blue sphere with rotating cube',
    colors: {
      sphere: 0x0000ff,
      cube: 0x00ff00,
    },
  },
  THREE: {
    name: 'Scene Three',
    description: 'Golden sphere with cyan cylinder',
    colors: {
      sphere: 0xffaa00,
      cylinder: 0x00ffff,
    },
  },
} as const;
