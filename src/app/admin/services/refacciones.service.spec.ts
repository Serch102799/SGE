import { TestBed } from '@angular/core/testing';

import { RefaccionesService } from './refacciones.service';

describe('RefaccionesService', () => {
  let service: RefaccionesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RefaccionesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
