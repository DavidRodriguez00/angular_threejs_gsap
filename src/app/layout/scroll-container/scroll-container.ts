import {
  Component,
  AfterViewInit,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

import { ScrollService } from '../../core/services/scroll.service';
import { SceneManagerService, IScene } from '../../core/services/scene-manager.service';
import { LoggerService } from '../../core/services/logger.service';

import { SceneOneComponent } from '../../scenes/scene-one/scene-one';
import { SceneTwoComponent } from '../../scenes/scene-two/scene-two';
import { SceneThreeComponent } from '../../scenes/scene-three/scene-three';
import { SceneTenComponent } from '../../scenes/scene-ten/scene-ten';

@Component({
  selector: 'app-scroll-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #scrollContainer
      class="scroll-container"
      role="main"
      aria-label="Main content with scrollable scenes"
    >
    <app-scene-one  #scene></app-scene-one>
    <app-scene-two #scene></app-scene-two>
    <app-scene-three #scene></app-scene-three>
    <app-scene-ten  #scene></app-scene-ten>
    </div>
  `,
  styleUrls: ['./scroll-container.css'],
  imports: [SceneOneComponent, SceneTwoComponent, SceneThreeComponent, SceneTenComponent],
})
export class ScrollContainerComponent implements AfterViewInit {
  @ViewChild('scrollContainer') private scrollRef!: ElementRef<HTMLElement>;
  // Single template-ref name — QueryList preserves DOM order
  @ViewChildren('scene') private sceneList!: QueryList<IScene>;

  private readonly scrollService = inject(ScrollService);
  private readonly sceneManager = inject(SceneManagerService);
  private readonly logger = inject(LoggerService);
  // DestroyRef injected at construction time → safe to use in takeUntilDestroyed
  private readonly destroyRef = inject(DestroyRef);

  ngAfterViewInit(): void {
    const el = this.scrollRef?.nativeElement;

    if (!el) {
      this.logger.warn('ScrollContainerComponent: scroll ref not available');
      return;
    }

    const scenes = this.sceneList.toArray();

    if (scenes.length === 0) {
      this.logger.warn('ScrollContainerComponent: no scenes found');
      return;
    }

    this.scrollService.initializeScroll(el);
    this.sceneManager.registerScenes(scenes);
    this.bindScrollToScenes();

    this.logger.info(
      `ScrollContainerComponent: initialized with ${scenes.length} scenes`,
    );
  }

  // ── Private ──────────────────────────────────────────────────────────

  private bindScrollToScenes(): void {
    // 1. Snapping y activación de escenas (Lo que ya tienes)
    this.scrollService.currentSection$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(index => this.sceneManager.activateScene(index));

    // 2. ANIMACIÓN FLUIDA: Enviar progreso a la escena activa
    this.scrollService.state$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(state => {
        const activeScene = this.sceneList.toArray()[state.section];

        // Si la escena tiene el método que arregla el logo y cámara
        if (activeScene && 'updateByProgress' in activeScene) {
          // state.progress es un valor de 0 a 1 dentro de la sección actual
          (activeScene as any).updateByProgress(state.progress);
        }
      });
  }
}