import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViajesTurismoComponent } from './viajes-turismo.component';

describe('ViajesTurismoComponent', () => {
  let component: ViajesTurismoComponent;
  let fixture: ComponentFixture<ViajesTurismoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ViajesTurismoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViajesTurismoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
