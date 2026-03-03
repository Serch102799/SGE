import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServiciosExternosComponent } from './servicios-externos.component';

describe('ServiciosExternosComponent', () => {
  let component: ServiciosExternosComponent;
  let fixture: ComponentFixture<ServiciosExternosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ServiciosExternosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ServiciosExternosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
