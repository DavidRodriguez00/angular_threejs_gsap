# Angular Three.js GSAP - Professional Interactive Web Experience

A high-performance, production-ready web application featuring smooth scroll-snap animations powered by Angular, Three.js, and GSAP.

## 🎯 Features

### Core Features
- **Smooth Scroll Navigation**: Intelligent scroll snapping between fullscreen sections
- **Interactive 3D Scenes**: Three beautiful Three.js scenes with custom animations
- **GSAP Animations**: Smooth, performant animations using GSAP library
- **Responsive Design**: Fully responsive across all device sizes
- **OnPush Change Detection**: Optimized Angular performance with OnPush strategy
- **TypeScript Strict Mode**: Type-safe codebase for better maintainability

### Professional Features
- **Service-Based Architecture**: Scalable, decoupled services
- **Error Handling**: Comprehensive error boundaries and logging
- **Performance Optimized**: Debounced scroll events, efficient rendering
- **Accessibility (a11y)**: ARIA labels, semantic HTML, keyboard support
- **CSS Variables**: Themeable design system with customizable colors
- **Mobile First**: Touch-friendly design with specific mobile optimizations
- **Browser Support**: Modern browsers (Chrome, Firefox, Safari, Edge)

## 📁 Project Structure

```
src/
├── app/
│   ├── core/
│   │   ├── constants.ts          # Application-wide constants
│   │   └── services/
│   │       ├── scroll.service.ts      # Scroll management
│   │       ├── scene-manager.service.ts # Scene lifecycle
│   │       └── logger.service.ts      # Logging utility
│   ├── layout/
│   │   └── scroll-container/
│   │       ├── scroll-container.ts
│   │       └── scroll-container.css
│   ├── scenes/
│   │   ├── scene-one/           # Cube, Sphere, Torus animation
│   │   ├── scene-two/           # Sphere & Cube interaction
│   │   └── scene-three/         # Sphere & Cylinder animation
│   ├── app.ts                   # Root component
│   └── app.config.ts            # App config
├── styles.css                   # Global styles with CSS variables
├── main.ts                      # Entry point
└── index.html
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

## 🎮 Usage

### Basic Navigation
- **Scroll**: Navigate between scenes
- **Auto-Snap**: Scenes automatically snap to fullscreen
- **Keyboard**: (Optional) Arrow keys for navigation

### Architecture

#### Services

**ScrollService**
- Manages scroll state and snapping behavior
- Provides RxJS observables for reactive updates
- Debounces scroll events for performance

**SceneManagerService**
- Manages scene lifecycle (show/hide)
- Tracks active scene
- Provides scene registration interface

**LoggerService**
- Centralized logging with log levels
- Development vs production mode support
- Ready for external error reporting integration

#### Components

All scene components implement the `IScene` interface:
```typescript
export interface IScene {
  show(): void;
  hide(): void;
}
```

**ScrollContainerComponent**
- OnPush change detection for optimal performance
- Coordinates scene management
- Handles scroll event delegation

**Scene Components** (SceneOne, SceneTwo, SceneThree)
- OnPush change detection enabled
- Three.js scene initialization
- Animation lifecycle management
- Proper error handling and cleanup

## 🎨 Customization

### Colors & Theme
Edit CSS variables in `styles.css`:

```css
:root {
  --color-bg-primary: #000000;
  --color-accent-1: #00ff00;  /* Green */
  --color-accent-2: #0000ff;  /* Blue */
  --color-accent-3: #ff00ff;  /* Magenta */
}
```

### Animation Timing
Adjust in `src/app/core/constants.ts`:

```typescript
export const APP_CONFIG = {
  SCROLL_SNAP_DURATION: 0.6,      // Snap animation duration
  SCENE_FADE_DURATION: 0.5,       // Fade in/out duration
  SCROLL_SNAP_DELAY: 150,         // Debounce delay
  // ... more configs
};
```

### Add New Scenes
1. Create new scene component in `src/app/scenes/`
2. Implement `IScene` interface
3. Add to `ScrollContainerComponent` template
4. Register in scroll container initialization

## 📊 Performance

- **Change Detection**: OnPush strategy on all components
- **Event Debouncing**: 150ms debounce on scroll events
- **Memory Leaks**: Proper cleanup with RxJS takeUntilDestroyed
- **Bundle Size**: Optimized with tree-shaking
- **Rendering**: Three.js scenes only render when visible

## ♿ Accessibility

- Semantic HTML with proper headings
- ARIA labels on interactive elements
- Keyboard navigation support
- Color contrast compliance
- Reduced motion support via prefers-reduced-motion

## 🔐 Browser Support

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | Latest | ✓ |
| Firefox | Latest | ✓ |
| Safari | 14+ | ✓ |
| Edge | Latest | ✓ |
| Mobile Safari | 14+ | ✓ |
| Chrome Mobile | Latest | ✓ |

## 📦 Dependencies

- **@angular/core**: 21.2.0
- **three**: 0.183.2
- **gsap**: 3.14.2
- **rxjs**: 7.8.0

## 🛠️ Development

```bash
# Watch mode
npm run watch

# Run tests
npm run test

# Build production bundle
npm run build
```

## 📝 Code Standards

- TypeScript strict mode enabled
- No implicit `any`
- No property access from index signature
- No implicit returns
- Proper error handling throughout
- JSDoc comments on public APIs

## 🚀 Production Deployment

1. Build the project:
   ```bash
   npm run build
   ```

2. Deploy `dist/` folder to your web server

3. Set up redirects for SPA routing:
   ```
   Redirect all requests to index.html (except assets)
   ```

4. Enable gzip compression on server

5. Set cache headers:
   ```
   dist/*.js: 1 year
   dist/*.css: 1 year
   index.html: no-cache
   ```

## 🐛 Debugging

Enable debug logging by setting environment:
```typescript
// In logger.service.ts
private isDevelopment(): boolean {
  return document.location.hostname.match(/localhost|127\.0\.0\.1/);
}
```

## 📄 License

MIT

## 👨‍💻 Contributing

1. Follow TypeScript strict mode
2. Use OnPush change detection
3. Implement proper error handling
4. Add comments for complex logic
5. Test on multiple devices

---

**Built with ❤️ using Angular, Three.js, and GSAP**
