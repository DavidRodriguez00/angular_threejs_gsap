import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ScrollService {
  scrollTo(y: number) {
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
}