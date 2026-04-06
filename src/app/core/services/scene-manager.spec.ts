import { TestBed } from '@angular/core/testing';

import { SceneManagerService } from './scene-manager';

describe('SceneManagerService', () => {
  let service: SceneManagerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SceneManagerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
