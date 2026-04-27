// src/app/scenes/scene-two/scene-two.ts
import {
  Component,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewInit,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IScene } from '../../core/services/scene-manager.service';
import { SceneTwoService } from './services/scene-two.engine';
import { SceneTwoAnimations } from './services/scene-two-animations';

@Component({
  selector: 'app-scene-two',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scene-two.html',
  styleUrls: ['./scene-two.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneTwoComponent implements IScene, AfterViewInit, OnDestroy {

  // ── ViewChild ─────────────────────────────────────────────────────────────
  @ViewChild('canvasContainer', { static: true })
  private canvasRef!: ElementRef<HTMLDivElement>;

  @ViewChild('overlayText', { static: true })
  private overlayRef!: ElementRef<HTMLDivElement>;

  @ViewChild('titleEl', { static: true })
  private titleRef!: ElementRef<HTMLHeadingElement>;

  @ViewChild('subtitleEl', { static: true })
  private subtitleRef!: ElementRef<HTMLParagraphElement>;

  @ViewChild('quoteEl', { static: true })
  private quoteRef!: ElementRef<HTMLElement>;

  @ViewChild('scrollIndicator', { static: true })
  private scrollRef!: ElementRef<HTMLDivElement>;

  // ── State ─────────────────────────────────────────────────────────────────
  isLoading = true;
  loadingProgress = 0;

  private initialized = false;
  private destroyed = false;

  constructor(
    private sceneService: SceneTwoService,
    private animationsService: SceneTwoAnimations,
    private cdr: ChangeDetectorRef
  ) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngAfterViewInit(): void {
    // Ocultar inicialmente (lazy render)
    this.setHostVisible(false);
  }

  ngOnDestroy(): void {
    this.destroyed = true;

    try {
      this.sceneService.dispose();
      this.animationsService.dispose();
    } catch (e) {
      console.warn('SceneTwo destroy error:', e);
    }
  }

  // ── IScene API ────────────────────────────────────────────────────────────
  async show(): Promise<void> {
    if (this.destroyed) return;

    this.setHostVisible(true);

    if (!this.initialized) {
      await this.initScene();
    } else {
      this.sceneService.resume();
      this.animationsService.playIntroSequence();
    }
  }

  hide(): void {
    if (this.destroyed) return;

    this.setHostVisible(false);

    if (this.initialized) {
      this.sceneService.pause();
      this.animationsService.dispose();
    }
  }

  // ── Init lazy ─────────────────────────────────────────────────────────────
  private async initScene(): Promise<void> {
    if (this.initialized || this.destroyed) return;

    this.initialized = true;

    try {
      await this.sceneService.init(
        this.canvasRef.nativeElement,
        (progress: number) => {
          if (this.destroyed) return;

          this.loadingProgress = Math.round(progress * 100);
          this.mark();
        }
      );

      if (this.destroyed) return;

      this.isLoading = false;
      this.mark();

      this.initAnimations();

    } catch (err) {
      console.error('SceneTwo init failed:', err);
    }
  }

  // ── Animaciones ───────────────────────────────────────────────────────────
  private initAnimations(): void {
    this.animationsService.init({
      overlayText: this.overlayRef.nativeElement,
      title: this.titleRef.nativeElement,
      subtitle: this.subtitleRef.nativeElement,
      quote: this.quoteRef.nativeElement,
      scrollIndicator: this.scrollRef.nativeElement,
      canvasContainer: this.canvasRef.nativeElement,
      camera: this.sceneService.getCamera(),
      senateGroup: this.sceneService.getSenateGroup(),
    });

    this.animationsService.playIntroSequence();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private setHostVisible(visible: boolean): void {
    const el = this.canvasRef?.nativeElement;
    if (!el) return;

    const host =
      (el.closest('app-scene-two') as HTMLElement) ??
      (el.closest('section') as HTMLElement);

    if (!host) return;

    // Keep layout height stable (100vh) so global section scrolling does not collapse.
    host.style.display = '';
    host.style.visibility = visible ? 'visible' : 'hidden';
    host.style.pointerEvents = visible ? '' : 'none';
  }

  private mark(): void {
    if (!this.destroyed) {
      this.cdr.markForCheck();
    }
  }
}
