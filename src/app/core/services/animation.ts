import { Injectable } from '@angular/core';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

@Injectable({ providedIn: 'root' })
export class AnimationService {

  constructor() {
    gsap.registerPlugin(ScrollTrigger);
  }

  killAll() {
    ScrollTrigger.getAll().forEach(t => t.kill());
  }
}