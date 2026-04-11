import {
    Component,
    ElementRef,
    AfterViewInit,
    inject,
    PLATFORM_ID,
    viewChild,
    NgZone,
    DestroyRef
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import * as THREE from 'three';
import gsap from 'gsap';

import { SpaceEngine } from './scene-two.galaxy';
import { NebulaEngine } from './scene-two.nebula';
import { SpaceDeathstarManager } from './scene-two.deathstar';
import { animateSpace } from './scene-two.animations';
import { SpaceScrollHandler } from './scene-two.scroll';
import { ScrollService } from '../../core/services/scroll.service';
import { IScene } from '../../core/services/scene-manager.service';

// ─── Estado de la cámara que se guarda al salir y se restaura al entrar ───────
interface CameraSnapshot {
    z: number;
    fov: number;
    exposure: number;
}

// Valores "en reposo" a los que siempre volvemos tras el intro
const RESTING_CAMERA: CameraSnapshot = {
    z: 200,
    fov: 52,
    exposure: 1.0,
};

@Component({
    selector: 'app-scene-two',
    templateUrl: './scene-two.html',
    styleUrls: ['./scene-two.css'],
    standalone: true
})
export class SceneTwoComponent implements AfterViewInit, IScene {

    // =========================================================================
    // IScene – show / hide
    // =========================================================================

    show(): void {
        this.zone.runOutsideAngular(() => {
            // Reanudar render loop si estaba pausado
            if (!this.frame) this.loop();

            if (!this._hasPlayedIntro) {
                // ── PRIMERA VEZ: secuencia completa ──────────────────────────
                this._hasPlayedIntro = true;
                this.playIntro();
            } else {
                // ── VISITAS POSTERIORES: entrada suave ───────────────────────
                this.playEnter();
            }
        });
    }

    hide(): void {
        this.zone.runOutsideAngular(() => {
            this.playExit(() => {
                // Pausar render loop para ahorrar GPU mientras no se ve
                if (this.frame) {
                    cancelAnimationFrame(this.frame);
                    this.frame = null;
                }
            });
        });
    }

    // =========================================================================
    // REFS
    // =========================================================================
    readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('spaceCanvas');

    private platformId = inject(PLATFORM_ID);
    private zone = inject(NgZone);
    private destroyRef = inject(DestroyRef);
    private hostRef = inject(ElementRef);
    private scrollService = inject(ScrollService);

    // =========================================================================
    // ENGINES
    // =========================================================================
    private space!: SpaceEngine;
    private nebula!: NebulaEngine;
    private deathstar!: SpaceDeathstarManager;
    private scroll!: SpaceScrollHandler;

    // =========================================================================
    // LOOP
    // =========================================================================
    private clock = new THREE.Timer();
    private frame: number | null = null;

    private mouse = new THREE.Vector2();
    private targetMouse = new THREE.Vector2();

    private resizeObserver!: ResizeObserver;

    // ── Guards de estado ──────────────────────────────────────────────────────
    /** Evita repetir la secuencia de intro completa en visitas posteriores. */
    private _hasPlayedIntro = false;

    /** Evita lanzar playEnter/playExit cuando ya hay una transición en curso. */
    private _transitioning = false;

    // =========================================================================
    // LIFECYCLE
    // =========================================================================
    ngAfterViewInit(): void {
        if (!isPlatformBrowser(this.platformId)) return;

        this.zone.runOutsideAngular(() => {
            this.init();
            this.listen();
            // this.bindScroll();

            this.destroyRef.onDestroy(() => this.dispose());
        });
    }

    // =========================================================================
    // INIT
    // =========================================================================
    private init(): void {
        const canvas = this.canvasRef().nativeElement;

        this.space = new SpaceEngine(canvas);
        this.nebula = new NebulaEngine(this.space.scene);
        this.deathstar = new SpaceDeathstarManager(this.space.scene);

        this.scroll = new SpaceScrollHandler(
            this.space.camera,
            this.deathstar.container,
            this.deathstar
        );

        this.loaddeathstar();
    }

    // En scene-two.ts -> loaddeathstar()
    private async loaddeathstar(): Promise<void> {
        try {
            await this.deathstar.load('/assets/models/deathstar.glb');
            // Si a 2.2 se ve bien, inicialízala cerca de ese valor
            this.deathstar.container.scale.setScalar(1);
            this.deathstar.container.position.set(0, 0, 0);

        } catch (err) {
            console.error('deathstar load error:', err);
        }
    }

    // =========================================================================
    // SCROLL
    // =========================================================================
    // private bindScroll() {
    //     this.scrollService.sectionChange$
    //         ?.pipe(takeUntilDestroyed(this.destroyRef))
    //         .subscribe(progress => this.scroll.updateByProgress(progress));
    // }

    // =========================================================================
    // LISTENERS
    // =========================================================================
    private listen(): void {
        this.resizeObserver = new ResizeObserver(() => this.space.onResize());
        this.resizeObserver.observe(this.hostRef.nativeElement);
        window.addEventListener('mousemove', this.onMouseMove);
    }

    private onMouseMove = (e: MouseEvent): void => {
        this.targetMouse.x = (e.clientX / window.innerWidth - 0.5) * 0.5;
        this.targetMouse.y = -(e.clientY / window.innerHeight - 0.5) * 0.5;
    };

    // =========================================================================
    // LOOP
    // =========================================================================
    private loop = (): void => {
        this.frame = requestAnimationFrame(this.loop);

        const time = this.clock.getElapsed();

        this.smoothMouse();
        this.update(time);
        this.space.render();
    };

    private smoothMouse(): void {
        this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.5;
        this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.05;
    }

    private update(time: number): void {
        this.space.update(time);
        this.nebula.update(time);

        animateSpace(
            this.space.camera,
            null as any,
            this.deathstar.container,
            time,
            this.mouse
        );

        this.deathstar.update(time, this.mouse);
    }

    // =========================================================================
    // TRANSICIONES
    // =========================================================================

    /**
     * INTRO (solo la primera vez).
     * Cámara viaja desde Z=600 → Z=150, exposición 0.1 → 1.0
     * y el deathstar hace su animación cinemática completa.
     */
    private playIntro(): void {
        const el = this.hostRef.nativeElement;

        // Aseguramos visibilidad del host
        gsap.killTweensOf(el);
        gsap.to(el, { opacity: 1, duration: 0.6, ease: 'power2.out' });

        // Cámara y exposición desde cero
        this.space.setExposure(0.1);
        this.space.camera.position.z = 300;

        const proxy = { v: 0.1 };
        gsap.to(proxy, {
            v: RESTING_CAMERA.exposure,
            duration: 3.2,
            ease: 'power2.inOut',
            onUpdate: () => this.space.setExposure(proxy.v),
        });

        gsap.to(this.space.camera.position, {
            z: RESTING_CAMERA.z,
            duration: 4.2,
            ease: 'expo.inOut',
        });

        // deathstar: esperamos a que esté cargado antes de lanzar intro
        if (this.deathstar.isReady) {
            this.deathstar.intro();
        } else {
            // Si la carga aún no terminó, esperamos con polling ligero
            const wait = setInterval(() => {
                if (this.deathstar.isReady) {
                    clearInterval(wait);
                    this.deathstar.intro();
                }
            }, 100);
        }
    }

    /**
     * ENTER (visitas 2, 3, …).
     * Fade-in del host + cámara vuelve a su posición de reposo suavemente
     * + deathstar aparece con fade de escala desde 0.7 → escala actual.
     */
    private playEnter(): void {
        if (this._transitioning) return;
        this._transitioning = true;

        const el = this.hostRef.nativeElement;
        const tl = gsap.timeline({
            onComplete: () => { this._transitioning = false; }
        });

        // 1. Host visible
        tl.to(el, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0);

        // 2. Exposición de galaxia sube desde el valor actual → reposo
        const proxyIn = { v: this.space['renderer'].toneMappingExposure };
        tl.to(proxyIn, {
            v: RESTING_CAMERA.exposure,
            duration: 1.2,
            ease: 'power2.out',
            onUpdate: () => this.space.setExposure(proxyIn.v),
        }, 0);

        // 3. Cámara vuelve suavemente a su Z de reposo
        tl.to(this.space.camera.position, {
            z: RESTING_CAMERA.z,
            duration: 2,
            ease: 'power3.out',
        }, 0);

        // 4. FOV vuelve a reposo
        const proxyFov = { fov: this.space.camera.fov };
        tl.to(proxyFov, {
            fov: RESTING_CAMERA.fov,
            duration: 1.4,
            ease: 'power3.out',
            onUpdate: () => {
                this.space.camera.fov = proxyFov.fov;
                this.space.camera.updateProjectionMatrix();
            },
        }, 0);

        // 5. deathstar: scale-up suave desde 0.75 (recoge desde donde quedó el exit)
        tl.to(this.deathstar.container.scale, {
            x: 1, y: 1, z: 1,
            duration: 1.0,
            ease: 'back.out(1.4)',
        }, 0.1);

        // 6. Opacidad del deathstar (a través de los materiales emisivos)
        //    Reutilizamos el método de pulso; no hacemos nada extra aquí.
    }

    /**
     * EXIT (al salir de la escena).
     * Inversa visual del enter: deathstar se encoge, exposición baja, host fade-out.
     * Callback al completar para que el caller pause el render loop.
     */
    private playExit(onComplete?: () => void): void {
        if (this._transitioning) {
            onComplete?.();
            return;
        }
        this._transitioning = true;

        const el = this.hostRef.nativeElement;
        const tl = gsap.timeline({
            maker: true,
            onComplete: () => {
                this._transitioning = false;
                onComplete?.();
            }
        });

        // 1. deathstar se encoge y "se aleja"
        tl.to(this.deathstar.container.scale, {
            x: 0.75, y: 0.75, z: 0.75,
            duration: 0.9,
            ease: 'power2.in',
        }, 0);

        // 2. Cámara retrocede ligeramente (sensación de alejamiento)
        tl.to(this.space.camera.position, {
            z: RESTING_CAMERA.z + 100,
            duration: 0.9,
            ease: 'power2.in',
        }, 0);

        // 3. Exposición baja (universo se oscurece)
        const proxyOut = { v: this.space['renderer'].toneMappingExposure };
        tl.to(proxyOut, {
            v: 0.3,
            duration: 0.7,
            ease: 'power2.in',
            onUpdate: () => this.space.setExposure(proxyOut.v),
        }, 0);

        // 4. Host fade-out (el más largo marca la duración total de la transición)
        tl.to(el, {
            opacity: 0,
            duration: 0.8,
            ease: 'power2.in',
        }, 0.1);
    }

    // =========================================================================
    // CLEANUP
    // =========================================================================
    private dispose(): void {
        if (this.frame) cancelAnimationFrame(this.frame);

        window.removeEventListener('mousemove', this.onMouseMove);
        this.resizeObserver?.disconnect();

        this.space.dispose();
        this.nebula.dispose();
        this.deathstar.dispose();
    }
}