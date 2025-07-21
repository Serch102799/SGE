import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EntradasInsumoComponent } from './entradas-insumo.component';

describe('EntradasInsumoComponent', () => {
  let component: EntradasInsumoComponent;
  let fixture: ComponentFixture<EntradasInsumoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EntradasInsumoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EntradasInsumoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
