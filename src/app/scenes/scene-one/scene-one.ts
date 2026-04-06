import {
  Component,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ChangeDetectionStrategy,
  inject,
  NgZone,
  signal,
} from '@angular/core';
import gsap from 'gsap';

import { SceneOneThree, PlanetName, PLANET_NAMES } from './scene-one.three';
import { SceneOneAnimations }                       from './scene-one.animations';
import { LoggerService }                            from '../../core/services/logger.service';
import { IScene }                                   from '../../core/services/scene-manager.service';
import { APP_CONFIG }                               from '../../core/constants';

@Component({
  selector: 'app-scene-one',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scene-one.html',
  styleUrls:  ['./scene-one.css'],
})
export class SceneOneComponent implements AfterViewInit, OnDestroy, IScene {
  @ViewChild('canvas', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;

  // Usamos readonly para datos estáticos
  readonly planetNames = PLANET_NAMES;
  
  /** Signal para el estado de la UI (Chip activo) */
  readonly activePlanet = signal<PlanetName | null>(null);

  private three:      SceneOneThree      | null = null;
  private animations: SceneOneAnimations | null = null;
  private initTimer?: any;
  private fadeTween?: gsap.core.Tween;

  private readonly logger = inject(LoggerService);
  private readonly zone   = inject(NgZone);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    // Retraso controlado para asegurar que el DOM y el hardware estén listos
    this.initTimer = setTimeout(() => this.initScene(), APP_CONFIG.SCENE_INIT_DELAY);
  }

  ngOnDestroy(): void {
    if (this.initTimer) clearTimeout(this.initTimer);
    this.fadeTween?.kill();
    this.safeDestroy();
  }

  // ── IScene Implementation ──────────────────────────────────────────────────

  show(): void {
    const el = this.canvasRef?.nativeElement;
    if (!el) return;

    this.zone.runOutsideAngular(() => {
      this.fadeTween?.kill();
      this.fadeTween = gsap.to(el, {
        opacity: 1,
        duration: APP_CONFIG.SCENE_FADE_DURATION,
        ease: 'power2.out',
        onStart: () => {
          // Aseguramos que las animaciones internas se reanuden
          this.animations?.play();
        }
      });
    });
  }

  hide(): void {
    const el = this.canvasRef?.nativeElement;
    if (!el) return;

    this.zone.runOutsideAngular(() => {
      this.fadeTween?.kill();
      this.fadeTween = gsap.to(el, {
        opacity: 0,
        duration: APP_CONFIG.SCENE_FADE_DURATION,
        ease: 'power2.in',
        onComplete: () => this.animations?.pause()
      });
    });
  }

  // ── Interacciones ─────────────────────────────────────────────────────────

  onChipClick(name: PlanetName): void {
    if (!this.three) return;

    // Lógica de toggle: si pulsas el mismo, vuelves al sol (null)
    const nextPlanet = this.activePlanet() === name ? null : name;
    
    // Actualizamos el signal (esto refresca la UI de Angular)
    this.activePlanet.set(nextPlanet);

    // Ejecutamos el movimiento de cámara fuera de la zona de Angular
    this.zone.runOutsideAngular(() => {
      if (nextPlanet) {
        this.three?.focusPlanet(nextPlanet);
      } else {
        this.three?.focusSun();
      }
    });
  }

  // ── Gestión de Escena ─────────────────────────────────────────────────────

  private initScene(): void {
    try {
      const canvas = this.canvasRef.nativeElement;

      this.zone.runOutsideAngular(() => {
        // Inicialización del motor gráfico
        this.three = new SceneOneThree(canvas);
        this.three.init();

        // Inicialización de la lógica de animación
        this.animations = new SceneOneAnimations(this.three);
        this.animations.init();
        
        // Lanzamos la entrada visual
        this.show();
      });

      this.logger.info('Scene One — Glass Orrery (Kinetic Engine) Ready');
    } catch (err) {
      this.logger.error('Scene One failed to boot', err);
    }
  }

  private safeDestroy(): void {
    this.zone.runOutsideAngular(() => {
      try {
        this.animations?.destroy();
        this.three?.destroy();
      } catch (err) {
        this.logger.error('Error during scene cleanup', err);
      } finally {
        this.three = null;
        this.animations = null;
      }
    });
  }
}