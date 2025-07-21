import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistroEntradaInsumoComponent } from './registro-entrada-insumo.component';

describe('RegistroEntradaInsumoComponent', () => {
  let component: RegistroEntradaInsumoComponent;
  let fixture: ComponentFixture<RegistroEntradaInsumoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RegistroEntradaInsumoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegistroEntradaInsumoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
