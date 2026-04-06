import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SceneManagerService {
  private active: any;

  set(scene: any) {
    this.active = scene;
  }

  get() {
    return this.active;
  }
}