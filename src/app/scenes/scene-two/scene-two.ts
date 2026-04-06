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

import { SceneTwoThree, SWPlanetName, SW_PLANET_NAMES } from './scene-two.three';
import { SceneTwoAnimations }                             from './scene-two.animations';
import { LoggerService }                                  from '../../core/services/logger.service';
import { IScene }                                         from '../../core/services/scene-manager.service';
import { APP_CONFIG }                                     from '../../core/constants';

// ── Static planet data for HUD readouts ──────────────────────────────────────

interface PlanetHUD {
  sector:     string;
  population: string;
  status:     string;
  isRebel:    boolean;
  directive:  string;
}

const SW_HUD_DATA: Record<SWPlanetName, PlanetHUD> = {
  Coruscant: {
    sector:     'CORE WORLDS',
    population: '1 TRIL',
    status:     'IMPERIAL',
    isRebel:    false,
    directive:  'Seat of the Galactic Empire — all loyalty is sworn here'
  },
  Tatooine: {
    sector:     'OUTER RIM',
    population: '200,000',
    status:     'NEUTRAL',
    isRebel:    false,
    directive:  'Two suns burn over a world the Empire ignores — for now'
  },
  Hoth: {
    sector:     'OUTER RIM',
    population: 'MINIMAL',
    status:     '⚠ REBEL BASE',
    isRebel:    true,
    directive:  'Echo Base detected — dispatch Blizzard Force immediately'
  },
  Endor: {
    sector:     'OUTER RIM',
    population: '30 MIL',
    status:     '⚠ HOSTILE',
    isRebel:    true,
    directive:  'Rebel Alliance consolidating forces — fleet mobilised'
  },
  Mustafar: {
    sector:     'OUTER RIM',
    population: 'CLASSIFIED',
    status:     'LORD VADER',
    isRebel:    false,
    directive:  'Fortress Vader — approach only with express clearance'
  },
  Alderaan: {
    sector:     'CORE WORLDS',
    population: '2 BIL',
    status:     '⚠ INSURGENT',
    isRebel:    true,
    directive:  'Bail Organa suspected — superweapon authorization pending'
  },
};

const DEFAULT_DIRECTIVE = 'The power of the dark side is absolute';

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-scene-two',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './scene-two.html',
  styleUrls:  ['./scene-two.css'],
})
export class SceneTwoComponent implements AfterViewInit, OnDestroy, IScene {
  @ViewChild('canvas',       { static: true }) private canvasRef!:  ElementRef<HTMLCanvasElement>;
  @ViewChild('imperialClock',{ static: true }) private clockRef?:   ElementRef<HTMLSpanElement>;
  @ViewChild('alertOverlay', { static: true }) private alertRef?:   ElementRef<HTMLDivElement>;

  readonly planetNames = SW_PLANET_NAMES;

  readonly activePlanet = signal<SWPlanetName | null>(null);

  private three:      SceneTwoThree      | null = null;
  private animations: SceneTwoAnimations | null = null;
  private initTimer?:  ReturnType<typeof setTimeout>;
  private clockTimer?: ReturnType<typeof setInterval>;
  private fadeTween?:  gsap.core.Tween;
  private sessionStart = Date.now();

  private readonly logger = inject(LoggerService);
  private readonly zone   = inject(NgZone);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    this.initTimer = setTimeout(() => this.initScene(), APP_CONFIG.SCENE_INIT_DELAY);
    this.startImperialClock();
  }

  ngOnDestroy(): void {
    if (this.initTimer)  clearTimeout(this.initTimer);
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.fadeTween?.kill();
    this.safeDestroy();
  }

  // ── IScene ────────────────────────────────────────────────────────────────

  show(): void {
    const el = this.canvasRef?.nativeElement;
    if (!el) return;
    this.zone.runOutsideAngular(() => {
      this.fadeTween?.kill();
      this.fadeTween = gsap.to(el, {
        opacity: 1,
        duration: APP_CONFIG.SCENE_FADE_DURATION,
        ease: 'power2.out',
        onStart: () => this.animations?.play()
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

  // ── Interaction ───────────────────────────────────────────────────────────

  onChipClick(name: SWPlanetName): void {
    if (!this.three) return;

    const next = this.activePlanet() === name ? null : name;
    this.activePlanet.set(next);
    this.updateHUDReadout(next);

    this.zone.runOutsideAngular(() => {
      if (next) this.three?.focusPlanet(next);
      else      this.three?.focusStar();
    });
  }

  /** Template helper — returns true for rebel planets (for CSS class) */
  isRebelPlanet(name: SWPlanetName): boolean {
    return SW_HUD_DATA[name]?.isRebel ?? false;
  }

  /** Template helper — 3-letter designation tag */
  getPlanetTag(name: SWPlanetName): string {
    return name.slice(0, 3).toUpperCase();
  }

  // ── Imperial Calendar ─────────────────────────────────────────────────────

  private startImperialClock(): void {
    const format = () => {
      const elapsed = (Date.now() - this.sessionStart) / 1000;
      const yr  = Math.floor(elapsed / 86400);
      const day = Math.floor((elapsed % 86400) / 3600);
      const hr  = Math.floor(elapsed % 3600 / 60);
      return `${yr}.${String(day).padStart(2,'0')}.${String(hr).padStart(2,'0')} ABY`;
    };

    const el = this.clockRef?.nativeElement;
    if (el) el.textContent = format();

    this.clockTimer = setInterval(() => {
      const el = this.clockRef?.nativeElement;
      if (el) el.textContent = format();
    }, 60_000);
  }

  // ── HUD Readouts ──────────────────────────────────────────────────────────

  private updateHUDReadout(planet: SWPlanetName | null): void {
    const bodyEl   = document.getElementById('swBodyName');
    const sectorEl = document.getElementById('swSector');
    const popEl    = document.getElementById('swPop');
    const statEl   = document.getElementById('swStatus');
    const dirEl    = document.getElementById('directiveText');

    if (planet) {
      const d = SW_HUD_DATA[planet];
      if (bodyEl)   bodyEl.textContent   = planet.toUpperCase();
      if (sectorEl) sectorEl.textContent = d.sector;
      if (popEl)    popEl.textContent    = d.population;
      if (statEl)   statEl.textContent   = d.status;
      if (dirEl)    dirEl.textContent    = d.directive;
    } else {
      if (bodyEl)   bodyEl.textContent   = 'CORUSCANT';
      if (sectorEl) sectorEl.textContent = 'CORE WORLDS';
      if (popEl)    popEl.textContent    = '1 TRIL';
      if (statEl)   statEl.textContent   = 'IMPERIAL';
      if (dirEl)    dirEl.textContent    = DEFAULT_DIRECTIVE;
    }
  }

  // ── Scene Management ──────────────────────────────────────────────────────

  private initScene(): void {
    try {
      const canvas = this.canvasRef.nativeElement;
      this.zone.runOutsideAngular(() => {
        this.three      = new SceneTwoThree(canvas);
        this.three.init();
        this.animations = new SceneTwoAnimations(this.three);
        this.animations.init();
        this.show();
      });
      this.logger.info('Scene Two — Galactic Empire · Death Star Orbital Command Ready');
    } catch (err) {
      this.logger.error('Scene Two failed to boot', err);
    }
  }

  private safeDestroy(): void {
    this.zone.runOutsideAngular(() => {
      try {
        this.animations?.destroy();
        this.three?.destroy();
      } catch (err) {
        this.logger.error('Scene Two cleanup error', err);
      } finally {
        this.three = null;
        this.animations = null;
      }
    });
  }
}