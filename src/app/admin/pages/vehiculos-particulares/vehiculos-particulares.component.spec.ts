import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VehiculosParticularesComponent } from './vehiculos-particulares.component';

describe('VehiculosParticularesComponent', () => {
  let component: VehiculosParticularesComponent;
  let fixture: ComponentFixture<VehiculosParticularesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VehiculosParticularesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VehiculosParticularesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
