import { Component } from '@angular/core';
import { ScrollContainerComponent } from './layout/scroll-container/scroll-container';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ScrollContainerComponent],
  template: `<app-scroll-container></app-scroll-container>`
})
export class AppComponent {}