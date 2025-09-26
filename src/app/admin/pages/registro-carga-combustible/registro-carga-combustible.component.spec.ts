import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistroCargaCombustibleComponent } from './registro-carga-combustible.component';

describe('RegistroCargaCombustibleComponent', () => {
  let component: RegistroCargaCombustibleComponent;
  let fixture: ComponentFixture<RegistroCargaCombustibleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RegistroCargaCombustibleComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegistroCargaCombustibleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
