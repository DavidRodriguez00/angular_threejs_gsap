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

import { SpaceEngine } from './scene-three.galaxy';
import { NebulaEngine } from './scene-three.nebula';
import { SpaceLogoManager } from './scene-three.logo';
import { animateSpace } from './scene-three.animations';
import { SpaceScrollHandler } from './scene-three.scroll';
import { ScrollService } from '../../core/services/scroll.service';
import { IScene } from '../../core/services/scene-manager.service';

@Component({
    selector: 'app-scene-three',
    templateUrl: './scene-three.html',
    styleUrls: ['./scene-three.css'],
    standalone: true
})
export class SceneThreeComponent implements AfterViewInit, IScene {
    show(): void {
        const el = this.hostRef.nativeElement;

        this.zone.runOutsideAngular(() => {
            gsap.killTweensOf(el);

            gsap.to(el, {
                opacity: 1,
                duration: 0.8,
                ease: 'power2.out'
            });

            // Reactivar render loop si estaba parado
            if (!this.frame) {
                this.start();
            }
        });
    }

    hide(): void {
        const el = this.hostRef.nativeElement;

        this.zone.runOutsideAngular(() => {
            gsap.killTweensOf(el);

            gsap.to(el, {
                opacity: 0,
                duration: 0.8,
                ease: 'power2.in'
            });

            // 🔥 Opcional pero MUY recomendable (performance)
            if (this.frame) {
                cancelAnimationFrame(this.frame);
                this.frame = null;
            }
        });
    }

    // ======================
    // REFS
    // ======================
    readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('spaceCanvas');

    private platformId = inject(PLATFORM_ID);
    private zone = inject(NgZone);
    private destroyRef = inject(DestroyRef);
    private hostRef = inject(ElementRef);
    private scrollService = inject(ScrollService);

    // ======================
    // ENGINES
    // ======================
    private space!: SpaceEngine;
    private nebula!: NebulaEngine;
    private logo!: SpaceLogoManager;
    private scroll!: SpaceScrollHandler;

    // ======================
    // LOOP
    // ======================
    private clock = new THREE.Timer();
    private frame: number | null = null;

    private mouse = new THREE.Vector2();
    private targetMouse = new THREE.Vector2();

    private resizeObserver!: ResizeObserver;

    // ======================
    // LIFECYCLE
    // ======================
    ngAfterViewInit(): void {
        if (!isPlatformBrowser(this.platformId)) return;

        this.zone.runOutsideAngular(() => {
            this.init();
            this.listen();
            this.bindScroll();

            this.destroyRef.onDestroy(() => this.dispose());
        });
    }

    // ======================
    // INIT
    // ======================
    private init() {
        const canvas = this.canvasRef().nativeElement;

        this.space = new SpaceEngine(canvas);
        this.nebula = new NebulaEngine(this.space.scene, this.space.camera);
        this.logo = new SpaceLogoManager(this.space.scene);

        this.scroll = new SpaceScrollHandler(
            this.space.camera,
            this.logo.container // ✅ ahora coincide con tu manager nuevo
        );

        this.loadLogo();
    }

    private async loadLogo() {
        try {
            await this.logo.load('/assets/models/starwars.glb');

            this.logo.container.position.set(0, 0, 140);

            // 👇 importante: usar intro() (no playIntro)
            this.logo.intro(() => {
                console.log('Logo ready');
            });

        } catch (err) {
            console.error('Logo load error:', err);
        }
    }

    // ======================
    // SCROLL
    // ======================
    private bindScroll() {
        this.scrollService.sectionChange$
            ?.pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(progress => {
                this.scroll.updateByProgress(progress);
            });
    }

    // ======================
    // LISTENERS
    // ======================
    private listen() {
        this.resizeObserver = new ResizeObserver(() => {
            this.space.onResize();
        });

        this.resizeObserver.observe(this.hostRef.nativeElement);

        window.addEventListener('mousemove', this.onMouseMove);
    }

    private onMouseMove = (e: MouseEvent) => {
        this.targetMouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
        this.targetMouse.y = -(e.clientY / window.innerHeight - 0.5) * 0.5;
    };

    // ======================
    // LOOP
    // ======================
    private start() {
        this.playIntro();
        this.loop();
    }

    private loop = () => {
        this.frame = requestAnimationFrame(this.loop);

        const time = this.clock.getElapsed();

        this.smoothMouse();
        this.update(time);
        this.space.render();
    };

    private smoothMouse() {
        this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.05;
        this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.05;
    }

    private update(time: number) {
        this.space.update(time);
        this.nebula.update(time);

        animateSpace(
            this.space.camera,
            null as any,
            this.logo.container,
            time,
            this.mouse
        );

        this.logo.update(time, this.mouse);
    }

    // ======================
    // INTRO GLOBAL
    // ======================
    private playIntro() {
        this.space.setExposure(0.1);

        const proxy = { v: 0.1 };

        gsap.to(proxy, {
            v: 1,
            duration: 3.2,
            ease: 'power2.inOut',
            onUpdate: () => this.space.setExposure(proxy.v)
        });

        this.space.camera.position.z = 600;

        gsap.to(this.space.camera.position, {
            z: 150,
            duration: 4.2,
            ease: 'expo.inOut'
        });
    }

    // ======================
    // CLEANUP
    // ======================
    private dispose() {
        if (this.frame) cancelAnimationFrame(this.frame);

        window.removeEventListener('mousemove', this.onMouseMove);
        this.resizeObserver.disconnect();

        this.space.dispose();
        this.nebula.dispose();
        this.logo.dispose();
    }
}