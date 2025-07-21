import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RefaccionesComponent } from './refacciones.component';

describe('RefaccionesComponent', () => {
  let component: RefaccionesComponent;
  let fixture: ComponentFixture<RefaccionesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RefaccionesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RefaccionesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
